# レシート PWA シェル

Google Apps Script の Web アプリ URL を **そのまま** ホーム画面に追加すると、Android Chrome では右下に Chrome バッジが付くことがあります。

このフォルダ（`ebay-post-app/pwa-shell`）を **このリポジトリの GitHub Pages** で公開し、**その URL** をホームに追加してください。

公開 URL（例）: `https://jellybeansmame-cloud.github.io/ebay-post-app/?ssId=...`

## 初回セットアップ（GitHub）

1. `ebay-post-app` を GitHub リポジトリとして push
2. リポジトリ Settings → Pages → Source: **GitHub Actions**
3. `pwa-shell/config.js` の GAS URL を確認
4. push 後、Actions の **Deploy receipt PWA shell** が成功することを確認

## スプレッドシート連携

`ebay-sales/01_main.js` の `InputPostAppURL()` が、各ユーザーのシート ID 付きでこの URL を B4 に書き込みます。

```
https://jellybeansmame-cloud.github.io/ebay-post-app/?ssId=（その人のシートID）
```

初回は `?ssId=` 付き URL から開き、ホームに追加。2 回目以降は localStorage に ssId が残ります。

## スマホ

1. スプレッドシートのリンクを開く（GAS 直 URL ではない）
2. 古い GAS 直ショートカットを削除
3. **アプリをインストール** / **ホーム画面に追加**
