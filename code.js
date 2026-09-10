// ============================================
// Webアプリ用コード（完全版）
// すべての処理をWebアプリ内で完結
// ============================================

// Androidの「ホームに追加」は外側ページのfaviconだけを見る。
// 透過PNGだと不透明部分だけ拡大されるので、余白＋不透明背景の画像を使う。
// setFaviconUrl のURLは末尾が .png / .ico である必要がある。
const PWA_ICON_BASE =
  'https://jellybeansmame-cloud.github.io/ebay-post-app/icon-';

function iconUrl(size) {
  return PWA_ICON_BASE + size + '.png';
}

const WEB_APP_FAVICON_URL = iconUrl(224);

function getServiceUrl_() {
  return ScriptApp.getService().getUrl();
}

function buildStartUrl_(ssId) {
  const base = getServiceUrl_();
  return ssId ? base + '?ssId=' + encodeURIComponent(ssId) : base;
}

function buildManifest_(startUrl) {
  return {
    name: 'レシート記録',
    short_name: 'レシート',
    start_url: startUrl,
    scope: getServiceUrl_(),
    display: 'standalone',
    background_color: '#667eea',
    theme_color: '#667eea',
    icons: [
      { src: iconUrl(192), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: iconUrl(512), sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}

function getServiceWorkerScript_() {
  return [
    "self.addEventListener('install', function(e) { self.skipWaiting(); });",
    "self.addEventListener('activate', function(e) { e.waitUntil(self.clients.claim()); });",
    "self.addEventListener('fetch', function(e) { e.respondWith(fetch(e.request)); });",
  ].join('\n');
}

/**
 * GET: HTML / manifest / service worker
 */
function doGet(e) {
  e = e || { parameter: {} };

  if (e.parameter.manifest !== undefined) {
    const ssId = e.parameter.ssId || '';
    return ContentService.createTextOutput(
      JSON.stringify(buildManifest_(buildStartUrl_(ssId)))
    ).setMimeType(ContentService.MimeType.JSON);
  }

  if (e.parameter.sw !== undefined) {
    return ContentService.createTextOutput(getServiceWorkerScript_())
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  const ssId = e.parameter.ssId || '';
  const ssIdSuffix = ssId ? '&ssId=' + encodeURIComponent(ssId) : '';
  const serviceUrl = getServiceUrl_();

  const template = HtmlService.createTemplateFromFile('Index');
  template.ssId = ssId;
  template.manifestUrl = serviceUrl + '?manifest=1' + ssIdSuffix;
  template.swUrl = serviceUrl + '?sw=1';
  template.icon192Url = iconUrl(192);
  template.icon512Url = iconUrl(512);

  return template.evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .setTitle('📮 レシート')
    .setFaviconUrl(WEB_APP_FAVICON_URL)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 複数のレシート画像を解析してマージ（HTMLから呼ばれる）
 */
function analyzeMultipleReceipts(base64Array, ssId) {
  console.log("=== analyzeMultipleReceipts START ===");
  console.log("画像枚数:", base64Array.length);
  console.log("ssId:", ssId);
  
  if (!base64Array || base64Array.length === 0) {
    return { error: "画像データがありません" };
  }
  
  if (!ssId) {
    return { error: "スプレッドシートIDが指定されていません" };
  }
  
  // ★ ユーザーのシートからAPIキーを取得
  let apiKey;
  try {
    const ss = SpreadsheetApp.openById(ssId);
    const configSheet = ss.getSheetByName('設定');
    
    if (!configSheet) {
      console.error("「設定」シートが見つかりません");
      return { error: "「設定」シートが見つかりません" };
    }
    
    apiKey = configSheet.getRange('B3').getValue();
    
    console.log("APIキー取得: B3セルの値の長さ =", apiKey ? apiKey.length : 0);
    console.log("APIキーの最初の10文字:", apiKey ? apiKey.substring(0, 10) : "空");
    
    if (!apiKey) {
      console.error("APIキーが空です");
      return { error: "APIキーが設定されていません。「設定」シートのB3セルにGemini APIキーを入力してください。" };
    }
    
    // 前後の空白を削除
    apiKey = apiKey.toString().trim();
    
    if (apiKey.length < 30) {
      console.error("APIキーが短すぎます:", apiKey.length);
      return { error: "APIキーの形式が正しくありません（長さ: " + apiKey.length + "）。正しいAPIキーを設定してください。" };
    }
    
    console.log("APIキー検証OK");
    
  } catch (e) {
    console.error("APIキー取得エラー:", e.toString());
    return { error: "スプレッドシートへのアクセスエラー: " + e.toString() };
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const prompt = `
添付画像は郵便局の領収書1枚を分割して撮影したものです。
以下のルールに従って合計し、結果のみをご提出ください。

①日付（取扱日時）
②合計金額（下部の大きな「合計」の金額）
③追跡番号リスト（金額付き）
  ★追跡番号は必ず12-13桁の完全な形式で出力してください（例: RN104536565JP）
  ★追跡番号の末尾2文字（国コード）を省略しないでください
  ★追跡番号ごとの金額は、その番号のすぐ下に記載されている「小計」の金額です
  ★追跡番号が連続で記載されている場合、その下の「小計」は連続する追跡番号の合計になるので、件数で割ってそれぞれの金額を算出してください
④追跡番号付き商品の合計金額
⑤追跡番号付き商品の合計件数
⑥一般郵便物の合計金額（②から④を引いたもの）
⑦一般郵便物の総数

結果はJSONで出力してください

【JSON出力】
{
"transaction_date": "YYYY-MM-DD HH:MM",
"total_amount": ②の値,
"tracking_items": [
{"tracking_number": "完全な12-13桁（RN104536565JPのような形式）", "amount": その項目の「小計」の金額}
],
"tracked_items_total_amount": ④の値,
"tracked_items_count": ⑤の値,
"general_mail_total_amount": ⑥の値,
"general_mail_count": ⑦の値
}

この形式で必ず出力してください。追跡番号は必ず完全な形式（末尾の国コード含む）で出力してください。
  `;

  // ★ 複数の画像をparts配列に追加
  const parts = [{"text": prompt}];
  
  base64Array.forEach(function(base64) {
    parts.push({
      "inline_data": {
        "mime_type": "image/jpeg",
        "data": base64
      }
    });
  });

  const payload = {
    "contents": [{
      "parts": parts
    }]
  };

  try {
    console.log("Gemini API リクエスト送信（画像" + base64Array.length + "枚）");
    
    const response = UrlFetchApp.fetch(url, {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    });

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    console.log("Response Code:", responseCode);
    
    if (responseCode !== 200) {
      console.error("APIエラー:", responseText.substring(0, 200));
      
      // ★ 429エラーの場合は分かりやすいメッセージ
      if (responseCode === 429) {
        return { 
          error: "Gemini APIの無料枠を使い切りました。\n\n" +
                 "【対処法】\n" +
                 "・1分待ってから再実行（短時間に多数リクエストした場合）\n" +
                 "・17:00まで待つ（1日の上限1,500回に達した場合）\n" +
                 "・有料プランに切り替える"
        };
      }
      
      return { error: `Gemini APIエラー(${responseCode}): APIキーが正しいか確認してください` };
    }

    const json = JSON.parse(responseText);
    
    // ★ トークン数をログ出力
    if (json.usageMetadata) {
      console.log("=== トークン使用量 ===");
      console.log("入力トークン:", json.usageMetadata.promptTokenCount || "N/A");
      console.log("出力トークン:", json.usageMetadata.candidatesTokenCount || "N/A");
      console.log("合計トークン:", json.usageMetadata.totalTokenCount || "N/A");
      console.log("usageMetadata全体:", JSON.stringify(json.usageMetadata));
    } else {
      console.log("usageMetadataが存在しません");
    }
    
    if (!json.candidates || !json.candidates[0]) {
      return { error: "AIからの返答が空でした" };
    }
    
    if (!json.candidates[0].content || !json.candidates[0].content.parts) {
      return { error: "AIの返答構造が不正です" };
    }
    
    const resultText = json.candidates[0].content.parts[0].text;
    console.log("AI返答（全文）:", resultText);
    console.log("AI返答の文字数:", resultText.length);
    
    // ★ コードブロック記号を削除
    let cleanText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    console.log("クリーンアップ後:", cleanText.substring(0, 300));
    
    const match = cleanText.match(/\{[\s\S]*\}/);
    
    if (!match) {
      console.error("JSONが見つかりませんでした:", cleanText.substring(0, 500));
      return { error: "JSONが見つかりませんでした。もう一度撮影してください。" };
    }
    
    let jsonStr = match[0];
    
    console.log("抽出したJSON:", jsonStr.substring(0, 300));
    
    let parsedData;
    try {
      parsedData = JSON.parse(jsonStr);
      console.log("解析成功:", parsedData);
    } catch (parseError) {
      console.error("JSONパースエラー:", parseError.toString());
      console.error("パースに失敗したJSON（最初の500文字）:", jsonStr.substring(0, 500));
      return { error: "AI応答の解析に失敗しました。もう一度撮影してください。" };
    }
    
    // ★ 追跡番号から空白を除去
    if (parsedData.tracking_items && Array.isArray(parsedData.tracking_items)) {
      parsedData.tracking_items = parsedData.tracking_items.map(function(item) {
        if (item.tracking_number) {
          item.tracking_number = item.tracking_number.replace(/\s+/g, '');
        }
        return item;
      });
    }
    
    return parsedData;

  } catch (e) {
    console.error("エラー:", e.toString());
    return { error: e.toString() };
  }
}

/**
 * マージ結果を送料シートに保存
 */
function saveMergedReceipt(mergedData, ssId) {
  console.log("=== saveMergedReceipt START ===");
  
  if (!ssId) {
    return "エラー: スプレッドシートIDが指定されていません";
  }
  
  try {
    const ss = SpreadsheetApp.openById(ssId);
    let sheet = ss.getSheetByName('送料');
    
    if (!sheet) {
      return "エラー: 「送料」シートが見つかりません";
    }
    
    const now = new Date();
    const trackingItems = mergedData.tracking_items || [];
    let addedCount = 0;
    
    // ★ 日付（日時から日付部分のみ）
    const dateStr = mergedData.transaction_date || '';
    const dateOnly = dateStr.split(' ')[0]; // "2026-02-16 18:3" → "2026-02-16"
    
    // ★ 追跡番号ありの行を追加（レシート順）
    trackingItems.forEach(function(item) {
      const nextRow = sheet.getLastRow() + 1;
      
      sheet.getRange(nextRow, 1).setValue(dateOnly); // 日付
      sheet.getRange(nextRow, 2).setValue(item.tracking_number || ''); // 追跡番号
      sheet.getRange(nextRow, 3).setValue(item.amount || 0); // 送料合計
      sheet.getRange(nextRow, 4).setValue(1); // 数量
      sheet.getRange(nextRow, 5).setValue(item.amount || 0); // 単価
      sheet.getRange(nextRow, 6).setValue('追跡あり'); // 種別
      sheet.getRange(nextRow, 7).setValue('JP'); // データ元
      sheet.getRange(nextRow, 8).setValue(now); // 登録日時
      
      addedCount++;
    });
    
    // ★ 一般郵便の行を追加（まとめて1行）
    if (mergedData.general_mail_count > 0) {
      const nextRow = sheet.getLastRow() + 1;
      const generalTotal = mergedData.general_mail_total_amount || 0;
      const generalCount = mergedData.general_mail_count || 0;
      const unitPrice = generalCount > 0 ? Math.round(generalTotal / generalCount) : 0;
      
      sheet.getRange(nextRow, 1).setValue(dateOnly); // 日付
      sheet.getRange(nextRow, 2).setValue(''); // 追跡番号（空）
      sheet.getRange(nextRow, 3).setValue(generalTotal); // 送料合計
      sheet.getRange(nextRow, 4).setValue(generalCount); // 数量
      sheet.getRange(nextRow, 5).setValue(unitPrice); // 単価
      sheet.getRange(nextRow, 6).setValue('追跡なし'); // 種別
      sheet.getRange(nextRow, 7).setValue('JP'); // データ元
      sheet.getRange(nextRow, 8).setValue(now); // 登録日時
      
      addedCount++;
    }
    
    console.log("保存完了:", addedCount + "行追加");
    
    return "保存完了！\n" +
           "追跡あり: " + trackingItems.length + "件 (¥" + (mergedData.tracked_items_total_amount || 0) + ")\n" +
           "追跡なし: " + (mergedData.general_mail_count || 0) + "件 (¥" + (mergedData.general_mail_total_amount || 0) + ")\n" +
           "合計: ¥" + (mergedData.total_amount || 0);
    
  } catch (e) {
    console.error("保存エラー:", e.toString());
    return "エラー: " + e.toString();
  }
}