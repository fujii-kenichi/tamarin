# -*- coding: utf-8 -*-
""" タマリンカメラの画面を生成.
    by fujii.kenichi@tamariva.co.jp
"""
from django.conf import settings
from django.shortcuts import render
from django.templatetags.static import static

# タマリンカメラ固有で書き換えたいシステム的な情報を定義する.

CAMERA_CONTEXT = {

    # アイコン類のパス.
    "FAVICON": static("image/camera-favicon.ico"),
    "ICON_192": static("image/camera-icon-192x192.png"),
    "ICON_512": static("image/camera-icon-512x512.png"),

    # JSライブライのパス.
    "DEXIE_JS": static("lib/dexie.min.js"),
    "CRYPTO_JS": static("lib/crypto-js.min.js"),
    "IMAGECAPTURE_JS": static("lib/imagecapture.js"),

    # UI用画像のパス.
    "LOADING_ICON": static("image/loading.gif"),
    "ERROR_ICON": static("image/error.png"),

    # シャッター音のためのファイル.
    "CAMERA_SHUTTER_SOUND": static("sound/camera-shutter-sound.mp3"),

    # 各種ヘルプのURL.
    "INSTALL_HELP_URL": static("install-help.html"),
    "CAMERA_HELP_URL": static("camera-help.html"),
    "AUTH_HELP_URL": static("auth-help.html"),

    # manifest で指定する画面モード.
    "DISPLAY": "fullscreen",

    # manifest で指定する色.
    "THEME_COLOR": "pink",

    # Dexieを通じてIndexedDBの構成に使用される値.
    "DATABASE_NAME": "tamarin-camera",
    "DATABASE_VERSION": "1",
    "DATABASE_USER_DUMMY_ID": "current_user",

    # Periodic Sync の時に用いられるタグ文字列.
    "SYNC_TAG": "tamarin-camera-sync",

    # アプリとしてのふるまいを決める値.
    "MAIN_LOOP_INTERVAL": 200,  # この時間だけ毎回メインループでスリープ(ミリ秒).
    "PERIODIC_SYNC_INTERVAL": 3 * 1000,  # Periodic Syncでこちらを呼び出してほしい時間間隔(ミリ秒).
    "AUTO_RELOAD_TRIGGER": 30 * 1000 / 200,  # 何もせずこの時間を過ぎたら自動リロード機能を実行(ミリ秒)

    "MAX_PHOTO_COUNT": 10,  # カメラとしてローカルに写真を保持しておける枚数. あんまり多いとIndexedDBが耐えられないかも...
}

# タマリンカメラ固有で書き換えたいユーザに見せる各種メッセージを定義する.

CAMERA_CONTEXT_MESSAGE = {

    # PWAとしてマニフェストに書くための情報.
    "NAME": "タマリンカメラ",
    "SHORT_NAME": "タマリンカメラ",
    "DESCRIPTION": "タマリンサービスのカメラです！",

    # 各UI要素に対応した文字列.
    "CAMERA_HELP_LABEL": "詳しい使い方をみる",
    "SETTING_LABEL": "タマリンカメラの設定",
    "SHUTTER_SOUND_LABEL": "シャッター音を鳴らす",
    "AUTO_RELOAD_LABEL": "自動でタグを取得する",
    "ENCRYPTION_LABEL": "暗号化する",
    "VERSION_LABEL": "ビルドバージョン",
    "DEVICE_PARAM_LABEL": "デバイス初期化情報",
    "SETTING_OK_LABEL": "設定",
}

# 最終的にコンテンツ書き換えに使用される辞書を定義する.

CONTEXT = settings.APP_CONTEXT | settings.APP_CONTEXT_MESSAGE | CAMERA_CONTEXT | CAMERA_CONTEXT_MESSAGE


# 基本的にはコンテンツ書き換え辞書による書き換えを行ったらあとはそのままレスポンスを返す.


def camera_manifest_json(request):
    return render(request, "camera-manifest.json", CONTEXT, content_type="application/json")


def camera_serviceworker_js(request):
    return render(request, "camera-serviceworker.js", CONTEXT, content_type="text/javascript")


def camera_app_js(request):
    return render(request, "camera-app.js", CONTEXT, content_type="text/javascript")


def camera_app_css(request):
    return render(request, "camera-app.css", CONTEXT, content_type="text/css")


def camera_app_html(request):
    return render(request, "camera-app.html", CONTEXT)
