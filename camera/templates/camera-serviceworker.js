/** 
 * タマリンカメラ (service worker).
 * by fujii.kenichi@tamariva.co.jp
 * 
 * ↓ このファイルのバイト数を変えることでブラウザに更新を伝えるためのコメント.
 * {{VERSION}}:{{DUMMY_COMMENT}}
 */
"use strict";

importScripts("{{DEXIE_JS}}");
importScripts("{{CRYPTO_JS}}");

/**
 * installイベントの処理を定義する.
 */
self.addEventListener("install", (event => {
    event.waitUntil(
        // キャッシュへ必要なファイルを押し込む.
        caches.open("{{VERSION}}").then(cache => {
            cache.addAll([
                "{{DEXIE_JS}}",
                "{{CRYPTO_JS}}",
                "{{BULMA_CSS}}",
                "{{COMMON_CSS}}",
                "{{CAMERA_APP_FAVICON}}",
                "{{CAMERA_APP_ICON180}}",
                "{{CAMERA_APP_ICON192}}",
                "{{CAMERA_APP_ICON512}}",
                "{{CAMERA_APP_SHUTTER_AUDIO}}",
                "camera-app.webmanifest",
                "camera-app.css",
                "camera-app.js",
                "camera-app.html",
                "camera-app.html{{APP_MODE_URL_PARAM}}"
            ]).then(self.skipWaiting());
        })
    );
}));

/**
 * fetchイベントの処理を定義する.
 */
self.addEventListener("fetch", (event => {
    // キャッシュからとってこれたらそれを返却する.
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                console.log("service worker returns content from cache :", event.request.url);
                return response;
            } else {
                return fetch(event.request);
            }
        })
    );
}));

/**
 * activateイベントの処理を定義する.
 */
self.addEventListener("activate", (event => {
    // バージョンの違うキャッシュを削除する.
    event.waitUntil(
        caches.keys().then(cache_names => {
            return Promise.all(cache_names.map(name => {
                if (name !== "{{VERSION}}") {
                    return caches.delete(name);
                }
            }));
            // 全てのクライアントに自分をコントローラとして設定して終了.
        }).then(() => self.clients.claim())
    );
}));

/**
 * syncイベントの処理を定義する.
 */
self.addEventListener("sync", (event => {
    if (event.tag === "{{CAMERA_APP_UPLOAD_PHOTO_TAG}}") {
        event.waitUntil(upload_photos());
    }
}));

/**
 * 写真をあるだけアップロードする.
 */
async function upload_photos() {
    // データベースを開く.
    const database = new Dexie("{{CAMERA_APP_DATABASE_NAME}}");
    database.version("{{CAMERA_APP_DATABASE_VERSION}}").stores({
        user: "dummy_id, user_id",
        photo: "++id, date_taken"
    });
    const user = await database.user.get("{{APP_DATABASE_CURRENT_USER}}");
    // ユーザーが取得できなかったらこれ以上は何もしない.
    if (!user) {
        return;
    }
    let token = null;
    while (true) {
        // アップロードすべき写真をデータベースから取得する.
        const photo = await database.photo.orderBy("date_taken").first();
        // 写真がなければこれ以上は何もしない.
        if (!photo) {
            return;
        }
        // トークンが無効なら作り直す.
        if (!token) {
            const response = await fetch("{{CREATE_TOKEN_URL}}", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "username": user.username,
                    "password": CryptoJS.AES.decrypt(user.encrypted_password, String("{{APP_SECRET_KEY}}")).toString(CryptoJS.enc.Utf8)
                })
            });
            // 200以外の場合にこのまま裏でアップロードをしても危険なのでもう何もしない...    
            if (response.status !== 200) {
                return;
            }
            token = await response.json().access;
        }
        // 写真アップロードに必要なフォームを作成する.
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
        // Mediaサービスを呼んで写真をアップロードする.
        const response = await fetch("{{MEDIA_API_URL}}", {
            method: "POST",
            headers: {
                "Authorization": `{{TOKEN_FORMAT}} ${token}`
            },
            body: form_data
        });
        if (response.status === 201) {
            console.info(`photo upload time :${(new Date() - start_time)}`);
            // データベースから写真を削除する.
            await database.photo.delete(photo.id);
            // クライアントにメッセージを送る.
            self.clients.matchAll().then(clients => {
                for (const client of clients) {
                    client.postMessage({ tag: "{{CAMERA_APP_PHOTO_UPLOADED_TAG}}" });
                }
            });
        } else if (response.status === 400 || response.status === 401 || status === 403) {
            token = null;
        } else {
            return;
        }
    }
}

/**
 * messageイベントの処理を定義する.
 */
self.addEventListener("message", (event => {
    if (event.data.tag === "{{CAMERA_APP_FORCE_UPDATE_TAG}}") {
        event.waitUntil(force_update());
    }
}));

/**
 * 強制アップデートの処理を行う.
 */
async function force_update() {
    // すべてのキャッシュを削除する.
    // これで構成するファイルをぜんぶもう一回取りに行く.
    caches.keys().then(cache_names => {
        return Promise.all(cache_names.map(name => {
            return caches.delete(name);
        }));
    }).then(() => {
        // クライアントにメッセージを送る.
        // クライアントはこれで再度自分自身へリダイレクトする.
        self.clients.matchAll().then(clients => {
            for (const client of clients) {
                client.postMessage({ tag: "{{CAMERA_APP_FORCE_UPDATE_TAG}}" });
            }
        });
    });
}