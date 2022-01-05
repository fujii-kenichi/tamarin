/** 
 * タマリンカメラ (service worker).
 * by fujii.kenichi@tamariva.co.jp
 * 
 * ↓ このファイルのバイト数を変えることでブラウザに更新を伝えるためのコメント.
 * {{VERSION}}:{{DUMMY_COMMENT}}
 */
'use strict';

importScripts('{{DEXIE_JS}}');
importScripts('{{CRYPTO_JS}}');

// この時間以内のタイムスタンプであればすでにアップロードが実施されたものとみなす.
const TIMESTAMP_RANGE = 1000 * 60;

/**
 * installイベントの処理を定義する.
 */
self.addEventListener('install', (event => {
    event.waitUntil(
        caches.open('{{VERSION}}').then(cache => {
            cache.addAll([
                '{{DEXIE_JS}}',
                '{{CRYPTO_JS}}',
                '{{HOWLER_JS}}',
                '{{BULMA_TOAST_JS}}',
                '{{BULMA_CSS}}',
                '{{ANIMATE_CSS}}',
                '{{COMMON_CSS}}',
                '{{CAMERA_APP_FAVICON}}',
                '{{CAMERA_APP_ICON180}}',
                '{{CAMERA_APP_ICON192}}',
                '{{CAMERA_APP_ICON512}}',
                '{{CAMERA_APP_SHUTTER_AUDIO}}',
                'camera-app.webmanifest',
                'camera-app.css',
                'camera-app.js',
                'camera-app.html',
                'camera-app.html{{APP_MODE_URL_PARAM}}'
            ]).then(() => {
                self.skipWaiting();
            });
        })
    );
}));

/**
 * fetchイベントの処理を定義する.
 */
self.addEventListener('fetch', (event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response ? response : fetch(event.request);
        })
    );
}));

/**
 * activateイベントの処理を定義する.
 */
self.addEventListener('activate', (event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(cacheNames.map(name => {
                if (name !== '{{VERSION}}') {
                    return caches.delete(name);
                }
            }));
        }).then(() => {
            self.clients.claim();
        })
    );
}));

/**
 * syncイベントの処理を定義する.
 */
self.addEventListener('sync', (event => {
    if (event.tag === '{{CAMERA_APP_UPLOAD_PHOTO_TAG}}') {
        event.waitUntil(uploadPhotos());
    }
}));

/**
 * messageイベントの処理を定義する.
 */
self.addEventListener('message', (event => {
    switch (event.data.tag) {
        case '{{CAMERA_APP_FORCE_UPDATE_TAG}}':
            event.waitUntil(forceUpdate());
            break;

        case '{{CAMERA_APP_UPLOAD_PHOTO_TAG}}':
            event.waitUntil(uploadPhotos());
            break;
    }
}));

/**
 * 強制アップデートの処理を行う.
 */
async function forceUpdate() {
    caches.keys().then(cacheNames => {
        return Promise.all(cacheNames.map(name => {
            return caches.delete(name);
        }));
    }).then(() => {
        self.clients.matchAll().then(clients => {
            for (const client of clients) {
                client.postMessage({ tag: '{{CAMERA_APP_FORCE_UPDATE_TAG}}' });
            }
        });
    });
}

/**
 * 写真をあるだけアップロードする.
 */
async function uploadPhotos() {
    const database = new Dexie('{{CAMERA_APP_DATABASE_NAME}}');
    database.version('{{CAMERA_APP_DATABASE_VERSION}}').stores({
        user: 'dummyId, userId',
        photo: '++id, dateTaken'
    });
    const user = await database.user.get('{{APP_DATABASE_CURRENT_USER}}');
    if (!user) {
        return;
    }
    let token = null;
    let now = null;
    const getPhoto = async function() {
        const firstPhoto = await database.photo.orderBy('dateTaken').first();
        if (firstPhoto) {
            if (firstPhoto.timestamp) {
                if ((now - firstPhoto.timestamp) < TIMESTAMP_RANGE) {
                    return null;
                }
            } else {
                firstPhoto.timestamp = now;
                await database.photo.put(firstPhoto);
            }
        }
        return firstPhoto;
    };
    while (true) {
        const photoCount = await database.photo.count();
        if (photoCount === 0) {
            return;
        }
        if (!navigator.onLine) {
            if ('sync' in self.registration) {
                self.registration.sync.register('{{CAMERA_APP_UPLOAD_PHOTO_TAG}}');
            }
            return;
        }
        if (!token) {
            const tokenResponse = await fetch('{{CREATE_TOKEN_URL}}', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'username': user.username,
                    'password': CryptoJS.AES.decrypt(user.password, String('{{APP_SECRET_KEY}}')).toString(CryptoJS.enc.Utf8)
                })
            });
            if (tokenResponse.status !== 200) {
                return;
            }
            const result = await tokenResponse.json();
            token = result ? result.access : null;
            if (!token) {
                return;
            }
        }
        now = new Date();
        const photo = await database.transaction('rw', database.photo, getPhoto);
        if (!photo) {
            return;
        }
        const form = new FormData();
        form.append('owner', photo.owner);
        form.append('date_taken', photo.dateTaken);
        form.append('author_name', photo.authorName);
        form.append('scene_tag', photo.sceneTag);
        form.append('context_tag', photo.contextTag);
        form.append('content_type', photo.contentType);
        form.append('encryption_key', photo.encryptionKey);
        const data = new File([photo.encryptedData], `${photo.id}.bin`, { lastModified: now });
        form.append('encrypted_data', data);
        const mediaResponse = await fetch('{{MEDIA_API_URL}}', {
            method: 'POST',
            headers: {
                'Authorization': `{{TOKEN_FORMAT}} ${token}`
            },
            body: form
        });
        if (mediaResponse.status !== 201) {
            return;
        }
        console.info(`photo upload time :${(new Date() - now)}`);
        await database.photo.delete(photo.id);
        const clients = await self.clients.matchAll();
        for (const client of clients) {
            client.postMessage({ tag: '{{CAMERA_APP_PHOTO_UPLOADED_TAG}}' });
        }
    }
}