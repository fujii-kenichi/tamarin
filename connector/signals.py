# -*- coding: utf-8 -*-
"""
タマリンコネクタにおけるデータモデルに対するシグナルハンドラ.
@author: fujii.kenichi@tamariva.co.jp
"""
from django.conf import settings
from django.db.models.signals import pre_save, post_save, pre_delete
from django.dispatch import receiver

from .models import History, Media


@receiver(pre_save, sender=Media)
def media_check_handler(sender, instance, **kwargs):
    """[Mediaがアップロードされる時のシグナルハンドラ]"""
    count = Media.objects.filter(owner=instance.owner.id).count()
    # 1ユーザあたりの最大数を超えていたら例外を出して保管を拒絶する(クライアントには500が帰る).
    if count >= settings.MAX_MEDIA_COUNT:
        raise Exception('Too many media')


@receiver(post_save, sender=Media)
def media_upload_handler(sender, instance, **kwargs):
    """[Mediaがアップロードされた後のシグナルハンドラ]"""
    if settings.USE_HISTORY == "True":
        # Historyを作成して保存しておく.
        data = History.objects.create(type="upload", user=instance.owner.id, media=instance.id)
        data.save()


@receiver(pre_delete, sender=Media)
def media_delete_handler(sender, instance, **kwargs):
    """[Mediaが削除された時のシグナルハンドラ]"""
    if settings.USE_HISTORY == "True":
        # Historyを作成して保存しておく.
        data = History.objects.create(type="delete", user=instance.owner.id, media=instance.id)
        data.save()
