// キャプチャしたスクリーンショットのデータを一時的に保存する変数
let capturedImageData = null;

// content.jsからのメッセージを受け取るリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureVisibleTab') {
    // 現在のタブ情報を取得
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      const tab = tabs[0];
      
      try {
        // タブのズームレベルを取得
        const zoomFactor = await chrome.tabs.getZoom(tab.id);
        
        // キャプチャオプションを設定
        const captureOptions = {
          format: 'png',
          quality: 100
        };

        // スクリプトを注入してページの準備を行う
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: preparePageForCapture,
        });

        // 少し待ってからキャプチャを実行（レイアウト安定待ち）
        setTimeout(async () => {
          try {
            // 表示部分のスクリーンショットを撮影（エラー検知を厳しく）
            const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, captureOptions);
            if (!dataUrl || !dataUrl.startsWith('data:image')) {
              throw new Error('Empty capture');
            }
            
            if (message.type === 'area') {
              // 範囲選択の場合は応答して終了
              sendResponse({imageData: dataUrl});
            } else if (message.type === 'full') {
              // 全体キャプチャの場合は保存して編集画面を開く
              capturedImageData = dataUrl;
              openEditorTab();
            }

            // ページを元の状態に戻す
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              function: restorePageAfterCapture,
            });
          } catch (error) {
            console.error('Capture failed:', error);
          }
        }, 250);
      } catch (error) {
        console.error('Setup failed:', error);
      }
    });
    // 非同期レスポンスを有効にする
    return true;
  } else if (message.action === 'captureArea') {
    // 選択範囲のデータを受け取り、保存
    capturedImageData = message.imageData;
    // 新しいタブでエディタを開く
    openEditorTab();
    // レスポンスを返す
    sendResponse({success: true});
  } else if (message.action === 'getImageData') {
    // エディタページからの画像データリクエストに応答
    if (capturedImageData) {
      sendResponse({imageData: capturedImageData});
      // データを送信したらクリア
      capturedImageData = null;
    } else {
      sendResponse({error: 'No image data available'});
    }
  }
  
  // 非同期レスポンスを有効にする
  return true;
});

// キャプチャ前にページを準備する関数
function preparePageForCapture() {
  // 現在のスクロール位置を保存
  window._originalScroll = {
    x: window.scrollX,
    y: window.scrollY
  };

  // NOTE: 一部サイトで body overflow を変更すると白画面になるため変更しない
  // Google DocsやSpreadsheetの特殊な要素を処理
  const specialElements = document.querySelectorAll('.docs-sheet-container, .grid-container');
  specialElements.forEach(el => {
    if (el) {
      el.style.transform = 'none';
      el.style.width = 'auto';
      el.style.height = 'auto';
    }
  });
}

// キャプチャ後にページを元に戻す関数
function restorePageAfterCapture() {
  // スクロールを元に戻す
  if (window._originalScroll) {
    window.scrollTo(window._originalScroll.x, window._originalScroll.y);
  }
  
  // Google DocsやSpreadsheetの特殊な要素を元に戻す
  const specialElements = document.querySelectorAll('.docs-sheet-container, .grid-container');
  specialElements.forEach(el => {
    if (el) {
      el.style.transform = '';
      el.style.width = '';
      el.style.height = '';
    }
  });
}

// エディタページを新しいタブで開く関数
function openEditorTab() {
  chrome.tabs.create({
    url: 'editor.html'
  });
} 