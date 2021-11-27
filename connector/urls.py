# -*- coding: utf-8 -*-
""" タマリンコネクタの各ページをルーティングする.
    by fujii.kenichi@tamariva.co.jp
"""
from django.urls import include, path
from rest_framework import routers

from . import views

router = routers.DefaultRouter()

# User APIを登録.
router.register("users", views.UserViewSet)

# Media APIを登録.
router.register("medias", views.MediaViewSet)

urlpatterns = [

    # Token APIを実行.
    path("auth/", include("djoser.urls.jwt")),

    # User/Media APIを実行.
    path("api/", include(router.urls)),

    # サインアップ画面.
    path("signup/", views.signup),

    # サインアップ完了画面.
    path("signup-done/", views.signup_done, name="signup_done"),

    # デバッグ用画面.
    path("debug/", views.debug),

    # 通常のトップページ画面.
    path("", views.index),
]
