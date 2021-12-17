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

// 現在アプリでサインインしているユーザーを示す変数(新規作成時の初期値を含む).
let current_user = {
    dummy_id: "{{APP_DATABASE_CURRENT_USER}}",
    user_id: null,
    username: null,
    encrypted_password: null,
    author_name: null,
    context_tag: null,
    scene_tag: null,
    scene_color: null,
    shutter_sound: true, // シャッターサウンドはデフォルトでオン.
    auto_reload: true, // 自動リロードはデフォルトでオン.
    encryption: true, // 暗号化もデフォルトでオン.
    selected_context: null, // 現在選択しているコンテキストを覚えておく.
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

// service workerに写真のアップロードを任せるか?
let use_service_worker = false;

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
        // いったんシャッターを消す.
        document.getElementById("shutters").style.display = "none";
        // 結びつけているストリームを全てリセットする.
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
        // ページが表示状態なら再表示.
        if (document.visibilityState === "visible") {
            // デバイスパラメータを用いてストリームに接続する.        
            navigator.mediaDevices.getUserMedia(DEVICE_PARAM).then(stream => {
                const preview = document.getElementById("preview");
                const my_image_capture = class {
                    // 実行環境に存在しない時に使用する簡易版ImageCapture実装.                
                    async takePhoto() {
                        return new Promise(resolve => {
                            const canvas = document.getElementById("canvas");
                            canvas.width = preview.videoWidth;
                            canvas.height = preview.videoHeight;
                            canvas.getContext("2d").drawImage(preview, 0, 0);
                            canvas.toBlob(resolve, "image/jpeg", 1.0);
                        });
                    }
                };
                image_capture = typeof ImageCapture === "undefined" ? new my_image_capture() : new ImageCapture(stream.getVideoTracks()[0]);
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
    // もういっぱいならこれ以上撮影できない.
    if (photo_count >= Number("{{CAMERA_APP_MAX_PHOTO_COUNT}}")) {
        return;
    }
    // プレビューが消えていたら撮影できない.
    const preview = document.getElementById("preview");
    if (!image_capture || preview.style.visibility === "hidden") {
        return;
    }
    // プレビューを消す.
    preview.style.visibility = "hidden";
    // シャッター音を再生する.
    // safariがUIイベント経由でないとサウンド再生を許可してくれないのでここで再生する.
    const shutter_audio = document.getElementById("shutter_audio");
    if (current_user.shutter_sound) {
        shutter_audio.pause();
        shutter_audio.currentTime = 0;
        shutter_audio.load();
        shutter_audio.play();
    }
    // とりあえず枚数を増やしておく...
    photo_count++;
    document.getElementById("photo_count").value = photo_count;
    // 今の時点を撮影日時とする.
    const start_time = new Date();
    // 実際の画像情報を取得する.
    // TODO: 本当はここでカメラの性能を生かせるようにいろいろ設定するべき...
    image_capture.takePhoto(CAPTURE_PARAM).then(image => {
        console.info(`captured image type : ${image.type}`);
        console.info(`captured image size : ${image.size}`);
        // 画像を読み込む.
        const image_reader = new FileReader();
        image_reader.onload = () => {
            let data = image_reader.result;
            let key = "{{NO_ENCRYPTION_KEY}}";
            // 暗号化の処理をする.
            if (current_user.encryption) {
                key = CryptoJS.lib.WordArray.random(Number("{{MEDIA_ENCRYPTION_KEY_LENGTH}}")).toString();
                const base64_raw = btoa(new Uint8Array(data).reduce((d, b) => d + String.fromCharCode(b), ""));
                const base64_encrypted = CryptoJS.AES.encrypt(base64_raw, key).toString();
                data = base64_encrypted;
                console.info(`encrypted data size :${base64_encrypted.length}`);
            }
            // TODO: 本当はここでサイズを確認し超えていたら何らかのエラーにしてしまうべき.            
            // データベースに保管する.
            database.photo.add({
                owner: current_user.user_id,
                date_taken: start_time.toJSON(),
                author_name: current_user.author_name,
                scene_tag: scene_tag,
                context_tag: document.getElementById("context_tags").value,
                content_type: image.type,
                encryption_key: key,
                encrypted_data: data
            }).then(() => {
                console.info(`photo processing time :${(new Date() - start_time)}`);
                // プレビューを再開する.
                preview.style.visibility = "visible";
                // アップロードのためにservice workerにsyncイベントを登録する.
                if ("sync" in service_worker) {
                    service_worker.sync.register("{{CAMERA_APP_UPLOAD_PHOTO_TAG}}").then(() => {
                        use_service_worker = true;
                    }).catch(error => {
                        console.warn("could not register {{CAMERA_APP_UPLOAD_PHOTO_TAG}} :", error);
                        use_service_worker = false;
                    });
                }
            });
        };
        image_reader.readAsArrayBuffer(image);
    }).catch(error => {
        console.warn("exception in take_photo() : ", error);
    });
}

/**
 * Tokenサービスから現在のユーザーにもとづいたトークンをもってくる.
 * @return {Promise<boolean}> true:もってこれた. / false:もってこれなかった.
 */
async function get_token() {
    if (!token) {
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
        if (response.status === 200) {
            const result = await response.json();
            if (result) {
                token = result.access;
                return token ? token : false;
            }
        }
        return false;
    }
    // とりあえずトークンはある...
    return true;
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
    current_user = user;
    // 初回だけデータベースにあった情報で表示を更新する.
    if (!date_updated) {
        date_updated = "dummy";
        setup_ui();
    }
    while (true) {
        // オフラインならここで終了.
        if (!navigator.onLine) {
            return true;
        }
        // トークンがとれなければおしまい.        
        if (!await get_token()) {
            return false;
        }
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
            // 更新時刻が覚えているものと違えばUIを更新する.
            if (date_updated !== result[0].date_updated) {
                date_updated = result[0].date_updated;
                current_user.context_tag = result[0].context_tag;
                current_user.scene_tag = result[0].scene_tag;
                current_user.scene_color = result[0].scene_color;
                setup_ui();
            }
            const select = document.getElementById("context_tags");
            if (select.selectedIndex >= 0) {
                current_user.selected_context = select.options[select.selectedIndex].value;
            }
            await database.user.put(current_user);
            // 成功で戻る.
            return true;
        } else if (response.status === 401 || response.status === 403) {
            // エラーなら今のトークンがダメということでリトライ. 
            token = null;
        }
    }
}

/**
 * データベースにある写真を１枚だけMediaサービスにアップロードする.
 * @return {Promise<boolean>} true:アップロードした / false:アップロードしなかった.
 */
async function upload_photo() {
    // オフラインならなにもしない.
    if (!navigator.onLine) {
        return false;
    }
    // 写真がなければなにもしない.
    const photo = await database.photo.orderBy("date_taken").first();
    if (!photo) {
        return false;
    }
    // トークンがとれなければおしまい.
    if (!await get_token()) {
        return false;
    }
    // アップロードに使用するフォームを準備する.
    // MediaサービスのAPIはこの時だけJSONではなくてHTML Formであげていることに注意!
    const form_data = new FormData();
    form_data.append("owner", photo.owner);
    form_data.append("date_taken", photo.date_taken);
    form_data.append("author_name", photo.author_name);
    form_data.append("scene_tag", photo.scene_tag);
    form_data.append("context_tag", photo.context_tag);
    form_data.append("content_type", photo.content_type);
    form_data.append("encryption_key", photo.encryption_key);
    // フォームに写真を追加する.
    // 本当は form_data.append("data", photo.encrypted_data); でいいような気もする(ChromeだとOK)
    // でもSafariではform cacheに起因するバグ?で送信データのサイズが偶に0になってしまうということが起こる.
    // しょうがいないのでLastMOdifiedをつけるべくいったんFileオブジェクトを経由して設定する.
    const start_time = new Date();
    const encrypted_data = new File([photo.encrypted_data], `${photo.id}.bin`, { lastModified: start_time });
    form_data.append("encrypted_data", encrypted_data);
    // Mediaサービスに写真をアップロードする.
    const response = await fetch("{{MEDIA_API_URL}}", {
        method: "POST",
        headers: {
            "Authorization": `{{TOKEN_FORMAT}} ${token}`
        },
        body: form_data
    });
    // うまくいったらデータベースから削除する.
    if (response.status === 201) {
        console.info(`photo upload time :${(new Date() - start_time)}`);
        await database.photo.delete(photo.id);
        return true;
    } else if (response.status === 401 || response.status === 403) {
        token = null;
    }
    return false;
}

/**
 * 写真をあるだけ全部アップロードする.
 */
async function upload_all_photos() {
    let result = true;
    do {
        result = await upload_photo();
        photo_count = await database.photo.count();
        document.getElementById("photo_count").value = photo_count;
    } while (result && token);
}

/**
 *  current_userの中身からUIのエレメントを設定する.
 */
function setup_ui() {
    document.getElementById("username").value = current_user.username;
    document.getElementById("author_name").value = document.getElementById("current_author_name").value = current_user.author_name;
    document.getElementById("shutter_sound").checked = current_user.shutter_sound;
    document.getElementById("auto_reload").checked = current_user.auto_reload;
    document.getElementById("encryption").checked = current_user.encryption;
    let context_tags_html = "";
    if (current_user.context_tag) {
        for (const tag of current_user.context_tag.split(/,/)) {
            if (tag) {
                context_tags_html += (`<option class=\"context_tag\" value=\"${tag}\" ${(tag === current_user.selected_context ? "selected" : "")}>${tag}</option>`);
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
    // 写真の枚数を更新.
    database.photo.count().then(count => {
        document.getElementById("photo_count").value = photo_count = count;
    });
    // 選択されているコンテキストを念の為更新.
    const select = document.getElementById("context_tags");
    if (select.selectedIndex >= 0) {
        current_user.selected_context = select.options[select.selectedIndex].value;
    }
    // ユーザーの設定を自動更新.
    if (current_user.auto_reload) {
        load_user();
    }
    // 溜まっている写真をアップロード.
    if (!use_service_worker) {
        upload_all_photos();
    }
    // オンラインでかつトークンがないなら再度サインインを要求.
    if (navigator.onLine && !token) {
        change_view("signin_view");
    }
    // 終わったらもう一回自分を登録.
    background_task_timer = setTimeout(background_task, BACKGROUND_TASK_INTERVAL);
}

/**
 * アプリケーションのメイン.
 */
function main() {
    change_view("loading_view");
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
    navigator.serviceWorker.register("camera-serviceworker.js").then(registration => {
        navigator.serviceWorker.ready.then(registration => {
            service_worker = registration;
            // メッセージのハンドラも登録しておく.
            navigator.serviceWorker.onmessage = (event => {
                if (event.data.tag === "{{CAMERA_APP_PHOTO_UPLOADED_TAG}}") {
                    // service workerから写真アップロード実施のメッセージが来たら枚数のカウンタを変える.
                    database.photo.count().then(count => {
                        document.getElementById("photo_count").value = photo_count = count;
                    });
                } else if (event.data.tag === "{{CAMERA_APP_FORCE_UPDATE_TAG}}") {
                    // service workerから強制アップデートのメッセージが来たら自分自身を読み直す.
                    // すでにキャッシュはservice workerが削除しているのでこれでアップデートされる.
                    window.location = "camera-app.html{{APP_MODE_URL_PARAM}}";
                }
            });
        });
    });
    // タッチイベントを無効にしておく.
    window.addEventListener("touchmove", (event => {
        event.preventDefault();
    }));
    // オンラインになった時のイベントをセットする.
    window.addEventListener("offline", (() => {
        update_preview();
    }));
    // オフラインになった時のイベントをセットする.
    window.addEventListener("online", (() => {
        update_preview();
    }));
    // ページの表示状態が変わったときのイベントをセットする.
    document.addEventListener("visibilitychange", (() => {
        update_preview();
    }));
    // プレビューのメタデータがロードされたら再生を開始するイベントをセットする.    
    document.getElementById("preview").onloadedmetadata = (() => {
        document.getElementById("preview").play().catch(error => {
            console.error("could not start play preview :", error);
        });
    });
    // プレビューの再生が開始されたらシャッターを出現させるイベントをセットする.
    document.getElementById("preview").onplay = (() => {
        document.getElementById("shutters").style.display = "block";
    });
    // UIのイベントをセットする:再サインイン.
    document.getElementById("current_author_name").onclick = (() => {
        change_view("signin_view");
    });
    // UIのイベントをセットする:サインインキャンセル.
    document.getElementById("signin-cancel").onclick = (() => {
        if (token) {
            change_view("main_view");
        }
    });
    // UIのイベントをセットする:コンテキストを選択.
    document.getElementById("context_tags").onchange = (() => {
        const select = document.getElementById("context_tags");
        if (select.selectedIndex >= 0) {
            current_user.selected_context = select.options[select.selectedIndex].value;
            database.user.put(current_user);
        }
    });
    // UIのイベントをセットする:リロード.
    document.getElementById("photo_count").onclick = (() => {
        background_task();
    });
    // UIのイベントをセットする:サインイン.
    document.getElementById("signin").onclick = (() => {
        const signin_error = document.getElementById("signin_error");
        signin_error.style.display = "none";
        // 画面から情報をとってくる.
        const author_name = document.getElementById("author_name").value.trim();
        const username = document.getElementById("username").value.trim();
        const raw_password = document.getElementById("password").value;
        // 利用者の名前が正当かどうかを確認してだめならエラーとする.        
        const validator = /[\s\,\:\;\&\"\'\`\¥\|\~\%\/\\<\>\?\\\*]/m;
        if (!author_name || validator.exec(author_name)) {
            signin_error.style.display = "block";
            return;
        }
        // 入力情報を保存する.
        document.getElementById("current_author_name").value = current_user.author_name = author_name;
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
    // UIのイベントをセットする:設定.
    document.getElementById("setting").onclick = (() => {
        document.getElementById("setting_dialog").classList.add("is-active");
    });
    // UIのイベントをセットする:設定保存.
    document.getElementById("save_setting").onclick = (() => {
        // 設定値を保存する.
        current_user.shutter_sound = document.getElementById("shutter_sound").checked;
        current_user.auto_reload = document.getElementById("auto_reload").checked;
        current_user.encryption = document.getElementById("encryption").checked;
        const select = document.getElementById("context_tags");
        if (select.selectedIndex >= 0) {
            current_user.selected_context = select.options[select.selectedIndex].value;
        }
        database.user.put(current_user).then(() => {
            document.getElementById("setting_dialog").classList.remove("is-active");
        });
    });
    // UIのイベントをセットする:バージョンアップ.
    document.getElementById("version").onclick = (() => {
        document.getElementById("setting_dialog").classList.remove("is-active");
        change_view("loading_view");
        // service workerにメッセージをポストする.        
        if (navigator.serviceWorker.controller && ("postMessage" in navigator.serviceWorker.controller)) {
            navigator.serviceWorker.controller.postMessage({
                tag: "{{CAMERA_APP_FORCE_UPDATE_TAG}}"
            });
        } else {
            console.warn("Cound not post message.");
        }
    });
    // Dexieのインスタンスを作る.
    database = new Dexie("{{CAMERA_APP_DATABASE_NAME}}");
    database.version("{{CAMERA_APP_DATABASE_VERSION}}").stores({
        user: "dummy_id, user_id",
        photo: "++id, date_taken"
    });
    // プレビューを開始する.
    update_preview();
    // ユーザーをロードして処理開始.
    load_user().then(success => {
        change_view(success ? "main_view" : "signin_view");
        background_task();
    });
}