# -*- coding: utf-8 -*-
"""
タマリンカメラの各ページをルーティングする.
@author: fujii.kenichi@tamariva.co.jp
"""
from django.urls import path

from . import views

# PWAとして内容を書き換えてブラウザに送りたいコンテンツのパスをここで定義.
urlpatterns = [
    path("camera-serviceworker.js", views.camera_serviceworker_js),
    path("camera-app.webmanifest", views.camera_app_webmanifest),
    path("camera-app.js", views.camera_app_js),
    path("camera-app.css", views.camera_app_css),
    path("camera-app.html", views.camera_app_html),
]
