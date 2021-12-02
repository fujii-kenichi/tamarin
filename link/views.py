# -*- coding: utf-8 -*-
"""
タマリンクの画面を生成.
@author: fujii.kenichi@tamariva.co.jp
"""
from django.conf import settings
from django.shortcuts import render
from django.templatetags.static import static

# タマリンク固有で書き換えたいシステム的な情報を定義する.
LINK_CONTEXT = {

    # アイコン類のパス.
    "FAVICON": static("image/link-favicon.ico"),
    "ICON_192": static("image/link-icon-192x192.png"),
    "ICON_512": static("image/link-icon-512x512.png"),

    # JSライブライのパス.
    "DEXIE_JS": static("js/dexie.min.js"),
    "CRYPTO_JS": static("js/crypto-js.min.js"),

    # UI用画像のパス.
    "LOADING_ICON": static("image/loading.gif"),
    "ERROR_ICON": static("image/error.png"),

    # 各種ヘルプのURL.
    "INSTALL_HELP_URL": static("install-help.html"),
    "LINK_HELP_URL": static("link-help.html"),
    "CONNECTOR_HELP_URL": static("connector-help.html"),
    "SIGNUP_URL": "../connector/signup",

    # manifestで指定する画面モード.
    "DISPLAY": "minimal-ui",

    # manifestで指定する色.
    "THEME_COLOR": "pink",

    # Dexieを通じてIndexedDBの構成に使用される値.
    "DATABASE_NAME": "tamarin-link",
    "DATABASE_VERSION": "1",
    "DATABASE_USER_DUMMY_ID": "current_user",

    # アプリとしてのふるまいを決める値.
    "MAIN_LOOP_INTERVAL": 200, # この時間だけ毎回メインループでスリープ(ミリ秒).
    "MAX_TAG_LENGTH": 250, # シーンや状況といったタグの入力フィールドにおける最大文字長.
}

# タマリンク固有で書き換えたいユーザに見せる各種メッセージを定義する.
LINK_CONTEXT_MESSAGE = {

    # PWAとしてマニフェストに書くための情報.
    "NAME": "タマリンク",
    "SHORT_NAME": "タマリンク",
    "DESCRIPTION": "タマリンの管理アプリです",

    # 各UI要素に対応した文字列.
    "SIGNUP_LABEL": "サインアップ",
    "LINK_HELP_LABEL": "詳しい使い方をみる",

    "USER_SECTION_LABEL": "タマリンカメラで撮影をするための設定",
    "SCENE_TAG_LABEL": "シーンの名前(リスト)",
    "SCENE_COLOR_LABEL": "シーンの色(リスト)",
    "CONTEXT_TAG_LABEL": "状況の名前(リスト)",

    "MEDIA_SECTION_LABEL": "サービスから写真をダウンロードをするための設定",
    "DOWNLOAD_RULE_LABEL": "フォルダへの振り分けルール",
    "DOWNLOAD_RULE_1": "(1) 撮影者を重視 - [ 撮影日付 ▶ 撮影者 ▶ 状況 ▶ シーン ▶ 撮影時刻(画像ファイル) ]",
    "DOWNLOAD_RULE_2": "(2) 状況を重視 - [ 撮影日付 ▶ 状況 ▶ 撮影者 ▶ シーン ▶ 撮影時刻(画像ファイル) ]",

    "DOWNLOAD_ONLY_LABEL": "ダウンロード後も保持する",

    "UPDATE_LABEL": "設定を保存する",
    "DOWNLOAD_LABEL": "ダウンロードを開始する",
    "DOWNLOAD_CANCEL_LABEL": "ダウンロードを停止する",

    # ファイル名を生成するときに使う日時の補完用文字列.
    "DOWNLOAD_Y": "年",
    "DOWNLOAD_M": "月",
    "DOWNLOAD_D": "日",
    "DOWNLOAD_H": "時",
    "DOWNLOAD_M": "分",
    "DOWNLOAD_S": "秒",
}

# 最終的にコンテンツ書き換えに使用される辞書を定義する.
CONTEXT = settings.APP_CONTEXT | settings.APP_CONTEXT_MESSAGE | LINK_CONTEXT | LINK_CONTEXT_MESSAGE


def link_serviceworker_js(request):
    # コンテンツ書き換え辞書による書き換えを行ったらあとはそのままレスポンスを返す.
    return render(request, "link-serviceworker.js", CONTEXT, content_type="text/javascript")


def link_app_webmanifest(request):
    # コンテンツ書き換え辞書による書き換えを行ったらあとはそのままレスポンスを返す.
    return render(request, "link-app.webmanifest", CONTEXT, "application/manifest+json")


def link_app_js(request):
    # コンテンツ書き換え辞書による書き換えを行ったらあとはそのままレスポンスを返す.
    return render(request, "link-app.js", CONTEXT, content_type="text/javascript")


def link_app_css(request):
    # コンテンツ書き換え辞書による書き換えを行ったらあとはそのままレスポンスを返す.
    return render(request, "link-app.css", CONTEXT, content_type="text/css")


def link_app_html(request):
    # コンテンツ書き換え辞書による書き換えを行ったらあとはそのままレスポンスを返す.
    return render(request, "link-app.html", CONTEXT)
