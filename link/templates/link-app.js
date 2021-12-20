/** 
 * タマリンク.
 * @author FUJII Kenichi <fujii.kenichi@tamariva.co.jp>
 */
"use strict";

// バックグラウンドタスクを繰り返すときの待ち時間(ミリ秒).
const BACKGROUND_TASK_INTERVAL = 15 * 1000;

// シーンタグの数.
const SCENE_TAG_COUNT = 4;

// コンテキストタグの数.
const CONTEXT_TAG_COUNT = 6;

// ダウンロードルールの数.
const DOWNLOAD_RULE_COUNT = 6;

// シーンで未使用とみなす色の名前.
const SCENE_NOT_USED_COLOR = "black";

// ダウンロードルールで未使用とみなすタグの名前.
const RULE_NOT_USED_VALUE = "NOT_USED";

// タグの値として入力された文字列の検証用正規表現.
const TAG_NAME_VALIDATOR = /[\s\,\:\;\&\"\'\`\¥\|\~\%\/\\<\>\?\\\*]/m;

// 現在アプリでサインインしているユーザーを示す変数(新規作成時の初期値を含む).
let current_user = {
    dummy_id: "{{APP_DATABASE_CURRENT_USER}}",
    user_id: "",
    username: "",
    encrypted_password: "",
    delete_after_download: true, // ダウンロード後にファイルを削除するかどうか.
    chart: "context"
};

// データベース(IndexedDBを使うためのDexie)のインスタンス.
let database = null;

// Service workerの登録情報.
let service_worker = null;

// Tokenサービスが返してきたトークン.
let token = null;

// Userサービスの最終更新日時.
let date_updated = null;

// バックグラウンドループで使うタイマー.
let background_task_timer = null;

// ダウンロード中かどうかを示すフラグ.
let in_downloading = false;

// チャート描画用のダウンロード待ち写真ファイルの枚数.
let photo_count = 0;

// チャート描画用のコンテキストの配列.
let context_list = [];

// チャート描画用のシーンの配列.
let scene_list = [];

// チャート描画用の撮影者の配列.
let author_list = [];

/**
 * Tokenサービスから現在のユーザーにもとづいたトークンをもってくる.
 * @return {Promise<boolean}> true:もってこれた. / false:もってこれなかった.
 */
async function get_token() {
    if (token) {
        return true;
    }
    const response = await fetch("{{CREATE_TOKEN_URL}}", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "username": current_user.username,
            "password": CryptoJS.AES.decrypt(current_user.encrypted_password, String("{{APP_SECRET_KEY}}")).toString(CryptoJS.enc.Utf8)
        })
    });
    if (response.status === 200) {
        const result = await response.json();
        token = result.access;
        return token ? true : false;
    }
    return false;
}

/**
 * Userサービスから対応するユーザーの情報をもってくる.
 * @return {Promise<boolean>} true:もってこれた(もしくはそうみなしてOK). / false:もってこれなかった.
 */
async function load_user() {
    const user = await database.user.get("{{APP_DATABASE_CURRENT_USER}}");
    if (!user) {
        return false;
    }
    current_user = user;
    document.getElementById("current_username").value = document.getElementById("username").value = current_user.username;
    while (true) {
        if (!navigator.onLine) {
            return true;
        }
        if (!await get_token()) {
            return false;
        }
        const response = await fetch(`{{USER_API_URL}}?username=${current_user.username}`, {
            headers: {
                "Authorization": `{{TOKEN_FORMAT}} ${token}`
            }
        });
        if (response.status === 200) {
            const result = await response.json();
            current_user.user_id = result[0].id;
            await database.user.put(current_user);
            if (date_updated !== result[0].date_updated) {
                date_updated = result[0].date_updated;
                set_context_tags(result[0].context_tag);
                set_scene_tags(result[0].scene_tag);
                set_scene_color_tags(result[0].scene_color);
                set_download_rules(result[0].download_rule);
            }
            return true;
        } else if (response.status === 400 || response.status === 401 || response.status === 403) {
            token = null;
        } else {
            return false;
        }
    }
}

/**
 * Userサービスへ対応するユーザーの情報を保存する.
 * @return {Promise<boolean>} true:保存できた. / false:保存できなかった.
 */
async function save_user() {
    const context_tag = get_context_tags();
    const scene_color = get_scene_color_tags(); // 色で操作しているからここだけscene_tagより先にする:
    const scene_tag = get_scene_tags();
    const download_rule = get_download_rules();
    if (!context_tag || !scene_color || !scene_tag || !download_rule) {
        return false;
    }
    while (true) {
        if (!navigator.onLine) {
            return false;
        }
        if (!await get_token()) {
            return false;
        }
        const response = await fetch(`{{USER_API_URL}}${current_user.user_id}/`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `{{TOKEN_FORMAT}} ${token}`
            },
            body: JSON.stringify({
                "context_tag": context_tag,
                "scene_tag": scene_tag,
                "scene_color": scene_color,
                "download_rule": download_rule
            })
        });
        if (response.status === 200) {
            return load_user();
        } else if (response.status === 400 || response.status === 401 || response.status === 403) {
            token = null;
        } else {
            return false;
        }
    }
}

/**
 * CSVテキストからコンテキストタグのUIを作る.
 * @param {string} tags タグがCSVで羅列されているテキスト.
 */
function set_context_tags(tags) {
    let i = 0;
    for (const tag of tags.split(/,/)) {
        if (tag) {
            document.getElementById(`context_tag_${i++}`).value = tag;
        }
    }
    for (; i < CONTEXT_TAG_COUNT; i++) {
        document.getElementById(`context_tag_${i}`).value = "";
    }
}

/**
 * コンテキストタグのUIからCSVテキストを作る.
 * @return {string} タグをCSVで羅列したテキスト.
 */
function get_context_tags() {
    let result = "";
    for (let i = 0; i < CONTEXT_TAG_COUNT; i++) {
        const value = document.getElementById(`context_tag_${i}`).value.trim();
        if (value.length > Number("{{MAX_CONTEXT_TAG_LENGTH}}") || TAG_NAME_VALIDATOR.exec(value)) {
            return null;
        }
        result += value ? `${value},` : "";
    }
    return result;
}

/**
 * CSVテキストからシーンタグのUIを作る.
 * @param {string} tags タグがCSVで羅列されているテキスト.
 */
function set_scene_tags(tags) {
    let i = 0;
    for (const tag of tags.split(/,/)) {
        if (tag) {
            document.getElementById(`scene_tag_${i++}`).value = tag;
        }
    }
    for (; i < SCENE_TAG_COUNT; i++) {
        document.getElementById(`scene_tag_${i}`).value = "";
    }
}

/**
 * シーンタグのUIからCSVテキストを作る.
 * @return {string} タグをCSVで羅列したテキスト.
 */
function get_scene_tags() {
    let result = "";
    for (let i = 0; i < SCENE_TAG_COUNT; i++) {
        const value = document.getElementById(`scene_tag_${i}`).value.trim();
        if (value.length > Number("{{MAX_SCENE_TAG_LENGTH}}") || TAG_NAME_VALIDATOR.exec(value)) {
            return null;
        }
        result += value ? `${value},` : "";
    }
    return result;
}

/**
 * CSVテキストからシーンカラーのUIを作る.
 * @param {string} tags タグがCSVで羅列されているテキスト.
 */
function set_scene_color_tags(tags) {
    let i = 0;
    for (const tag of tags.split(/,/)) {
        if (tag) {
            for (const option of document.getElementById(`scene_color_${i}`).childNodes) {
                option.selected = option.value === tag ? true : false;
            }
            document.getElementById(`scene_tag_${i++}`).style.backgroundColor = tag;
        }
    }
    for (; i < SCENE_TAG_COUNT; i++) {
        for (const option of document.getElementById(`scene_color_${i}`).childNodes) {
            option.selected = option.value === SCENE_NOT_USED_COLOR ? true : false;
        }
        document.getElementById(`scene_tag_${i}`).style.backgroundColor = SCENE_NOT_USED_COLOR;
    }
}

/**
 * シーンカラーのUIからCSVテキストを作る.
 * @return {string} タグをCSVで羅列したテキスト.
 */
function get_scene_color_tags() {
    let result = "";
    for (let i = 0; i < SCENE_TAG_COUNT; i++) {
        const scene_tag = document.getElementById(`scene_tag_${i}`);
        if (scene_tag.value) {
            for (const option of document.getElementById(`scene_color_${i}`).childNodes) {
                if (option.selected) {
                    if (option.value === SCENE_NOT_USED_COLOR) {
                        scene_tag.value = "";
                    } else {
                        result += `${option.value},`;
                    }
                }
            }
        }
    }
    return result;
}

/**
 * シーンカラーが選択された時のイベントハンドラ.
 * @param {number} index 着目しているシーンの番号.
 */
function update_scene_color(index) {
    for (const option of document.getElementById(`scene_color_${index}`).childNodes) {
        const scene = document.getElementById(`scene_tag_${index}`);
        if (option.selected) {
            scene.style.backgroundColor = option.value;
            if (option.value === SCENE_NOT_USED_COLOR) {
                scene.value = "";
            }
        }
    }
}

/**
 * CSVテキストからダウンロードルールのUIを作る.
 * @param {string} tags タグがCSVで羅列されているテキスト.
 */
function set_download_rules(tags) {
    let i = 0;
    for (const tag of tags.split(/,/)) {
        if (tag) {
            for (const option of document.getElementById(`download_rule_${i++}`).childNodes) {
                option.selected = option.value === tag ? true : false;
            }
        }
    }
    for (; i < DOWNLOAD_RULE_COUNT; i++) {
        for (const option of document.getElementById(`download_rule_${i}`).childNodes) {
            option.selected = option.value === RULE_NOT_USED_VALUE ? true : false;
        }
    }
}

/**
 * ダウンロードルールのUIからCSVテキストを作る.
 * @return {string} タグをCSVで羅列したテキスト.
 */
function get_download_rules() {
    let result = "";
    for (let i = 0; i < DOWNLOAD_RULE_COUNT; i++) {
        for (const option of document.getElementById(`download_rule_${i}`).childNodes) {
            if (option.selected && option.value !== RULE_NOT_USED_VALUE) {
                result += `${option.value},`;
            }
        }
    }
    return result;
}

/**
 * ダウンロードを待っている写真のリストをMediaサービスから取得する.
 * @return {Promise<*>} 写真の情報を示した配列. とれなかったらnull.
 */
async function get_photo_list() {
    while (true) {
        if (!navigator.onLine) {
            return null;
        }
        if (!await get_token()) {
            return null;
        }
        const response = await fetch(`{{MEDIA_API_URL}}?owner=${current_user.user_id}`, {
            headers: {
                "Authorization": `{{TOKEN_FORMAT}} ${token}`
            }
        });
        if (response.status === 200) {
            const list = await response.json();
            return (!list || list.length == 0) ? null : list;
        } else if (response.status === 400 || response.status === 401 || response.status === 403) {
            token = null;
        } else {
            return null;
        }
    }
}

/**
 * 写真をMediaサービスからダウンロードする.
 */
async function download_photos() {
    let photo_list = await get_photo_list();
    if (!photo_list) {
        return;
    }
    const download_count = document.getElementById("download_count");
    const download_file = document.getElementById("download_file");
    download_count.innerHTML = photo_list.length;
    download_file.innerHTML = "--------";
    document.getElementById("downloading_dialog").classList.add("is-active");
    in_downloading = true;
    let some_error = false;
    try {
        const selected_folder = await window.showDirectoryPicker();
        while (selected_folder && photo_list.length && in_downloading && !some_error) {
            if (!navigator.onLine) {
                break;
            }
            if (!await get_token()) {
                some_error = true;
                break;
            }
            const photo = photo_list[0];
            download_count.innerHTML = photo_list.length;
            download_file.innerHTML = photo.id;
            const response = await fetch(photo.encrypted_data);
            if (response.status === 200) {
                let data = null;
                if (photo.encryption_key !== "{{NO_ENCRYPTION_KEY}}") {
                    const base64_raw = await response.text();
                    const base64_decrypted = CryptoJS.AES.decrypt(base64_raw, photo.encryption_key).toString(CryptoJS.enc.Utf8);
                    const tmp = window.atob(base64_decrypted);
                    const buffer = new Uint8Array(tmp.length);
                    for (let i = 0; i < tmp.length; i++) {
                        buffer[i] = tmp.charCodeAt(i);
                    }
                    data = buffer;
                } else {
                    data = await response.arrayBuffer();
                }
                const date_taken = new Date(photo.date_taken);
                const year = `${date_taken.getFullYear()}{{DATETIME_YY}}`;
                const month = `${(date_taken.getMonth() + 1).toString().padStart(2.0)}{{DATETIME_MM}}`;
                const day = `${date_taken.getDate().toString().padStart(2, 0)}{{DATETIME_DD}}`;
                const time = `${date_taken.getHours().toString().padStart(2, 0)}{{DATETIME_HH}}${date_taken.getMinutes().toString().padStart(2, 0)}{{DATETIME_MN}}${date_taken.getSeconds().toString().padStart(2, 0)}{{DATETIME_SS}}`;
                const ext = photo.content_type.match(/[^¥/]+$/);
                const author_name = photo.author_name;
                const context_tag = photo.context_tag;
                const scene_tag = photo.scene_tag;
                let folder_names = [];
                let file_name_body = time;
                for (const rule of get_download_rules().split(/,/)) {
                    switch (rule) {
                        case "YYMM":
                            folder_names.push(`${year}${month}`);
                            break;

                        case "YY":
                            folder_names.push(year);
                            break;

                        case "MM":
                            folder_names.push(month);
                            break;

                        case "DD":
                            folder_names.push(day);
                            break;

                        case "AUTHOR":
                            folder_names.push(author_name);
                            break;

                        case "CONTEXT":
                            folder_names.push(context_tag);
                            break;

                        case "SCENE":
                            folder_names.push(scene_tag);
                            break;

                        case RULE_NOT_USED_VALUE:
                        default:
                            break;
                    }
                }
                let folder_handle = selected_folder;
                for (const folder_name of folder_names) {
                    folder_handle = await folder_handle.getDirectoryHandle(folder_name, { create: true });
                }
                let file_handle = null;
                let number = 0;
                let actual_file_name = null;
                do {
                    actual_file_name = `${file_name_body}${(number > 0 ? number : "")}.${ext}`;
                    number++;
                    try {
                        file_handle = await folder_handle.getFileHandle(actual_file_name);
                    } catch (error) {
                        file_handle = null;
                    }
                } while (file_handle);
                file_handle = await folder_handle.getFileHandle(actual_file_name, { create: true });
                const write_handle = await file_handle.createWritable();
                await write_handle.write(data);
                await write_handle.close();
                photo_list.shift();
                if (current_user.delete_after_download) {
                    while (true) {
                        if (!navigator.onLine) {
                            break;
                        }
                        if (!await get_token()) {
                            break;
                        }
                        const delete_response = await fetch(`{{MEDIA_API_URL}}${photo.id}`, {
                            method: "DELETE",
                            headers: {
                                "Authorization": `{{TOKEN_FORMAT}} ${token}`
                            }
                        });
                        if (delete_response.status === 200 || delete_response.status === 204) {
                            break;
                        } else if (delete_response.status === 400 || delete_response.status === 401 || delete_response.status === 403) {
                            token = null;
                        } else {
                            some_error = true;
                            break;
                        }
                    }
                }
            } else if (response.status === 400 || response.status === 401 || response.status === 403) {
                token = null;
            } else {
                some_error = true;
                break;
            }
        }
    } catch (error) {
        console.warn("error in download_photos() :", error);
    }
    in_downloading = false;
    document.getElementById("downloading_dialog").classList.remove("is-active");
    if (some_error) {
        if (!token) {
            change_view("signin_view");
        } else {
            document.getElementById("download_failed_dialog").classList.add("is-active");
        }
        return;
    }
    change_view("loading_view");
    update_ui().then(() => {
        change_view("main_view");
    });
}

/**
 * チャートを描画する.
 */
function draw_chart() {
    let list = [];
    switch (current_user.chart) {
        case "context":
            list = context_list;
            break;

        case "scene":
            list = scene_list;
            break;

        case "author":
            list = author_list;
            break;

        default:
            return;
    }
    let labels = [];
    let series = [];
    for (const key in list) {
        labels.push(key);
        series.push(list[key]);
    }
    new Chartist.Pie(".ct-chart", { labels, series }, {
        donut: true,
        labelInterpolationFnc: function(value) {
            return value;
        },
        labelPosition: "outside"
    });
    const status_title = document.getElementById("status_title");
    status_title.innerHTML = photo_count;
    // TODO: さぼって直接HTMLを操作している...
    if (photo_count == 0) {
        status_title.style.backgroundColor = "white";
        status_title.style.marginTop = "0";
    } else if (labels.length == 1) {
        status_title.style.backgroundColor = "transparent";
        status_title.style.marginTop = "4ex";
    } else {
        status_title.style.backgroundColor = "transparent";
        status_title.style.marginTop = "0";
    }
}

/**
 *  UIを更新する.
 */
async function update_ui() {
    get_photo_list().then(photo_list => {
        photo_count = 0;
        context_list = [];
        scene_list = [];
        author_list = [];
        if (photo_list) {
            photo_count = photo_list.length;
            for (const photo of photo_list) {
                const context_count = context_list[photo.context_tag];
                context_list[photo.context_tag] = context_count ? context_count + 1 : 1;
                const scene_count = scene_list[photo.scene_tag];
                scene_list[photo.scene_tag] = scene_count ? scene_count + 1 : 1;
                const author_count = author_list[photo.author_name];
                author_list[photo.author_name] = author_count ? author_count + 1 : 1;
            }
        }
        draw_chart();
    });
}

/**
 * 指定したビューだけを表示する.
 * @param {string} name ビューの名前.
 */
function change_view(name) {
    for (const view of document.getElementById("app").children) {
        view.style.display = view.id === name ? "block" : "none";
    }
}

/**
 * バックグラウンドタスク.
 */
function background_task() {
    if (!in_downloading) {
        load_user().then(result => {
            if (result) {
                update_ui();
            } else {
                change_view("signin_view");
            }
        });
    }
    background_task_timer = setTimeout(background_task, BACKGROUND_TASK_INTERVAL);
}

/**
 * アプリケーションのメイン.
 */
function main() {
    change_view("loading_view");
    document.getElementById("save_context").onclick = document.getElementById("save_scene").onclick = (() => {
        save_user().then(result => {
            document.getElementById(result ? "save_succeeded_dialog" : "save_failed_dialog").classList.add("is-active");
        });
    });
    document.getElementById("save_succeeded_ok").onclick = (() => {
        document.getElementById("save_succeeded_dialog").classList.remove("is-active");
    });
    document.getElementById("save_failed_ok").onclick = (() => {
        document.getElementById("save_failed_dialog").classList.remove("is-active");
    });
    document.getElementById("current_username").onclick = (() => {
        change_view("signin_view");
    });
    document.getElementById("signin").onclick = (() => {
        const signin_error = document.getElementById("signin_error");
        signin_error.style.display = "none";
        const username = document.getElementById("username").value.trim();
        const raw_password = document.getElementById("password").value;
        current_user.username = username;
        current_user.encrypted_password = CryptoJS.AES.encrypt(raw_password, String("{{APP_SECRET_KEY}}")).toString();
        database.user.put(current_user).then(() => {
            token = null;
            load_user().then(result => {
                if (result) {
                    change_view("loading_view");
                    update_ui().then(() => {
                        change_view("main_view");
                    });
                } else {
                    signin_error.style.display = "block";
                }
            });
        });
    });
    document.getElementById("signin-cancel").onclick = (() => {
        if (token) {
            change_view("main_view");
        }
    });
    document.getElementById("show_context_status").onclick = (() => {
        current_user.chart = "context";
        database.user.put(current_user).then(() => {
            draw_chart();
        });
    });
    document.getElementById("show_scene_status").onclick = (() => {
        current_user.chart = "scene";
        database.user.put(current_user).then(() => {
            draw_chart();
        });
    });
    document.getElementById("show_author_status").onclick = (() => {
        current_user.chart = "author";
        database.user.put(current_user).then(() => {
            draw_chart();
        });
    });
    document.getElementById("download_start").onclick = (() => {
        save_user().then(result => {
            if (!result) {
                document.getElementById("save_failed_dialog").classList.add("is-active");
            } else if (!("showDirectoryPicker" in window)) {
                alert("{{NO_FILESYSTEM_API_ERROR_MESSAGE}}");
            } else {
                download_photos();
            }
        });
    });
    document.getElementById("download_stop").onclick = (() => {
        in_downloading = false;
        document.getElementById("downloading_dialog").classList.remove("is-active");
    });
    document.getElementById("download_failed_ok").onclick = (() => {
        document.getElementById("download_failed_dialog").classList.remove("is-active");
    });
    database = new Dexie("{{LINK_APP_DATABASE_NAME}}");
    database.version("{{LINK_APP_DATABASE_VERSION}}").stores({
        user: "dummy_id, user_id"
    });
    navigator.serviceWorker.register("link-serviceworker.js").then(registration => {
        navigator.serviceWorker.ready.then(registration => {
            service_worker = registration;
        });
    });
    if (document.location.search !== "{{APP_MODE_URL_PARAM}}") {
        change_view("install_view");
        return;
    }
    load_user().then(result => {
        if (result) {
            update_ui().then(() => {
                change_view("main_view");
            });
        } else {
            change_view("signin_view");
        }
        background_task_timer = setTimeout(background_task, BACKGROUND_TASK_INTERVAL);
    });
}