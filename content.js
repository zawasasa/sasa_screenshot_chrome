// 二重注入防止のためのガードとスコープ隔離
(function initScreenshotAnnotateContent() {
  if (window.__saaInjected) return;
  window.__saaInjected = true;

  // 範囲選択のための変数（再注入時の衝突を避けるため var を使用）
  var isSelecting = false;
  var startX, startY;
  var selectionElement = null;
  var overlayElement = null; // 全画面オーバーレイ（iframe 上でもイベント取得）

  // popup.jsからのメッセージを受け取るリスナー
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'ping') {
      sendResponse && sendResponse({ ok: true });
      return true;
    }
    if (message.action === 'captureVisible') {
      // 表示部分のキャプチャをbackground.jsに要求
      chrome.runtime.sendMessage({action: 'captureVisibleTab', type: 'full'});
      sendResponse && sendResponse({ ok: true });
    } else if (message.action === 'startAreaSelection') {
      // 範囲選択モードを開始
      startAreaSelection();
      sendResponse && sendResponse({ ok: true });
    }
    return true;
  });

// 範囲選択モードを開始する関数
  function startAreaSelection() {
    if (overlayElement) return; // 多重開始防止
  // bodyのカーソルは触らず、オーバーレイにのみ適用
  
    // 全画面オーバーレイを作成（イベント捕捉用）
    overlayElement = document.createElement('div');
    overlayElement.style.position = 'fixed';
    overlayElement.style.left = '0';
    overlayElement.style.top = '0';
    overlayElement.style.width = '100vw';
    overlayElement.style.height = '100vh';
    overlayElement.style.cursor = 'crosshair';
    overlayElement.style.background = 'transparent';
    overlayElement.style.zIndex = '2147483646';
    overlayElement.style.pointerEvents = 'auto';
    document.body.appendChild(overlayElement);

  // 選択範囲を表示するための要素を作成
  selectionElement = document.createElement('div');
  selectionElement.style.position = 'fixed';
  selectionElement.style.border = '2px solid #4285f4';
  selectionElement.style.backgroundColor = 'rgba(66, 133, 244, 0.1)';
  selectionElement.style.pointerEvents = 'none';
  selectionElement.style.display = 'none';
    selectionElement.style.zIndex = '2147483647';
  document.body.appendChild(selectionElement);

  // マウスイベントのリスナーを設定
    // オーバーレイ上でイベント取得（iframe 上でも確実に拾う）
    overlayElement.addEventListener('mousedown', handleMouseDown, true);
    overlayElement.addEventListener('mousemove', handleMouseMove, true);
    overlayElement.addEventListener('mouseup', handleMouseUp, true);
  }

// マウスダウンイベントのハンドラ
  function handleMouseDown(e) {
  e.preventDefault();
  isSelecting = true;
  startX = e.clientX;
  startY = e.clientY;
  selectionElement.style.display = 'block';
}

// マウス移動イベントのハンドラ
  function handleMouseMove(e) {
  if (!isSelecting) return;
  e.preventDefault();

  const currentX = e.clientX;
  const currentY = e.clientY;

  // 選択範囲の位置とサイズを計算
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  // 選択範囲要素のスタイルを更新
  selectionElement.style.left = left + 'px';
  selectionElement.style.top = top + 'px';
  selectionElement.style.width = width + 'px';
  selectionElement.style.height = height + 'px';
  }

// マウスアップイベントのハンドラ
  function handleMouseUp(e) {
  if (!isSelecting) return;
  isSelecting = false;

  // 選択範囲の座標を取得（ビューポート基準のCSSピクセル）
  const leftCss = parseInt(selectionElement.style.left) || 0;
  const topCss = parseInt(selectionElement.style.top) || 0;
  const widthCss = parseInt(selectionElement.style.width) || 0;
  const heightCss = parseInt(selectionElement.style.height) || 0;

  if (widthCss <= 0 || heightCss <= 0) {
    cleanup();
    return;
  }

  // 選択範囲をキャプチャ（倍率変換は画像読み込み後に実施）
  captureSelectedArea(leftCss, topCss, widthCss, heightCss);

  // クリーンアップ
  cleanup();
  }

// 選択範囲をキャプチャする関数
  function captureSelectedArea(leftCss, topCss, widthCss, heightCss) {
  // Canvas要素を作成
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  // 表示部分全体をキャプチャ
  chrome.runtime.sendMessage({action: 'captureVisibleTab', type: 'area'}, (response) => {
    if (response && response.imageData) {
      // キャプチャした画像を読み込み
      const img = new Image();
      img.onload = () => {
        try {
          const ratio = window.devicePixelRatio || 1;

          // 画像（可視領域）サイズに合わせてCSS→デバイスピクセルへ変換
          const srcLeft = Math.round(leftCss * ratio);
          const srcTop = Math.round(topCss * ratio);
          const srcWidth = Math.round(widthCss * ratio);
          const srcHeight = Math.round(heightCss * ratio);

          // キャンバスのサイズを選択サイズに設定（デバイスピクセル）
          canvas.width = srcWidth;
          canvas.height = srcHeight;

          // ソース範囲を画像の境界内にクリップ
          const clippedLeft = Math.max(0, Math.min(srcLeft, img.width));
          const clippedTop = Math.max(0, Math.min(srcTop, img.height));
          const clippedWidth = Math.max(0, Math.min(srcWidth, img.width - clippedLeft));
          const clippedHeight = Math.max(0, Math.min(srcHeight, img.height - clippedTop));

          if (clippedWidth === 0 || clippedHeight === 0) {
            console.warn('Selection outside of captured viewport');
            return;
          }

          // 選択範囲部分だけを切り取り
          context.drawImage(
            img,
            clippedLeft, clippedTop, clippedWidth, clippedHeight,
            0, 0, clippedWidth, clippedHeight
          );
          
          // 切り取った画像データをbackground.jsに送信
          const imageData = canvas.toDataURL('image/png');
          chrome.runtime.sendMessage({
            action: 'captureArea',
            imageData: imageData
          }, (response) => {
            if (!response || !response.success) {
              console.error('Failed to send captured area to background');
            }
          });
        } catch (error) {
          console.error('Error processing captured area:', error);
        }
      };
      img.onerror = () => {
        console.error('Failed to load captured image');
      };
      img.src = response.imageData;
    } else {
      console.error('No image data received from capture');
    }
  });
  }

// クリーンアップ関数
  function cleanup() {
    // イベントリスナーを削除
    if (overlayElement) {
      overlayElement.removeEventListener('mousedown', handleMouseDown, true);
      overlayElement.removeEventListener('mousemove', handleMouseMove, true);
      overlayElement.removeEventListener('mouseup', handleMouseUp, true);
    }

  // 選択範囲要素を削除
  if (selectionElement) {
    selectionElement.remove();
    selectionElement = null;
  }

    // オーバーレイを削除
    if (overlayElement) {
      overlayElement.remove();
      overlayElement = null;
    }

  // bodyのカーソルは変更しない
  }

})();