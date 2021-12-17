# -*- coding: utf-8 -*-
"""
アプリケーションの設定値.
@author: fujii.kenichi@tamariva.co.jp
"""

from django.conf import settings
from django.templatetags.static import static

# タマリン固有の設定:共通して使用するシステム的な値を定義.
APP_SETTINGS = {
    # タマリンのバージョンを定義.
    # PWAのキャッシュに使用されるのでアプリを更新したら変更しないとキャッシュが破棄されない:デバッグ時も注意!
    "VERSION": "0.0.03E",

    # タマリン提供者の名前を定義.
    "OWNER": "タマリバ株式会社",

    # シークレットキー情報:Djangoの設定を引き継ぐ.
    "SECRET_KEY": settings.SECRET_KEY,

    # メディアを暗号化する時に自動生成するキーの長さ.
    "MEDIA_ENCRYPTION_KEY_LENGTH": 8,

    # 暗号化をしていないことを示す特別なキーの値.
    "NO_ENCRYPTION_KEY": "none",

    # ユーザーが入力するユーザー名やパスワードの入力フィールドに渡す最小長.
    "MIN_NAME_LENGTH": 6,

    # ユーザーが入力するユーザー名やパスワードの入力フィールドに渡す最大長.
    "MAX_NAME_LENGTH": 50,

    # タグをCSVにした後の最終的なレコード上の最大長.
    "MAX_TAG_CSV_LENGTH": 250,

    # シーンタグやコンテキストタグの内容を一個だけ保存する際のレコード上の最大長.
    "MAX_TAG_LENGTH": 25,

    # コンテキストタグの入力フィールドに渡す最大長.
    "MAX_CONTEXT_TAG_LENGTH": 15,

    # シーンタグの入力フィールドに渡す最大長.
    "MAX_SCENE_TAG_LENGTH": 5,

    # MIME-TYPE 文字列の最大長.
    "MAX_MIME_TYPE_LENGTH": 64,

    # ヒストリーを示すタイプ文字列の最大長.
    "MAX_HISTORY_TYPE_LENGTH": 32,

    # フィードバックの最小長.
    "MIN_FEEDBACK_LENGTH": 10,

    # フィードバックの最大長.
    "MAX_FEEDBACK_LENGTH": 1000,

    # Token APIのエンドポイントとフォーマット.
    "CREATE_TOKEN_URL": "../connector/auth/jwt/create",
    "TOKEN_FORMAT": "JWT",

    # User APIのエンドポイント.
    "USER_API_URL": "../connector/api/users/",

    # Media APIのエンドポイント.
    "MEDIA_API_URL": "../connector/api/medias/",

    # PWAとしての起動かどうかを判定するためのURLパラメータ.
    "APP_MODE_URL_PARAM": "?mode=app",

    # manifestで指定する色.
    "APP_THEME_COLOR": "lightpink",

    # Dexieを通じてIndexedDBの構成に使用される値.
    "APP_DATABASE_CURRENT_USER": "current_user",

    # 共通ライブラリ類のパス.
    "DEXIE_JS": static("js/dexie.min.js"),
    "CRYPTO_JS": static("js/crypto-js.min.js"),
    "BULMA_CSS": static("css/bulma.css"),
    "CHARTIST_JS": static("js/chartist.min.js"),
    "CHARTIST_CSS": static("css/chartist.min.css"),
    "COMMON_CSS": static("css/common.css"),

    # 共通画像ファイルのパス.
    "OK_ICON192": static("image/ok-icon192x192.png"),
    "NG_ICON192": static("image/ng-icon192x192.png"),

    # タマリンカメラ:ファイルのパス.
    "CAMERA_APP_FAVICON": static("image/camera-app-favicon.ico"),
    "CAMERA_APP_ICON180": static("image/camera-app-icon180x180.png"),
    "CAMERA_APP_ICON192": static("image/camera-app-icon192x192.png"),
    "CAMERA_APP_ICON512": static("image/camera-app-icon512x512.png"),
    "CAMERA_APP_SHUTTER_WAV": static("audio/camera-app-shutter.mp3"),

    # タマリンカメラ:manifestの値.
    "CAMERA_APP_START_URL": "/camera/camera-app.html",
    "CAMERA_APP_SCOPE": "/camera/",
    "CAMERA_APP_DISPLAY": "standalone",
    "CAMERA_APP_ORIENTATION": "any",

    # タマリンカメラ:Dexieを通じてIndexedDBの構成に使用される値.
    "CAMERA_APP_DATABASE_NAME": "tamarin-camera",
    "CAMERA_APP_DATABASE_VERSION": "3",

    # タマリンカメラ:service workerのsyncに用いられるタグ文字列:写真のアップロード.
    "CAMERA_APP_UPLOAD_PHOTO_TAG": "upload_photo",

    # タマリンカメラ:service workerとのメッセージ送受信に用いられる文字列:写真をアップロードした.
    "CAMERA_APP_PHOTO_UPLOADED_TAG": "photo_uploaded",

    # タマリンカメラ:service workerとのメッセージ送受信に用いられる文字列:アプリの強制アップデート.
    "CAMERA_APP_FORCE_UPDATE_TAG": "force_update",

    # タマリンカメラ:写真を保持しておける枚数:あんまり多いとIndexedDBが耐えられないかも...
    "CAMERA_APP_MAX_PHOTO_COUNT": 10,

    # タマリンク:ファイルのパス.
    "LINK_APP_FAVICON": static("image/link-app-favicon.ico"),
    "LINK_APP_ICON180": static("image/link-app-icon180x180.png"),
    "LINK_APP_ICON192": static("image/link-app-icon192x192.png"),
    "LINK_APP_ICON512": static("image/link-app-icon512x512.png"),

    # タマリンク:manifestの値.
    "LINK_APP_START_URL": "/link/link-app.html",
    "LINK_APP_SCOPE": "/link/",
    "LINK_APP_DISPLAY": "standalone",
    "LINK_APP_ORIENTATION": "any",

    # タマリンク:Dexieを通じてIndexedDBの構成に使用される値.
    "LINK_APP_DATABASE_NAME": "tamarin-link",
    "LINK_APP_DATABASE_VERSION": "3",
}

# タマリン固有の設定:表示に使用するメッセージを定義.
APP_MESSAGES = {
    # 言語:Djangoの情報を引き継ぐ.
    # 以下のデータはこの言語でのメッセージ情報.
    # TODO: Djangoの多言語化方法に完全に合わせたやり方に変更する.
    "LANG": settings.LANGUAGE_CODE,

    # データベースの初期値.
    "DEFAULT_SCENE_TAG": "シーン1,シーン2,シーン3,",
    "DEFAULT_SCENE_COLOR": "tomato,royalblue,lightgreen,",
    "DEFAULT_CONTEXT_TAG": "コンテキスト1,コンテキスト2,コンテキスト3,コンテキスト4,コンテキスト5,",
    "DEFAULT_DOWNLOAD_RULE": "YYMM,DD,AUTHOR,SCENE,CONTEXT,",

    # 表示に使用される文字列:管理画面.
    "MEDIA_LABEL": "メディア",
    "HISTORY_LABEL": "ヒストリー",
    "FEEDBACK_LABEL": "フィードバック",

    # 表示に使用される文字列:サインイン.
    "USERNAME_LABEL": "ユーザー名",    
    "PASSWORD_LABEL": "パスワード",

    # 表示に使用される文字列:サインアップ.
    "SIGNUP_MESSAGE": "サインアップ",
    "SIGNUP_LONG_MESSAGE": "タマリンへようこそ",
    "SIGNUP_DONE_MESSAGE": "サインアップ完了",
    "SIGNUP_DONE_LONG_MESSAGE": "サインアップが完了しました",

    # 表示に使用される文字列:パスワード変更.    
    "PASSWORD_CHANGE_MESSAGE": "パスワード変更",
    "PASSWORD_CHANGE_DONE_MESSAGE": "パスワード変更完了",
    "PASSWORD_CHANGE_DONE_LONG_MESSAGE": "パスワードを変更しました",
    "INVALID_PASSWORD_MESSAGE": "パスワードが間違っています",
    "PASSWORD2_LABEL": "パスワード(確認)",
    "NEW_PASSWORD_LABEL": "新しいパスワード",
    "NEW_PASSWORD2_LABEL": "新しいパスワード(確認)",

    # 表示に使用される文字列:フィードバック.
    "FEEDBACK_LONG_MESSAGE": "ご要望や問題をお書きください",
    "FEEDBACK_DONE_MESSAGE": "ありがとうございます",
    "FEEDBACK_DONE_LONG_MESSAGE": "フィードバックを記録しました",
    "FEEDBACK_MESSAGE": "フィードバック",

    # 表示に使用される文字列:共通.
    "VERSION_LABEL": "バージョン",
    "OK_LABEL": "OK",
    "SEND_LABEL": "送信する",
    "BACK_TO_HOME_LABEL": "戻る",
    "LOADING_MESSAGE":"処理中です...",
    "SAVE_LABEL": "保存",
    "SAVE_SUCCEEDED_MESSAGE": "設定が保存されました",
    "SAVE_FAILED_MESSAGE": "設定が保存できませんでした",
    "FATAL_ERROR_MESSAGE": "アプリを実行できません",

    # 表示に使用される文字列:サインイン.
    "AUTHOR_NAME_LABEL": "あなたの名前",
    "SIGNIN_LABEL": "サインイン",
    "SIGNIN_ERROR_MESSAGE": "入力に間違いがあります",

    # 表示に使用される文字列:インストール.
    "INSTALL_MESSAGE": "インストールできます!",
    "OPEN_APP_LABEL": "このまま開く",

    # マニフェストに書く情報:タマリンカメラ.
    "CAMERA_APP_NAME": "タマリンカメラ",
    "CAMERA_APP_SHORT_NAME": "タマリンカメラ",
    "CAMERA_APP_DESCRIPTION": "タマリンのカメラです",

    # 表示に使用される文字列:タマリンカメラ.
    "SHUTTER_SOUND_LABEL": "シャッター音を鳴らす",
    "AUTO_RELOAD_LABEL": "自動でタグを同期する",
    "ENCRYPTION_LABEL": "写真を暗号化する",

    # ニフェストに書く情報:タマリンク.
    "LINK_APP_NAME": "タマリンク",
    "LINK_APP_SHORT_NAME": "タマリンク",
    "LINK_APP_DESCRIPTION": "タマリンの写真管理アプリです",

    # 表示に使用される文字列:タマリンク.
    "CONTEXT_TAG_SECTION_LABEL": "コンテキスト",
    "SCENE_TAG_SECTION_LABEL": "シーン",
    "STATUS_SECTION_LABEL": "現在の状況",
    "DOWNLOAD_SECTION_LABEL": "ダウンロード",

    "SHUTTER_COLOR_RED": "赤",
    "SHUTTER_COLOR_BLUE": "青",
    "SHUTTER_COLOR_GREEN": "緑",
    "SHUTTER_COLOR_YELLOW": "黄",
    "SHUTTER_COLOR_PINK": "桃",
    "SHUTTER_COLOR_NOT_USED": "未使用",
    "CONTEXT_TAG_NOT_USED": "未使用",

    "RULE_YYMM": "年月",
    "RULE_YY": "年",
    "RULE_MM": "月",
    "RULE_DD": "日",
    "RULE_AUTHOR": "撮影者",
    "RULE_CONTEXT": "コンテキスト",
    "RULE_SCENE": "シーン",
    "RULE_NOT_USED": "未使用",

    "NO_FILESYSTEM_API_ERROR_MESSAGE": "この環境はダウンロードが使用できません",
    "DOWNLOAD_START_LABEL": "ダウンロードを開始",
    "DOWNLOADING_LABEL": "ダウンロード中...",
    "DOWNLOAD_STOP_LABEL": "ダウンロードを停止",

    # ファイル名を生成するときに使う日時の補完用文字列.
    "DATETIME_YY": "年",
    "DATETIME_MM": "月",
    "DATETIME_DD": "日",
    "DATETIME_HH": "時",
    "DATETIME_MN": "分",
    "DATETIME_SS": "秒",

    # サービス利用条件.
    "TERMS_MESSAGE": "\
    【タマリン利用規約】$\
    タマリンを利用するにあたり注意していただきたいことを以下に記載します。$\
    1. サインアップにより記載の条件について合意していただいたとみなします。$\
    2. タマリンは予告なく稼働を停止することや終了することがあります。$\
    3. お預かりしている写真は永続的な保存をお約束するものではございません。$\
    4. 当社のプライバシーポリシーについてはホームページをご覧ください。$\
    5. タマリンよりかわいい名前があったらそっちに改名するかもしれません。$\
    6. トイストーリーは3より4だと思う方はお話をしたいのでご連絡ください。$\
    7. その他お困りのことがあれば[問題を報告する]からご連絡ください。$\
    【2022年1月 タマリバ株式会社】",
}
