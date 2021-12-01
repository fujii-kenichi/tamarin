# アーキテクチャ

タマリンのアーキテクチャについてのメモです。

## 1. 前提条件

- 全体：オンプレでもクラウドでも同じように動く技術スタックを採用したい。
- 全体：できる限り商用での稼働実績があり安定した構成を採用したい。
- クライアント側：PWA という比較的現段階では未成熟な技術を使用しているので、問題が発生した時の切り分けの容易性を確保するためにフレームワークを使用しないでなるべくシンプルな構成にしておきたい。技術の確認ができたらいまどきのUIフレームワークで機能を拡張していく。
- サーバ側：なるべく簡単に最初のバージョンを開発できる開発容易性と、稼働後における高い拡張性の両立を目指したい。
- クラウド側：可能な限り運用コストを低減できるようにしたい。

## 2. 非機能要求

- PWA を採用することでストアに依存しないアプリケーションのデリバリを実現すること。
- タマリンカメラの実行環境として iPhone, iPod (Safari) と Andorid (Chrome) をサポートすること。
- タマリンクの実行環境として Windows 10 Home (Chromium Edge) をサポートすること。

## 3. 導出した構成要素

- サーバサイドのメイン記述言語は拡張性や安定性から Python に決定。
- メインデータベースはオンプレ・クラウド双方への適用と実績から PostgreSQL に決定。
- サーバサイドのフレームワークは管理機能の充実や開発生産性の高さから Django に決定。
- サーバサイドの OS は Python と PostgreSQL から Linux に決定。
- クライアントサイドは前述の通り当面はプレインな JavaScript と HTML/CSS で構成することを決定。
- クラウド環境は本来 PWA ということでは GCP が最適のような気もするが、諸般の事情で Azure に決定。
- クラウドに持っていった際に最も課金的な懸念のある写真のストレージには、パフォーマンスとコストを勘案してオブジェクトストレージである Azure ストレージを使用することを決定。
- Django アプリケーションの実行環境は、スケーラビリティとコストから App Service を使用することに決定。
- PostgreSQL は機能面からみれば Azure PostgreSQL が最適であるが、コスト面ではちょっと高いのでここはあえて最小構成の VM で稼働させることを決定。最終的には Azure PostgreSQL への移行を想定。

## 4. 最終的な構成

- TODO: ここに以下の構成要素での図を書く
- Client: タマリンカメラ
  - JavaScript / HTML / CSS
    - iPHone/ iPod : Mobile Safari / IndexedDB / Service worker (Off-line)
    - Android : Mobile Chrome / IndexedDB / Service worker (Off-line + Sync)
    - 依存ライブラリ: Crypto-js / Dexie / Image Capture
- Client: タマリンク
  - JavaScript / HTML / CSS
    - Windows 10 : Chromium Edge | Chrome / IndexedDB
    - 依存ライブラリ: Crypto-js / Dexie
- Server: コネクタ
  - App Service : Django / Python
    - HTTPS + JWT Access token
  - VM : Linux + PostgreSQL
  - メディアストレージ : Azure ストレージ (ダウンロードはここから直接)
