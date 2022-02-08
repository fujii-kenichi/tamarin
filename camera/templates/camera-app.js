/** 
 * タマリンカメラ.
 * @author FUJII Kenichi <fujii.kenichi@tamariva.co.jp>
 */
'use strict';

// バックグラウンドを繰り返すときの待ち時間(ミリ秒).
const BACKGROUND_TASK_INTERVAL = 15 * 1000;

// シャッターのアニメーションのための時間.
const SHUTTER_ANIMATION_TIME = 500;

// 撮影用のパラメータ.
const CAPTURE_PARAM = JSON.parse(String('{{CAPTURE_PARAM}}').replaceAll('&quot;', '"'));
const DEVICE_PARAM = JSON.parse(String('{{DEVICE_PARAM}}').replaceAll('&quot;', '"'));

// 写真の最大枚数.
const MAX_PHOTO_COUNT = Number('{{CAMERA_APP_MAX_PHOTO_COUNT}}');

// よくつかうUIのエレメント.
const PREVIEW = document.getElementById('preview');
const CANVAS = document.getElementById('canvas');
const SHUTTERS = document.getElementById('shutters');
const PHOTO_COUNT = document.getElementById('photo_count');
const CONTEXT_TAGS = document.getElementById('context_tags');
const ZOOM = document.getElementById('zoom');

// 自前の実装でJPEGを作るときの品質値.
const JPEG_Q_FACTOR = 0.85;

// シャッター音.
const SHUTTER_AUDIO = new Howl({
    src: ['{{CAMERA_APP_SHUTTER_AUDIO}}'],
    html5: true
});

// 現在アプリでサインインしているユーザーを示す変数(新規作成時の初期値を含む).
let currentUser = {
    dummyId: '{{APP_DATABASE_CURRENT_USER}}',
    userId: '',
    username: '',
    password: '',
    authorName: '',
    contextTag: '',
    sceneTag: '',
    sceneColor: '',
    shutterSound: true, // シャッターサウンドはデフォルトでオン.
    autoReload: true, // 自動リロードはデフォルトでオン.
    encryption: true, // 暗号化もデフォルトでオン.
    selectedContextTag: '' // 現在選択しているコンテキストを覚えておく.
};

// データベース(IndexedDBを使うためのDexie)のインスタンス.
let database = null;

// Tokenサービスが返してきたトークン.
let token = null;

// Userサービスの最終更新日時.
let dateUpdated = null;

// 撮影用のimage capture オブジェクト.
let imageCapture = null;

// プレビューのビデオトラック.
let videoTrack = null;

// 現在溜まっている写真の枚数.
let photoCount = 0;

/**
 * カメラのプレビューを更新する.
 */
function updatePreview() {
    // 以降の処理はトライ＆エラーの結果としてこうしているけど,
    // これが本当に適切なやり方なのかはちょっとよくわからない...
    try {
        ZOOM.style.display = SHUTTERS.style.display = 'none';
        PREVIEW.pause();
        if (PREVIEW.srcObject) {
            PREVIEW.srcObject.getVideoTracks().forEach(track => {
                track.stop();
                PREVIEW.srcObject.removeTrack(track);
            });
            PREVIEW.removeAttribute('srcObject');
            PREVIEW.load();
            PREVIEW.srcObject = null;
        }
        imageCapture = null;
        if (document.visibilityState === 'visible') {
            navigator.mediaDevices.getUserMedia(DEVICE_PARAM).then(stream => {
                const MyImageCapture = class {
                    async takePhoto() {
                        return new Promise(resolve => {
                            CANVAS.width = PREVIEW.videoWidth;
                            CANVAS.height = PREVIEW.videoHeight;
                            CANVAS.getContext('2d').drawImage(PREVIEW, 0, 0);
                            CANVAS.toBlob(resolve, 'image/jpeg', JPEG_Q_FACTOR);
                        });
                    }
                };
                imageCapture = typeof ImageCapture === 'undefined' ? new MyImageCapture() : new ImageCapture(stream.getVideoTracks()[0]);
                PREVIEW.srcObject = stream;
                videoTrack = stream.getVideoTracks()[0];
                const settings = videoTrack.getSettings();
                if ('zoom' in settings) {
                    const capabilities = videoTrack.getCapabilities();
                    ZOOM.min = capabilities.zoom.min;
                    ZOOM.max = capabilities.zoom.max;
                    ZOOM.step = capabilities.zoom.step;
                    ZOOM.value = settings.zoom;
                    ZOOM.style.display = 'inline-block';
                }
            });
        }
    } catch (error) {
        console.error(error);
    }
}

/**
 * 写真を撮影する.
 * @param {string} index シャッターの番号.
 * @param {string} sceneTag 撮影時に指定されたシーンタグ.
 */
function takePhoto(index, sceneTag) {
    if (PREVIEW.style.visibility === 'hidden' || !imageCapture || (imageCapture.track && imageCapture.track.readyState !== 'live')) {
        return;
    }
    if (photoCount >= MAX_PHOTO_COUNT) {
        bulmaToast.toast({
            message: '{{MAX_PHOTO_MESSAGE}}',
            position: 'center',
            type: 'is-success',
            dismissible: false,
            animate: { in: 'fadeIn', out: 'fadeOut' },
        });
        return;
    }
    PHOTO_COUNT.value = ++photoCount;
    const shutter = document.getElementById(`shutter_${index}`);
    shutter.classList.add('animate__animated');
    PREVIEW.style.visibility = 'hidden';
    if (currentUser.shutterSound) {
        SHUTTER_AUDIO.play();
    }
    const now = new Date();
    // TODO: 本当はここでカメラの性能を生かせるようにいろいろ設定するべき...
    imageCapture.takePhoto(CAPTURE_PARAM).then(image => {
        const reader = new FileReader();
        reader.onload = () => {
            let data = reader.result;
            let key = '{{NO_ENCRYPTION_KEY}}';
            if (currentUser.encryption) {
                key = CryptoJS.lib.WordArray.random(Number('{{MEDIA_ENCRYPTION_KEY_LENGTH}}')).toString();
                const raw = btoa(new Uint8Array(data).reduce((d, b) => d + String.fromCharCode(b), ''));
                data = CryptoJS.AES.encrypt(raw, key).toString();
                console.info(`encrypted data size :${data.length}`);
            }
            database.photo.add({
                owner: currentUser.userId,
                dateTaken: now.toJSON(),
                authorName: currentUser.authorName,
                sceneTag: sceneTag,
                contextTag: currentUser.selectedContextTag,
                contentType: image.type,
                encryptionKey: key,
                encryptedData: data
            }).then(() => {
                setTimeout(() => {
                    shutter.classList.remove('animate__animated');
                    PREVIEW.style.visibility = 'visible';
                }, SHUTTER_ANIMATION_TIME);
                navigator.serviceWorker.controller.postMessage({ tag: '{{CAMERA_APP_UPLOAD_PHOTO_TAG}}' });
                console.info(`photo processing time :${(Date.now() - now)}`);
                console.info(`captured image type : ${image.type}`);
                console.info(`captured image size : ${image.size}`);
            });
        };
        reader.readAsArrayBuffer(image).catch(error => {
            console.error(error);
        });
    });
}

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
    document.getElementById('username').value = currentUser.username;
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
                currentUser.contextTag = result[0].context_tag;
                currentUser.sceneTag = result[0].scene_tag;
                currentUser.sceneColor = result[0].scene_color;
                currentUser.selectedContextTag = CONTEXT_TAGS.selectedIndex >= 0 ? CONTEXT_TAGS.options[CONTEXT_TAGS.selectedIndex].value : currentUser.selectedContextTag;
                await database.user.put(currentUser);
                if (dateUpdated !== result[0].date_updated) {
                    dateUpdated = result[0].date_updated;
                    updateView();
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
 *  currentUserの中身からUIのエレメントを設定する.
 */
function updateView() {
    document.getElementById('author_name').value = document.getElementById('current_author_name').value = currentUser.authorName;
    document.getElementById('shutter_sound').checked = currentUser.shutterSound;
    document.getElementById('auto_reload').checked = currentUser.autoReload;
    document.getElementById('encryption').checked = currentUser.encryption;
    let contextTags = '';
    if (currentUser.contextTag) {
        for (const context of currentUser.contextTag.split(/,/)) {
            if (context) {
                contextTags += (`<option class=\'context_tag\' value=\'${context}\' ${(context === currentUser.selectedContextTag ? 'selected' : '')}>${context}</option>`);
            }
        }
    }
    CONTEXT_TAGS.innerHTML = contextTags;
    let shutters = '';
    if (currentUser.sceneTag && currentUser.sceneColor) {
        const scenes = currentUser.sceneTag.split(/,/);
        const colors = currentUser.sceneColor.split(/,/);
        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            if (scene) {
                shutters += (`<div id=\'shutter_${i}\' class=\'animate__pulse animate__infinite tama-shutter\' style=\'background-color:${colors[i]};\' onmousedown=\"takePhoto(${i},\'${scene}\')\">${scene}</div>`);
            }
        }
    }
    SHUTTERS.innerHTML = shutters;
    database.photo.count().then(count => {
        PHOTO_COUNT.value = photoCount = count;
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
    navigator.serviceWorker.controller.postMessage({ tag: '{{CAMERA_APP_UPLOAD_PHOTO_TAG}}' });
    database.photo.count().then(count => {
        PHOTO_COUNT.value = photoCount = count;
    });
    currentUser.selectedContextTag = CONTEXT_TAGS.selectedIndex >= 0 ? CONTEXT_TAGS.options[CONTEXT_TAGS.selectedIndex].value : currentUser.selectedContextTag;
    if (currentUser.autoReload) {
        loadUser().then(result => {
            if (!result) {
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
    window.addEventListener('touchmove', (event => {
        event.preventDefault();
    }));
    window.addEventListener('offline', (() => {
        updatePreview();
    }));
    window.addEventListener('online', (() => {
        updatePreview();
        navigator.serviceWorker.controller.postMessage({ tag: '{{CAMERA_APP_UPLOAD_PHOTO_TAG}}' });
    }));
    document.addEventListener('visibilitychange', (() => {
        updatePreview();
    }));
    document.getElementById('current_author_name').onclick = (() => {
        switchView('signin_view');
    });
    document.getElementById('signin-cancel').onclick = (() => {
        if (token) {
            switchView('main_view');
        }
    });
    PREVIEW.onloadedmetadata = (() => {
        PREVIEW.play().catch(error => {
            console.error(error);
        });
    });
    PREVIEW.onplay = (() => {
        SHUTTERS.style.display = 'block';
    });
    CONTEXT_TAGS.onchange = (() => {
        currentUser.selectedContextTag = CONTEXT_TAGS.selectedIndex >= 0 ? CONTEXT_TAGS.options[CONTEXT_TAGS.selectedIndex].value : currentUser.selectedContextTag;
        database.user.put(currentUser).catch(error => {
            console.error(error);
        });
    });
    PHOTO_COUNT.onclick = (() => {
        if (navigator.onLine) {
            bulmaToast.toast({
                message: '{{RELOAD_MESSAGE}}',
                position: 'center',
                type: 'is-success',
                dismissible: false,
                animate: { in: 'fadeIn', out: 'fadeOut' },
            });
            loadUser().then(() => {
                navigator.serviceWorker.controller.postMessage({ tag: '{{CAMERA_APP_UPLOAD_PHOTO_TAG}}' });
            });
        }
    });
    ZOOM.oninput = ((event) => {
        if (videoTrack) {
            videoTrack.applyConstraints({ advanced: [{ zoom: event.target.value }] });
        }
    });
    document.getElementById('signin').onclick = (() => {
        const signinError = document.getElementById('signin_error');
        signinError.style.display = 'none';
        const authorName = document.getElementById('author_name').value.trim();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const validator = /[\s\,\:\;\&\'\"\`\¥\|\~\%\/\\<\>\?\\\*]/m;
        if (!authorName || validator.exec(authorName)) {
            signinError.style.display = 'block';
            return;
        }
        document.getElementById('current_author_name').value = currentUser.authorName = authorName;
        currentUser.username = username;
        currentUser.password = CryptoJS.AES.encrypt(password, String('{{APP_SECRET_KEY}}')).toString();
        database.user.put(currentUser).then(() => {
            token = null;
            loadUser().then(result => {
                if (result) {
                    switchView('main_view');
                } else {
                    signinError.style.display = 'block';
                }
            });
        });
    });
    document.getElementById('setting').onclick = (() => {
        document.getElementById('setting_dialog').classList.add('is-active');
    });
    document.getElementById('save_setting').onclick = (() => {
        currentUser.shutterSound = document.getElementById('shutter_sound').checked;
        currentUser.autoReload = document.getElementById('auto_reload').checked;
        currentUser.encryption = document.getElementById('encryption').checked;
        currentUser.selectedContextTag = CONTEXT_TAGS.selectedIndex >= 0 ? CONTEXT_TAGS.options[CONTEXT_TAGS.selectedIndex].value : currentUser.selectedContextTag;
        database.user.put(currentUser).then(() => {
            document.getElementById('setting_dialog').classList.remove('is-active');
        });
    });
    document.getElementById('version').onclick = (() => {
        document.getElementById('setting_dialog').classList.remove('is-active');
        switchView('loading_view');
        navigator.serviceWorker.controller.postMessage({ tag: '{{CAMERA_APP_FORCE_UPDATE_TAG}}' });
    });
    database = new Dexie('{{CAMERA_APP_DATABASE_NAME}}');
    database.version('{{CAMERA_APP_DATABASE_VERSION}}').stores({
        user: 'dummyId, userId',
        photo: '++id, dateTaken'
    });
    navigator.serviceWorker.register('camera-serviceworker.js').then(() => {
        navigator.serviceWorker.ready.then(() => {
            navigator.serviceWorker.onmessage = (event => {
                switch (event.data.tag) {
                    case '{{CAMERA_APP_PHOTO_UPLOADED_TAG}}':
                        database.photo.count().then(count => {
                            PHOTO_COUNT.value = photoCount = count;
                        });
                        break;

                    case '{{CAMERA_APP_FORCE_UPDATE_TAG}}':
                        window.location = 'camera-app.html{{APP_MODE_URL_PARAM}}';
                        break;
                }
            });
        });
    });
    if (document.location.search !== '{{APP_MODE_URL_PARAM}}') {
        console.log(document.location.href);
        QRCode.toCanvas(document.getElementById('qrcode'), document.location.href);
        switchView('install_view');
        return;
    }
    loadUser().then(result => {
        updateView();
        updatePreview();
        switchView(result ? 'main_view' : 'signin_view');
        setTimeout(backgroundTask, BACKGROUND_TASK_INTERVAL);
    });
}