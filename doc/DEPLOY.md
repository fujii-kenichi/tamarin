# デプロイ

## 1.ローカルマシンへのデプロイ

Python 3.9 を準備してから、ソースコード一式を Github から取得して適当な場所に展開します。

### 1-1. SQLite を使う場合

localhost で普通に Django 3.2 のプロジェクトとして実行できます。
ちなみにアップロードした写真は直下の media フォルダに [ユーザーのUUID/メディアのUUID.bin」という感じで格納されます。

```bash
python3 -m pip install -r requirements.txt
python3 manage.py makemigrations connector
python3 manage.py migrate
python3 manage.py createsuperuser
python3 manage.py runserver_plus
```

### 1-2. PostgreSQL を使う場合

PostgreSQL 12 をインストールして sudo passwd postgres でアカウントを作ったら、以下のように PostgreSQL を使用するための環境変数を設定します。

```bash
export DATABASE=POSTGRESQL
export DATABASE_NAME=tamarin_db
export DATABASE_USER=tamarin_db_admin
export DATABASE_PASSWORD="内緒のパスワード"
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
```

sudo -u postgres psql でユーザーとデータベースとテーブルを作ります。

```sql
CREATE DATABASE tamarin_db;
CREATE USER tamarin_db_admin WITH PASSWORD '内緒のパスワード';
ALTER ROLE tamarin_db_admin SET client_encoding TO 'utf8';
ALTER ROLE tamarin_db_admin SET default_transaction_isolation TO 'read committed';
ALTER ROLE tamarin_db_admin SET timezone TO 'Asia/Tokyo';
GRANT ALL PRIVILEGES ON DATABASE tamarin_db TO tamarin_db_admin;
```

あとは SQLite と同じように migrate と createsuperuser したら実行できるようになります。

### 1-3. 開発環境でのデバッグと実行

デバッグ機能をフルにして実行します。

```bash
export DEBUG=True
python3 manage.py runserver_plus
```

デバッグ機能をオフで実行します。staticファイルやmediaファイルの扱いが変わります。

```bash
export DEBUG=False
python3 manage.py collectstatic
python3 manage.py runserver
```

gunicorn を使ってデバッグ機能ありで起動します。こっちの方が本番環境の構成に近いです。

```bash
export DEBUG=True
gunicorn --log-level debug --workers 2 tamarin.wsgi
```

gunicorn を使ってデバッグ機能なしで起動します。ほぼ本番環境相当の構成です。

```bash
export DEBUG=False
export SECRET_KEY="内緒の文字列"
export APP_SECRET_KEY="内緒の文字列"
export ALLOWED_HOSTS="公開しているエンドポイントのDNS名" もしくは "*"
python3 manage.py collectstatic
gunicorn --workers 5 tamarin.wsgi
```

## 2. Azure へのデプロイ

ここでは本番環境としてAzureを使用した場合を書きます。どういう構成なのか、 またどうしてそう決定したのかは [ARCHITECTURE.md](./ARCHITECTURE.md) に書いてあります。

Azureではとりあえず以下のことはすでにおこなっておいてあるとします。

- 適切なサブスクリプションの設定。
- 専用のリソースグループの作成。以降作成するリソースはすべてこのリソースグループを指定します。

### 2-1. PostgreSQL 用 VM の作成

- 普通に Linux (Ubuntu) の VM を1台立てます。テスト用であれば一番小さい(安い)ので十分です。作成時に同時に ssh の公開鍵も発行してもらうと、以下のような感じですぐに入れます。

   ```bash
   ssh -i "発行された公開鍵ファイル.pem" azureuser@"VMのパブリックIPアドレス"
   ```

- 悪い人が ssh できないように、とりあえず Azure のコンソールから該当するインスタンスの TCP/22(SSH) のIPアドレス制限を、* から自分の開発マシンが使っているアウトバウンドでのパブリックIPアドレスのみに変えておきます。ちなみに自分の開発マシンが出ていっているマシンのIPアドレスが変わったら Azure コンソールから設定し直します。
- sudo apt update, sudo apt upgradeでパッケージを最新化したうえで、sudo apt install postgresql で PostgreSQL をインストールします。
- Django 経由で初期化しないといけないので、とりあえず VM にある PostgreSQL をインターネット経由で繋げるようにします。
  - /etc/postgresql/12/main/postgresql.conf の listen_addresses を '*' に変更します。
  - /etc/postgresql/12/main/pg_hba.conf に host all all 0.0.0.0/0 md5 を追加します。
  - ファイアウォールを開けてサービスを再起動します。

    ```bash
    sudo iptables -A INPUT -p tcp --dport 5432 -j ACCEPT
    sudo service postgresql restart
    ```

- この段階でこの PostgreSQL はインターネット上に全公開ですので、とっとと以下のことをやります。
  - ローカルマシンでの開発と同じように sudo -u postgres psql でユーザーとデータベースとテーブルを作ります。ちなみに以下にようにするとローカルから VM 上の PostgreSQL に(この段階では)つなげることができます。

    ```bash
    psql -h "VMのパブリックIPアドレス" -U tamarin_db_admin postgres
    ```

  - ローカルマシンの Django から Azure VM 上にある PostgreSQL に接続して初期化します。

    ```bash
    export DATABASE_NAME=tamarin_db
    export DATABASE_PASSWORD="内緒のパスワード"
    export DATABASE_HOST="VMのパブリックIPアドレス"
    export DATABASE_PORT=5432
    python3 manage.py migrate
    python3 manage.py createsuperuser
    ```

- ここまで無事に来たら PostgreSQL をインターネットからのアクセスができないようにします。そのために、Azure のコンソールから当該 VM のネットワークにおける受信ポートの規則に、PostgreSQL(5432) は ServiceTag:AzureCloud からのみ開けるルールを追加します。さきほどの psql コマンドで無事に **接続ができなくなっている** ことを確認します。
  - ちなみに本当は使用する Azure App Service のインスタンスからのみ接続できるように絞るほうが適切です。今回は Azure App Service が無償プランのせいか NSG をうまく設定できなかったのでとりあえず AzureCloud で制限しています...

### 2-2. Azure ストレージの作成

- ストレージアカウントを作成します。
- リソースの共有(CORS)に以下の設定をします。
   | 設定項目 | 値 |
   | ---- | ---- |
   | 許可されたオリジン | App Service が公開する FQDN |
   | 許可されたメソッド | GET/HEAD/POST...(8つ全部にチェック) |
   | 許可されたヘッダー | * |
   | 公開されるヘッダー | * |
   | 最長有効期間 | 60 |
- ストレージアカウントにコンテナを作成します。
- つくったコンテナに以下の設定をします。
   | 設定項目 | 値 |
   | ---- | ---- |
   | パブリックアクセスレベル | Blob |
   | 認証方法 | アクセスキー |

### 2-3. Azure App Service の作成

- App Service プランを作成します。
- App Service を以下の条件で作成します。
   | 設定項目 | 値 |
   | ---- | ---- |
   | スタック | Python |
   | メジャーバージョン | Python 3 |
   | マイナーバージョン | Python 3.9 |
   | FTPの状態 | 無効 (Githubからのデプロイを使用する場合は不要なので) |
   | HTTP バージョン | 1.1 |
   | Webソケット | オフ |
   | リモートデバッグ | オフ |

- アプリケーション設定に以下の値を入れます。
   | 名前 | 値 | 備考 |
   | ---- | ---- | ---- |
   | DEBUG | False | Django の設定なので基本的に本番では False |
   | SECRET_KEY | 任意の文字列 | シークレットキー文字列 |
   | APP_SECRET_KEY | 任意の文字列 | PWA用シークレットキー文字列 |
   | ALLOWED_HOSTS | App Service が待ち受ける FQDN | 例) hoge.azurewebsites.net |
   | DB_ENGINE | POSTGRESQL | データベースとして PostgreSQL を使用することを指示 |
   | DB_HOST | PostgreSQL が稼働している VM の IP アドレス | パブリック IP アドレスで動作確認 |
   | DB_NAME | PostgreSQL で設定したデータベース名 | 前述の DB_NAME 環境変数と同じ |
   | DB_USER | PostgreSQL の管理ユーザー名 | 前述の DB_USER 環境変数と同じ |
   | DB_PASSWORD | DB_USER のパスワード | 前述の DB_PASSWORD 環境変数と同じ |
   | DB_PORT | 5432 | 前述の DB_PORT 環境変数と同じ |
   | MEDIA_STORAGE | AZURE_BLOB | 写真の保管に Azure ストレージを使用することを指示 |
   | AZURE_ACCOUNT_NAME | ストレージアカウント名 | 使用するストレージアカウントの名称 |
   | AZURE_CUSTOM_DOMAIN | ストレージアカウントのドメイン名 | 例) hogestorages.blob.core.windows.net |
   | AZURE_MEDIA_CONTAINER | ストレージコンテナ名 | 使用するストレージアコンテナの名称 |
   | AZURE_STORAGE_KEY | ストレージへのアクセスキー | Azure 管理コンソールから取得した値を設定 |
   | CLARITY_CODE | Microsoft Clarity のトラッキングコード | 測定を行う場合に設定 |

### 2-4. Github からの自動デプロイの設定

- このあと、Gitub から workflow で自動デプロイされるように設定すると便利です。
- このリポジトリ固有の話なので詳細は割愛します。
