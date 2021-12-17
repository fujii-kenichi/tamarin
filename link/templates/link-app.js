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
    user_id: null,
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
let file_count = 0;

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
    // トークンがあればとりあえずはもってこれたとする.
    // 使った側がエラーが起きた時はリセットする.
    if (token) {
        return true;
    }
    try {
        const response = await fetch("{{CREATE_TOKEN_URL}}", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "username": current_user.username,
                "password": CryptoJS.AES.decrypt(current_user.encrypted_password, String("{{SECRET_KEY}}")).toString(CryptoJS.enc.Utf8)
            })
        });
        // レスポンスコートが想定内なら所定の処理.
        if (response.status === 200) {
            const result = await response.json();
            token = result.access;
            return token ? true : false;
        } else if (response.status === 400 || response.status === 401 || response.status === 403) {
            return false;
        }
    } catch (error) {
        console.error("exception in get_token() :", error);
    }
    change_view("error_view");
    throw new Error("fatal error");
}

/**
 * Userサービスから対応するユーザーの情報をもってくる.
 * @return {Promise<boolean>} true:もってこれた(もしくはそうみなしてOK). / false:もってこれなかった.
 */
async function load_user() {
    const user = await database.user.get("{{APP_DATABASE_CURRENT_USER}}");
    // データベースにユーザーが(まだ)存在しない場合.
    if (!user) {
        return false;
    }
    // データベースにあった情報で表示を更新する.
    current_user = user;
    document.getElementById("current_username").value = document.getElementById("username").value = current_user.username;
    while (true) {
        // トークンがとれなければおしまい.
        if (!await get_token()) {
            return false;
        }
        try {
            // 現在のユーザーに対応するデータをUserサービスから持ってくる.
            const response = await fetch(`{{USER_API_URL}}?username=${current_user.username}`, {
                headers: {
                    "Authorization": `{{TOKEN_FORMAT}} ${token}`
                }
            });
            if (response.status === 200) {
                // 200ならとってきた情報をデータベースに格納する.
                const result = await response.json();
                current_user.user_id = result[0].id;
                await database.user.put(current_user);
                // 更新時刻が覚えているものと違えばUIを更新する.
                if (date_updated !== result[0].date_updated) {
                    date_updated = result[0].date_updated;
                    context_tag_csv2ui(result[0].context_tag);
                    scene_tag_csv2ui(result[0].scene_tag);
                    scene_color_csv2ui(result[0].scene_color);
                    download_rule_csv2ui(result[0].download_rule);
                }
                // 成功で戻る.
                return true;
            } else if (response.status === 400 || response.status === 401 || response.status === 403) {
                // エラーなら今のトークンがダメということでリトライ. 
                token = null;
            }
        } catch (error) {
            console.error("exception in load_user() :", error);
            return false;
        }
    }
}

/**
 * Userサービスへ対応するユーザーの情報を保存する.
 * @return {Promise<boolean>} true:保存できた. / false:保存できなかった.
 */
async function save_user() {
    // UIから値をもってくる.
    const context_tag = context_tag_ui2csv();
    const scene_color = scene_color_ui2csv(); // 色で操作しているからここだけscene_tagより先にする:
    const scene_tag = scene_tag_ui2csv();
    const download_rule = download_rule_ui2csv();
    // どれかに問題があったらエラーで戻る.
    if (!context_tag || !scene_color || !scene_tag || !download_rule) {
        return false;
    }
    while (true) {
        // トークンがとれなければおしまい.
        if (!await get_token()) {
            return false;
        }
        try {
            // Userサービスにも保存する(PATCHで部分的な更新をしていることに注意!)
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
                // 保存に成功したら再度ユーザーの読み直しをしてその結果を戻す.
                return load_user();
            } else if (response.status === 400 || response.status === 401 || response.status === 403) {
                // エラーなら今のトークンがダメということでリトライ. 
                token = null;
            }
        } catch (error) {
            console.error("exception in save_user() :", error);
            return false;
        }
    }
}

/**
 * CSVテキストからコンテキストタグのUIを作る.
 * @param {string} tags タグがCSVで羅列されているテキスト.
 */
function context_tag_csv2ui(tags) {
    let i = 0;
    for (const tag of tags.split(/,/)) {
        if (tag) {
            document.getElementById(`context_tag_${i}`).value = tag;
            i++;
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
function context_tag_ui2csv() {
    let result = "";
    for (let i = 0; i < CONTEXT_TAG_COUNT; i++) {
        const value = document.getElementById(`context_tag_${i}`).value.trim();
        if (value) {
            if (TAG_NAME_VALIDATOR.exec(value) || value.length > Number("{{MAX_CONTEXT_TAG_LENGTH}}")) {
                return null;
            }
            if (value.length > 0) {
                result += value;
                result += ",";
            }
        }
    }
    return result;
}

/**
 * CSVテキストからシーンタグのUIを作る.
 * @param {string} tags タグがCSVで羅列されているテキスト.
 */
function scene_tag_csv2ui(tags) {
    let i = 0;
    for (const tag of tags.split(/,/)) {
        if (tag) {
            document.getElementById(`scene_tag_${i}`).value = tag;
            i++;
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
function scene_tag_ui2csv() {
    let result = "";
    for (let i = 0; i < SCENE_TAG_COUNT; i++) {
        const value = document.getElementById(`scene_tag_${i}`).value.trim();
        if (value) {
            if (TAG_NAME_VALIDATOR.exec(value) || value.length > Number("{{MAX_SCENE_TAG_LENGTH}}")) {
                return null;
            }
            if (value.length > 0) {
                result += value;
                result += ",";
            }
        }
    }
    return result;
}

/**
 * CSVテキストからシーンカラーのUIを作る.
 * @param {string} tags タグがCSVで羅列されているテキスト.
 */
function scene_color_csv2ui(tags) {
    let i = 0;
    for (const tag of tags.split(/,/)) {
        if (tag) {
            for (const option of document.getElementById(`scene_color_${i}`).childNodes) {
                option.selected = option.value === tag ? true : false;
            }
            document.getElementById(`scene_tag_${i}`).style.backgroundColor = tag;
            i++;
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
function scene_color_ui2csv() {
    let result = "";
    for (let i = 0; i < SCENE_TAG_COUNT; i++) {
        const scene_tag = document.getElementById(`scene_tag_${i}`);
        if (scene_tag.value) {
            for (const option of document.getElementById(`scene_color_${i}`).childNodes) {
                if (option.selected) {
                    if (option.value === SCENE_NOT_USED_COLOR) {
                        scene_tag.value = "";
                    } else {
                        result += option.value;
                        result += ",";
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
function download_rule_csv2ui(tags) {
    let i = 0;
    for (const tag of tags.split(/,/)) {
        if (tag) {
            for (const option of document.getElementById(`download_rule_${i}`).childNodes) {
                option.selected = option.value === tag ? true : false;
            }
            i++;
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
function download_rule_ui2csv() {
    let result = "";
    for (let i = 0; i < DOWNLOAD_RULE_COUNT; i++) {
        for (const option of document.getElementById(`download_rule_${i}`).childNodes) {
            if (option.selected && option.value !== RULE_NOT_USED_VALUE) {
                result += option.value;
                result += ",";
            }
        }
    }
    return result;
}

/**
 * ダウンロードを待っているファイルのリストをMediaサービスから取得する.
 * @return {Promise<*>} ファイルの情報を示した配列. とれなかったらnull.
 */
async function get_download_file_list() {
    while (true) {
        // トークンがとれなければおしまい.
        if (!await get_token()) {
            return null;
        }
        try {
            // ユーザーがOwnerのMediaのリストをMediaサービスから取得する.
            const response = await fetch(`{{MEDIA_API_URL}}?owner=${current_user.user_id}`, {
                headers: {
                    "Authorization": `{{TOKEN_FORMAT}} ${token}`
                }
            });
            if (response.status === 200) {
                const file_list = await response.json();
                if (!file_list || file_list.length == 0) {
                    return null;
                }
                return file_list;
            } else if (response.status === 400 || response.status === 401 || response.status === 403) {
                // エラーなら今のトークンがダメということでリトライ. 
                token = null;
            } else {
                return null;
            }
        } catch (error) {
            console.error("exception in get_download_file_list() :", error);
            return null;
        }
    }
}

/**
 * ファイルをMediaサービスからダウンロードする.
 */
async function download_files() {
    // リストを取ってきて空の場合はなにもしないで抜ける.
    let file_list = await get_download_file_list();
    if (!file_list) {
        return;
    }
    document.getElementById("download_count").innerHTML = file_list.length;
    document.getElementById("download_file").innerHTML = "--------";
    document.getElementById("downloading_dialog").classList.add("is-active");
    try {
        // フォルダを選択する.
        const selected_folder_handle = await window.showDirectoryPicker();
        const download_rules = download_rule_ui2csv().split(/,/);
        in_downloading = true;
        while (selected_folder_handle && file_list.length && in_downloading) {
            // 対象となるファイルをリストの先頭から取得する.
            const file = file_list[0];
            // 現在のダウンロード状況をUIに反映する.
            document.getElementById("download_count").innerHTML = file_list.length;
            document.getElementById("download_file").innerHTML = file.id;
            // トークンがとれなければおしまい.
            if (!await get_token()) {
                change_view("signin_view");
                break;
            }
            // Mediaサービスからファイルを取得する.
            const response = await fetch(file.encrypted_data);
            if (response.status === 200) {
                let data = null;
                if (file.encryption_key !== "{{NO_ENCRYPTION_KEY}}") {
                    // 暗号化されていた場合の処理.                
                    const base64_raw = await response.text();
                    const base64_decrypted = CryptoJS.AES.decrypt(base64_raw, file.encryption_key).toString(CryptoJS.enc.Utf8);
                    const tmp = window.atob(base64_decrypted);
                    const buffer = new Uint8Array(tmp.length);
                    for (let i = 0; i < tmp.length; i++) {
                        buffer[i] = tmp.charCodeAt(i);
                    }
                    data = buffer;
                } else {
                    data = await response.arrayBuffer();
                }
                // ここからは保存するパス名とファイル名の要素を生成する.
                const date_taken = new Date(file.date_taken);
                const year = `${date_taken.getFullYear()}{{DATETIME_YY}}`;
                const month = `${(date_taken.getMonth() + 1).toString().padStart(2.0)}{{DATETIME_MM}}`;
                const day = `${date_taken.getDate().toString().padStart(2, 0)}{{DATETIME_DD}}`;
                const time = `${date_taken.getHours().toString().padStart(2, 0)}{{DATETIME_HH}}${date_taken.getMinutes().toString().padStart(2, 0)}{{DATETIME_MN}}${date_taken.getSeconds().toString().padStart(2, 0)}{{DATETIME_SS}}`;
                const ext = file.content_type.match(/[^¥/]+$/);
                const author_name = file.author_name;
                const context_tag = file.context_tag;
                const scene_tag = file.scene_tag;
                // ここからはダウンロードルールに基づいてパスとファイルを作成する.
                let path = [];
                let body = time;
                for (const rule of download_rules) {
                    switch (rule) {
                        case "YYMM":
                            path.push(`${year}${month}`);
                            break;

                        case "YY":
                            path.push(year);
                            break;

                        case "MM":
                            path.push(month);
                            break;

                        case "DD":
                            path.push(day);
                            break;

                        case "AUTHOR":
                            path.push(author_name);
                            break;

                        case "CONTEXT":
                            path.push(context_tag);
                            break;

                        case "SCENE":
                            path.push(scene_tag);
                            break;

                        case RULE_NOT_USED_VALUE:
                            break;
                    }
                }
                // パスを順番にフォルダとして開いてハンドルを再帰的に取得する.
                let folder_handle = selected_folder_handle;
                for (const p of path) {
                    folder_handle = await folder_handle.getDirectoryHandle(p, { create: true });
                }
                // 既存のファイルとファイル名がぶつかっている間はループする.
                let file_handle = null;
                let number = 0;
                let actual_file_name = null;
                do {
                    actual_file_name = `${body}${(number > 0 ? number : "")}.${ext}`;
                    number++;
                    // ファイル名がぶつかっている間はずっとfile(1),(2)...と数字を上げ続ける.
                    // これは微妙に危険な(終わらない可能性のある)アルゴリズムのような気がする...
                    try {
                        file_handle = await folder_handle.getFileHandle(actual_file_name);
                    } catch (error) {
                        file_handle = null;
                    }
                } while (file_handle);
                // 最後のハンドルでファイルをオープンする.
                file_handle = await folder_handle.getFileHandle(actual_file_name, { create: true });
                // ダウンロードした中身を書き込んでクローズする.
                const write_handle = await file_handle.createWritable();
                await write_handle.write(data);
                await write_handle.close();
                // リストから当該ファイルを削除して詰める.
                file_list.shift();
                // Mediaサービスからもファイルを削除する.
                if (current_user.delete_after_download) {
                    await fetch(`{{MEDIA_API_URL}}${file.id}`, {
                        method: "DELETE",
                        headers: {
                            "Authorization": `{{TOKEN_FORMAT}} ${token}`
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.warn("error in download_files() :", error);
    }
    in_downloading = false;
    // 強制的にバックグラウンドタスクを起動してチャートを再描画する.
    background_task();
    document.getElementById("downloading_dialog").classList.remove("is-active");
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
    status_title.innerHTML = file_count;
    // ここではさぼって直接HTMLエレメントを操作しているので注意!
    if (file_count == 0) {
        // 写真がない場合はチャートの代わりに円を書く.
        status_title.style.backgroundColor = "white";
        status_title.style.marginTop = "0";
    } else if (labels.length == 1) {
        // 種類が1つしかない場合は見えやすいようにちょっと個数の表示をずらす.
        status_title.style.backgroundColor = "transparent";
        status_title.style.marginTop = "4ex";
    } else {
        // それ以外は普通にチャートを描く.
        status_title.style.backgroundColor = "transparent";
        status_title.style.marginTop = "0";
    }
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
    // 前のタイマーがあれば破棄しておく.
    if (background_task_timer) {
        clearTimeout(background_task_timer);
        background_task_timer = null;
    }
    // オンラインでダウンロード中でなければ...
    if (navigator.onLine && !in_downloading) {
        // ユーザーの情報をもってくる.
        load_user().then(() => {
            // 最新のダウンロードファイルの状況を取得する.
            get_download_file_list().then(file_list => {
                if (file_list) {
                    file_count = file_list.length;
                    // チャートのデータを作成する.
                    for (const file of file_list) {
                        const context_count = context_list[file.context_tag];
                        context_list[file.context_tag] = context_count ? context_count + 1 : 1;
                        const scene_count = scene_list[file.scene_tag];
                        scene_list[file.scene_tag] = scene_count ? scene_count + 1 : 1;
                        const author_count = author_list[file.author_name];
                        author_list[file.author_name] = author_count ? author_count + 1 : 1;
                    }
                } else {
                    file_count = 0;
                    context_list = [];
                    scene_list = [];
                    author_list = [];
                }
                // チャートを描画する.
                draw_chart();
            });
        });
    }
    // 終わったらもう一回自分を登録.
    background_task_timer = setTimeout(background_task, BACKGROUND_TASK_INTERVAL);
}

/**
 * アプリケーションのメイン.
 */
function main() {
    // 起動時のURLを確認する.
    if (document.location.search !== "{{APP_MODE_URL_PARAM}}") {
        change_view("install_view");
        return;
    }
    // service workerが使える環境かどうかをチェックする.
    if (!("serviceWorker" in navigator)) {
        change_view("error_view");
        return;
    }
    // service workerの登録を行う.
    navigator.serviceWorker.register("link-serviceworker.js").then(registration => {
        navigator.serviceWorker.ready.then(registration => {
            service_worker = registration;
        });
    });
    // UIのイベントをセットする:保存.
    document.getElementById("save_context").onclick = document.getElementById("save_scene").onclick = (() => {
        save_user().then(result => {
            document.getElementById(result ? "save_succeeded_dialog" : "save_failed_dialog").classList.add("is-active");
        });
    });
    // UIのイベントをセットする:保存成功表示.
    document.getElementById("save_succeeded_ok").onclick = (() => {
        document.getElementById("save_succeeded_dialog").classList.remove("is-active");
    });
    // UIのイベントをセットする:保存失敗表示.
    document.getElementById("save_failed_ok").onclick = (() => {
        document.getElementById("save_failed_dialog").classList.remove("is-active");
    });
    // UIのイベントをセットする:再サインイン.
    document.getElementById("current_username").onclick = (() => {
        change_view("signin_view");
    });
    // UIのイベントをセットする:サインイン.
    document.getElementById("signin").onclick = (() => {
        const signin_error = document.getElementById("signin_error");
        signin_error.style.display = "none";
        // 画面から情報をとってくる.
        const username = document.getElementById("username").value.trim();
        const raw_password = document.getElementById("password").value;
        // 入力情報を保存する.
        current_user.username = username;
        current_user.encrypted_password = CryptoJS.AES.encrypt(raw_password, String("{{SECRET_KEY}}")).toString();
        database.user.put(current_user).then(() => {
            // 既存のトークンを無効化してユーザーをロードする.
            token = null;
            load_user().then(success => {
                if (!success) {
                    signin_error.style.display = "block";
                } else {
                    change_view("main_view");
                }
            });
        });
    });
    // UIのイベントをセットする:サインインキャンセル.
    document.getElementById("signin-cancel").onclick = (() => {
        if (token) {
            change_view("main_view");
        }
    });
    // UIのイベントをセットする:ステータスのチャートをコンテキストに.
    document.getElementById("show_context_status").onclick = (() => {
        current_user.chart = "context";
        database.user.put(current_user).then(() => {
            draw_chart();
        });
    });
    // UIのイベントをセットする:ステータスのチャートをシーンに.
    document.getElementById("show_scene_status").onclick = (() => {
        current_user.chart = "scene";
        database.user.put(current_user).then(() => {
            draw_chart();
        });
    });
    // UIのイベントをセットする:ステータスのチャートを撮影者に.
    document.getElementById("show_author_status").onclick = (() => {
        current_user.chart = "author";
        database.user.put(current_user).then(() => {
            draw_chart();
        });
    });
    // UIのイベントをセットする:ダウンロード開始.
    document.getElementById("download_start").onclick = (() => {
        save_user().then(result => {
            if (!result) {
                document.getElementById("save_failed_dialog").classList.add("is-active");
            } else if (!("showDirectoryPicker" in window)) {
                alert("{{NO_FILESYSTEM_API_ERROR_MESSAGE}}");
            } else {
                download_files();
            }
        });
    });
    // UIのイベントをセットする:ダウンロード停止.
    document.getElementById("download_stop").onclick = (() => {
        in_downloading = false;
        document.getElementById("downloading_dialog").classList.remove("is-active");
    });
    // Dexieのインスタンスを作る.
    database = new Dexie("{{LINK_APP_DATABASE_NAME}}");
    database.version("{{LINK_APP_DATABASE_VERSION}}").stores({
        user: "dummy_id, user_id"
    });
    // ユーザーをロードして処理開始.
    load_user().then(success => {
        draw_chart();
        background_task();
        change_view(success ? "main_view" : "signin_view");
    });
}