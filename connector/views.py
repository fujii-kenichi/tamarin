# -*- coding: utf-8 -*-
"""
タマリンコネクタの画面とAPI処理を制御.
@author: fujii.kenichi@tamariva.co.jp
"""
import sys

from django import forms
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.forms import UserCreationForm
from django.core.exceptions import ValidationError
from django.shortcuts import redirect, render
from rest_framework import viewsets
from rest_framework.parsers import JSONParser, MultiPartParser

from tamarin.app_settings import APP_MESSAGES, APP_SETTINGS

from . import models, serializers

sys.path.append("../")

# コンテンツ書き換えに使用される辞書を定義する.
CONTEXT_DICT = dict(**APP_SETTINGS, **APP_MESSAGES)


def index(request):
    """[indexの処理]"""
    return render(request, "index.html", CONTEXT_DICT)


def debug(request):
    """[debugの処理]"""
    return render(request, "debug.html", CONTEXT_DICT)


def signup(request):
    """[サインアップの処理]"""
    if request.method == "POST":
        form = SignupForm(request.POST)
        if form.is_valid():
            user = form.save()
            user.refresh_from_db()
            user.save()
            return redirect("signup_done")
    else:
        form = SignupForm()

    context = {"form": form}
    return render(request, "signup.html", dict(**context, **CONTEXT_DICT))


def signup_done(request):
    """[サインアップ終了の処理]"""
    return render(request, "signup_done.html", CONTEXT_DICT)


def password_change(request):
    """[パスワード変更の処理]"""
    if request.method == "POST":
        form = PasswordChangeForm(request.POST)
        if form.is_valid():
            current_username = form.cleaned_data["current_username"]
            user = models.User.objects.get(username=current_username)
            confirm_new_password = form.cleaned_data["confirm_new_password"]
            user.set_password(confirm_new_password)
            user.save()
            return redirect("password_change_done")
    else:
        form = PasswordChangeForm()

    context = {"form": form}
    return render(request, "password_change.html", dict(**context, **CONTEXT_DICT))


def password_change_done(request):
    """[パスワード変更終了の処理]"""
    return render(request, "password_change_done.html", CONTEXT_DICT)


def feedback(request):
    """[フィードバックの処理]"""
    if request.method == "POST":
        form = FeedbackForm(request.POST)
        if form.is_valid():
            form_author_name = form.cleaned_data["author_name"]
            form_comment = form.cleaned_data["comment"]
            feedback = models.Feedback.objects.create(author_name=form_author_name, comment=form_comment)
            feedback.save()
            return redirect("feedback_done")
    else:
        form = FeedbackForm()

    context = {"form": form}
    return render(request, "feedback.html", dict(**context, **CONTEXT_DICT))


def feedback_done(request):
    """[フィードバック終了の処理]"""
    return render(request, "feedback_done.html", CONTEXT_DICT)


class SignupForm(UserCreationForm):
    """[サインナップのフォーム]"""
    class Meta:
        model = models.User
        fields = ("username", "password1", "password2", )


class PasswordChangeForm(forms.Form):
    """[パスワード変更のフォーム]"""
    current_username = forms.CharField(required=True, min_length=CONTEXT_DICT["MIN_NAME_LENGTH"], max_length=CONTEXT_DICT["MAX_NAME_LENGTH"], widget=forms.TextInput(), label=CONTEXT_DICT["USERNAME_LABEL"])
    current_password = forms.CharField(required=True, min_length=CONTEXT_DICT["MIN_NAME_LENGTH"], max_length=CONTEXT_DICT["MAX_NAME_LENGTH"], widget=forms.PasswordInput(), label=CONTEXT_DICT["PASSWORD_LABEL"])
    new_password = forms.CharField(required=True, min_length=CONTEXT_DICT["MIN_NAME_LENGTH"], max_length=CONTEXT_DICT["MAX_NAME_LENGTH"], widget=forms.PasswordInput(), label=CONTEXT_DICT["NEW_PASSWORD_LABEL"])
    confirm_new_password = forms.CharField(required=True, min_length=CONTEXT_DICT["MIN_NAME_LENGTH"], max_length=CONTEXT_DICT["MAX_NAME_LENGTH"], widget=forms.PasswordInput(), label=CONTEXT_DICT["NEW_PASSWORD2_LABEL"])

    def clean_current_username(self):
        current_username = self.cleaned_data["current_username"]
        return current_username

    def clean_current_password(self):
        current_username = self.cleaned_data["current_username"]
        current_password = self.cleaned_data["current_password"]
        if current_username and current_password:
            try:
                user = models.User.objects.get(username=current_username)
                auth_result = authenticate(username=user.username, password=current_password)
                if not auth_result:
                    raise ValidationError(CONTEXT_DICT["INVALID_PASSWORD_MESSAGE"])

            except models.User.DoesNotExist:
                raise ValidationError(CONTEXT_DICT["INVALID_PASSWORD_MESSAGE"])

        return current_password

    def clean_new_password(self):
        new_password = self.cleaned_data["new_password"]
        return new_password

    def clean_confirm_new_password(self):
        confirm_new_password = self.cleaned_data["confirm_new_password"]
        return confirm_new_password

    def clean(self):
        cleaned_data = super().clean()
        new_password = self.cleaned_data.get("new_password")
        confirm_new_password = self.cleaned_data.get("confirm_new_password")
        if new_password != confirm_new_password:
            self.add_error(field="confirm_new_password", error=ValidationError(CONTEXT_DICT["INVALID_PASSWORD_MESSAGE"]))
        return cleaned_data


class FeedbackForm(forms.Form):
    """[フィードバックのフォーム]"""
    author_name = forms.CharField(required=True, min_length=CONTEXT_DICT["MIN_NAME_LENGTH"], max_length=CONTEXT_DICT["MAX_NAME_LENGTH"], widget=forms.TextInput(), label=CONTEXT_DICT["USERNAME_LABEL"])
    comment = forms.CharField(required=True, min_length=CONTEXT_DICT["MIN_FEEDBACK_LENGTH"], max_length=CONTEXT_DICT["MAX_FEEDBACK_LENGTH"], widget=forms.TextInput(), label=CONTEXT_DICT["FEEDBACK_MESSAGE"])


class UserViewSet(viewsets.ModelViewSet):
    """[Userのビュー]"""
    queryset = models.User.objects.all()
    serializer_class = serializers.UserSerializer

    def get_queryset(self):
        """[独自のクエリ:usernameに指定したUserの情報を取得する]"""
        query_username = self.request.query_params.get("username")
        return models.User.objects.filter(username=query_username) if query_username else self.queryset


class MediaViewSet(viewsets.ModelViewSet):
    """[Mediaのビュー]"""
    queryset = models.Media.objects.all()
    serializer_class = serializers.MediaSerializer
    parser_classes = (JSONParser, MultiPartParser)

    def get_queryset(self):
        """[独自のクエリ:ownerに指定したUser IDに基づいたMediaの一覧を返却する]"""
        query_owner = self.request.query_params.get("owner")
        return models.Media.objects.filter(owner__id=query_owner) if query_owner else self.queryset


class HistoryViewSet(viewsets.ModelViewSet):
    """[Historyのビュー]"""
    queryset = models.History.objects.all()
    serializer_class = serializers.HistorySerializer


class FeedbackViewSet(viewsets.ModelViewSet):
    """[Feedbackのビュー]"""
    queryset = models.Feedback.objects.all()
    serializer_class = serializers.FeedbackSerializer
