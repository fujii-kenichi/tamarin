# -*- coding: utf-8 -*-
"""
tamarin URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))

@author: fujii.kenichi@tamariva.co.jp
"""
import datetime

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http.response import HttpResponse
from django.urls import include, path
from django.urls.conf import re_path
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_safe
from django.views.static import serve

from connector.app_settings import APP_SETTINGS


@never_cache
@require_safe
def heartbeat(request):
    """[ハートビート用の処理:キャッシュを抑制した上でシンプルな文字列だけを返す]"""
    return HttpResponse("{},{}".format(APP_SETTINGS["VERSION"], datetime.datetime.now().isoformat()), content_type="text/plain")


urlpatterns = [
    # ハートビート.
    path("heartbeat/", heartbeat),

    # 管理画面.
    path("manager/", admin.site.urls),

    # タマリンコネクタ.
    path("connector/", include("connector.urls")),

    # タマリンカメラ.
    path("camera/", include("camera.urls")),

    # タマリンク.
    path("link/", include("link.urls")),

    # 静的ファイルがDEBUGモードでなくても配信できるように設定する.
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),

    # メディアファイルがDEBUGモードでなくても配信できるように設定する.
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += [path("silk/", include("silk.urls", namespace="silk"))]
