# INSTALL

タマリンプロジェクトの成果物をインストール・デプロイする方法です.
今は単なるメモ書きです.

## デプロイ

### PostgreSQL (Debug)

PostgreSQL 13はすでにインストールしてあるという前提.

```bash
sudo passwd postgres
sudo -u postgres psql
CREATE DATABASE tamarin-db;
CREATE USER tamarin-db-admin WITH PASSWORD '内緒のパスワード';
ALTER ROLE tamarin-db-admin SET client_encoding TO 'utf8';
ALTER ROLE tamarin-db-admin SET default_transaction_isolation TO 'read committed';
ALTER ROLE tamarin-db-admin SET timezone TO 'Asia/Tokyo';
GRANT ALL PRIVILEGES ON DATABASE tamarin-db TO tamarin-db-admin;
\q
```

DjangoにPostgreSQLを使うように指示 (これをしなければローカルのSQLiteを使用)

```bash
export DATABASE=POSTGRESQL
export DATABASE_NAME=tamarin-db
export DATABASE_USER=tamarin-db-admin
export DATABASE_PASSWORD=内緒のパスワード
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
```

### PostgreSQL (Production)

Debugの設定に加えて以下をやる.

- postgresql.conf の listen_addresses を '*' に.
- pg_hba.conf に host all all 0.0.0.0/0 md5 を追加.
- ファイアウォールをあけて再起動.

```bash
sudo iptables -A INPUT -p tcp --dport 5432 -j ACCEPT
sudo service postgresql restart
```

その他やっておいたほうがよさそうなこと：

- TCP/22 (SSH)のIPアドレス制限を * から 自分の開発マシンが使っているアウトバウンドでのパブリックIPアドレスに変えておく.
- TCP/5432 (PostgreSQL)のIPアドレス制限を * から Djangoが動いているマシンのアウトバウンドでのパブリックIPアドレスに変えておく.

### Django

Python3はすでにインストールしてあるという前提.

```bash
python3 -m pip install -r requirements.txt
python3 manage.py makemigrations connector
python3 manage.py migrate
python3 manage.py createsuperuser
python3 manage.py runserver
```

## 起動

### Django (Debug)

```bash
export DEBUG=True
python3 manage.py runserver
```

### gunicorn (Debug)

```bash
export DEBUG=True
gunicorn --log-level debug --workers 2 tamarin.wsgi
```

### gunicorn (Production)

```bash
export DEBUG=False
export APP_DEBUG=False (PWAのJavaScript側デバッグ機能もオフにする場合)
export SECRET_KEY=内緒の文字列
export ALLOWED_HOSTS=公開しているエンドポイントのｑDNS名
gunicorn --workers 5 tamarin.wsgi
```
