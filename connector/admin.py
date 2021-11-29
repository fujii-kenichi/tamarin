# -*- coding: utf-8 -*-
"""
タマリンコネクタの管理画面.
@author: fujii.kenichi@tamariva.co.jp
"""

from django.contrib import admin
from django.contrib.admin import ModelAdmin
from django.contrib.auth.admin import UserAdmin

from . import models

# Django組み込み管理画面のタイトルを変える.
admin.site.site_title = "Tamarin Manager"
admin.site.site_header = "Tamarin Manager"

# Django組み込み管理画面で編集可能なモデルとしてUerとMediaを登録する.
admin.site.register(models.User)
admin.site.register(models.Media)


class UserAdmin(UserAdmin):
    """ Userクラス用の管理画面.
    """
    pass


class MediaAdmin(ModelAdmin):
    """ Mediaクラス用の管理画面.
    """
    pass
