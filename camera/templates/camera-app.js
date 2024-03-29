/**
 * タマリンカメラ.
 * @author FUJII Kenichi <fujii.kenichi@tamariva.co.jp>
 */
'use strict';

// バックグラウンドを繰り返すときの待ち時間(ミリ秒).
const BACKGROUND_TASK_INTERVAL = 15 * 1000;

// シャッターのアニメーションのための時間(ミリ秒).
const SHUTTER_ANIMATION_TIME = 500;

// ローカルで保持できる写真の最大枚数.
const MAX_PHOTO_COUNT = 25;

// 撮影する写真のサイズ.
const PHOTO_WIDTH = 1920;
const PHOTO_HEIGHT = 1080;

// JPEGを作るときの品質値.
const JPEG_Q_FACTOR = 0.85;

// カメラ用のパラメータ.
const DEVICE_PARAM = {
    audio: false,
    video: {
        width: { ideal: PHOTO_WIDTH, max: PHOTO_WIDTH },
        height: { ideal: PHOTO_HEIGHT, max: PHOTO_HEIGHT },
        facingMode: { ideal: "environment" },
        zoom: true
    }
};

// シャッター音.
const SHUTTER_AUDIO = new Howl({
    src: ['{{CAMERA_APP_SHUTTER_AUDIO}}'],
    html5: true
});

// よくつかうUIのエレメント.
const PREVIEW = document.getElementById('preview');
const CANVAS = document.getElementById('canvas');
const SHUTTERS = document.getElementById('shutters');
const PHOTO_COUNT = document.getElementById('photo_count');
const CONTEXT_TAGS = document.getElementById('context_tags');
const ZOOM = document.getElementById('zoom');

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

// プレビュービデオのトラック.
let previewTrack = null;

// 現在溜まっている写真の枚数.
let photoCount = 0;

// service workerのregistration.
let registration = null;

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
        if (document.visibilityState === 'visible') {
            navigator.mediaDevices.getUserMedia(DEVICE_PARAM).then(stream => {
                PREVIEW.srcObject = stream;
                previewTrack = stream.getVideoTracks()[0];
                const settings = previewTrack.getSettings();
                if ('zoom' in settings) {
                    const capabilities = previewTrack.getCapabilities();
                    ZOOM.min = capabilities.zoom.min;
                    ZOOM.max = capabilities.zoom.max;
                    ZOOM.step = capabilities.zoom.step;
                    ZOOM.value = settings.zoom;
                    ZOOM.style.display = 'inline-block';
                }
            }).catch(error => {
                console.error(error);
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
    if (PREVIEW.style.visibility === 'hidden') {
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

    setTimeout(() => {
        shutter.classList.remove('animate__animated');
        PREVIEW.style.visibility = 'visible';
    }, SHUTTER_ANIMATION_TIME);

    const displayError = (error) => {
        console.error(error);
        bulmaToast.toast({
            message: '{{PHOTO_ERROR_MESSAGE}}',
            position: 'center',
            type: 'is-warning',
            dismissible: false,
            animate: { in: 'fadeIn', out: 'fadeOut' },
        });
    };

    try {
        if (currentUser.shutterSound) {
            SHUTTER_AUDIO.play();
        }
        CANVAS.width = PREVIEW.videoWidth;
        CANVAS.height = PREVIEW.videoHeight;
        CANVAS.getContext('2d').drawImage(PREVIEW, 0, 0);
        new Promise(resolve => CANVAS.toBlob(resolve, 'image/jpeg', JPEG_Q_FACTOR)).then(image => {
            console.info(`captured image type: ${image.type}`);
            console.info(`captured image size: ${image.size}`);
            image.arrayBuffer().then(buffer => {
                const now = new Date();
                let data = buffer;
                let key = '{{NO_ENCRYPTION_KEY}}';
                if (currentUser.encryption) {
                    key = CryptoJS.lib.WordArray.random(Number('{{MEDIA_ENCRYPTION_KEY_LENGTH}}')).toString();
                    const raw = btoa(new Uint8Array(data).reduce((d, b) => d + String.fromCharCode(b), ''));
                    data = CryptoJS.AES.encrypt(raw, key).toString();
                    console.info(`encrypted image size: ${data.length}`);
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
                    console.info(`image processing time: ${(Date.now() - now)}`);
                    navigator.serviceWorker.controller.postMessage({ tag: '{{CAMERA_APP_UPLOAD_PHOTO_TAG}}' });
                }).catch(error => {
                    displayError(error);
                });
            }).catch(error => {
                displayError(error);
            });
        }).catch(error => {
            displayError(error);
        });
    } catch (error) {
        displayError(error);
    }
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
        console.warn('no current user.');
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
                console.warn(`could not load user: ${response.status}`);
                token = null;
                break;

            default:
                console.error('unexpected load user response: ', response);
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
    }).catch(error => {
        console.error(error);
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
    }).catch(error => {
        console.error(error);
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
        if (previewTrack) {
            previewTrack.applyConstraints({ advanced: [{ zoom: event.target.value }] });
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
        }).catch(error => {
            console.error(error);
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
        }).catch(error => {
            console.error(error);
        });
    });
    document.getElementById('version').onclick = (() => {
        document.getElementById('setting_dialog').classList.remove('is-active');
        switchView('loading_view');
        database.photo.clear();
        registration.update();
        window.location.reload(true);
    });

    database = new Dexie('{{CAMERA_APP_DATABASE_NAME}}');
    database.version('{{CAMERA_APP_DATABASE_VERSION}}').stores({
        user: 'dummyId, userId',
        photo: '++id, dateTaken'
    });

    navigator.serviceWorker.register('camera-serviceworker.js').then(result => {
        registration = result;
        navigator.serviceWorker.ready.then(() => {
            navigator.serviceWorker.onmessage = (event => {
                switch (event.data.tag) {
                    case '{{CAMERA_APP_PHOTO_UPLOADED_TAG}}':
                        database.photo.count().then(count => {
                            PHOTO_COUNT.value = photoCount = count;
                        }).catch(error => {
                            console.error(error);
                        });
                        break;

                    default:
                        console.error(`unknown event tag: ${event.data.tag}`);
                        break;
                }
            });
        }).catch(error => {
            console.error(error);
        });
    }).catch(error => {
        console.error(error);
    });

    if (document.location.search !== '{{APP_MODE_URL_PARAM}}') {
        console.info(`location: ${document.location.href}`);
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