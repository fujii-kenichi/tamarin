# -*- coding: utf-8 -*-
"""
タマリンコネクタの各ページをルーティングする.
@author: fujii.kenichi@tamariva.co.jp
"""
from django.urls import include, path
from rest_framework import routers

from . import views

router = routers.DefaultRouter()

# User APIを登録.
router.register("users", views.UserViewSet)

# Media APIを登録.
router.register("medias", views.MediaViewSet)

# History APIを登録.
router.register("histories", views.HistoryViewSet)

urlpatterns = [
    # Token APIを実行.
    path("auth/", include("djoser.urls.jwt")),

    # User/Media/History APIを実行.
    path("api/", include(router.urls)),

    # 通常のトップページ画面.
    path("", views.index),

    # デバッグ用画面.
    path("debug/", views.debug),

    # サインアップ画面.
    path("signup/", views.signup),

    # サインアップ完了画面.
    path("signup-done/", views.signup_done, name="signup_done"),

    # パスワード変更画面.
    path("password-change/", views.password_change),

    # パスワード変更完了画面.
    path("password-change-done/", views.password_change_done, name="password_change_done"),

    # フィードバック画面.
    path("feedback/", views.feedback),

    # フィードバック完了画面.
    path("feedback-done/", views.feedback_done, name="feedback_done"),
]
