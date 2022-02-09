# 使わせていただいているOSSやデータ

Python系は [requirements.txt](./requirements.txt) に、JavaScript系は [package.json](./package.json) に書いてあるけど、備忘録もかねてここにメモ。

## Python

### [Django](https://www.djangoproject.com/)

- 恐ろしいくらい便利なWebアプリケーションフレームワーク。

### [WhiteNoise](https://whitenoise.evans.io/en/stable/)

- ちょっといろいろとクセのある静的ファイルの扱いが簡単に。

### [Django REST framework](https://www.django-rest-framework.org/)

- REST APIをこれでさくっと実現。

### [Simple JWT](https://django-rest-framework-simplejwt.readthedocs.io/en/latest/)

- REST APIでのJWT認証を実現。

### [Django インポート/エクスポート](https://kurozumi.github.io/django-import-export/)

- めっちゃ簡単にデータベースの内容をCSVへエキスポートできるようになる。

### [Django Silk](https://github.com/jazzband/django-silk)

- HTTPリクエストとデータベースへのアクセスをプロファイリングできるツール。

### [Django Extensions](https://django-extensions.readthedocs.io/en/latest/)

- shell_plusやrunserver_plusといったデバッグに便利な機能を追加してくれる。

### その他Django界隈で参考にさせていただいた記事

- [Django Best Practices: Custom User Model](https://learndjango.com/tutorials/django-custom-user-model)
- [Django REST Framework image upload](https://stackoverflow.com/questions/45564130/django-rest-framework-image-upload)

## JavaScript

### [Dexie.js](https://dexie.org/)

- IndexedDBがとっても使いやすくなる。
  
### [crypto-js](https://github.com/brix/crypto-js)

- 暗号処理ライブラリ。

### [Chartist.js](https://gionkunz.github.io/chartist-js/)

- チャート描画ライブラリ。いろいろ試してみたけど、これが一番余計なことしないで素敵。

### [node-qrcode](https://github.com/soldair/node-qrcode)

- QRコード生成ライブラリ。

### その他、JavaScript界隈で便利なサイト

- [MDN Web Docs](https://developer.mozilla.org/ja/)
- [モダン JavaScript チートシート](https://mbeaudru.github.io/modern-js-cheatsheet/translations/ja-JP.html)

## HTML/CSS/Audio

### [Bulma](https://bulma.io/)

- めちゃくちゃ便利でかっこいいCSSフレームワーク。以下のリンクも便利。
- [Bulmaswatch](https://jenil.github.io/bulmaswatch/)
- [Free Bulma Templates](https://bulmatemplates.github.io/bulma-templates/)
- [Bulma extensions](https://bulma.io/extensions/)

### [Bulma Toast](https://rfoel.github.io/bulma-toast/)

- Bulmaとあわせて超簡単にトーストが作れる。

### [Animate.css](https://animate.style/)

- アニメーション効果のために使用。なんだかちょっとかっこいいぞ…

### [HOWLER.JS](https://howlerjs.com)

- SafariのAUDIOタグとの戦いに疲れ果ててこれを発見。最初から使わせてもらえば良かった…

## テスト

### [Cypress](https://www.cypress.io/)

- めちゃくちゃ便利な（こればっかり…）テストフレームワーク。

## データ

### アイコン

#### [iconscount](https://iconscout.com/)

- [Elegant Themes](https://iconscout.com/contributors/elegant-themes)
- [Beautiful Flat Icons Icon Pack](https://iconscout.com/icon-pack/beautiful-flat-icons-1)

#### アイコンを作るのに便利なサイト

- [favicon generator](https://ao-system.net/favicongenerator/)
- [miniPaint](https://viliusle.github.io/miniPaint/)
- [peko-step.com](https://www.peko-step.com/tool/alphachannel.html)

### サウンド

#### [Freesound](https://freesound.org/)

- [Single Electro Beat](https://freesound.org/people/Jofae/sounds/369724/)

## その他とっても便利なサイト:PWA編

とくに最初のBuilding Progressive Web Appsという本が非常にわかりやすくて良かったです。

- [Building Progressive Web Apps: Bringing the Power of Native to the Browser (English Edition)](https://www.oreilly.com/library/view/building-progressive-web/9781491961643/)
- [プログレッシブウェブアプリ (PWA)](https://developer.mozilla.org/ja/docs/Web/Progressive_web_apps)
- [What PWA Can Do Today](https://whatpwacando.today/)
- [Progressive Web Apps](https://web.dev/progressive-web-apps/)
- [Make your PWA feel more like an app](https://web.dev/app-like-pwas/)
- [PWAs Power Tips](https://firt.dev/pwa-design-tips/)
- [Designing Native-Like Progressive Web Apps For iOS](https://medium.com/appscope/designing-native-like-progressive-web-apps-for-ios-1b3cdda1d0e8)
- [6 Tips to make your iOS PWA feel like a native app](https://www.netguru.com/blog/pwa-ios)
- [PWA Stats](https://www.pwastats.com/)
- [Appscope - Progressive Web Apps Examples](https://appsco.pe/)
- [Background Sync with Service Workers](https://davidwalsh.name/background-sync)
- [Web App Manifest Generator](https://app-manifest.firebaseapp.com/)
- [PWAをもっと前進させませんか？【2021年末版】](https://zenn.dev/kaa_a_zu/articles/701efdbb4a7a49)
- [iOSのPWA対応時に気をつけるべきこと](https://qiita.com/zprodev/items/e5db743727c5722874cb)

## その他とっても便利なサイト:ブラウザ編

とにかく今回はSafariやAUDIO/VIDEO/SELECTタグの振る舞いには苦しめられた…その苦闘の歴史を含めて色々便利なサイトを足跡として残しておきます…

- [サインインフォームのベストプラクティス](https://web.dev/i18n/ja/sign-in-form-best-practices/)
- [Can't interact with select boxes on safari #83](https://github.com/nightwatchjs/nightwatch-docs/issues/83)
- [iOSで"optgroup"を使った時にバグで苦しまない方法](https://www.kabanoki.net/6149/)
- [Safari13.0.2でフォームのselectボックスを使うとクラッシュする](https://code-pocket.info/20191012267/)
- [4 reasons your z-index isn’t working (and how to fix it)](https://www.freecodecamp.org/news/4-reasons-your-z-index-isnt-working-and-how-to-fix-it-coder-coder-6bc05f103e6c/)
- [Ipad dropdown does not show selected value when set by JQuery .val()](https://stackoverflow.com/questions/6861536/ipad-dropdown-does-not-show-selected-value-when-set-by-jquery-val)
- [Safari change select height](https://coderedirect.com/questions/541010/safari-change-select-height)
- [iOS Safari 13.3.1 uploaded file size is 0](https://stackoverflow.com/questions/60729546/ios-safari-13-3-1-uploaded-file-size-is-0)
- [世にも奇妙なSafariのaudio要素の挙動](https://rch850.hatenablog.com/entry/2021/07/26/015048)
- [getUserMedia()で指定できるMediaTrackConstraintsのよもやま](https://lealog.hateblo.jp/entry/2017/08/21/155211)
- [Safariでvideo.play()したときにAbortErrorと言われたときの対応](https://qiita.com/mikan17/items/3d75d5c9f002386a494e)
- [ChromeのMediaStreamTrackとvideo要素の組合せには罠がある話](https://lealog.hateblo.jp/entry/2017/08/10/150100)
- [video要素を使った際にメモリリークが発生した際のメモ](https://qiita.com/qianer-fengtian/items/89980fbb420171cd3d2e)
