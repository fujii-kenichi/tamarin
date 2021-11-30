/** 
 * タマリンカメラ.
 * @author FUJII Kenichi <fujii.kenichi@tamariva.co.jp>
 */
"use strict";

// デバッグフラグ.
const DEBUG = Boolean("{{DEBUG}}");

// IndexedDBにパスワードを保存する際の暗号化に使うキー.
const SECRET_KEY = String("{{SECRET_KEY}}");

// 写真の暗号化のために自動生成するキーの長さ.
const MEDIA_ENCRYPTION_KEY_LENGTH = Number("{{MEDIA_ENCRYPTION_KEY_LENGTH}}");

// メインループを繰り返すときの待ち時間(ミリ秒).
const MAIN_LOOP_INTERVAL = Number("{{MAIN_LOOP_INTERVAL}}");

// 自動でConnectorからUserのデータを自動リロードする間隔(アイドル状態の回数).
const AUTO_RELOAD_TRIGGER = Number("{{AUTO_RELOAD_TRIGGER}}");

// データベース(IndexedDB)に入れることのできる写真の最大枚数(つまりオフラインで撮影して溜めて置ける最大の枚数.
const MAX_PHOTO_COUNT = Number("{{MAX_PHOTO_COUNT}}");

// シャッターを切ったときにそれっぽい効果をだすためにビデオを一瞬止める時間(ミリ秒).
const SHUTTER_PAUSE_TIME = 1 * 1000;

// デバイス初期化用の文字列.
const DEVICE_PARAM = String("{{DEVICE_PARAM}}").replaceAll("&quot;", '"');

// HTMLの各要素.
const CAMERA_VIEW = document.getElementById("camera_view");
const AUTH_VIEW = document.getElementById("auth_view");
const SETTING_VIEW = document.getElementById("setting_view");
const LOADING_VIEW = document.getElementById("loading_view");
const INSTALL_VIEW = document.getElementById("install_view");
const ERROR_VIEW = document.getElementById("error_view");
const DEBUG_VIEW = document.getElementById("debug_view");

const CAMERA_PREVIEW = document.getElementById("camera_preview");
const CAMERA_SHUTTER = document.getElementById("camera_shutter");
const CAMERA_AUTHOR_NAME = document.getElementById("camera_author_name");
const CAMERA_CONTEXT_TAG = document.getElementById("camera_context_tag");
const CAMERA_PHOTO_COUNT = document.getElementById("camera_photo_count");
const CAMERA_SETTING = document.getElementById("camera_setting");
const CAMERA_DEBUG = document.getElementById("camera_debug");
const CAMERA_SHUTTER_SOUND = document.getElementById("camera_shutter_sound");

const AUTH_ERROR_MESSAGE = document.getElementById("auth_error_message");
const AUTH_AUTHOR_NAME = document.getElementById("auth_author_name");
const AUTH_USERNAME = document.getElementById("auth_username");
const AUTH_PASSWORD = document.getElementById("auth_password");
const AUTH_OK = document.getElementById("auth_ok");

const SETTING_SHUTTER_SOUND = document.getElementById("setting_shutter_sound");
const SETTING_AUTO_RELOAD = document.getElementById("setting_auto_reload");
const SETTING_ENCRYPTION = document.getElementById("setting_encryption");
const SETTING_OK = document.getElementById("setting_ok");

const DEBUG_LOG = document.getElementById("debug_log");
const DEBUG_RELOAD = document.getElementById("debug_reload");
const DEBUG_CLEAR = document.getElementById("debug_clear");
const DEBUG_RESET = document.getElementById("debug_reset");
const DEBUG_STATE = document.getElementById("debug_state");
const DEBUG_CAMERA = document.getElementById("debug_camera");
const DEBUG_CLOSE = document.getElementById("debug_close");

// データベース(IndexedDBを使うためのDexie)のインスタンス.
let database = null;

// 現在アプリでサインインしているユーザを示す変数(新規作成時の初期値を含む).
let current_user = {
    dummy_id: "{{DATABASE_USER_DUMMY_ID}}",
    user_id: null,
    username: null,
    encrypted_password: null,
    author_name: null,
    scene_tag: null,
    scene_color: null,
    context_tag: null,
    shutter_sound: true,
    auto_reload: true,
    encryption: true
};

// オンラインかオフラインを示す情報.
let online = false;

// メインループのステートマシンにおけるステートを示す変数.
let state = "init";

// Tokenサービスが返してきたアクセストークン(無い場合はnull).
let token = null;

// データベースに今何枚の写真があるか？.
let photo_count = 0;

// 自動リロードをトリガーするための待ち状態カウント.
let idle_count = 0;

// 写真撮影時に使用するオブジェクト.
let image_capture = null;

// Service workerの登録情報.
let serviceworker_registration = null;

// 不要なUI(DOM)の更新を避けるため前の状態を記憶するための変数たち.
let last_state = null;
let last_author_name = null;
let last_scene_tag = null;
let last_scene_color = null;
let last_context_tag = null;
let last_photo_count = null;

// メインループで使うタイマー.
let timeout_id = null;

// デバッグ時に出力されたログを順番に覚えておくためのバッファ.
let debug_log = [];

/**
 * 溜めておいたデバッグログをUIに読み込む.
 */
async function load_debug_log() {
    // TODO: Json化できない(つまり正しく情報が出ない)オブジェクトを無くすこと！
    DEBUG_LOG.value = JSON.stringify(debug_log, null, 2);
}

/**
 * デバッグ用にログ出力機能をセットアップする.
 */
async function setup_debug_log() {

    if (DEBUG) {
        // デバッグモードだったらconsoleへのログ出力を横取りしてバッファにも溜めておく.            
        const original_error = console.error;
        console.error = (...args) => {
            debug_log.push(Array.from(args));
            return original_error(args);
        }

        const original_warn = console.warn;
        console.warn = (...args) => {
            debug_log.push(Array.from(args));
            return original_warn(args);
        }

        const original_info = console.info;
        console.info = (...args) => {
            debug_log.push(Array.from(args));
            return original_info(args);
        }

        // デバッグ用UIのイベントを設定する.
        CAMERA_DEBUG.onclick = (async(event) => {
            DEBUG_VIEW.style.display = "block";
            load_debug_log();
        });

        DEBUG_RELOAD.onclick = (async(event) => {
            load_debug_log();
        });

        DEBUG_CLEAR.onclick = (async(event) => {
            debug_log = [];
            load_debug_log();
        });

        DEBUG_STATE.onclick = (async(event) => {
            DEBUG_LOG.value = "{ online: " + online + " }";
        });

        DEBUG_RESET.onclick = (async(event) => {
            await database.photo.clear();
            await database.user.clear();
            DEBUG_LOG.value = "reset database.";
        });

        DEBUG_CAMERA.onclick = (async(event) => {
            await setup_camera();
            DEBUG_LOG.value = "setup camera.";
        });

        DEBUG_CLOSE.onclick = (async(event) => {
            DEBUG_VIEW.style.display = "none";
        });

    } else {
        // デバッグモードじゃない場合には、逆にconsole系は何もしないようにする.
        console.error = (...args) => {};
        console.warn = (...args) => {};
        console.info = (...args) => {};
        console.log = (...args) => {};
        console.assert = (...args) => {};

        // デバッグ機能の有効化ボタンを消しておく.
        CAMERA_DEBUG.style.display = "none";
    }
}

/**
 * データベース(IndexedDB)をセットアップする.
 */
async function setup_database() {
    console.assert(!database);

    // Dexieのインスタンスを作る.
    database = new Dexie("{{DATABASE_NAME}}");
    console.assert(database);

    // インデックスを設定する.
    database.version("{{DATABASE_VERSION}}").stores({
        user: "dummy_id, user_id",
        photo: "++id, date_taken"
    });
}

/**
 * カメラ(撮影デバイス)をセットアップする.
 */
async function setup_camera() {
    // TODO: 作成済みのImage Captureがあった場合の処理を追加する.
    if (image_capture) {
        console.warn("how can I destroy image capture object instance gently ...?");
        image_capture = null;
    }

    try {
        // Viewから渡された設定値を使ってJSONを作る.
        const device_param = JSON.parse(DEVICE_PARAM);
        console.assert(device_param);
        console.info("getting user media devices using param :", device_param);

        // カメラストリームに接続する.
        const stream = await navigator.mediaDevices.getUserMedia(device_param);
        console.assert(stream);
        console.log("connected to stream :", stream);

        // TODO: 本当はここでカメラの性能を生かせるようにいろいろ設定するべき...

        // カメラストリームの情報を取得する.
        const settings = stream.getVideoTracks()[0].getSettings();
        console.assert(settings);
        console.info("stream settings :", settings);

        // カメラストリームをプレビューにつなげて再生を開始する. 
        CAMERA_PREVIEW.srcObject = stream;

        // 撮影用のオブジェクトを初期化しておく.
        image_capture = new ImageCapture(stream.getVideoTracks()[0]);
        console.assert(image_capture);
    } catch (error) {
        console.error("camera setup error :", error.toString());
        state = "open_error_view";
    }
}

/**
 * アプリの動作に必要となるプラットフォーム関連の初期化を行う.
 */
async function init() {
    console.assert(!serviceworker_registration);

    // service worker が使える環境かどうかをチェック.
    if (!("serviceWorker" in navigator)) {
        console.error("no service worker in navigator.");
        state = "open_error_view";
        return;
    }

    // 起動時のURLを確認し、もしPWAとしての起動でなければインストールビューを表示するようにしておいて抜ける.
    const param = document.location.search;
    console.assert(param);
    console.log("startup parameter :", param);

    if (param !== "{{MODE_APP}}") {
        console.log("no {{MODE_APP}} param in url :", document.location.search);
        state = "open_install_view";
        return;
    }

    // service workerの登録を行う.
    try {
        navigator.serviceWorker.register("camera-serviceworker.js").then(registration => {
            console.log("service worker registrated :", registration);

            navigator.serviceWorker.ready.then(registration => {
                console.log("service worker is ready :", registration);
                serviceworker_registration = registration;
                state = "start";
            });
        });
    } catch (error) {
        // service workerが登録できなかった場合は起動できないエラーとして扱う.
        console.error("service worker registration error :", error.toString());
        state = "open_error_view";
    }
}

/**
 * Tokenサービスから現在のユーザにもとづいた有効なトークンを生成する.
 */
async function get_token() {
    // これを呼んだら以前のトークンはもう忘れておく.
    token = null;

    // Tokenサービスを呼び出すために現在のユーザに紐づいたパスワードを復号する.
    const raw_password = CryptoJS.AES.decrypt(current_user.encrypted_password, SECRET_KEY).toString(CryptoJS.enc.Utf8);
    console.assert(raw_password);

    // Tokenサービスを呼び出す.
    console.log("calling token service : {{CREATE_TOKEN_URL}}");
    const token_response = await fetch("{{CREATE_TOKEN_URL}}", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "username": current_user.username,
            "password": raw_password
        })
    });
    console.assert(token_response);
    console.log("token service respond :", token_response);

    // レスポンスが200のときだけトークンを更新する.
    if (token_response.status === 200) {
        const result = await token_response.json();
        console.assert(result);

        token = result.access;
        console.assert(token);
    }
}

/**
 * Userサービスから対応するユーザの情報をもってくる.
 * 
 * @param {*} new_state 成功した際に次に移るべきステート
 */
async function load_user(new_state) {
    console.assert(new_state);

    // データベースにユーザーが保存されているかどうかを確認する.
    console.log("loading current user from database.");
    const user = await database.user.get("{{DATABASE_USER_DUMMY_ID}}");

    if (!user) {
        // データベースにユーザーが存在しない場合は、初回起動とみなして認証ビューを開くようにステートを変えて抜ける.
        console.warn("could not find current user in database - may be the first run.");
        state = "open_auth_view";
        return;
    }

    // データベースに格納されていた情報を変数に移す.
    current_user = user;

    // オフライン時の判断をする.
    if (!online) {

        // Userサービスからすでにidが取れているのであれば、大丈夫そうだと判断してオフラインでの動作を続行する.                    
        // そうでない場合はまあオフラインなんで意味ないんだけど(とはいってもこのまま続行もできないので)認証パネルを出すようにして抜ける.
        if (current_user.user_id) {
            console.warn("assuming current user would be valid in offline :", current_user.user_id);
            state = new_state;
        } else {
            console.warn("current user may be insufficient in offline :", current_user.username);
            state = "authentication_failed";
        }

        // いずれにしろオフライン時はここで抜ける.
        return;
    }

    // アクセストークンをとってきて、失敗したら認証パネルを出すようにステートを変えて終了する.
    await get_token();

    if (!token) {
        state = "authentication_failed";
        return;
    }

    // 現在のユーザに対応するデータをUserサービスから持ってくる.
    console.log("calling user service : {{USER_API_URL}}");
    const user_response = await fetch("{{USER_API_URL}}" + "?username=" + current_user.username, {
        headers: {
            "Authorization": "{{TOKEN_FORMAT}} " + token
        }
    });
    console.assert(user_response);

    // レスポンスのステータスが200じゃなかったら、不明なエラーということでステートを変えて抜ける.
    if (user_response.status !== 200) {
        console.error("could not get user :", user_response.status);
        state = "service_error";
        return;
    }

    // UserサービスからとってきたデータをJSONにする.
    const result_user = await user_response.json();
    console.assert(result_user);
    console.assert(result_user.length === 1);

    // そのJSONから現在のユーザを示す変数を更新する.
    console.info("update current user :", current_user.username);
    current_user.user_id = result_user[0].id;
    console.assert(current_user.user_id);

    current_user.scene_tag = result_user[0].scene_tag;
    console.assert(current_user.scene_tag);

    current_user.scene_color = result_user[0].scene_color;
    console.assert(current_user.scene_color);

    current_user.context_tag = result_user[0].context_tag;
    console.assert(current_user.context_tag);

    // 更新されたユーザを示す変数をさらにデータベースに保存する.
    console.log("save current user to database :", current_user);
    await database.user.put(current_user);

    // 新しいユーザの情報でUIの表示を更新する.
    await update_camera_view();

    // 呼び出し元が期待する次のステートに遷移するようにして処理を終了する.
    state = new_state;
}

/**
 * 撮影済みの写真枚数の表示を更新する.
 */
async function update_photo_counter() {

    // データベースのレコード数を枚数とみなす.
    photo_count = await database.photo.count();

    // 値が前と違っていたらUIを更新する.
    if (photo_count !== last_photo_count) {
        last_photo_count = photo_count;
        CAMERA_PHOTO_COUNT.value = photo_count;
    }
}

/**
 * カメラ操作ビューの表示内容を更新する.
 */
async function update_camera_view() {

    // まず撮影済み枚数の表示を更新する.
    await update_photo_counter();

    // "撮影者"の情報が前と違っていたら更新する.
    if (last_author_name !== current_user.author_name) {
        last_author_name = current_user.author_name;
        CAMERA_AUTHOR_NAME.value = last_author_name;
    }

    // "シーン"の情報が前と違っていたら更新する.    
    if (last_scene_tag !== current_user.scene_tag || last_scene_color !== current_user.scene_color) {
        last_scene_tag = current_user.scene_tag;
        last_scene_color = current_user.scene_color;
        let inner_html = "";

        if (current_user.scene_tag) {
            const scene_tag = last_scene_tag.split(/,/);
            console.assert(scene_tag);

            const scene_color = last_scene_color.split(/,/);
            console.assert(scene_color);

            // CSVのタグを分解してループを回してボタンを生成してセットする.
            for (let i = 0; i < scene_tag.length; i++) {
                const v = scene_tag[i].trim();
                console.assert(v);

                // 色は数が足りない場合はデフォルトのテーマカラーで補う.
                const c = scene_color.length > i ? scene_color[i].trim() : "{{THEME_COLOR}}";
                console.assert(c);

                inner_html += ("<div class=\"camera_shutter_button\" style=\"background-color:" + c + ";\" onclick='take_photo(\"" + v + "\")'>" + v + "</div>");
            }
        } else {
            console.warn("scene tag is empty - no camera shutter.");
        }
        CAMERA_SHUTTER.innerHTML = inner_html;
    }

    // "状況"の情報が前と違っていたら更新する.        
    if (last_context_tag !== current_user.context_tag) {
        last_context_tag = current_user.context_tag;
        let inner_html = "";

        if (current_user.context_tag) {

            // CSVのタグを分解してループを回してオプションタグ(選択肢)を生成してセットする.            
            for (const t of last_context_tag.split(/,/)) {
                const v = t.trim();
                console.assert(v);

                inner_html += ("<option class=\"camera_context_tag\" value=\"" + v + "\">" + v + "</option>");
            }
        } else {
            console.warn("context tag is empty - no context option.");
        }
        CAMERA_CONTEXT_TAG.innerHTML = inner_html;
    }
}

/**
 * 写真を撮影する.
 * 
 * @param {*} scene_tag 写真のシーンを示す情報(イベントを発行するボタンから引き継がれてくる)
 */
async function take_photo(scene_tag) {
    console.assert(scene_tag);

    // もう規定枚数いっぱいいならこれ以上撮影できない.
    if (photo_count >= MAX_PHOTO_COUNT) {
        console.warn("photo database is full :", photo_count);
        return;
    }

    // 今の日時を撮影日時とする(EXIFを用いる等ではなくここで生成する点に注意!)
    const start_time = new Date();
    console.assert(start_time);

    // 撮影日時をISOフォーマット(UTC)で保管.
    const date_taken = start_time.toJSON();
    console.assert(date_taken);

    // シャッター音を再生する.
    // safariがUIスレッドでないとサウンド再生を許可してくれないのでここで再生する.
    // 一回停止して再生時間をリセットしているのは連続でシャッターを切った際に音がちゃんとかぶさるようにするため.
    if (current_user.shutter_sound) {
        CAMERA_SHUTTER_SOUND.pause();
        CAMERA_SHUTTER_SOUND.currentTime = 0;
        CAMERA_SHUTTER_SOUND.play();
    }

    // 一瞬プレビューのビデオを止めることで撮影したっぽい効果をだす.
    CAMERA_PREVIEW.pause();
    setTimeout(() => {
        CAMERA_PREVIEW.play();
    }, SHUTTER_PAUSE_TIME);

    // 実際の画像情報を取得する.
    const image = await image_capture.takePhoto();
    console.assert(image);
    console.log("image captured :", image);
    console.info("captured image type :", image.type);
    console.info("captured image size :", image.size);

    // 画像を読み込む準備をする.
    const image_reader = new FileReader();
    console.assert(image_reader);

    image_reader.onload = () => {
        // 画像の読み込みが完了したらここにくる.
        let data = image_reader.result;
        console.assert(data);

        // "暗号化していない"を示す値で暗号キーを初期化する.
        let key = "none";

        // 設定に基づいて暗号化の処理を行う.
        if (current_user.encryption) {

            // 暗号キーは乱数で毎回自動生成する.
            key = CryptoJS.lib.WordArray.random(MEDIA_ENCRYPTION_KEY_LENGTH).toString();
            console.assert(key);

            // 画像をBASE64に変換する.
            const base64_raw = btoa(new Uint8Array(data).reduce((d, b) => d + String.fromCharCode(b), ''));
            console.assert(base64_raw);
            console.log("base64 raw data size :", base64_raw.length);

            // BASE64を作成したキーで暗号化する.
            const base64_encrypted = CryptoJS.AES.encrypt(base64_raw, key).toString();
            console.assert(base64_encrypted);
            console.log("base64 encrypted data size :", base64_encrypted.length);

            // 処理結果を撮影データにすり替える.
            data = base64_encrypted;
        }
        console.assert(data);
        console.assert(key);

        // "状況"を示す情報を取得する.
        const context_tag = CAMERA_CONTEXT_TAG.value;
        console.assert(context_tag);

        // ここまでの処理にかかった時間をログに書いておく.
        console.info("photo processing time in ms :", new Date() - start_time);

        // TODO: 本当はここでアップロードサイズを確認し、もしそれを超えていたら何らかのエラーにしてしまうべき.

        // データベースに保管する.
        console.log("adding photo to database.");
        database.photo.add({
            owner: current_user.user_id,
            date_taken: date_taken,
            author_name: current_user.author_name,
            scene_tag: scene_tag,
            context_tag: context_tag,
            content_type: image.type,
            encryption_key: key,
            encrypted_data: data
        }).then(() => {
            // データベースの更新が成功したら撮影済みカウンタの表示を更新する.
            update_photo_counter();

            // service workerにsyncイベントを登録する.
            console.assert(serviceworker_registration);
            serviceworker_registration.sync.register("{{SYNC_TAG}}").then(() => {
                console.info("service worker sync registrated :{{SYNC_TAG}}");
            });
        });
    }

    // 画像を読み込む.
    image_reader.readAsArrayBuffer(image);
}

/**
 * データベースにある写真を１枚だけMediaサービスにアップロードする.
 */
async function upload_photo() {
    // 最も古い写真をデータベースから取得する.
    const photo = await database.photo.orderBy("date_taken").first();

    // なかったらなにもしないで終了する.
    if (!photo) {
        console.log("photo database is empty.");
        return;
    }

    console.assert(photo.id);
    console.info("start uploading photo to media service :", photo.id);

    // アップロードにかかった時間を計測するための準備をする.
    const start_time = new Date();
    console.assert(start_time);

    // アップロードに使用するフォームを準備する.
    // MediaサービスのAPIはこの時だけJSONではなくてHTML Formであげていることに注意！
    const form_data = new FormData();
    console.assert(form_data);

    // フォームに属性情報を入れていく.
    form_data.append("owner", photo.owner);
    form_data.append("date_taken", photo.date_taken);
    form_data.append("author_name", photo.author_name);
    form_data.append("scene_tag", photo.scene_tag);
    form_data.append("context_tag", photo.context_tag);
    form_data.append("content_type", photo.content_type);
    form_data.append("encryption_key", photo.encryption_key);

    // フォームに写真を追加する.
    // 本当は form_data.append("data", photo.encrypted_data); でいいような気もするけど(ChromeだとOK)、
    // これだとSafariではform cacheに起因するバグ？で送信データのサイズが偶に0になってしまうということが起こる.
    // しょうがいないのでLastMOdifiedをつけるべくいったんFileオブジェクトを経由して設定する.
    const encrypted_data = new File([photo.encrypted_data], photo.id + ".bin", { lastModified: start_time });
    form_data.append("encrypted_data", encrypted_data);

    // Mediaサービスに写真をアップロードする.
    console.log("calling media service : {{MEDIA_API_URL}}");
    const media_response = await fetch("{{MEDIA_API_URL}}", {
        method: "POST",
        headers: {
            "Authorization": "{{TOKEN_FORMAT}} " + token
        },
        body: form_data
    });
    console.assert(media_response);
    console.log("media service returns response :", media_response);

    // 処理結果のHTTPステータスコードをみる.
    switch (media_response.status) {
        case 201:
            // 無事にアップロードできた!
            console.log("photo uploaded successfully :", photo.id);
            console.info("photo upload time in ms :", new Date() - start_time);

            // データベースから該当する写真を削除する.
            console.log("deleting photo :", photo.id);
            await database.photo.delete(photo.id);
            break;

        case 401:
            // 認証エラーということはたぶんトークンの期限切れ.
            console.warn("photo uploaded failed with 401 - may be token expired :", current_user.user_id);

            // トークンを取っておいて次回のこの処理では失敗しないことを願う.
            await get_token();
            break;

        default:
            // 予期していないステータスコードが返ってきちゃったので(危ないので)とりあえずエラーとする.
            // TODO: もうちょっとステータスコードの処理を増やしたほうがいいかも...
            console.warn("unexpected status code returned from media service  :", media_response.status);
            state = "service_error";
            break;
    }
}

/**
 * ひたすらぐるぐる回るアプリケーションのメインループ.
 */
async function main_loop() {
    let keep_main_loop = true;

    // 前のタイマーを破棄する.
    if (timeout_id) {
        clearTimeout(timeout_id);
    }

    try {
        // ステートとオンラインの状況を最新化する.
        if (state !== last_state) {
            last_state = state;
            console.log("current state :", state);
        }
        online = navigator.onLine === false ? false : true;

        // 対応するステートによって処理を分岐させる.
        switch (state) {
            case "init":
                // 初期化：初期化処理をする(次のステートはinit()の中で設定される).
                await init();
                break;

            case "start":
                // スタート；ステートをユーザの更新に変更する.
                state = "load_user";
                break;

            case "load_user":
                // ユーザの更新：データベースからユーザを更新し成功したらカメラ操作ビューを開く.
                await load_user("open_camera_view");
                break;

            case "open_auth_view":
                //  認証ビューを開く：認証ビューだけを有効化する.
                state = "in_auth_view";
                LOADING_VIEW.style.display = "none";
                CAMERA_VIEW.style.display = "none";
                AUTH_VIEW.style.display = "block";
                SETTING_VIEW.style.display = "none";

                // UI要素の情報を更新しておく.
                AUTH_AUTHOR_NAME.value = current_user.author_name;
                AUTH_USERNAME.value = current_user.username;
                break;

            case "in_auth_view":
                // 認証ビューを表示中：このステートを繰り返す.
                break;

            case "authentication_failed":
                // 認証失敗：エラーメッセージを有効化したうえで認証ビューを開く.
                state = "open_auth_view";
                AUTH_ERROR_MESSAGE.style.display = "block";
                break;

            case "open_camera_view":
                // カメラ操作ビューを開く：カメラ操作用のビューだけを有効化する.
                state = "in_camera_view";
                LOADING_VIEW.style.display = "none";
                CAMERA_VIEW.style.display = "block";
                AUTH_VIEW.style.display = "none";
                SETTING_VIEW.style.display = "none";

                idle_count = 0;

                // UI表示を最新化する.
                await update_camera_view();
                break;

            case "in_camera_view":
                // カメラ操作ビューを表示中：写真のアップロードとユーザの自動リロードを処理する.
                if (online) {
                    idle_count++;

                    if (photo_count > 0) {
                        // もし今がオンラインで写真がたまっていれば、1枚だけアップロードをする.
                        await upload_photo();
                        idle_count = 0;
                    } else {
                        // もしこのステートが十分な回数繰り返されているようであり、かつ自動リロード設定が有効な場合は、ユーザ情報のリロードをする.
                        if (current_user.auto_reload && idle_count > AUTO_RELOAD_TRIGGER) {
                            console.log("auto (silent) reloading user from user service.");
                            idle_count = 0;
                            await load_user("in_camera_view");
                        }
                    }
                }

                // 撮影済み枚数の表示を更新する.
                await update_photo_counter();
                break;

            case "open_setting_view":
                // 設定ビューを開く：設定用のビューだけを有効化する.
                state = "in_setting_view";
                LOADING_VIEW.style.display = "none";
                CAMERA_VIEW.style.display = "none";
                AUTH_VIEW.style.display = "none";
                SETTING_VIEW.style.display = "block";

                // UI要素の情報を更新しておく.                
                SETTING_SHUTTER_SOUND.checked = current_user.shutter_sound;
                SETTING_AUTO_RELOAD.checked = current_user.auto_reload;
                SETTING_ENCRYPTION.checked = current_user.encryption;
                break;

            case "in_setting_view":
                // 設定ビューを表示中：このステートを繰り返す.                
                break;

            case "open_reload_view":
                // ユーザ情報をUserサービスからリロードする：UIを切り替えてから"load_user"に遷移する.
                state = "load_user";
                LOADING_VIEW.style.display = "block";
                CAMERA_VIEW.style.display = "none";
                AUTH_VIEW.style.display = "none";
                SETTING_VIEW.style.display = "none";
                AUTH_ERROR_MESSAGE.style.display = "none";
                break;

            case "open_install_view":
                // インストールビューを開く：インストールを促すメッセージを表示してメインループを終了する.
                keep_main_loop = false;
                INSTALL_VIEW.style.display = "block";
                LOADING_VIEW.style.display = "none";

                console.info("open install view - teminate main loop.");
                break;

            case "open_error_view":
                // エラービューを開く：エラーを示すメッセージを表示してメインループを終了する.
                keep_main_loop = false;
                LOADING_VIEW.style.display = "none";
                CAMERA_VIEW.style.display = "none";
                AUTH_VIEW.style.display = "none";
                SETTING_VIEW.style.display = "none";
                ERROR_VIEW.style.display = "block";

                console.error("fatal error - teminate main loop.");

                // デバッグ時にはログを見せて終わりにする.
                if (DEBUG) {
                    DEBUG_VIEW.style.display = "block";
                    load_debug_log();
                }
                break;

            case "service_error":
                // サービスエラーが発生した：エラービューに遷移する.
                console.warn("something wrong in network service.");

                // TODO: いきなり終わるんじゃなくて、もっとエラー内容に応じたリカバリ処理をすること！
                state = "open_error_view";
                break;

            default:
                // 未定義のステート：実装エラーとみなしてエラービューを表示して終了する.
                console.error("internal error - unknown state :", state);
                state = "open_error_view";
                break;
        }
    } catch (error) {
        // 何かしらの例外処理が発生した.
        console.error("internal error - unhandled exception in main loop :", error.toString());

        // カメラビューに強制的に戻す.
        // TODO: これももう少し丁寧なエラーハンドリングをしたほうがいいかも...
        state = "open_camera_view";
    }

    // ループ脱出が指示されていなければタイマーをセットして一定時間後にもう一回自分が呼ばれるようにして終了する.
    if (keep_main_loop) {
        timeout_id = setTimeout(main_loop, MAIN_LOOP_INTERVAL);
        console.assert(timeout_id);
    }
}

/**
 * アプリケーションのメイン.
 */
async function main() {
    // ローディングビューを表示する.
    LOADING_VIEW.style.display = "block";

    // UIのイベントをセットアップする：再認証.
    CAMERA_AUTHOR_NAME.onclick = (async(event) => {
        state = "open_auth_view";
    });

    // UIのイベントをセットアップする：リロード.
    CAMERA_PHOTO_COUNT.onclick = (async(event) => {
        state = "open_reload_view";
    });

    // UIのイベントをセットアップする：設定.    
    CAMERA_SETTING.onclick = (async(event) => {
        state = "open_setting_view";
    });

    // UIのイベントをセットアップする：認証実行ボタン.
    AUTH_OK.onclick = (async(event) => {
        current_user.author_name = AUTH_AUTHOR_NAME.value.trim();
        current_user.username = AUTH_USERNAME.value.trim();
        current_user.encrypted_password = CryptoJS.AES.encrypt(AUTH_PASSWORD.value, SECRET_KEY).toString();

        // 入力は全て必須要素なのでひとつでも入っていなかったらエラーとする.
        if (!current_user.author_name || !current_user.username || !current_user.encrypted_password) {
            console.warn("insufficient input data.");
            state = "authentication_failed";
            return;
        }

        // データベースを更新してからリロードに移るようにする.
        // 認証エラーなどの場合にはさらに適切なステートに遷移することが期待できる.
        console.log("updating user database :", current_user);
        await database.user.put(current_user);
        state = "open_reload_view";
    });

    // UIのイベントをセットアップする：設定更新ボタン.            
    SETTING_OK.onclick = (async(event) => {
        // 現在のユーザを示す変数に設定値を適用する.
        current_user.shutter_sound = SETTING_SHUTTER_SOUND.checked;
        current_user.auto_reload = SETTING_AUTO_RELOAD.checked;
        current_user.encryption = SETTING_ENCRYPTION.checked;

        // データベースを更新してからリロードに移るようにする.
        // 認証エラーなどの場合にはさらに適切なステートに遷移することが期待できる.
        console.log("updating user database :", current_user);
        await database.user.put(current_user);
        state = "open_reload_view";
    });

    // 依存するもろもろのセットアップ処理を行う.
    await setup_debug_log();
    await setup_database();
    await setup_camera();

    // メインループの１回目を開始する.
    await main_loop();
}