// ポップアップUIのボタンにイベントリスナーを設定
document.addEventListener('DOMContentLoaded', () => {
  const getActiveTab = () => new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs[0]));
  });

  // 表示部分（可視領域）をキャプチャする
  document.getElementById('captureVisible').addEventListener('click', async () => {
    try {
      // バックグラウンドへ直接依頼（content.js 依存を排除）
      await chrome.runtime.sendMessage({ action: 'captureVisibleTab', type: 'full' });
    } catch (e) {
      console.error('Failed to trigger capture:', e);
    } finally {
      window.close();
    }
  });

  // 範囲選択でキャプチャする
  const areaBtn = document.getElementById('captureArea');
  areaBtn.addEventListener('click', async () => {
    try {
      const tab = await getActiveTab();
      if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        alert('このページではキャプチャできません。通常のWebページ（http/https）でお試しください。');
        return;
      }
      // まず既存の content.js がいるか確認（いれば再注入しない）
      const ping = () => new Promise(resolve => {
        try {
          chrome.tabs.sendMessage(tab.id, { action: 'ping' }, response => {
            if (chrome.runtime.lastError) {
              // 受信側がいない場合など
              resolve(false);
              return;
            }
            resolve(Boolean(response && response.ok));
          });
        } catch (_) {
          resolve(false);
        }
      });

      let hasContent = await ping();
      // 必要な場合のみ注入（全フレームに注入）
      let injectedFrames = [];
      if (!hasContent) {
        try {
          const results = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content.js'] });
          injectedFrames = Array.isArray(results) ? results.map(r => r.frameId) : [];
        } catch (err) {
          console.error('executeScript failed:', err);
        }
        // 再度 ping
        hasContent = await ping();
      }

      // 受信確認（可能なら全フレームへ送信して誰かが応答すればOK）
      const targetFrameIds = injectedFrames.length ? injectedFrames : [undefined];
      const sendToFrame = (frameId) => new Promise(resolve => {
        chrome.tabs.sendMessage(tab.id, { action: 'startAreaSelection' }, { frameId }, resp => {
          if (chrome.runtime.lastError) {
            console.debug('sendMessage error:', chrome.runtime.lastError.message);
            resolve(false);
            return;
          }
          resolve(Boolean(resp && resp.ok));
        });
      });

      let started = false;
      for (const fid of targetFrameIds) {
        // eslint-disable-next-line no-await-in-loop
        if (await sendToFrame(fid)) { started = true; break; }
      }
      if (!started) throw new Error('startAreaSelection not acknowledged');
      // 押下の感触を視覚化
      areaBtn.disabled = true;
      setTimeout(() => { areaBtn.disabled = false; }, 300);
    } catch (e) {
      console.error('Failed to start area selection:', e);
      alert('範囲選択を開始できませんでした。拡張機能のサイトへのアクセス権限を「すべてのサイト」に設定して再試行してください。');
    } finally {
      window.close();
    }
  });
});