# -*- coding: utf-8 -*-
"""
タマリンコネクタにおけるデータモデルに対するシグナルハンドラ.
@author: fujii.kenichi@tamariva.co.jp
"""
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from .models import History, Media


@receiver(post_save, sender=Media)
def media_upload_handler(sender, instance, **kwargs):
    """[Mediaがアップロードされた時のシグナルハンドラ]"""
    # Historyを作成して保存しておく.
    data = History.objects.create(type="upload", user=instance.owner.id, media=instance.id)
    data.save()


@receiver(pre_delete, sender=Media)
def media_delete_handler(sender, instance, **kwargs):
    """[Mediaが削除された時のシグナルハンドラ]"""
    # Historyを作成して保存しておく.
    data = History.objects.create(type="delete", user=instance.owner.id, media=instance.id)
    data.save()
