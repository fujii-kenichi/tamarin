# -*- coding: utf-8 -*-
"""
タマリンクの各ページをルーティングする.
@author: fujii.kenichi@tamariva.co.jp
"""
from django.urls import path

from . import views

# 内容を書き換えてブラウザに送りたいコンテンツのパスをここで定義.
urlpatterns = [
    path("link-serviceworker.js", views.link_serviceworker_js),
    path("link-app.webmanifest", views.link_app_webmanifest),
    path("link-app.js", views.link_app_js),
    path("link-app.css", views.link_app_css),
    path("link-app.html", views.link_app_html),
]
