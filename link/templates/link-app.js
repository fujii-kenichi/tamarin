/** 
 * タマリンク.
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

// HTMLの各要素.
const MAIN_VIEW = document.getElementById("main_view");
const AUTH_VIEW = document.getElementById("auth_view");
const DOWNLOAD_VIEW = document.getElementById("download_view");
const LOADING_VIEW = document.getElementById("loading_view");
const INSTALL_VIEW = document.getElementById("install_view");
const ERROR_VIEW = document.getElementById("error_view");

const USER = document.getElementById("user");

const SCENE_TAG = document.getElementById("scene_tag");
const SCENE_COLOR = document.getElementById("scene_color");
const CONTEXT_TAG = document.getElementById("context_tag");
const DOWNLOAD_RULE = document.getElementById("download_rule");
const DOWNLOAD_ONLY = document.getElementById("download_only");

const UPDATE = document.getElementById("update");
const DOWNLOAD = document.getElementById("download");
const DOWNLOAD_CANCEL = document.getElementById("download_cancel");

const DOWNLOAD_COUNT = document.getElementById("download_count");
const DOWNLOAD_FILE = document.getElementById("download_file");

const AUTH_ERROR_MESSAGE = document.getElementById("auth_error_message");
const AUTH_USERNAME = document.getElementById("auth_username");
const AUTH_PASSWORD = document.getElementById("auth_password");
const AUTH_OK = document.getElementById("auth_ok");

// データベース(IndexedDBを使うためのDexie)のインスタンス.
let database = null;

// 現在アプリでサインインしているユーザを示す変数(新規作成時の初期値を含む).
let current_user = {
    dummy_id: "{{DATABASE_USER_DUMMY_ID}}",
    user_id: null,
    username: null,
    encrypted_password: null,
    scene_tag: null,
    scene_color: null,
    context_tag: null,
    download_rule: 1,
    download_only: false
};

// ダウンロードフォルダへのハンドル.
let download_folder = null;

// ダウンロードするファイル(写真)のリスト.
let download_file_list = null;

// メインループのステートマシンにおけるステートを示す変数.
let state = "init";

// Tokenサービスが返してきたアクセストークン(無い場合はnull).
let token = null;

// 不要なUI(DOM)の更新を避けるため前の状態を記憶するための変数.
let last_state = null;

// メインループで使うタイマー.
let timeout_id = null;

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
        user: "dummy_id, user_id"
    });
}

/**
 * アプリの動作に必要となるプラットフォーム関連の初期化を行う.
 */
async function init() {

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

    // ファイルシステムAPIのサポートをチェック.
    if (!("showDirectoryPicker" in window)) {
        console.error("no showDirectoryPicker feature.");
        state = "open_error_view";
        return;
    }

    // service workerの登録を行う.    
    try {
        await navigator.serviceWorker.register("link-serviceworker.js");
        console.info("serviceworker registrated.");
        state = "start";
    } catch (error) {
        console.error("service worker registration error :", error);
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
    if (token_response.status == 200) {
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

    // アクセストークンをとってきて、失敗したら認証パネルを出すようにステートを変えて終了する.
    await get_token();

    if (!token) {
        console.error("no token :", current_user);
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
        console.error("could not get user :", user_response);
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
    SCENE_TAG.value = current_user.scene_tag;

    current_user.scene_color = result_user[0].scene_color;
    console.assert(current_user.scene_color);
    SCENE_COLOR.value = current_user.scene_color;

    current_user.context_tag = result_user[0].context_tag;
    console.assert(current_user.context_tag);
    CONTEXT_TAG.value = current_user.context_tag;

    // 更新されたユーザを示す変数をさらにデータベースに保存する.    
    console.log("save current user to database :", current_user);
    await database.user.put(current_user);

    // 呼び出し元が期待する次のステートに遷移するようにして処理を終了する.    
    state = new_state;
}

/**
 * Userサービスへ対応するユーザの情報を保存する.
 */
async function save_user() {
    // ユーザを示す変数の内容をUIで設定された値で更新する.
    current_user.scene_tag = SCENE_TAG.value.trim();
    current_user.scene_color = SCENE_COLOR.value.trim();
    current_user.context_tag = CONTEXT_TAG.value.trim();
    current_user.download_rule = DOWNLOAD_RULE.value;
    current_user.download_only = DOWNLOAD_ONLY.checked;

    // データベースに保存する.
    await database.user.put(current_user);

    // Userサービスにも保存する (PATCHで部分的な更新をしていることに注意!)
    console.log("calling user service : {{USER_API_URL}}");
    const user_response = await fetch("{{USER_API_URL}}" + current_user.user_id + "/", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "{{TOKEN_FORMAT}} " + token
        },
        body: JSON.stringify({
            "scene_tag": current_user.scene_tag,
            "scene_color": current_user.scene_color,
            "context_tag": current_user.context_tag
        })
    });
    console.assert(user_response);
    console.log("user service respond :", user_response);

    // 200以外だったらエラーなのでとりあえず再認証を要求するようにしておく.
    if (user_response.status !== 200) {
        state = "authentication_failed";
    }
}

/**
 * ダウンロードを待っているファイルのリストをMediaサービスから取得する.
 */
async function setup_download_file_list() {
    // 最初にリストを空にしておく.
    download_file_list = null;

    // アクセストークンをとってきて、失敗したら認証パネルを出すようにステートを変えて終了する.
    await get_token();

    if (!token) {
        state = "authentication_failed";
        return;
    }

    // ユーザがOwnerのMediaのリストをMediaサービスから取得する.
    console.log("calling media service to get media list : {{MEDIA_API_URL}}");
    const media_response = await fetch("{{MEDIA_API_URL}}" + "?owner=" + current_user.user_id, {
        headers: {
            "Authorization": "{{TOKEN_FORMAT}} " + token
        }
    });
    console.assert(media_response);
    console.log("media service returns response :", media_response);

    // 成功するはずなので200以外だったら予期しないエラーとする.
    if (media_response.status != 200) {
        state = "service_error";
        return;
    }

    // 返却された結果をリストにJSONにする.
    const result = await media_response.json();
    console.assert(result);

    // それをさらに配列にいれる.
    download_file_list = result;

    console.log("download file list :", download_file_list);

    // 次のステートはダウンロードビューとする.
    state = "in_download_view";
}

/**
 * ファイルをMediaサービスから１つダウンロードする.
 */
async function download_file() {
    // リストが空の場合はなにもしないで抜ける.
    if (!download_file_list || download_file_list.length == 0) {
        console.log("download file list is empty.");
        state = "open_main_view";
        return;
    }
    console.log("remaining download file list :", download_file_list);

    // 対象となるファイルをリストの先頭から取得する.
    const file = download_file_list[0];
    console.assert(file);
    console.log("target file :", file);

    // 現在のダウンロード状況をUIに反映する.
    DOWNLOAD_COUNT.value = download_file_list.length;
    DOWNLOAD_FILE.value = file.id;

    // アクセストークンをとってきて、失敗したら認証パネルを出すようにステートを変えて終了する.
    await get_token();

    if (!token) {
        state = "authentication_failed";
        return;
    }

    // Mediaサービスからファイルを取得する.
    console.log("calling media service to get media content: ", file.encrypted_data);
    const media_response = await fetch(file.encrypted_data);

    console.assert(media_response);
    console.log("media service respond :", media_response);

    // 200以外だったら予期しないエラーとして抜ける.
    // たぶん別のタマリンクがダウンロードして削除したとか?そういう状況.
    // TODO: 本当はこのあたりもう少し親切なエラー処理をしたい...
    if (media_response.status !== 200) {
        console.error("could not get media :", media_response);
        state = "service_error";
        return;
    }

    // ここからはファイル内容の復号化処理をする.
    let data = null;

    // 暗号化キーが指定されているかをチェックする.
    if (file.encryption_key !== "none") {
        // 暗号化されている場合にはデータ場BASE64なのでテキストとして取得する.
        const base64_raw = await media_response.text();
        console.assert(base64_raw);
        console.log("base64 raw data length :", base64_raw.length);

        // それをキーを用いて復号化する.
        const base64_decrypted = CryptoJS.AES.decrypt(base64_raw, file.encryption_key).toString(CryptoJS.enc.Utf8);
        console.assert(base64_decrypted);
        console.log("decrypted raw data length :", base64_decrypted.length);

        // 復号化した文字列をバイナリに変える.
        const tmp = window.atob(base64_decrypted);
        console.assert(tmp.length > 0);
        console.log("result binary length :", tmp.length);

        const buffer = new Uint8Array(tmp.length);
        console.assert(buffer);

        for (let i = 0; i < tmp.length; i++) {
            buffer[i] = tmp.charCodeAt(i);
        }

        // 保存するデータをすり替える.
        data = buffer;
    } else {
        // 暗号化されていない場合は普通にバッファで受ける.
        data = await media_response.arrayBuffer();
        console.assert(data);
        console.log("loading file data :", data);
    }
    console.assert(data);

    // ここからは保存するパス名とファイル名を生成する処理をする.
    // まずは撮影日時を取得する.
    const date_taken = new Date(file.date_taken);
    console.assert(date_taken);

    // 日付と時刻を人間可読なフォーマットの文字列にする.
    // TODO: これは本当はLOCALE的な処理に任せたほうがいいような気がする.
    const date = date_taken.getFullYear() + "{{DOWNLOAD_Y}}" + (date_taken.getMonth() + 1).toString().padStart(2.0) + "{{DOWNLOAD_M}}" + date_taken.getDate().toString().padStart(2, 0) + "{{DOWNLOAD_D}}";
    console.assert(date);

    const time = date_taken.getHours().toString().padStart(2, 0) + "{{DOWNLOAD_H}}" + date_taken.getMinutes().toString().padStart(2, 0) + "{{DOWNLOAD_M}}" + date_taken.getSeconds().toString().padStart(2, 0) + "{{DOWNLOAD_S}}";
    console.assert(time);

    const ext = file.content_type.match(/[^¥/]+$/);
    console.assert(ext);

    // 撮影者情報とシーンと状況のそれぞれのタグを取得する.
    // TODO: 本来はここでファイルシステムに適切な値になっているか確認して正規化する処理が必要.
    const author_name = file.author_name;
    const scene_tag = file.scene_tag;
    const context_tag = file.context_tag;

    // ここからはダウンロードルールに基づいてパスとファイルを作成する.
    let path_name = [];
    let file_name = "";

    switch (current_user.download_rule) {
        case "1":
            path_name.push(date);
            path_name.push(context_tag);
            path_name.push(scene_tag);
            path_name.push(author_name);
            file_name = time + "." + ext;
            break;

        case "2":
            path_name.push(date);
            path_name.push(author_name);
            path_name.push(context_tag);
            path_name.push(scene_tag);
            file_name = time + "." + ext;
            break;

        default:
            console.error("unsupported download rule :", current_user.download_rule);
            state = "open_error_view";
            return;
    }

    // パスの配列とファイル名がこれで得られたことを確認する.
    console.assert(path_name.length > 0);
    console.log("generated file path :", path_name);

    console.assert(file_name);
    console.log("generated file name :", file_name);

    // パスを順番にフォルダとして開いてハンドルを再帰的に取得する.
    let folder_handle = download_folder;
    console.assert(folder_handle);

    for (let i = 0; i < path_name.length; i++) {
        console.log("open path :", path_name[i]);
        folder_handle = await folder_handle.getDirectoryHandle(path_name[i], { create: true });
        console.assert(folder_handle);
    }

    // 最後のハンドルでファイルをオープンする.
    console.log("open file :", file_name);
    const file_handle = await folder_handle.getFileHandle(file_name, { create: true });
    console.assert(file_handle);

    // ダウンロードした中身を書き込んでクローズする.
    const write_handle = await file_handle.createWritable();
    console.assert(write_handle);

    await write_handle.write(data);
    await write_handle.close();

    // ここまででファイルのダウンロードが無事に終了した.
    // リストから当該ファイルを削除して詰める.
    download_file_list.shift();

    // Mediaサービスからもファイルを削除する.
    if (!current_user.download_only) {
        console.log("calling media service to delete media : {{MEDIA_API_URL}}");
        await fetch("{{MEDIA_API_URL}}" + file.id, {
            method: "DELETE",
            headers: {
                "Authorization": "{{TOKEN_FORMAT}} " + token
            }
        });
        // TODO: 本当はここに削除時のエラー処理をする必要がある.
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
        const online = navigator.onLine == false ? false : true;

        // オフラインだったら問答無用でエラーにしておしまい.
        if (!online) {
            state = "open_error_view";
        }

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
                // ユーザの更新：データベースからユーザを更新し成功したらメインビューを開く.
                await load_user("open_main_view");
                break;

            case "open_auth_view":
                //  認証ビューを開く：認証ビューだけを有効化する.                
                state = "in_auth_view";
                LOADING_VIEW.style.display = "none";
                MAIN_VIEW.style.display = "none";
                AUTH_VIEW.style.display = "block";
                DOWNLOAD_VIEW.style.display = "none";

                // UI要素の情報を更新しておく.
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

            case "open_main_view":
                // メインビューを開く：メインビューだけを有効化する.
                state = "in_main_view";
                LOADING_VIEW.style.display = "none";
                MAIN_VIEW.style.display = "block";
                AUTH_VIEW.style.display = "none";
                DOWNLOAD_VIEW.style.display = "none";

                // UI要素の情報を更新しておく.                
                USER.value = current_user.username;
                DOWNLOAD_RULE.value = current_user.download_rule;
                DOWNLOAD_ONLY.checked = current_user.download_only;
                break;

            case "in_main_view":

                break;

            case "save_setting":
                // 設定ビューを開く：設定ビューだけを有効化する.
                state = "open_main_view";
                LOADING_VIEW.style.display = "block";
                MAIN_VIEW.style.display = "none";
                AUTH_VIEW.style.display = "none";
                DOWNLOAD_VIEW.style.display = "none";

                // ユーザの情報をデータベースとUserサービスに保存する.
                await save_user();
                break;

            case "open_download_view":
                // ダウンロードビューを開く：ダウンロードを開始する.
                state = "in_download_view";
                LOADING_VIEW.style.display = "none";
                MAIN_VIEW.style.display = "none";
                AUTH_VIEW.style.display = "none";
                DOWNLOAD_VIEW.style.display = "block";
                DOWNLOAD_COUNT.value = "";
                DOWNLOAD_FILE.value = "";

                // ユーザの情報をデータベースとUserサービスに保存する.                
                await save_user();

                // 次にダウンロード可能なファイルのリストを作成する.
                // setup_download_file_list() の中で次のステートが決定される.
                await setup_download_file_list();
                break;

            case "in_download_view":
                // ダウンロードビューを表示中：毎回１ファイルづつのダウンロードを行う.
                await download_file();
                break;

            case "open_install_view":
                // インストールビューを開く：インストールを促すメッセージを表示してメインループを終了する.
                keep_main_loop = false;
                INSTALL_VIEW.style.display = "block";
                LOADING_VIEW.style.display = "none";

                console.error("open install view - teminate main loop.");
                break;

            case "open_error_view":
                // エラービューを開く：エラーを示すメッセージを表示してメインループを終了する.
                keep_main_loop = false;
                LOADING_VIEW.style.display = "none";
                MAIN_VIEW.style.display = "none";
                AUTH_VIEW.style.display = "none";
                DOWNLOAD_VIEW.style.display = "none";
                ERROR_VIEW.style.display = "block";

                console.error("fatal error - teminate main loop.");
                break;

            case "service_error":
                // サービスエラーが発生した：エラービューに遷移する.
                console.warn("something wrong in network service - try to reload.");

                // TODO: いきなり終わるんじゃなくて、もっとエラー内容に応じたリカバリ処理をすること！
                state = "open_auth_view";
                break;

            default:
                // 未定義のステート：実装エラーとみなしてエラービューを表示して終了する.                
                console.error("internal error - unknown state :", state);
                state = "open_error_view";
                break;
        }
    } catch (error) {
        // 何かしらの例外処理が発生した.        
        console.error("internal error - unhandled exception in main loop :", error);

        // メインビューに強制的に戻す.
        // TODO: これももう少し丁寧なエラーハンドリングをしたほうがいいかも...
        state = "open_main_view";
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

    // UIのイベントをセットアップする：再認証ボタン.
    USER.onclick = (async(event) => {
        AUTH_ERROR_MESSAGE.style.display = "none";
        state = "open_auth_view";
    });

    // UIのイベントをセットアップする：更新ボタン.    
    UPDATE.onclick = (async(event) => {
        state = "save_setting";
    });

    // UIのイベントをセットアップする：認証ボタン.    
    AUTH_OK.onclick = (async(event) => {
        current_user.username = AUTH_USERNAME.value.trim();
        current_user.encrypted_password = CryptoJS.AES.encrypt(AUTH_PASSWORD.value, SECRET_KEY).toString();

        // 入力は全て必須要素なのでひとつでも入っていなかったらエラーとする.
        if (!current_user.username || !current_user.encrypted_password) {
            console.warn("insufficient input data.");
            state = "authentication_failed";
            return;
        }

        // データベースを更新してからスタートに移るようにする.
        // 認証エラーなどの場合にはさらに適切なステートに遷移することが期待できる.
        console.log("updating user database :", current_user);
        await database.user.put(current_user);
        state = "start";
    });

    // UIのイベントをセットアップする：ダウンロードボタン.     
    DOWNLOAD.onclick = (async(event) => {
        // フォルダ選択ダイアログをだす.
        download_folder = await window.showDirectoryPicker();
        console.assert(download_folder);

        // 無事に返ってきたらダウンロードビューに遷移する.
        console.log("showDirectoryPicker() returns :", download_folder);
        state = "open_download_view";
    });

    // UIのイベントをセットアップする：ダウンロードキャンセルボタン.     
    DOWNLOAD_CANCEL.onclick = (async(event) => {
        // ステートをメインビューに戻す.
        // ボタンの押下自体は非同期だが、メインループのステート処理に戻ってきたときは、
        // １ファイルのダウンロードが終わったということだから、これでキャンセルになる.
        state = "open_main_view";
    });

    // データベースをセットアップする.
    await setup_database();

    // メインループの１回目を開始する.
    await main_loop();
}