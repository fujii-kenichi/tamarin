# -*- coding: utf-8 -*-
"""
タマリンコネクタのデータモデル.
@author: fujii.kenichi@tamariva.co.jp
"""
import sys
import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.validators import ASCIIUsernameValidator
from django.db import models

from tamarin.app_settings import APP_MESSAGES, APP_SETTINGS

sys.path.append("../")

# コンテンツ書き換えに使用される辞書を定義する.
CONTEXT_DICT = dict(**APP_SETTINGS, **APP_MESSAGES)


class User(AbstractUser):
    """[Userクラス]
    タマリンサービスにおけるひとつのユーザーを表現する.
    AbstractUserクラスを拡張しているのでfirst_nameといった使わない属性もそのままであることに注意.
    """
    # IDはUUIDとする.
    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)

    # ユーザー名:APIのURLに露出する場合があるということで意図的にASCIIに制限している.
    username_validator = ASCIIUsernameValidator()
    username = models.CharField(max_length=CONTEXT_DICT["MAX_NAME_LENGTH"], unique=True, validators=[username_validator, ], verbose_name=CONTEXT_DICT["USERNAME_LABEL"])

    # email は不要.
    EMAIL_FIELD = ""

    # 最終更新日.
    date_updated = models.DateTimeField(auto_now=True)

    # シーンタグの羅列:CSVで区切って入れる.
    scene_tag = models.CharField(blank=True, null=False, default=CONTEXT_DICT["DEFAULT_SCENE_TAG"], max_length=CONTEXT_DICT["MAX_TAG_CSV_LENGTH"])

    # シーンタグにあわせえた色の羅列:CSVで区切って入れる.CSSの色名がそのまま使用可能.
    scene_color = models.CharField(blank=True, null=False, default=CONTEXT_DICT["DEFAULT_SCENE_COLOR"], max_length=CONTEXT_DICT["MAX_TAG_CSV_LENGTH"])

    # コンテキストタグの羅列:CSVで区切って入れる.
    context_tag = models.CharField(blank=True, null=False, default=CONTEXT_DICT["DEFAULT_CONTEXT_TAG"], max_length=CONTEXT_DICT["MAX_TAG_CSV_LENGTH"])

    # ダウンロードルール:CSVで区切って入れる.
    download_rule = models.CharField(blank=True, null=False, default=CONTEXT_DICT["DEFAULT_DOWNLOAD_RULE"], max_length=CONTEXT_DICT["MAX_TAG_CSV_LENGTH"])


def generate_data_path(instance, filename):
    """ Mediaが保存されるときには元のファイル名を無視してUUIDでつけなおしたものを強制する. """
    return "{}/{}.bin".format(instance.owner.id, uuid.uuid4())


class Media(models.Model):
    """[Mediaクラス]
    タマリンサービスにおけるひとつのメディアデータ(写真)を表現する.
    """
    # IDはUUIDとする.
    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)

    # 所有者:Userを参照する.
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    # 生成(撮影)された日時.
    date_taken = models.DateTimeField(blank=False)

    # データのタイプ:MIMEタイプの文字列がそのまま入る.
    content_type = models.CharField(blank=False, max_length=CONTEXT_DICT["MAX_MIME_TYPE_LENGTH"])

    # データのタイプ:Formでアップロードしたりするのに必要なので設けているだけで実質は使用しない.
    type = models.CharField(blank=False, max_length=CONTEXT_DICT["MAX_MIME_TYPE_LENGTH"])

    # データの作成者:任意に設定された文字列が入る.
    author_name = models.CharField(blank=False, max_length=CONTEXT_DICT["MAX_NAME_LENGTH"])

    # シーンタグ:最終的に選ばれた文字列が一つだけ入る.
    scene_tag = models.CharField(blank=False, max_length=CONTEXT_DICT["MAX_TAG_LENGTH"])

    # コンテキストタグ:最終的に選ばれた文字列が一つだけ入る.
    context_tag = models.CharField(blank=False, max_length=CONTEXT_DICT["MAX_TAG_LENGTH"])

    # 暗号化キー:NO_ENCRYPTION_KEYで暗号化されていない/それ以外は暗号化に使用したキー.
    encryption_key = models.CharField(blank=False, max_length=CONTEXT_DICT["MEDIA_ENCRYPTION_KEY_LENGTH"]*2)

    # 実際のファイルデータ:暗号化キーで暗号化されているので復号する必要がある.
    encrypted_data = models.FileField(blank=False, upload_to=generate_data_path)

    class Meta:
        verbose_name = CONTEXT_DICT["MEDIA_LABEL"]
        verbose_name_plural = CONTEXT_DICT["MEDIA_LABEL"]


class History(models.Model):
    """[Historyクラス]
    タマリンサービスにおけるひとつのヒストリーデータ(何らかの行動)を表現する.
    """
    # 発生した日時.
    date_occurred = models.DateTimeField(auto_now_add=True)

    # タイプ:まだ試行段階なのでとりあえず任意の文字列.
    type = models.CharField(blank=False, max_length=CONTEXT_DICT["MAX_HISTORY_TYPE_LENGTH"])

    # 発生させたユーザー:Userのidを参照する.
    user = models.UUIDField()

    # 対象となるメディア:Mediaのidを参照する.
    media = models.UUIDField()

    class Meta:
        verbose_name = CONTEXT_DICT["HISTORY_LABEL"]
        verbose_name_plural = CONTEXT_DICT["HISTORY_LABEL"]


class Feedback(models.Model):
    """[Feedbackクラス]
    タマリンサービスにおけるユーザーからのフィードバックを表現する.
    """
    # 発生した日時.
    date_occurred = models.DateTimeField(auto_now_add=True)

    # 作成者,
    author_name = models.CharField(blank=False, max_length=CONTEXT_DICT["MAX_NAME_LENGTH"])

    # コメント.
    comment = models.CharField(blank=False, max_length=CONTEXT_DICT["MAX_FEEDBACK_LENGTH"])

    class Meta:
        verbose_name = CONTEXT_DICT["FEEDBACK_LABEL"]
        verbose_name_plural = CONTEXT_DICT["FEEDBACK_LABEL"]
