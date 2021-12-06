# -*- coding: utf-8 -*-
"""
タマリンコネクタの画面とAPI処理を制御.
@author: fujii.kenichi@tamariva.co.jp
"""
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.shortcuts import redirect, render
from rest_framework import viewsets
from rest_framework.parsers import JSONParser, MultiPartParser

from . import models, serializers


def index(request):
    """[indexの処理]"""
    return render(request, "index.html")


def debug(request):
    """[debugの処理]"""
    return render(request, "debug.html")


def signup(request):
    """[サインアップの処理]"""
    # データがポストされた時は...
    if request.method == "POST":
        form = SignupForm(request.POST)
        # 入力された内容を検証する.
        if form.is_valid():
            user = form.save()
            user.refresh_from_db()
            user.save()
            # サインナップ成功に移動.
            return redirect("signup_done")
        else:
            # エラーの時は再表示.
            return render(request, "signup.html", {"form": form})
    else:
        # ポストじゃない時はフォームを表示.
        form = SignupForm()

    return render(request, "signup.html", {"form": form})


def signup_done(request):
    """[サインアップ終了の処理]"""
    return render(request, "signup_done.html")


class SignupForm(UserCreationForm):
    """[サインナップのフォーム]"""
    class Meta:
        model = models.User
        fields = ("username", "email", "password1", "password2", )


class UpdateForm(UserChangeForm):
    class Meta:
        model = models.User
        fields = ("username", "email",)


class UserViewSet(viewsets.ModelViewSet):
    """[Userのビュー]"""
    queryset = models.User.objects.all()
    serializer_class = serializers.UserSerializer

    def get_queryset(self):
        """[独自のクエリ：usernameに指定したUserの情報を取得する]"""
        query_username = self.request.query_params.get("username")
        return models.User.objects.filter(username=query_username) if query_username else self.queryset


class MediaViewSet(viewsets.ModelViewSet):
    """[Mediaのビュー]"""
    queryset = models.Media.objects.all()
    serializer_class = serializers.MediaSerializer
    parser_classes = (JSONParser, MultiPartParser)

    def get_queryset(self):
        """[独自のクエリ：ownerに指定したUser IDに基づいたMediaの一覧を返却する]"""
        query_owner = self.request.query_params.get("owner")
        return models.Media.objects.filter(owner__id=query_owner) if query_owner else self.queryset


class HistoryViewSet(viewsets.ModelViewSet):
    """[Historyのビュー]"""
    queryset = models.User.objects.all()
    serializer_class = serializers.HistorySerializer
