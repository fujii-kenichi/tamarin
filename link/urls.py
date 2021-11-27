# -*- coding: utf-8 -*-
""" タマリンクの各ページをルーティングする.
    by fujii.kenichi@tamariva.co.jp
"""
from django.urls import path

from . import views

# PWAとして内容を書き換えてブラウザに送りたいコンテンツのパスをここで定義.

urlpatterns = [
    path("link-manifest.json", views.link_manifest_json),
    path("link-serviceworker.js", views.link_serviceworker_js),
    path("link-app.js", views.link_app_js),
    path("link-app.css", views.link_app_css),
    path("link-app.html", views.link_app_html),
]
