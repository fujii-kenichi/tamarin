# -*- coding: utf-8 -*-
"""
タマリンコネクタにおけるデータモデルのシリアライザ.
@author: fujii.kenichi@tamariva.co.jp
"""
from rest_framework import serializers

from . import models


class UserSerializer(serializers.ModelSerializer):
    """[Userモデルのシリアライザ]"""
    class Meta:
        model = models.User
        fields = ["id", "username", "date_updated", "scene_tag", "scene_color", "context_tag", "download_rule"]


class MediaSerializer(serializers.ModelSerializer):
    """[Mediaモデルのシリアライザ]"""
    class Meta:
        model = models.Media
        fields = ["id", "owner", "date_taken", "content_type", "author_name", "scene_tag", "context_tag", "encryption_key", "encrypted_data"]


class HistorySerializer(serializers.ModelSerializer):
    """[Historyモデルのシリアライザ]"""
    class Meta:
        model = models.History
        fields = ["id", "date_occurred", "type", "user", "media"]


class FeedbackSerializer(serializers.ModelSerializer):
    """[Feedbackモデルのシリアライザ]"""
    class Meta:
        model = models.Feedback
        fields = ["id", "date_occurred", "author_name", "comment"]
