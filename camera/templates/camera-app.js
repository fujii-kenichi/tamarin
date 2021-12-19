/** 
 * タマリンカメラ.
 * @author FUJII Kenichi <fujii.kenichi@tamariva.co.jp>
 */
"use strict";

// バックグラウンドタスクを繰り返すときの待ち時間(ミリ秒).
const BACKGROUND_TASK_INTERVAL = 15 * 1000;

// 撮影用のパラメータ.
const CAPTURE_PARAM = JSON.parse(String("{{CAPTURE_PARAM}}").replaceAll("&quot;", '"'));
const DEVICE_PARAM = JSON.parse(String("{{DEVICE_PARAM}}").replaceAll("&quot;", '"'));

// 自前の実装でJPEGを作るときの品質値.
const JPEG_Q = 0.85;

// 現在アプリでサインインしているユーザーを示す変数(新規作成時の初期値を含む).
let current_user = {
    dummy_id: "{{APP_DATABASE_CURRENT_USER}}",
    user_id: "",
    username: "",
    encrypted_password: "",
    author_name: "",
    context_tag: "",
    scene_tag: "",
    scene_color: "",
    shutter_sound: true, // シャッターサウンドはデフォルトでオン.
    auto_reload: true, // 自動リロードはデフォルトでオン.
    encryption: true, // 暗号化もデフォルトでオン.
    selected_context: "", // 現在選択しているコンテキストを覚えておく.
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

// 撮影用のimage capture オブジェクト.
let image_capture = null;

// 現在溜まっている写真の枚数.
let photo_count = 0;

/**
 * カメラのプレビューを更新する.
 */
function update_preview() {
    // 以降の処理はトライ＆エラーの結果としてこうしているけど,
    // これが本当に適切なやり方なのかはちょっとよくわからない...
    try {
        document.getElementById("shutters").style.display = "none";
        const preview = document.getElementById("preview");
        preview.pause();
        if (preview.srcObject) {
            preview.srcObject.getVideoTracks().forEach(track => {
                track.stop();
                preview.srcObject.removeTrack(track);
            });
            preview.removeAttribute("srcObject");
            preview.load();
            preview.srcObject = null;
        }
        image_capture = null;
        if (document.visibilityState === "visible") {
            navigator.mediaDevices.getUserMedia(DEVICE_PARAM).then(stream => {
                const MyImageCapture = class {
                    async takePhoto() {
                        return new Promise(resolve => {
                            const canvas = document.getElementById("canvas");
                            canvas.width = preview.videoWidth;
                            canvas.height = preview.videoHeight;
                            canvas.getContext("2d").drawImage(preview, 0, 0);
                            canvas.toBlob(resolve, "image/jpeg", JPEG_Q);
                        });
                    }
                };
                image_capture = typeof ImageCapture === "undefined" ? new MyImageCapture() : new ImageCapture(stream.getVideoTracks()[0]);
                preview.srcObject = stream;
            });
        }
    } catch (error) {
        console.error("could not update preview :", error);
    }
}

/**
 * 写真を撮影する.
 * @param {string} scene_tag 撮影時に指定されたシーンタグ.
 */
function take_photo(scene_tag) {
    if (photo_count >= Number("{{CAMERA_APP_MAX_PHOTO_COUNT}}")) {
        return;
    }
    const preview = document.getElementById("preview");
    if (preview.style.visibility === "hidden") {
        return;
    }
    preview.style.visibility = "hidden";
    const shutter_audio = document.getElementById("shutter_audio");
    if (current_user.shutter_sound) {
        shutter_audio.pause();
        shutter_audio.currentTime = 0;
        shutter_audio.load();
        shutter_audio.play();
    }
    document.getElementById("photo_count").value = ++photo_count;
    const start_time = new Date();
    // TODO: 本当はここでカメラの性能を生かせるようにいろいろ設定するべき...
    image_capture.takePhoto(CAPTURE_PARAM).then(image => {
        console.info(`captured image type : ${image.type}`);
        console.info(`captured image size : ${image.size}`);
        const image_reader = new FileReader();
        image_reader.onload = () => {
            let data = image_reader.result;
            let key = "{{NO_ENCRYPTION_KEY}}";
            if (current_user.encryption) {
                key = CryptoJS.lib.WordArray.random(Number("{{MEDIA_ENCRYPTION_KEY_LENGTH}}")).toString();
                const base64_raw = btoa(new Uint8Array(data).reduce((d, b) => d + String.fromCharCode(b), ""));
                const base64_encrypted = CryptoJS.AES.encrypt(base64_raw, key).toString();
                data = base64_encrypted;
                console.info(`encrypted data size :${base64_encrypted.length}`);
            }
            const photo = {
                owner: current_user.user_id,
                date_taken: start_time.toJSON(),
                author_name: current_user.author_name,
                scene_tag: scene_tag,
                context_tag: document.getElementById("context_tags").value,
                content_type: image.type,
                encryption_key: key,
                encrypted_data: data
            };
            // TODO: 本当はここでサイズを確認して適切な処理をするべき.
            database.photo.add(photo).then(() => {
                console.info(`photo processing time :${(new Date() - start_time)}`);
                preview.style.visibility = "visible";
                if (navigator.onLine) {
                    upload_photo(photo);
                } else {
                    if ("sync" in service_worker) {
                        service_worker.sync.register("{{CAMERA_APP_UPLOAD_PHOTO_TAG}}");
                    }
                }
            });
        };
        image_reader.readAsArrayBuffer(image);
    });
}

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
    document.getElementById("username").value = current_user.username;
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
            current_user.context_tag = result[0].context_tag;
            current_user.scene_tag = result[0].scene_tag;
            current_user.scene_color = result[0].scene_color;
            const select = document.getElementById("context_tags");
            current_user.selected_context = select.selectedIndex >= 0 ? select.options[select.selectedIndex].value : current_user.selected_context;
            await database.user.put(current_user);
            if (date_updated !== result[0].date_updated) {
                date_updated = result[0].date_updated;
                setup_ui();
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
 * 写真をMediaサービスにアップロードする.
 * @param {*} photo 対象となる写真.
 */
async function upload_photo(photo) {
    while (true) {
        if (!navigator.onLine) {
            return;
        }
        if (!await get_token()) {
            return;
        }
        const form_data = new FormData();
        form_data.append("owner", photo.owner);
        form_data.append("date_taken", photo.date_taken);
        form_data.append("author_name", photo.author_name);
        form_data.append("scene_tag", photo.scene_tag);
        form_data.append("context_tag", photo.context_tag);
        form_data.append("content_type", photo.content_type);
        form_data.append("encryption_key", photo.encryption_key);
        const start_time = new Date();
        const encrypted_data = new File([photo.encrypted_data], `${photo.id}.bin`, { lastModified: start_time });
        form_data.append("encrypted_data", encrypted_data);
        const response = await fetch("{{MEDIA_API_URL}}", {
            method: "POST",
            headers: {
                "Authorization": `{{TOKEN_FORMAT}} ${token}`
            },
            body: form_data
        });
        if (response.status === 201) {
            console.info(`photo upload time :${(new Date() - start_time)}`);
            await database.photo.delete(photo.id);
            document.getElementById("photo_count").value = photo_count = await database.photo.count();
            return;
        } else if (response.status === 400 || response.status === 401 || response.status === 403) {
            token = null;
        } else {
            return;
        }
    }
}

/**
 * 写真をあるだけアップロードする.
 */
async function upload_photos() {
    while (navigator.onLine && token) {
        const photo = await database.photo.orderBy("date_taken").first();
        if (photo) {
            await upload_photo(photo);
        } else {
            break;
        }
    }
}

/**
 *  current_userの中身からUIのエレメントを設定する.
 */
function setup_ui() {
    document.getElementById("author_name").value = document.getElementById("current_author_name").value = current_user.author_name;
    document.getElementById("shutter_sound").checked = current_user.shutter_sound;
    document.getElementById("auto_reload").checked = current_user.auto_reload;
    document.getElementById("encryption").checked = current_user.encryption;
    let context_tags_html = "";
    if (current_user.context_tag) {
        for (const context of current_user.context_tag.split(/,/)) {
            if (context) {
                context_tags_html += (`<option class=\"context_tag\" value=\"${context}\" ${(context === current_user.selected_context ? "selected" : "")}>${context}</option>`);
            }
        }
    }
    document.getElementById("context_tags").innerHTML = context_tags_html;
    let shutters_html = "";
    if (current_user.scene_tag && current_user.scene_color) {
        const scene_tags = current_user.scene_tag.split(/,/);
        const scene_colors = current_user.scene_color.split(/,/);
        for (let i = 0; i < scene_tags.length; i++) {
            const scene = scene_tags[i];
            if (scene) {
                shutters_html += (`<div class=\"tama-shutter\" style=\"background-color:${scene_colors[i]};\" onmousedown='take_photo(\"${scene}\")'>${scene}</div>`);
            }
        }
    }
    document.getElementById("shutters").innerHTML = shutters_html;
    database.photo.count().then(count => {
        document.getElementById("photo_count").value = photo_count = count;
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
    const select = document.getElementById("context_tags");
    current_user.selected_context = select.selectedIndex >= 0 ? select.options[select.selectedIndex].value : current_user.selected_context;
    if (current_user.auto_reload) {
        load_user();
    }
    if (!token) {
        change_view("signin_view");
    }
    upload_photos().then(() => {
        background_task_timer = setTimeout(background_task, BACKGROUND_TASK_INTERVAL);
    });
}

/**
 * アプリケーションのメイン.
 */
function main() {
    change_view("loading_view");
    window.addEventListener("touchmove", (event => {
        event.preventDefault();
    }));
    window.addEventListener("offline", (() => {
        update_preview();
    }));
    window.addEventListener("online", (() => {
        update_preview();
    }));
    document.addEventListener("visibilitychange", (() => {
        update_preview();
    }));
    document.getElementById("preview").onloadedmetadata = (() => {
        document.getElementById("preview").play().catch(error => {
            console.error("could not start play preview :", error);
        });
    });
    document.getElementById("preview").onplay = (() => {
        document.getElementById("shutters").style.display = "block";
    });
    document.getElementById("current_author_name").onclick = (() => {
        change_view("signin_view");
    });
    document.getElementById("signin-cancel").onclick = (() => {
        if (token) {
            change_view("main_view");
        }
    });
    document.getElementById("context_tags").onchange = (() => {
        const select = document.getElementById("context_tags");
        current_user.selected_context = select.selectedIndex >= 0 ? select.options[select.selectedIndex].value : current_user.selected_context;
        database.user.put(current_user);
    });
    document.getElementById("photo_count").onclick = (() => {
        load_user().then(() => {
            change_view("loading_view");
            upload_photos().then(() => {
                change_view("main_view");
            });
        });
    });
    document.getElementById("signin").onclick = (() => {
        const signin_error = document.getElementById("signin_error");
        signin_error.style.display = "none";
        const author_name = document.getElementById("author_name").value.trim();
        const username = document.getElementById("username").value.trim();
        const raw_password = document.getElementById("password").value;
        const validator = /[\s\,\:\;\&\"\'\`\¥\|\~\%\/\\<\>\?\\\*]/m;
        if (!author_name || validator.exec(author_name)) {
            signin_error.style.display = "block";
            return;
        }
        document.getElementById("current_author_name").value = current_user.author_name = author_name;
        current_user.username = username;
        current_user.encrypted_password = CryptoJS.AES.encrypt(raw_password, String("{{APP_SECRET_KEY}}")).toString();
        database.user.put(current_user).then(() => {
            token = null;
            load_user().then(result => {
                if (result) {
                    change_view("main_view");
                } else {
                    signin_error.style.display = "block";
                }
            });
        });
    });
    document.getElementById("setting").onclick = (() => {
        document.getElementById("setting_dialog").classList.add("is-active");
    });
    document.getElementById("save_setting").onclick = (() => {
        current_user.shutter_sound = document.getElementById("shutter_sound").checked;
        current_user.auto_reload = document.getElementById("auto_reload").checked;
        current_user.encryption = document.getElementById("encryption").checked;
        const select = document.getElementById("context_tags");
        current_user.selected_context = select.selectedIndex >= 0 ? select.options[select.selectedIndex].value : current_user.selected_context;
        database.user.put(current_user).then(() => {
            document.getElementById("setting_dialog").classList.remove("is-active");
        });
    });
    document.getElementById("version").onclick = (() => {
        document.getElementById("setting_dialog").classList.remove("is-active");
        if (navigator.serviceWorker.controller && ("postMessage" in navigator.serviceWorker.controller)) {
            change_view("loading_view");
            navigator.serviceWorker.controller.postMessage({
                tag: "{{CAMERA_APP_FORCE_UPDATE_TAG}}"
            });
        }
    });
    database = new Dexie("{{CAMERA_APP_DATABASE_NAME}}");
    database.version("{{CAMERA_APP_DATABASE_VERSION}}").stores({
        user: "dummy_id, user_id",
        photo: "++id, date_taken"
    });
    navigator.serviceWorker.register("camera-serviceworker.js").then(() => {
        navigator.serviceWorker.ready.then(registration => {
            service_worker = registration;
            if ("sync" in service_worker) {
                service_worker.sync.register("{{CAMERA_APP_UPLOAD_PHOTO_TAG}}");
            }
            navigator.serviceWorker.onmessage = (event => {
                if (event.data.tag === "{{CAMERA_APP_PHOTO_UPLOADED_TAG}}") {
                    database.photo.count().then(count => {
                        document.getElementById("photo_count").value = photo_count = count;
                    });
                } else if (event.data.tag === "{{CAMERA_APP_FORCE_UPDATE_TAG}}") {
                    window.location = "camera-app.html{{APP_MODE_URL_PARAM}}";
                }
            });
        });
    });
    if (document.location.search !== "{{APP_MODE_URL_PARAM}}") {
        change_view("install_view");
        return;
    }
    load_user().then(result => {
        setup_ui();
        update_preview();
        background_task_timer = setTimeout(background_task, BACKGROUND_TASK_INTERVAL);
        change_view(result ? "main_view" : "signin_view");
    });
}