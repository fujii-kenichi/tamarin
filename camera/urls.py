# -*- coding: utf-8 -*-
""" タマリンカメラの各ページをルーティングする.
    by fujii.kenichi@tamariva.co.jp
"""
from django.urls import path

from . import views

# PWAとして内容を書き換えてブラウザに送りたいコンテンツのパスをここで定義.

urlpatterns = [
    path("camera-manifest.json", views.camera_manifest_json),
    path("camera-serviceworker.js", views.camera_serviceworker_js),
    path("camera-app.js", views.camera_app_js),
    path("camera-app.css", views.camera_app_css),
    path("camera-app.html", views.camera_app_html),
]
