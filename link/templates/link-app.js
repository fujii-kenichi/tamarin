/** 
 * タマリンク.
 * @author FUJII Kenichi <fujii.kenichi@tamariva.co.jp>
 */
'use strict';

// バックグラウンドタスクを繰り返すときの待ち時間(ミリ秒).
const BACKGROUND_TASK_INTERVAL = 15 * 1000;

// シーンタグの数.
const SCENE_TAG_COUNT = 4;

// コンテキストタグの数.
const CONTEXT_TAG_COUNT = 6;

// ダウンロードルールの数.
const DOWNLOAD_RULE_COUNT = 6;

// シーンで未使用とみなす色の名前.
const SCENE_NOT_USED_COLOR = 'black';

// ダウンロードルールで未使用とみなすタグの名前.
const RULE_NOT_USED_VALUE = 'NOT_USED';

// タグの値として入力された文字列の検証用正規表現.
const TAG_NAME_VALIDATOR = /[\s\,\:\;\&\'\"\`\¥\|\~\%\/\\<\>\?\\\*]/m;

// 現在アプリでサインインしているユーザーを示す変数(新規作成時の初期値を含む).
let currentUser = {
    dummyId: '{{APP_DATABASE_CURRENT_USER}}',
    userId: '',
    username: '',
    password: '',
    cleanup: true, // ダウンロード後にファイルを削除するかどうか.
    chart: 'context' // 選択されているチャート.
};

// データベース(IndexedDBを使うためのDexie)のインスタンス.
let database = null;

// Tokenサービスが返してきたトークン.
let token = null;

// Userサービスの最終更新日時.
let dateUpdated = null;

// ダウンロード中かどうかを示すフラグ.
let inDownloading = false;

// チャート描画用のダウンロード待ち写真ファイルの枚数.
let photoCount = 0;

// チャート描画用のコンテキストの配列.
let contextList = [];

// チャート描画用のシーンの配列.
let sceneList = [];

// チャート描画用の撮影者の配列.
let authorList = [];

/**
 * Tokenサービスから現在のユーザーにもとづいたトークンをもってくる.
 * @return {Promise<boolean>} true:もってこれた. / false:もってこれなかった.
 */
async function getToken() {
    if (!token && navigator.onLine) {
        const response = await fetch('{{CREATE_TOKEN_URL}}', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                'username': currentUser.username,
                'password': CryptoJS.AES.decrypt(currentUser.password, String('{{APP_SECRET_KEY}}')).toString(CryptoJS.enc.Utf8)
            })
        });
        if (response.status === 200) {
            const result = await response.json();
            token = result ? result.access : null;
        }
    }
    return token ? true : false;
}

/**
 * Userサービスから対応するユーザーの情報をもってくる.
 * @return {Promise<boolean>} true:もってこれた(もしくはそうみなしてOK). / false:もってこれなかった.
 */
async function loadUser() {
    const user = await database.user.get('{{APP_DATABASE_CURRENT_USER}}');
    if (!user) {
        return false;
    }
    currentUser = user;
    document.getElementById('current_username').value = document.getElementById('username').value = currentUser.username;
    while (true) {
        if (!navigator.onLine) {
            return true;
        }
        if (!await getToken()) {
            return false;
        }
        const response = await fetch(`{{USER_API_URL}}?username=${currentUser.username}`, {
            headers: {
                'Authorization': `{{TOKEN_FORMAT}} ${token}`
            }
        });
        switch (response.status) {
            case 200:
                const result = await response.json();
                currentUser.userId = result[0].id;
                await database.user.put(currentUser);
                if (dateUpdated !== result[0].date_updated) {
                    dateUpdated = result[0].date_updated;
                    setContextTag(result[0].context_tag);
                    setSceneTag(result[0].scene_tag);
                    setSceneColor(result[0].scene_color);
                    setDownloadRule(result[0].download_rule);
                }
                return true;

            case 400:
            case 401:
            case 403:
                token = null;
                break;

            default:
                return false;
        }
    }
}

/**
 * Userサービスへ対応するユーザーの情報を保存する.
 * @return {Promise<boolean>} true:保存できた. / false:保存できなかった.
 */
async function saveUser() {
    const contextTag = getContextTag();
    const sceneColor = getSceneColor(); // 色で操作しているからここだけsceneTagより先にする:
    const sceneTag = getSceneTag();
    const downloadRule = getDownloadRule();
    if (!contextTag || !sceneColor || !sceneTag || !downloadRule) {
        return false;
    }
    while (true) {
        if (!navigator.onLine) {
            return false;
        }
        if (!await getToken()) {
            return false;
        }
        const response = await fetch(`{{USER_API_URL}}${currentUser.userId}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `{{TOKEN_FORMAT}} ${token}`
            },
            body: JSON.stringify({
                'context_tag': contextTag,
                'scene_tag': sceneTag,
                'scene_color': sceneColor,
                'download_rule': downloadRule
            })
        });
        switch (response.status) {
            case 200:
                return loadUser();

            case 400:
            case 401:
            case 403:
                token = null;
                break;

            default:
                return false;
        }
    }
}

/**
 * CSVテキストからコンテキストタグのUIを作る.
 * @param {string} csv タグがCSVで羅列されているテキスト.
 */
function setContextTag(csv) {
    let i = 0;
    for (const v of csv.split(/,/)) {
        if (v) {
            document.getElementById(`context_tag_${i++}`).value = v;
        }
    }
    for (; i < CONTEXT_TAG_COUNT; i++) {
        document.getElementById(`context_tag_${i}`).value = '';
    }
}

/**
 * コンテキストタグのUIからCSVテキストを作る.
 * @return {string} タグをCSVで羅列したテキスト.
 */
function getContextTag() {
    let csv = '';
    for (let i = 0; i < CONTEXT_TAG_COUNT; i++) {
        const v = document.getElementById(`context_tag_${i}`).value.trim();
        if (v.length > Number('{{MAX_CONTEXT_TAG_LENGTH}}') || TAG_NAME_VALIDATOR.exec(v)) {
            return null;
        }
        csv += v ? `${v},` : '';
    }
    return csv;
}

/**
 * CSVテキストからシーンタグのUIを作る.
 * @param {string} csv タグがCSVで羅列されているテキスト.
 */
function setSceneTag(csv) {
    let i = 0;
    for (const v of csv.split(/,/)) {
        if (v) {
            document.getElementById(`scene_tag_${i++}`).value = v;
        }
    }
    for (; i < SCENE_TAG_COUNT; i++) {
        document.getElementById(`scene_tag_${i}`).value = '';
    }
}

/**
 * シーンタグのUIからCSVテキストを作る.
 * @return {string} タグをCSVで羅列したテキスト.
 */
function getSceneTag() {
    let csv = '';
    for (let i = 0; i < SCENE_TAG_COUNT; i++) {
        const v = document.getElementById(`scene_tag_${i}`).value.trim();
        if (v.length > Number('{{MAX_SCENE_TAG_LENGTH}}') || TAG_NAME_VALIDATOR.exec(v)) {
            return null;
        }
        csv += v ? `${v},` : '';
    }
    return csv;
}

/**
 * CSVテキストからシーンカラーのUIを作る.
 * @param {string} csv タグがCSVで羅列されているテキスト.
 */
function setSceneColor(csv) {
    let i = 0;
    for (const v of csv.split(/,/)) {
        if (v) {
            for (const option of document.getElementById(`scene_color_${i}`).childNodes) {
                option.selected = option.value === v ? true : false;
            }
            document.getElementById(`scene_tag_${i++}`).style.backgroundColor = v;
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
function getSceneColor() {
    let csv = '';
    for (let i = 0; i < SCENE_TAG_COUNT; i++) {
        const t = document.getElementById(`scene_tag_${i}`);
        if (t.value) {
            for (const option of document.getElementById(`scene_color_${i}`).childNodes) {
                if (option.selected) {
                    if (option.value === SCENE_NOT_USED_COLOR) {
                        t.value = '';
                    } else {
                        csv += `${option.value},`;
                    }
                }
            }
        }
    }
    return csv;
}

/**
 * シーンカラーが選択された時のイベントハンドラ.
 * @param {number} index 着目しているシーンの番号.
 */
function onSceneColorChange(index) {
    for (const option of document.getElementById(`scene_color_${index}`).childNodes) {
        const scene = document.getElementById(`scene_tag_${index}`);
        if (option.selected) {
            scene.style.backgroundColor = option.value;
            if (option.value === SCENE_NOT_USED_COLOR) {
                scene.value = '';
            }
        }
    }
}

/**
 * CSVテキストからダウンロードルールのUIを作る.
 * @param {string} csv タグがCSVで羅列されているテキスト.
 */
function setDownloadRule(csv) {
    let i = 0;
    for (const v of csv.split(/,/)) {
        if (v) {
            for (const option of document.getElementById(`download_rule_${i++}`).childNodes) {
                option.selected = option.value === v ? true : false;
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
function getDownloadRule() {
    let csv = '';
    for (let i = 0; i < DOWNLOAD_RULE_COUNT; i++) {
        for (const option of document.getElementById(`download_rule_${i}`).childNodes) {
            if (option.selected && option.value !== RULE_NOT_USED_VALUE) {
                csv += `${option.value},`;
            }
        }
    }
    return csv;
}

/**
 * ダウンロードを待っている写真のリストをMediaサービスから取得する.
 * @return {Promise<[]>} 写真の情報を示した配列. とれなかったらnull.
 */
async function getPhotoList() {
    while (true) {
        if (!navigator.onLine) {
            return null;
        }
        if (!await getToken()) {
            return null;
        }
        const response = await fetch(`{{MEDIA_API_URL}}?owner=${currentUser.userId}`, {
            headers: {
                'Authorization': `{{TOKEN_FORMAT}} ${token}`
            }
        });
        switch (response.status) {
            case 200:
                const list = await response.json();
                return (!list || list.length === 0) ? null : list;

            case 400:
            case 401:
            case 403:
                token = null;
                break;

            default:
                return null;
        }
    }
}

/**
 * 写真をMediaサービスからダウンロードする.
 */
async function downloadPhotos() {
    let list = await getPhotoList();
    if (!list) {
        return;
    }
    const downloadCount = document.getElementById('download_count');
    const downloadFile = document.getElementById('download_file');
    const downloadRule = getDownloadRule();
    downloadCount.innerHTML = list.length;
    downloadFile.innerHTML = '';
    document.getElementById('downloading_dialog').classList.add('is-active');
    inDownloading = true;
    let someError = false;
    try {
        const pickedFolder = await window.showDirectoryPicker({ startIn: 'pictures' });
        while (pickedFolder && list.length && inDownloading && !someError) {
            if (!navigator.onLine) {
                someError = true;
                break;
            }
            if (!await getToken()) {
                someError = true;
                break;
            }
            downloadCount.innerHTML = list.length;
            const photo = list[0];
            const dateTaken = new Date(photo.date_taken);
            const year = `${dateTaken.getFullYear()}{{DATETIME_YY}}`;
            const month = `${(dateTaken.getMonth() + 1).toString().padStart(2, 0)}{{DATETIME_MM}}`;
            const day = `${dateTaken.getDate().toString().padStart(2, 0)}{{DATETIME_DD}}`;
            const time = `${dateTaken.getHours().toString().padStart(2, 0)}{{DATETIME_HH}}${dateTaken.getMinutes().toString().padStart(2, 0)}{{DATETIME_MN}}${dateTaken.getSeconds().toString().padStart(2, 0)}{{DATETIME_SS}}`;
            const ext = photo.content_type.match(/[^¥/]+$/);
            const authorName = photo.author_name;
            const contextTag = photo.context_tag;
            const sceneTag = photo.scene_tag;
            let fullFileName = pickedFolder.name;
            let folderHandle = pickedFolder;
            let folderNameList = [];
            let fileNameBody = time;
            for (const rule of downloadRule.split(/,/)) {
                switch (rule) {
                    case 'YYMM':
                        folderNameList.push(`${year}${month}`);
                        break;

                    case 'YY':
                        folderNameList.push(year);
                        break;

                    case 'MM':
                        folderNameList.push(month);
                        break;

                    case 'DD':
                        folderNameList.push(day);
                        break;

                    case 'AUTHOR':
                        folderNameList.push(authorName);
                        break;

                    case 'CONTEXT':
                        folderNameList.push(contextTag);
                        break;

                    case 'SCENE':
                        folderNameList.push(sceneTag);
                        break;

                    case RULE_NOT_USED_VALUE:
                    default:
                        break;
                }
            }
            for (const folderName of folderNameList) {
                folderHandle = await folderHandle.getDirectoryHandle(folderName, { create: true });
                fullFileName += `/${folderName}`;
            }
            let fileHandle = null;
            let number = 0;
            let actualFileName = null;
            do {
                const numberString = number > 0 ? `(${number})` : '';
                actualFileName = `${fileNameBody}${numberString}.${ext}`;
                number++;
                try {
                    fileHandle = await folderHandle.getFileHandle(actualFileName);
                } catch (dummy) {
                    fileHandle = null;
                }
            } while (fileHandle);
            fileHandle = await folderHandle.getFileHandle(actualFileName, { create: true });
            fullFileName += `/${actualFileName}`;
            downloadFile.innerHTML = fullFileName;
            const downloadResponse = await fetch(photo.encrypted_data);
            switch (downloadResponse.status) {
                case 200:
                    const writable = await fileHandle.createWritable();
                    let data = null;
                    if (photo.encryption_key !== '{{NO_ENCRYPTION_KEY}}') {
                        const raw = await downloadResponse.text();
                        const decrypted = CryptoJS.AES.decrypt(raw, photo.encryption_key).toString(CryptoJS.enc.Utf8);
                        const tmp = window.atob(decrypted);
                        const buffer = new Uint8Array(tmp.length);
                        for (let i = 0; i < tmp.length; i++) {
                            buffer[i] = tmp.charCodeAt(i);
                        }
                        data = buffer;
                    } else {
                        data = await downloadResponse.arrayBuffer();
                    }
                    await writable.write(data);
                    await writable.close();
                    list.shift();
                    if (currentUser.cleanup) {
                        let deleteDone = false;
                        while (!deleteDone) {
                            if (!navigator.onLine) {
                                someError = true;
                                break;
                            }
                            if (!await getToken()) {
                                break;
                            }
                            const deleteResponse = await fetch(`{{MEDIA_API_URL}}${photo.id}`, {
                                method: 'DELETE',
                                headers: {
                                    'Authorization': `{{TOKEN_FORMAT}} ${token}`
                                }
                            });
                            switch (deleteResponse.status) {
                                case 200:
                                case 204:
                                    deleteDone = true;
                                    break;

                                case 400:
                                case 401:
                                case 403:
                                    token = null;
                                    break;

                                default:
                                    someError = true;
                                    deleteDone = true;
                                    break;
                            }
                        }
                    }
                    break;

                case 400:
                case 401:
                case 403:
                    token = null;
                    break;

                default:
                    someError = true;
                    break;
            }
        }
    } catch (error) {
        console.error(error);
    }
    inDownloading = false;
    document.getElementById('downloading_dialog').classList.remove('is-active');
    if (someError) {
        if (!token) {
            switchView('signin_view');
        } else {
            document.getElementById('download_failed_dialog').classList.add('is-active');
        }
        return;
    }
    switchView('loading_view');
    updateView().then(() => {
        switchView('main_view');
    });
}

/**
 * チャートを描画する.
 */
function drawChart() {
    let list = [];
    switch (currentUser.chart) {
        case 'context':
            list = contextList;
            break;

        case 'scene':
            list = sceneList;
            break;

        case 'author':
            list = authorList;
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
    new Chartist.Pie('.ct-chart', { labels, series }, {
        donut: true,
        labelInterpolationFnc: function(value) {
            return value;
        },
        labelPosition: 'outside'
    });
    const statusTitle = document.getElementById('status_title');
    statusTitle.innerHTML = photoCount;
    if (photoCount === 0) {
        statusTitle.style.backgroundColor = 'white';
        statusTitle.style.marginTop = '0';
    } else if (labels.length === 1) {
        statusTitle.style.backgroundColor = 'transparent';
        statusTitle.style.marginTop = '4ex';
    } else {
        statusTitle.style.backgroundColor = 'transparent';
        statusTitle.style.marginTop = '0';
    }
}

/**
 *  UIを更新する.
 */
async function updateView() {
    getPhotoList().then(photoList => {
        photoCount = 0;
        contextList = [];
        sceneList = [];
        authorList = [];
        if (photoList) {
            photoCount = photoList.length;
            for (const photo of photoList) {
                const contextCount = contextList[photo.context_tag];
                contextList[photo.context_tag] = contextCount ? contextCount + 1 : 1;
                const sceneCount = sceneList[photo.scene_tag];
                sceneList[photo.scene_tag] = sceneCount ? sceneCount + 1 : 1;
                const authorCount = authorList[photo.author_name];
                authorList[photo.author_name] = authorCount ? authorCount + 1 : 1;
            }
        }
        drawChart();
    });
}

/**
 * 指定したビューに切り替える.
 * @param {string} name ビューの名前.
 */
function switchView(name) {
    for (const view of document.getElementById('app').children) {
        view.style.display = view.id === name ? 'block' : 'none';
    }
}

/**
 * バックグラウンドタスク.
 */
function backgroundTask() {
    if (!inDownloading) {
        loadUser().then(result => {
            if (result) {
                updateView();
            } else {
                switchView('signin_view');
            }
        });
    }
    setTimeout(backgroundTask, BACKGROUND_TASK_INTERVAL);
}

/**
 * アプリケーションのメイン.
 */
function main() {
    switchView('loading_view');
    document.getElementById('save_context').onclick = document.getElementById('save_scene').onclick = (() => {
        saveUser().then(result => {
            document.getElementById(result ? 'save_succeeded_dialog' : 'save_failed_dialog').classList.add('is-active');
        });
    });
    document.getElementById('save_succeeded_ok').onclick = (() => {
        document.getElementById('save_succeeded_dialog').classList.remove('is-active');
    });
    document.getElementById('save_failed_ok').onclick = (() => {
        document.getElementById('save_failed_dialog').classList.remove('is-active');
    });
    document.getElementById('current_username').onclick = (() => {
        switchView('signin_view');
    });
    document.getElementById('signin').onclick = (() => {
        const signinError = document.getElementById('signin_error');
        signinError.style.display = 'none';
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        currentUser.username = username;
        currentUser.password = CryptoJS.AES.encrypt(password, String('{{APP_SECRET_KEY}}')).toString();
        database.user.put(currentUser).then(() => {
            token = null;
            loadUser().then(result => {
                if (result) {
                    switchView('loading_view');
                    updateView().then(() => {
                        switchView('main_view');
                    });
                } else {
                    signinError.style.display = 'block';
                }
            });
        });
    });
    document.getElementById('signin-cancel').onclick = (() => {
        if (token) {
            switchView('main_view');
        }
    });
    document.getElementById('show_context_status').onclick = (() => {
        currentUser.chart = 'context';
        database.user.put(currentUser).then(() => {
            drawChart();
        });
    });
    document.getElementById('show_scene_status').onclick = (() => {
        currentUser.chart = 'scene';
        database.user.put(currentUser).then(() => {
            drawChart();
        });
    });
    document.getElementById('show_author_status').onclick = (() => {
        currentUser.chart = 'author';
        database.user.put(currentUser).then(() => {
            drawChart();
        });
    });
    document.getElementById('download_start').onclick = (() => {
        saveUser().then(result => {
            if (!result) {
                document.getElementById('save_failed_dialog').classList.add('is-active');
            } else if (!('showDirectoryPicker' in window)) {
                document.getElementById('browser_error_dialog').classList.add('is-active');
            } else {
                downloadPhotos();
            }
        });
    });
    document.getElementById('download_stop').onclick = (() => {
        inDownloading = false;
        document.getElementById('downloading_dialog').classList.remove('is-active');
    });
    document.getElementById('download_failed_ok').onclick = (() => {
        document.getElementById('download_failed_dialog').classList.remove('is-active');
    });
    document.getElementById('browser_error_ok').onclick = (() => {
        document.getElementById('browser_error_dialog').classList.remove('is-active');
    });
    database = new Dexie('{{LINK_APP_DATABASE_NAME}}');
    database.version('{{LINK_APP_DATABASE_VERSION}}').stores({
        user: 'dummyId, userId'
    });
    navigator.serviceWorker.register('link-serviceworker.js').then(() => {
        navigator.serviceWorker.ready.then(() => {});
    });
    if (document.location.search !== '{{APP_MODE_URL_PARAM}}') {
        QRCode.toCanvas(document.getElementById('qrcode'), document.location.href);
        switchView('install_view');
        return;
    }
    loadUser().then(result => {
        if (result) {
            updateView().then(() => {
                switchView('main_view');
            });
        } else {
            switchView('signin_view');
        }
        setTimeout(backgroundTask, BACKGROUND_TASK_INTERVAL);
    });
}