# -*- coding: utf-8 -*-
"""
Django settings for tamarin project.

Generated by 'django-admin startproject' using Django 3.2.9.

For more information on this file, see
https://docs.djangoproject.com/en/3.2/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/3.2/ref/settings/

@author: fujii.kenichi@tamariva.co.jp
"""

import os
from datetime import timedelta
from pathlib import Path

import environ

# インストールされた場所.
BASE_DIR = Path(__file__).resolve().parent.parent

# デバッグ指定.
DEBUG = environ.Env().bool("DEBUG", default=True)

# 言語・地域関連の指定.
LANGUAGE_CODE = "ja"
TIME_ZONE = "Asia/Tokyo"
USE_I18N = True
USE_L10N = True
USE_TZ = True

# カスタマイズされたユーザモデルを使用.
AUTH_USER_MODEL = "connector.User"

# アップロードできるファイルサイズを指定.
DATA_UPLOAD_MAX_MEMORY_SIZE = 8 * 1024 * 1024

# アプリケーション関連の設定.
ROOT_URLCONF = "tamarin.urls"
WSGI_APPLICATION = "tamarin.wsgi.application"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_cleanup",
    "storages",
    "rest_framework",
    "djoser",
    "connector",
    "camera",
    "link",
]

# ミドルウェア関連の設定.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "request_logging.middleware.LoggingMiddleware",
]

# テンプレート処理関連の設定.
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# データベース関連の設定.
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

DATABASE = os.getenv("DATABASE", "")

if DATABASE == "POSTGRESQL":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql_psycopg2",
            "NAME": os.getenv("DATABASE_NAME"),
            "USER": os.getenv("DATABASE_USER"),
            "PASSWORD": os.getenv("DATABASE_PASSWORD"),
            "HOST": os.getenv("DATABASE_HOST"),
            "PORT": os.getenv("DATABASE_PORT"),
            "OPTIONS": {"sslmode": "require"},
        }
    }

else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# 静的ファイル関連の設定.
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
STATICFILES_DIRS = (os.path.join(BASE_DIR, "static"),)
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
STATIC_URL = "/static/"

# メディアファイル関連の設定.
MEDIA_STORAGE = os.getenv("MEDIA_STORAGE", "")

if MEDIA_STORAGE == "AZURE_BLOB_STORAGE":
    DEFAULT_FILE_STORAGE = "connector.azure.MediaStorage"
    AZURE_ACCOUNT_NAME = os.environ.get("AZURE_ACCOUNT_NAME")
    AZURE_ACCOUNT_KEY = os.environ.get("AZURE_ACCOUNT_KEY")
    AZURE_CUSTOM_DOMAIN = os.environ.get("AZURE_CUSTOM_DOMAIN")
    AZURE_CONTAINER = os.environ.get("AZURE_CONTAINER")
    MEDIA_URL = f"https://{AZURE_CUSTOM_DOMAIN}/{AZURE_CONTAINER}/"

else:
    MEDIA_ROOT = os.path.join(BASE_DIR, "media")
    MEDIA_URL = "/media/"

# API関連のセキュリティ設定.
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated"
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
}

# Tokenの設定：DEBUG時には意図的に短くしていることに注意.
if DEBUG == "True":
    SIMPLE_JWT = {
        "AUTH_HEADER_TYPES": ("JWT",),
        "ACCESS_TOKEN_LIFETIME": timedelta(minutes=1),
        "REFRESH_TOKEN_LIFETIME": timedelta(minutes=1),
    }
else:
    SIMPLE_JWT = {
        "AUTH_HEADER_TYPES": ("JWT",),
        "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
        "REFRESH_TOKEN_LIFETIME": timedelta(minutes=60),
    }

# パスワード関連の設定.
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator", },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator", },
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator", },
]

# シークレットキー：本番環境では必ず上書きすること!
SECRET_KEY = os.getenv("SECRET_KEY", r"dummy-key-must-be-overridden",)

# セキュリティ関連の設定.
ALLOWED_HOSTS = ["localhost", os.getenv("ALLOWED_HOSTS"), ]

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_REFERRER_POLICY = "same-origin"

# デバッグ用のログ出力の設定：DEBUG時にはリクエストとレスポンスを毎回表示する.
if DEBUG == "True":
    LOGGING = {
        'version': 1,
        'disable_existing_loggers': False,
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
            },
        },
        'loggers': {
            'django.request': {
                'handlers': ['console'],
                'level': 'DEBUG',
                'propagate': False,
            },
        },
    }

# タマリン固有の設定：タマリンカメラとタマリンクで共通して使用するシステム的な値を定義.
APP_CONTEXT = {

    # タマリンサービスのバージョンを定義.
    # PWAのキャッシュに使用されるのでアプリを更新したら変更しないとキャッシュが破棄されない：デバッグ時も注意！
    "VERSION": "0.0.02L",

    # デバッグ設定.
    "DEBUG": os.getenv("APP_DEBBUG", "True"),

    # シークレットキー情報：Djangoの設定を引き継ぐ.
    "SECRET_KEY": SECRET_KEY,

    # メディアを暗号化する時に自動生成するキーの長さ.
    "MEDIA_ENCRYPTION_KEY_LENGTH": 8,

    # 暗号化をしていないことを示す特別なキーの値.
    "NO_ENCRYPTION_KEY": "none",

    # 認証するときにユーザが入力するユーザ名やパスワードの入力フィールドに渡す最大長.
    "AUTH_MAX_LENGTH": 150,

    # Token APIのエンドポイントとフォーマット.
    "CREATE_TOKEN_URL": "../connector/auth/jwt/create",
    "TOKEN_FORMAT": "JWT",

    # User APIのエンドポイント.
    "USER_API_URL": "../connector/api/users/",

    # Media APIのエンドポイント.
    "MEDIA_API_URL": "../connector/api/medias/",

    # PWAとしての起動かどうかを判定するためのURLパラメータ.
    "MODE_APP": "?mode=app",
}

# タマリン固有の設定：タマリンカメラとタマリンクで共通して使用するメッセージを定義.
APP_CONTEXT_MESSAGE = {

    # 言語：Djangoの情報を引き継ぐ.
    # 以下のデータはこの言語でのメッセージ情報.
    # TODO: Djangoの多言語化方法に完全に合わせたやり方に変更する.
    "LANG": LANGUAGE_CODE,

    # 作成者情報.
    "AUTHOR": "タマリバ株式会社",

    # 表示されるメッセージ:インストールビュー.
    "INSTALL_LABEL": "インストールできます！",
    "INSTALL_HELP_LABEL": "やりかたはこちら",
    "APP_OPEN_LABEL": "(このまま開く)",

    # 表示されるメッセージ:ローディングビュー.
    "LOADING_LABEL": "お待ちください...",

    # 表示されるメッセージ:認証ビュー.
    "AUTHOR_NAME_LABEL": "あなたのお名前",
    "USERNAME_LABEL": "サービスのユーザ名",
    "PASSWORD_LABEL": "サービスのパスワード",
    "AUTH_OK_LABEL": "サインイン",
    "AUTH_ERROR_MESSAGE": "サインインに失敗しました...",
    "CONNECTOR_HELP_LABEL": "うまくいかないときは",

    # 表示されるメッセージ:エラービュー.
    "ERROR_LABEL": "アプリを実行できません",
}
