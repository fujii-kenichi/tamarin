# -*- coding: utf-8 -*-
""" 
タマリンカメラの画面を生成.
@author: fujii.kenichi@tamariva.co.jp
"""
import random
import re
import string

from django.shortcuts import render
from django.views.decorators.http import require_safe

from connector.app_settings import APP_MESSAGES, APP_SETTINGS

# コンテンツ書き換えに使用される辞書を定義する.
CONTEXT_DICT = dict(**APP_SETTINGS, **APP_MESSAGES)


@require_safe
def camera_serviceworker_js(request):
    context_dict = CONTEXT_DICT

    # 現在のバージョンからダミーのコメントを生成するための乱数を初期化する.
    random.seed(CONTEXT_DICT["VERSION"])
    random_length = random.randint(1, 128)

    # ダミーのコメント文字列を生成して追加する.
    dummy_comment = "".join(random.choices(string.ascii_letters + string.digits, k=random_length))
    context_dict.update({"DUMMY_COMMENT": dummy_comment})

    return render(request, "camera-serviceworker.js", context_dict, content_type="text/javascript; charset=utf-8")


@require_safe
def camera_app_webmanifest(request):
    return render(request, "camera-app.webmanifest", CONTEXT_DICT, content_type="application/manifest+json; charset=utf-8")


@require_safe
def camera_app_js(request):
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

    # user-agentでリクエストを判定してデバイス初期化パラメータを決定する.
    if MOBILE_AGENT_RE.match(request.META["HTTP_USER_AGENT"]):
        CONTEXT_DICT.update(MOBILE_PARAM)
    else:
        CONTEXT_DICT.update(PC_PARAM)

    return render(request, "camera-app.js", CONTEXT_DICT, content_type="text/javascript; charset=utf-8")


@require_safe
def camera_app_css(request):
    return render(request, "camera-app.css", CONTEXT_DICT, content_type="text/css; charset=utf-8")


@require_safe
def camera_app_html(request):
    CONTEXT_DICT["ABSOLUTE_URI"] = request.build_absolute_uri()

    return render(request, "camera-app.html", CONTEXT_DICT, content_type="text/html; charset=utf-8")
