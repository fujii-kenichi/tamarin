# -*- coding: utf-8 -*-
"""
タマリンコネクタの管理画面.
@author: fujii.kenichi@tamariva.co.jp
"""

from django.contrib import admin
from django.contrib.auth.models import Group
from import_export import resources
from import_export.admin import ExportActionMixin
from import_export.formats import base_formats
from . import models

# Django組み込み管理画面のタイトルを変える.
admin.site.site_title = "Tamarin Manager"
admin.site.site_header = "Tamarin Manager"

# 認証と認可のグループを管理画面から消す.
admin.site.unregister(Group)


class UserResource(resources.ModelResource):
    """[Userをエキスポートする時のリソースクラス]"""
    class Meta:
        model = models.User
        export_order = ("id", "username", "email", "date_joined", "last_login", "is_active")


class UserAdmin(ExportActionMixin, admin.ModelAdmin):
    """[Userを管理する時のAdminクラス]"""
    list_display = ("username", "email", "date_joined", "is_active", "id")
    fields = ("id", "username", "email", "date_joined", "last_login", "is_active", "is_staff", "scene_tag", "scene_color", "context_tag")
    readonly_fields = ("id", "date_joined", "last_login")
    exclude = ("password", "first_name", "last_name", "groups", "user_permissions")
    formats = [base_formats.CSV]
    list_per_page = 50
    resource_class = UserResource


admin.site.register(models.User, UserAdmin)


class MediaAdmin(admin.ModelAdmin):
    """[Mediaを管理する時のAdminクラス]"""
    list_display = ("date_taken", "owner", "id")
    exclude = ("type",)
    readonly_fields = ("id", "owner", "date_taken", "content_type", "author_name", "scene_tag", "context_tag", "encryption_key", "encrypted_data")
    list_per_page = 50


admin.site.register(models.Media, MediaAdmin)


class HistoryResource(resources.ModelResource):
    """[Historyをエキスポートする時のリソースクラス]"""
    class Meta:
        model = models.History
        export_order = ("id", "date_occurred", "type", "user", "media")


class HistoryAdmin(ExportActionMixin, admin.ModelAdmin):
    """[Historyを管理する時のAdminクラス]"""
    list_display = ("id", "date_occurred", "type", "user", "media")
    readonly_fields = ("id", "date_occurred", "type", "user", "media")
    formats = [base_formats.CSV]
    list_per_page = 50
    resource_class = HistoryResource


admin.site.register(models.History, HistoryAdmin)
