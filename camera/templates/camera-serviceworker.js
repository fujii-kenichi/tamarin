/** 
 * タマリンカメラ (Service worker).
 * by fujii.kenichi@tamariva.co.jp
 * 
 * ↓ このファイルのバイト数を変えることで、ブラウザに更新を伝えるためのコメント.
 * {{VERSION}}:{{DUMMY_COMMENT}}
 */
"use strict";

// 依存するライブラリの読み込み.
importScripts("{{DEXIE_JS}}");
importScripts("{{CRYPTO_JS}}");

/**
 * install イベントの処理を定義する.
 */
self.addEventListener("install", (event => {
    console.log("service worker received install event :", event);
    event.waitUntil(
        // キャッシュへ必要なファイルを押し込む.
        caches.open("{{VERSION}}").then(cache => {
            cache.addAll([
                "{{DEXIE_JS}}",
                "{{CRYPTO_JS}}",
                "{{IMAGECAPTURE_JS}}",
                "{{FAVICON}}",
                "{{ICON_180}}",
                "{{ICON_192}}",
                "{{ICON_512}}",
                "{{LOADING_ICON}}",
                "{{ERROR_ICON}}",
                "{{CAMERA_SHUTTER_SOUND}}",
                "camera-app.css",
                "camera-app.js",
                "camera-app.html{{MODE_APP}}"
            ]).then(self.skipWaiting());
        })
    );
}));

/**
 * fetch イベントの処理を定義する.
 */
self.addEventListener("fetch", (event => {
    //console.log("service worker received fetch event :", event);
    // キャッシュからとってこれたらそれを返却する.
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                console.log("service worker returns content from cache :", event.request.url);
                return response;
            } else {
                // console.log("service worker could not find url from cache :", event.request.url);
                return fetch(event.request);
            }
        }));
}));

/**
 * activate イベントの処理を定義する.
 */
self.addEventListener("activate", (event => {
    console.log("service worker received activate event :", event);
    // バージョンの違う古いキャッシュを削除する.
    event.waitUntil(
        caches.keys().then(cache_names => {
            return Promise.all(cache_names.map(name => {
                if (name !== "{{VERSION}}") {
                    console.log("delete old cache :", name);
                    return caches.delete(name);
                }
            }));
            // 全てのクライアントに自分をコントローラとして設定して終了.
        }).then(() => self.clients.claim())
    );
}));

/**
 * sync イベントの処理を定義する.
 */
self.addEventListener("sync", (event => {
    console.log("service worker received sync event :", event);
    // タグを確認する.
    if (event.tag !== "{{SYNC_TAG}}") {
        console.warn("ignore unknown sync event :", event.tag);
        return;
    }
    // TODO: ちょっとネストが深くなっているのでawaitに変える?
    // 写真を1枚だけアップロードする処理のタスクを定義する.
    const task = new Promise(() => {
        console.log("background sync task started.");
        // データベースを開く.
        const database = new Dexie("{{DATABASE_NAME}}");
        console.assert(database);
        // インデックスを定義する.
        database.version("{{DATABASE_VERSION}}").stores({
            user: "dummy_id, user_id",
            photo: "++id, date_taken"
        });
        // データベースからユーザを取得する.
        database.user.get("{{DATABASE_USER_DUMMY_ID}}").then(user => {
            // ユーザが取得できなかったらこれ以上は何もしない.
            if (!user) {
                console.warn("could not load user from database - may be the first run.");
                return;
            }
            // アップロードすべき写真をデータベースから取得する.
            database.photo.orderBy("date_taken").first().then(photo => {
                // 写真がなければこれ以上は何もしない.
                if (!photo) {
                    console.log("photo database is empty.");
                    return;
                }
                // 写真があった場合はまたアップロードしたいので自分自身を呼ぶイベントを登録しておく.
                self.registration.sync.register("{{SYNC_TAG}}");
                // 写真のアップロード開始！
                console.info("start uploading photo to media service :", photo.id);
                const start_time = new Date();
                // INdexedDBにパスワードを保存する際の暗号化に使うキーを準備する.
                const SECRET_KEY = String("{{SECRET_KEY}}");
                // Tokenサービスを呼び出すために現在のユーザに紐づいたパスワードを復号する.
                const raw_password = CryptoJS.AES.decrypt(user.encrypted_password, SECRET_KEY).toString(CryptoJS.enc.Utf8);
                console.assert(raw_password);
                // Tokenサービスを呼び出す.
                console.log("calling token service : {{CREATE_TOKEN_URL}}");
                fetch("{{CREATE_TOKEN_URL}}", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        "username": user.username,
                        "password": raw_password
                    })
                }).then(token_response => {
                    console.assert(token_response);
                    console.log("token service respond :", token_response);
                    // レスポンスが200のときだけ処理を続行する.
                    if (token_response.status !== 200) {
                        console.error("could not get token :", token_response.status);
                        return;
                    }
                    // トークンがちゃんと取れたら...
                    token_response.json().then(token_result => {
                        console.assert(token_result);
                        const token = token_result.access;
                        console.assert(token);
                        // 写真アップロードに必要なフォームを作成する.
                        const form_data = new FormData();
                        console.assert(form_data);
                        // フォームを埋める.
                        form_data.append("owner", photo.owner);
                        form_data.append("date_taken", photo.date_taken);
                        form_data.append("author_name", photo.author_name);
                        form_data.append("scene_tag", photo.scene_tag);
                        form_data.append("context_tag", photo.context_tag);
                        form_data.append("content_type", photo.content_type);
                        form_data.append("encryption_key", photo.encryption_key);
                        const encrypted_data = new File([photo.encrypted_data], photo.id + ".bin", { lastModified: start_time });
                        form_data.append("encrypted_data", encrypted_data);
                        // Mediaサービスを呼んで写真をアップロードする.
                        console.log("calling media service : {{MEDIA_API_URL}}");
                        fetch("{{MEDIA_API_URL}}", {
                            method: "POST",
                            headers: {
                                "Authorization": "{{TOKEN_FORMAT}} " + token
                            },
                            body: form_data
                        }).then(media_response => {
                            console.assert(media_response);
                            console.log("media service returns response :", media_response);
                            // HTTPステータスコードで分岐する.
                            if (media_response.status === 201) {
                                // アップロードがうまくいった.
                                console.log("photo uploaded successfully :", photo.id);
                                console.info("photo upload time in ms :", new Date() - start_time);
                                // データベースから写真を削除する.
                                console.log("deleting photo :", photo.id);
                                database.photo.delete(photo.id).then(() => {
                                    console.log("deleted photo :", photo.id);
                                });
                            } else {
                                // 想定外のステータスコードが返ってきた.
                                console.error("unexpected status code from media service :", media_response.status);
                                // TODO: 本当はここでなにか適切なエラーハンドリングをするべき.
                            }
                        });
                    });
                });
            });
        });
    });
    // タスクの終了を待つ.
    event.waitUntil(task);
}));

/**
 * message イベントの処理を定義する.
 */
self.addEventListener("message", (event => {
    console.log("service worker received message event :", event);
    // タグを確認する.
    if (event.data.tag !== "{{FORCE_UPDATE_TAG}}") {
        console.warn("ignore unknown message event :", event.data.tag);
        return;
    }
    // 強制アップデートの処理を行う.
    const task = new Promise(() => {
        console.log("force update task started.");
        // すべてのキャッシュを削除する.
        // これで構成するファイルをぜんぶもう一回取りに行くはず.
        caches.keys().then(cache_names => {
            return Promise.all(cache_names.map(name => {
                console.log("delete cache :", name);
                return caches.delete(name);
            }));
        }).then(() => {
            // クライアントにメッセージを送る.
            // クライアントはこれで再度自分自身へリダイレクトする.
            // 詳細は camera-app.js をみてね!
            self.clients.matchAll().then(clients => {
                for (const c of clients) {
                    console.log("post message to client :", c);
                    c.postMessage({ tag: "{{FORCE_UPDATE_TAG}}" });
                }
            });
        });
    });
    // タスクの終了を待つ.
    event.waitUntil(task);
}));