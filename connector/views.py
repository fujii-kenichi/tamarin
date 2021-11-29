# -*- coding: utf-8 -*-
"""
タマリンコネクタの画面とAPI処理を制御.
@author: fujii.kenichi@tamariva.co.jp
"""
from django.contrib.auth.forms import UserCreationForm
from django.shortcuts import redirect, render
from rest_framework import viewsets
from rest_framework.parsers import JSONParser, MultiPartParser

from . import models, serializers


def index(request):
    return render(request, "index.html")


def debug(request):
    return render(request, "debug.html")


def signup(request):

    # サインナップの場合...
    if request.method == "POST":
        form = SignupForm(request.POST)

        # 入力された内容を検証する.
        if form.is_valid():
            user = form.save()
            user.refresh_from_db()
            user.save()

            # サインナップ成功.
            return redirect("signup_done")
        else:
            return render(request, "signup.html", {"form": form})

    else:
        form = SignupForm()

    return render(request, "signup.html", {"form": form})


def signup_done(request):
    return render(request, "signup_done.html")


class UserViewSet(viewsets.ModelViewSet):
    queryset = models.User.objects.all()
    serializer_class = serializers.UserSerializer

    # 独自のクエリ：usernameに指定したUserの情報を取得する.
    def get_queryset(self):
        query_username = self.request.query_params.get("username")
        return models.User.objects.filter(username=query_username) if query_username else self.queryset


class MediaViewSet(viewsets.ModelViewSet):
    queryset = models.Media.objects.all()
    serializer_class = serializers.MediaSerializer
    parser_classes = (JSONParser, MultiPartParser)

    # 独自のクエリ：ownerに指定したUser IDに基づいたMediaの一覧を返却する.
    def get_queryset(self):
        query_owner = self.request.query_params.get("owner")
        return models.Media.objects.filter(owner__id=query_owner) if query_owner else self.queryset


class SignupForm(UserCreationForm):
    class Meta:
        model = models.User
        fields = ("username", "email", "password1", "password2", )
