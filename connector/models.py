# -*- coding: utf-8 -*-
"""
タマリンコネクタのデータモデル.
@author: fujii.kenichi@tamariva.co.jp
"""
import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.validators import ASCIIUsernameValidator
from django.db import models


class User(AbstractUser):
    """[Userクラス]
    タマリンサービスにおけるひとつのテナントを表現する.
    標準のUserクラスを拡張しているが、使わない属性とかはもそのままにしてある.
    """
    # IDはUUIDとする.
    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)

    # ユーザ名：一部のURLに露出する場合があるということで意図的にASCIIに制限している.
    username_validator = ASCIIUsernameValidator()
    username = models.CharField(max_length=150, unique=True, validators=[username_validator, ], verbose_name="ユーザ名")

    # シーンタグの羅列：CSVで区切って入れる.
    scene_tag = models.CharField(blank=True, null=False, default="発見,気づき,協調", max_length=250)

    # シーンタグにあわせえた色の羅列：CSVで区切って入れる.CSSの色名がそのまま使用可能.
    scene_color = models.CharField(blank=True, null=False, default="greenyellow,orange,skyblue", max_length=250)

    # 状況タグの羅列：CSVで区切って入れる.
    context_tag = models.CharField(blank=True, null=False, default="お散歩,園庭,園内", max_length=250)


def generate_data_path(instance, filename):
    """ Mediaが保存されるときには元のファイル名を無視してUUIDでつけなおしたものを強制する. """
    return "{}/{}.bin".format(instance.owner.id, uuid.uuid4())


class Media(models.Model):
    """[Mediaクラス]
    タマリンサービスにおけるひとつのメディアデータ(写真)を表現する.
    """
    # IDはUUIDとする.
    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)

    # 所有者：Userを参照する.
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    # 生成(撮影)された日時.
    date_taken = models.DateTimeField(blank=False)

    # データのタイプ：MIMEタイプの文字列がそのまま入る.
    content_type = models.CharField(blank=False, max_length=64)

    # データのタイプ：Formでアップロードしたりするのに必要なので設けているだけでこちらは使用しない.
    type = models.CharField(blank=False, max_length=64)

    # データの作成者：Userへの参照ではなく個別の文字列.
    author_name = models.CharField(blank=False, max_length=150)

    # シーンタグ：最終的に選ばれたシーンタグの文字列が一つだけ入る.
    scene_tag = models.CharField(blank=False, max_length=250)

    # 状況タグ：最終的に選ばれた状況タグの文字列が一つだけ入る.
    context_tag = models.CharField(blank=False, max_length=250)

    # 暗号化キー："none"で暗号化されていない/それ以外は暗号化に使用したキー.
    encryption_key = models.CharField(blank=False, max_length=16)

    # 実際のファイルデータ：暗号化キーで暗号化されているので復号する必要がある.
    encrypted_data = models.FileField(blank=False, upload_to=generate_data_path)

    class Meta:
        verbose_name = "メディア"
        verbose_name_plural = "メディア"


class History(models.Model):
    """[Historyクラス]
    タマリンサービスにおけるひとつのヒストリーデータ(何らかの行動)を表現する.
    """
    # 発生した日時.
    date_occurred = models.DateTimeField(auto_now_add=True)

    # タイプ.
    type = models.CharField(blank=False, max_length=32)

    # 発生させたユーザ：Userのidを参照する.
    user = models.UUIDField()

    # 対象となるメディア：Mediaのidを参照する.
    media = models.UUIDField()

    class Meta:
        verbose_name = "ヒストリー"
        verbose_name_plural = "ヒストリー"
