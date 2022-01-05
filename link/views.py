# -*- coding: utf-8 -*-
"""
タマリンクの画面を生成.
@author: fujii.kenichi@tamariva.co.jp
"""
from django.shortcuts import render
from django.views.decorators.http import require_safe

from connector.app_settings import APP_MESSAGES, APP_SETTINGS

# コンテンツ書き換えに使用される辞書を定義する.
CONTEXT_DICT = dict(**APP_SETTINGS, **APP_MESSAGES)


@require_safe
def link_serviceworker_js(request):
    return render(request, "link-serviceworker.js", CONTEXT_DICT, content_type="text/javascript; charset=utf-8")


@require_safe
def link_app_webmanifest(request):
    return render(request, "link-app.webmanifest", CONTEXT_DICT, "application/manifest+json; charset=utf-8")


@require_safe
def link_app_js(request):
    return render(request, "link-app.js", CONTEXT_DICT, content_type="text/javascript; charset=utf-8")


@require_safe
def link_app_css(request):
    return render(request, "link-app.css", CONTEXT_DICT, content_type="text/css; charset=utf-8")


@require_safe
def link_app_html(request):
    CONTEXT_DICT["ABSOLUTE_URI"] = request.build_absolute_uri()

    return render(request, "link-app.html", CONTEXT_DICT, content_type="text/html; charset=utf-8")
