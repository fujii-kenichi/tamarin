/** 
 * タマリンク (Service worker).
 * by fujii.kenichi@tamariva.co.jp
 */
"use strict";

importScripts("{{DEXIE_JS}}");

/**
 * install イベントの処理を定義する.
 */
self.addEventListener('install', (event) => {
    console.log("service worker received install event :", event);

    // キャッシュに必要なファイルを設定する.
    caches.open("{{CACHE_NAME}}").then(cache => {
        return cache.addAll([
            "{{DEXIE_JS}}",
            "{{CRYPTO_JS}}",
            "{{FAVICON}}",
            "{{ICON_192}}",
            "{{ICON_512}}",
            "{{LOADING_ICON}}",
            "{{ERROR_ICON}}",
            "{{LINK_CSS}}",
            "link-app.css",
            "link-app.js",
            "link-app.html",
        ]);
    });

    event.waitUntil(skipWaiting());
});

/**
 * activate イベントの処理を定義する.
 */
self.addEventListener("activate", (event => {
    console.log("service worker received activate event :", event);

    // 古いキャッシュを削除する.
    caches.keys().then((key_list) => {
        return Promise.all(key_list.map((key) => {
            return caches.delete(key);
        }));
    });

    event.waitUntil(clients.claim());
}));

/**
 * fetch イベントの処理を定義する.
 */
self.addEventListener("fetch", (event => {
    console.log("service worker received fetch event :", event);

    // キャッシュからとってこれたら返却する.
    event.respondWith(caches.match(event.request).then(response => {
        return response ? response : fetch(event.request);
    }));
}));