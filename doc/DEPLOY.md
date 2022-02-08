# デプロイ

## 1. ローカルマシンへのデプロイ

Python 3.9を準備してから、ソースコード一式をGitHubから取得して適当な場所に展開します。

### 1-1. SQLiteを使う場合

localhostで普通にDjango 3.2のプロジェクトとして実行できます。
ちなみにアップロードした写真は直下のmediaフォルダーに[ユーザーのUUID/メディアのUUID.bin」という感じで格納されます。

```bash
python3 -m pip install -r requirements.txt
python3 manage.py makemigrations connector
python3 manage.py migrate
python3 manage.py createsuperuser
python3 manage.py runserver_plus
```

### 1-2. PostgreSQLを使う場合

PostgreSQL 12をインストールしてsudo passwd postgresでアカウントを作ったら、以下のようにPostgreSQLを使用するための環境変数を設定します。

```bash
export DATABASE=POSTGRESQL
export DATABASE_NAME=tamarin_db
export DATABASE_USER=tamarin_db_admin
export DATABASE_PASSWORD="内緒のパスワード"
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
```

sudo -u postgres psqlでデータベースとテーブルを作ります。

```sql
CREATE DATABASE tamarin_db;
CREATE USER tamarin_db_admin WITH PASSWORD '内緒のパスワード';
ALTER ROLE tamarin_db_admin SET client_encoding TO 'utf8';
ALTER ROLE tamarin_db_admin SET default_transaction_isolation TO 'read committed';
ALTER ROLE tamarin_db_admin SET timezone TO 'Asia/Tokyo';
GRANT ALL PRIVILEGES ON DATABASE tamarin_db TO tamarin_db_admin;
```

あとはSQLiteと同じようにmigrateとcreatesuperuserしたら実行できるようになります。

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

gunicornを使ってデバッグ機能ありで起動します。こっちの方が本番環境の構成に近いです。

```bash
export DEBUG=True
gunicorn --log-level debug --workers 2 tamarin.wsgi
```

gunicornを使ってデバッグ機能なしで起動します。ほぼ本番環境相当の構成です。

```bash
export DEBUG=False
export SECRET_KEY="内緒の文字列"
export APP_SECRET_KEY="内緒の文字列"
export ALLOWED_HOSTS="公開しているエンドポイントのDNS名" もしくは "*"
python3 manage.py collectstatic
gunicorn --workers 5 tamarin.wsgi
```

## 2. Azureへのデプロイ

ここでは本番環境としてAzureを使用した場合を書きます。どういう構成なのか、 またどうしてそう決定したのかは [ARCHITECTURE.md](./ARCHITECTURE.md) に書いてあります。

Azureではとりあえず以下のことはすでにおこなっておいてあるとします。

- 適切なサブスクリプションの設定。
- 専用のリソースグループの作成。以降作成するリソースはすべてこのリソースグループを指定します。

### 2-1. PostgreSQL用VMの作成

- 普通にLinux (Ubuntu) のVMを1台立てます。テスト用であれば一番小さい（安い）ので十分です。作成時にsshの公開鍵も発行してもらうと、以下のような感じですぐに入れます。

   ```bash
   ssh -i "発行された公開鍵ファイル.pem" azureuser@"VMのパブリックIPアドレス"
   ```

- 悪い人がsshできないように、とりあえずAzureのコンソールから該当するインスタンスのTCP/22(SSH)のIPアドレス制限を、* から自分の開発マシンが使っているアウトバウンドでのパブリックIPアドレスのみに変えておきます。ちなみに自分の開発マシンが出ていっているマシンのIPアドレスが変わったらAzureコンソールから設定し直します。
- sudo apt update, sudo apt upgradeでパッケージを最新化したうえで、sudo apt install postgresqlでPostgreSQLをインストールします。
- Django経由で初期化しないといけないので、とりあえずVMにあるPostgreSQLをインターネット経由で繋げるようにします。
  - /etc/postgresql/12/main/postgresql.confのlisten_addressesを '*' に変更します。
  - /etc/postgresql/12/main/pg_hba.confにhost all all 0.0.0.0/0 md5を追加します。
  - ファイアウォールを開けてサービスを再起動します。

    ```bash
    sudo iptables -A INPUT -p tcp --dport 5432 -j ACCEPT
    sudo service postgresql restart
    ```

- この段階でこのPostgreSQLはインターネット上に全公開ですので、とっとと以下のことをやります。
  - ローカルマシンでの開発と同じようにsudo -u postgres psqlでデータベースとテーブルを作ります。ちなみに以下にコマンドでローカルからVM上のPostgreSQLに（この段階では）つなげることができます。

    ```bash
    psql -h "VMのパブリックIPアドレス" -U tamarin_db_admin postgres
    ```

  - ローカルマシンのDjangoからAzure VM上にあるPostgreSQLへ接続して初期化します。

    ```bash
    export DATABASE_NAME=tamarin_db
    export DATABASE_PASSWORD="内緒のパスワード"
    export DATABASE_HOST="VMのパブリックIPアドレス"
    export DATABASE_PORT=5432
    python3 manage.py migrate
    python3 manage.py createsuperuser
    ```

- ここまで無事に来たらPostgreSQLをインターネットからのアクセスができないようにします。そのために、Azureのコンソールから当該VMのネットワークにおける受信ポートの規則に、PostgreSQL(5432) はServiceTag:AzureCloudからのみ開けるルールを追加します。さきほどのpsqlコマンドで無事に **接続ができなくなっている** ことを確認します。
  - ちなみに本当は使用するAzure App Serviceのインスタンスからのみ接続できるように絞るほうが適切です。今回はAzure App Serviceが無償プランのせいかNSGをうまく設定できなかったのでとりあえずAzureCloudで制限しています。

### 2-2. Azureストレージの作成

- ストレージアカウントを作成します。
- リソースの共有（CORS）に以下の設定をします。
   | 設定項目 | 値 |
   | ---- | ---- |
   | 許可されたオリジン | App Serviceが公開するFQDN |
   | 許可されたメソッド | GET/HEAD/POST...（8つ全部にチェック）|
   | 許可されたヘッダー | * |
   | 公開されるヘッダー | * |
   | 最長有効期間 | 60 |
- ストレージアカウントにコンテナーを作成します。
- つくったコンテナーに以下の設定をします。
   | 設定項目 | 値 |
   | ---- | ---- |
   | パブリックアクセスレベル | Blob |
   | 認証方法 | アクセスキー |

### 2-3. Azure App Serviceの作成

- App Serviceプランを作成します。
- App Serviceを以下の条件で作成します。
   | 設定項目 | 値 |
   | ---- | ---- |
   | スタック | Python |
   | メジャーバージョン | Python 3 |
   | マイナーバージョン | Python 3.9 |
   | FTPの状態 | 無効（GitHubからのデプロイを使用する場合は不要なので）|
   | HTTPバージョン | 1.1 |
   | Webソケット | オフ |
   | リモートデバッグ | オフ |

- アプリケーション設定に以下の値を入れます。
   | 名前 | 値 | 備考 |
   | ---- | ---- | ---- |
   | DEBUG | False | Djangoの設定なので基本的に本番ではFalse |
   | SECRET_KEY | 任意の文字列 | シークレットキー文字列 |
   | APP_SECRET_KEY | 任意の文字列 | PWA用シークレットキー文字列 |
   | ALLOWED_HOSTS | App Serviceが待ち受けるFQDN | 例）hoge.azurewebsites.net |
   | DB_ENGINE | POSTGRESQL | データベースとしてPostgreSQLを使用することを指示 |
   | DB_HOST | PostgreSQLが稼働しているVMのIPアドレス | パブリックIPアドレスで動作確認 |
   | DB_NAME | PostgreSQLのデータベース名 | 前述のDB_NAME環境変数と同じ |
   | DB_USER | PostgreSQLの管理ユーザー名 | 前述のDB_USER環境変数と同じ |
   | DB_PASSWORD | DB_USERのパスワード | 前述のDB_PASSWORD環境変数と同じ |
   | DB_PORT | 5432 | 前述のDB_PORT環境変数と同じ |
   | MEDIA_STORAGE | AZURE_BLOB | 写真の保管にAzureストレージを使用することを指示 |
   | AZURE_ACCOUNT_NAME | ストレージアカウント名 | 使用するストレージアカウントの名称 |
   | AZURE_CUSTOM_DOMAIN | ストレージアカウントのドメイン名 | 例）hogestorages.blob.core.windows.net |
   | AZURE_MEDIA_CONTAINER | ストレージコンテナー名 | 使用するストレージコンテナーの名称 |
   | AZURE_STORAGE_KEY | ストレージへのアクセスキー | Azure管理コンソールから取得した値を設定 |
   | CLARITY_CODE | Microsoft Clarityのトラッキングコード | 測定を行う場合に設定 |

### 2-4. GitHubからの自動デプロイの設定

- このあと、GitHubからworkflowで自動デプロイされるように設定すると便利です。
- このリポジトリ固有の話なので詳細は割愛します。
