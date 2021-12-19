# テスト

とりあえず本当に最低限のE2Eテストを動くようにしました。使用したのは [Cypress](https://docs.cypress.io/) です。
テストに関してはまだまだ途中の状態です。

## 1. 環境の構築

```bash
cd e2e-test
npm install dexie faker cypress
```

## 2. 実行

python3 manage.py runserver とかでローカルで動いているインスタンスをテストする場合:

```bash
npx cypress open
```

<https://example.com> で動いているインスタンスをテストする場合:

```bash
CYPRESS_BASE_URL=https://example.com npx cypress open
```

## 3. 注意

- 現時点ではテスト用のアカウントを毎回作りっぱなしになるのでお掃除をお忘れなく。
- そのうちもうちょっとこの項目は書き足します...
