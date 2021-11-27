# -*- coding: utf-8 -*-
""" タマリンコネクタにおけるデータモデルのシリアライザ.
    by fujii.kenichi@tamariva.co.jp
"""
from rest_framework import serializers

from . import models


class UserSerializer(serializers.ModelSerializer):
    """ Userモデルのシリアライザ."""
    class Meta:
        model = models.User
        fields = ["id", "username", "scene_tag", "scene_color", "context_tag"]


class MediaSerializer(serializers.ModelSerializer):
    """ Mediaモデルのシリアライザ."""
    class Meta:
        model = models.Media
        fields = ["id", "owner", "date_taken", "content_type", "author_name", "scene_tag", "context_tag", "encryption_key", "encrypted_data"]
