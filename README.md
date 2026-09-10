# ebay-post-app

郵便レシート読み取り Web アプリ（`WEB_APP_Post_URL`）。

OrangeConnex 送料拡張は **Chrome 拡張が Google API を直接呼ぶ** ため、このプロジェクトの変更は不要です。

## ホーム画面に追加（PWA）

### Android で Chrome バッジを消す（推奨）

GAS の URL（`script.google.com/.../exec`）を直接ホームに追加すると、**Android Chrome ではバッジが付いたまま** になることがあります。Google 側のホスティングの制限です。

**対処:** 同梱の `pwa-shell/` を **このリポジトリの GitHub Pages** で公開し、**その URL** をホームに追加してください。詳しくは [pwa-shell/README.md](pwa-shell/README.md)。

1. `pwa-shell/config.js` に GAS Web アプリの `/exec` URL を設定
2. GitHub に push → Actions で Pages 公開（`https://jellybeansmame-cloud.github.io/ebay-post-app/`）
3. `ebay-sales` の `InputPostAppURL()` がスプレッドシート B4 に PWA URL + ssId を書き込む
4. 古い GAS 直ショートカットを削除し、**B4 のリンク**からホームに追加

### GAS 直リンクの場合

manifest / Service Worker は入れていますが、Android ではバッジが消えない場合があります。iOS Safari ではバッジはもともと付きません。
