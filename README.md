# sasa_screenshot_chrome

[English](#quick-screenshot-annotate-chrome-extension) | [日本語](README.ja.md)

## Quick screenshot & annotate Chrome extension

Capture the visible area or a selected region of any webpage, add speech bubbles and arrows, reuse avatar/icon stamps from your saved presets, then copy to clipboard or download as PNG. Works entirely locally (no server, no login).

### Highlights
- Clear, readable speech bubbles for friendly callouts
- One‑click avatar/icon stamps from your saved presets (transparent PNG/WebP)
- Fast flow: capture → annotate → copy or save
- Local‑only processing: nothing is uploaded, no account required

### Features
- Visible area capture from the toolbar popup
- Area selection capture with drag-to-crop
- Annotation tools: Select, Rectangle, Circle, Arrow, Bubble, Avatar (stamps), Mosaic, Eraser
- Bubble: light/dark theme toggle, tail direction toggle, auto-tail snaps toward nearest avatar, scalable tail
- Avatar (stamps): transparent PNG/WebP, horizontal/vertical flip, quick reuse from saved presets
- Auto-select: newly created shapes/images/stamps become active immediately for move/resize
- Conditional toolbar: buttons enable only when applicable (e.g., flip for avatar, invert/tail for bubble)
- Styling: Color palette and adjustable line width
- Export: Copy to clipboard (PNG) or download

### Install (development)
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click “Load unpacked”
4. Select this folder (`ささっとスクショで囲もう`)
5. Pin the extension for quick access

Edge: use `edge://extensions` with the same steps.

### Usage
- From the popup:
  - “Capture visible area” → opens editor tab with the captured image
  - “Capture selected area” → crosshair cursor → drag to select → editor opens

In the editor (`editor.html`):
- Tools: Select / Rectangle / Circle / Arrow / Eraser
- Color: choose from the palette (black, red, blue, green, yellow)
- Line width: 1–20px
- Copy: PNG to clipboard
- Download: `screenshot-YYYYMMDD-HHMMSS.png`

### Permissions (from `manifest.json`)
- `activeTab`: capture the active tab
- `scripting`, `tabs`: inject content scripts and control tabs
- `clipboardWrite`: write PNG to clipboard
- `host_permissions: <all_urls>`: run on most sites
- `desktopCapture`: reserved for future use (currently unused)

No data is sent externally. Captured image is kept in background temporarily and cleared after it’s sent to the editor.

### Project structure
```
ささっとスクショで囲もう/
├─ manifest.json        # MV3 manifest
├─ background.js        # capture, temporary storage, open editor
├─ content.js           # area selection UI & crop
├─ popup.html / .js     # launcher (two capture modes)
├─ editor.html / .js    # annotation editor
└─ styles.css           # popup & editor styles
```

### How it works
- Popup triggers `captureVisibleTab` in background (PNG)
- For area selection, `content.js` draws a drag rectangle and crops the visible capture via Canvas
- Background stores the image briefly → opens `editor.html` → editor fetches via `getImageData`
- Editor draws annotations on Canvas, supports copy/download
- Special handling around Google Docs/Sheets transforms before/after capture

### Limitations
- Not a full-page scroller. Captures visible viewport and user-selected area only
- Cannot capture `chrome://` or extension pages (browser restriction)
- For stability, allow access on “All sites” so content script injection works reliably
- Handles HiDPI using `devicePixelRatio`

### Troubleshooting
- “Couldn’t start area selection” → set site access to “All sites”, then reload the page
- Blurry/misaligned → check browser zoom (100% recommended)

### License
MIT (see `LICENSE`)

## ささっとスクショで囲もう

Webページのスクリーンショットをサッと撮って、かわいい吹き出しや矢印で注釈し、登録済みのアバター/アイコンをスタンプとしてワンクリ貼り付け。ローカル完結で、PNG保存もクリップボードコピーもすぐにできるChrome拡張。

### 特長
- **表示中の画面をキャプチャ**: 今見えている範囲をワンクリックで撮影
- **ドラッグで範囲選択キャプチャ**: 必要なところだけ切り取り撮影
- **注釈ツール**: 四角形・円・矢印・吹き出し・スタンプ（画像）・モザイク・選択・消しゴム
- **吹き出し**: 明/暗の配色切替、しっぽ方向の切替、最寄りスタンプへの自動吸着
- **スタンプ（画像）**: 透過PNG/WebPに対応。保存したプリセットからワンクリ貼り付け
- **出力**: PNGでダウンロード or クリップボードに直接コピー
- **ローカル完結**: 画像や注釈はローカル処理。サーバー送信なし

---

### インストール（開発用）
1. Chromeで `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. このフォルダ（`ささっとスクショで囲もう`）を選択
5. 拡張機能をピン留めしておくと使いやすい

Edgeの場合は `edge://extensions` で同様の手順。

---

### 使い方
- **表示部分をキャプチャ**: 拡張アイコン → ポップアップの「表示部分をキャプチャ」
  - 新しいタブでエディターが開き、画像上に注釈が描ける
- **範囲を選択してキャプチャ**: ポップアップの「範囲を選択してキャプチャ」
  - 画面が十字カーソルになる → ドラッグで範囲指定 → 自動で切り出し → エディターが開く

エディター（`editor.html`）の主な操作:
- **ツール**: 選択 / 四角形 / 円形 / 矢印 / 消しゴム
- **色**: パレットから選択（黒、赤、青、緑、黄）
- **線の太さ**: スライダーで1〜20px
- **コピー**: 画像をクリップボードへ（PNG）
- **ダウンロード**: `screenshot-YYYYMMDD-HHMMSS.png` で保存

---

### 権限について（`manifest.json`）
- **activeTab**: アクティブなタブのキャプチャ許可
- **scripting / tabs**: コンテンツスクリプトの注入やタブ操作に使用
- **clipboardWrite**: エディターからPNGをクリップボードへコピー
- **host_permissions: <all_urls>**: ほとんどのサイトで動作させるため
- **desktopCapture**: 将来的な拡張のために入っています（現状未使用）

拡張はデータを外部送信しません。スクリーンショットは一時的にバックグラウンドで保持し、エディターへ渡したら破棄します。

---

### ファイル構成
```
ささっとスクショで囲もう/
├─ manifest.json        # MV3 マニフェスト
├─ background.js        # キャプチャ実行・一時保存・エディター起動
├─ content.js           # 範囲選択UIと切り出し処理
├─ popup.html / .js     # ランチャー（2つのキャプチャモード）
├─ editor.html / .js    # 注釈エディター（描画、コピー、保存）
└─ styles.css           # ポップアップ/エディターのスタイル
```

---

### ざっくり仕組み
- ポップアップから実行 → バックグラウンドが `captureVisibleTab` でPNGを取得
- 範囲選択モードの場合は、`content.js` でドラッグ矩形を作り、可視範囲キャプチャから該当部分だけCanvasで切り出し
- 画像データはバックグラウンドに一時保存 → 新規タブで `editor.html` を開く → `getImageData` で受け取り描画
- エディター上ではCanvasに注釈（四角/円/矢印等）を重ねて、コピー/保存
- Google Docs / スプレッドシートの変換（transformなど）で崩れないよう、撮影前後に一時的なスタイル調整を実施

---

### 既知の制限・注意
- **全ページ（縦長の全体）スクロール撮影には未対応**。今は「見えている範囲」＋「任意範囲切り出し」のみ
- **chrome:// や 拡張機能のページ**はブラウザの制約でキャプチャ不可
- サイトのアクセス権限は「すべてのサイト」にしておくと安定（範囲選択の注入に必要）
- High DPI（Retina等）でも綺麗に切り出すため、`devicePixelRatio` を考慮

---

### トラブルシュート
- 「範囲選択を開始できませんでした」→ 拡張のサイトアクセス権限を「すべてのサイト」に設定し、ページをリロード
- 画像が荒い/ズレる → ブラウザの拡大縮小を確認（標準100%推奨）。それでも改善しない場合は環境情報と一緒に報告してください

---

### 開発メモ
- 変更後は `chrome://extensions` → 対象拡張の「更新」ボタンでリロード
- `console` ログは背景（Service Worker）、ポップアップ、コンテンツ、エディターそれぞれのDevToolsで確認
- アイコンやi18nは未同梱。必要なら `manifest.json` を拡張してください
- アイコンフォントに [Font Awesome 6（CDN）](https://cdnjs.com/libraries/font-awesome) を利用

---

### ライセンス / クレジット
- ライセンス: 未設定（必要に応じて追加してください）
- Copyright © プロジェクトオーナー

