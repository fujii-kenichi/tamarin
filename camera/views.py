# -*- coding: utf-8 -*-
""" 
タマリンカメラの画面を生成.
@author: fujii.kenichi@tamariva.co.jp
"""
import random
import re
import string

from django.conf import settings
from django.shortcuts import render
from django.templatetags.static import static

# タマリンカメラ固有で書き換えたいシステム的な情報を定義する.
CAMERA_CONTEXT = {
    # アイコン類のパス.
    "FAVICON": static("image/camera-favicon.ico"),
    "ICON_180": static("image/camera-icon-180x180.png"),
    "ICON_192": static("image/camera-icon-192x192.png"),
    "ICON_512": static("image/camera-icon-512x512.png"),

    # JSライブライのパス.
    "DEXIE_JS": static("js/dexie.min.js"),
    "CRYPTO_JS": static("js/crypto-js.min.js"),

    # UI用画像のパス.
    "LOADING_ICON": static("image/loading.gif"),
    "ERROR_ICON": static("image/error.png"),

    # シャッター音のためのファイル.
    "CAMERA_SHUTTER_SOUND": static("sound/camera-shutter-sound.mp3"),

    # 各種ヘルプのURL.
    "INSTALL_HELP_URL": static("install-help.html"),
    "CAMERA_HELP_URL": static("camera-help.html"),
    "CONNECTOR_HELP_URL": static("connector-help.html"),

    # manifestで指定する画面モード.
    "DISPLAY": "standalone",

    # manifestで指定する色.
    "THEME_COLOR": "pink",

    # Dexieを通じてIndexedDBの構成に使用される値.
    "DATABASE_NAME": "tamarin-camera",
    "DATABASE_VERSION": "1",
    "DATABASE_USER_DUMMY_ID": "current_user",

    # service workerのsyncに用いられるタグ文字列.
    "SYNC_TAG": "upload_photo",

    # service workerのメッセージ送受信に用いられる文字列.
    "FORCE_UPDATE_TAG": "force_update",

    # アプリとしてのふるまいを決める値.
    "MAIN_LOOP_INTERVAL": 200,  # この時間だけ毎回メインループでスリープ(ミリ秒).

    # カメラとしてローカルに写真を保持しておける枚数. あんまり多いとIndexedDBが耐えられないかも...
    "MAX_PHOTO_COUNT": 10
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
    "ENCRYPTION_LABEL": "写真を暗号化する",
    "VERSION_LABEL": "バージョン",
    "SETTING_OK_LABEL": "設定",
}

# 最終的にコンテンツ書き換えに使用される辞書を定義する.
CONTEXT = dict(**settings.APP_CONTEXT, **settings.APP_CONTEXT_MESSAGE, **CAMERA_CONTEXT, **CAMERA_CONTEXT_MESSAGE)

# user-agent判定用文字列.
MOBILE_AGENT_RE = re.compile(r".*(iphone|ipod|mobile|android)", re.IGNORECASE)

# モバイルデバイス向けの初期化パラメータ.
MOBILE_PARAM = {
    "DEVICE_PARAM": "\
    {\
        \"audio\" : false,\
        \"video\" : {\
            \"width\" :  { \"min\" : 1920, \"ideal\" : 1920, \"max\" : 1920 },\
            \"height\" : { \"min\" : 1080, \"ideal\" : 1080, \"max\" : 1080 },\
            \"facingMode\" : { \"exact\" : \"environment\" }\
        }\
    }",
    "CAPTURE_PARAM": "{\
        \"imageWidth\" : 1920,\
        \"imageHeight\" : 1080\
    }"
}

# PC向けの初期化パラメータ.
PC_PARAM = {
    "DEVICE_PARAM": "\
    {\
        \"audio\" : false,\
        \"video\" : {\
            \"width\" :  { \"ideal\" : 1920, \"max\" : 1920 },\
            \"height\" : { \"ideal\" : 1080, \"max\" : 1080 },\
            \"facingMode\" : \"user\"\
        }\
    }",
    "CAPTURE_PARAM": "{\
    }"
}


def camera_serviceworker_js(request):
    context = CONTEXT

    # 現在のバージョンからダミーのコメントを生成するための乱数を初期化する.
    random.seed(CONTEXT["VERSION"])
    random_length = random.randint(1, 128)

    # ダミーのコメント文字列を生成して追加する.
    dummy_comment = ''.join(random.choices(string.ascii_letters + string.digits, k=random_length))
    context.update({"DUMMY_COMMENT": dummy_comment})

    # コンテンツ書き換え辞書による書き換えを行ったらあとはそのままレスポンスを返す.
    return render(request, "camera-serviceworker.js", context, content_type="text/javascript; charset=utf-8")


def camera_app_webmanifest(request):
    # コンテンツ書き換え辞書による書き換えを行ったらあとはそのままレスポンスを返す.
    return render(request, "camera-app.webmanifest", CONTEXT, content_type="application/manifest+json; charset=utf-8")


def camera_app_js(request):
    context = CONTEXT
    user_agent = request.META["HTTP_USER_AGENT"]

    # user-agentでリクエストを判定してデバイス初期化パラメータを決定する.
    if MOBILE_AGENT_RE.match(request.META["HTTP_USER_AGENT"]):
        context.update(MOBILE_PARAM)
    else:
        context.update(PC_PARAM)

    # コンテンツ書き換え辞書による書き換えを行ったらあとはそのままレスポンスを返す.
    return render(request, "camera-app.js", context, content_type="text/javascript; charset=utf-8")


def camera_app_css(request):
    # コンテンツ書き換え辞書による書き換えを行ったらあとはそのままレスポンスを返す.
    return render(request, "camera-app.css", CONTEXT, content_type="text/css; charset=utf-8")


def camera_app_html(request):
    # コンテンツ書き換え辞書による書き換えを行ったらあとはそのままレスポンスを返す.
    return render(request, "camera-app.html", CONTEXT, content_type="text/html; charset=utf-8")
