# -*- coding: utf-8 -*-
"""
タマリンコネクタのAzure版メディアストレージ.
@author: fujii.kenichi@tamariva.co.jp
"""
from django.conf import settings
from storages.backends.azure_storage import AzureStorage


class MediaStorage(AzureStorage):
    account_name = settings.AZURE_ACCOUNT_NAME
    account_key = settings.AZURE_ACCOUNT_KEY
    azure_container = settings.AZURE_CONTAINER
    expiration_secs = None
    overwrite_files = True
