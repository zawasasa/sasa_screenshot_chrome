// テキスト入力用のdiv要素を作成
const textInput = document.createElement('div');
textInput.contentEditable = true;
textInput.style.position = 'absolute';
textInput.style.display = 'none';
textInput.style.minWidth = '50px';
textInput.style.minHeight = '20px';
textInput.style.padding = '5px';
textInput.style.border = '1px solid #4285f4';
textInput.style.backgroundColor = 'white';
textInput.style.fontFamily = 'Arial';
textInput.style.zIndex = '1000';
textInput.style.whiteSpace = 'pre-wrap';
textInput.style.wordBreak = 'break-word';
textInput.style.outline = 'none';
textInput.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
document.querySelector('.canvas-container').appendChild(textInput);

// DOMの読み込み完了を待つ
document.addEventListener('DOMContentLoaded', () => {
  // キャンバスとコンテキストの取得
  const canvas = document.getElementById('imageCanvas');
  const ctx = canvas.getContext('2d');

  // 編集状態を管理する変数
  let currentTool = null;  // 現在選択中のツール
  let currentColor = '#000000';  // 現在選択中の色
  let isDrawing = false;  // 描画中かどうか
  let startX, startY;  // 描画開始位置
  let selectedShape = null;  // 選択中の図形
  let shapes = [];  // 描画された図形を保存する配列
  let isResizing = false;  // リサイズ中かどうか
  let resizeHandle = null;  // 現在操作中のリサイズハンドル
  let lastX, lastY;  // 前回のマウス位置
  let pendingAvatarImage = null; // 直近に読み込んだアバター画像
  let editingShape = null; // 吹き出しテキスト編集中の図形
  let editingOriginalText = '';

  // 背景画像
  let backgroundImage = null;

  // 編集履歴
  let history = [];
  let currentStep = -1;

  // サイズスライダーの更新
  const lineWidthSlider = document.getElementById('lineWidth');
  const lineWidthValue = document.getElementById('lineWidthValue');

  if (lineWidthSlider && lineWidthValue) {
    lineWidthSlider.addEventListener('input', () => {
      lineWidthValue.textContent = `${lineWidthSlider.value}px`;
    });
  }

  // 取り消しボタンの設定
  const undoButton = document.getElementById('undoTool');
  if (undoButton) {
    undoButton.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        restoreFromHistory();
      }
    });
  }

  // ツールボタンのイベントリスナー設定
  document.querySelectorAll('.tool-button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tool-button').forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');
      currentTool = button.id;
      selectedShape = null;
      updateResizeHandles();

      if (currentTool === 'avatarTool') {
        const input = document.getElementById('avatarInput');
        input.value = '';
        input.click();
      }
    });
  });

  // 色選択パレットのイベントリスナー設定
  document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.remove('active');
      });
      option.classList.add('active');
      currentColor = option.dataset.color;
    });
  });

  // マウスイベントのリスナー設定
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);
  canvas.addEventListener('dblclick', handleDoubleClick);

  // 画像の読み込み
  chrome.runtime.sendMessage({action: 'getImageData'}, (response) => {
    if (response && response.imageData) {
      const img = new Image();
      img.onload = () => {
        // キャンバスのサイズを画像に合わせる
        canvas.width = img.width;
        canvas.height = img.height;
        
        // キャンバスコンテナのサイズを調整
        const container = document.querySelector('.canvas-container');
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.8;
        
        // アスペクト比を維持しながら、最大サイズに収まるようにスケールを計算
        const scaleX = maxWidth / img.width;
        const scaleY = maxHeight / img.height;
        const scale = Math.min(scaleX, scaleY);
        
        // キャンバスの表示サイズを設定
        canvas.style.width = `${img.width * scale}px`;
        canvas.style.height = `${img.height * scale}px`;
        
        // 画像を描画
        ctx.drawImage(img, 0, 0);
        backgroundImage = img;
        
        // 初期状態を履歴に保存
        saveToHistory();
      };
      img.src = response.imageData;
    }
  });

  // 画像選択時にキャンバスへ配置
  const avatarInput = document.getElementById('avatarInput');
  if (avatarInput) {
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files && avatarInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          pendingAvatarImage = img;
          // キャンバス中央に初期配置
          const initWidth = Math.min(canvas.width * 0.3, img.width);
          const scale = initWidth / img.width;
          const initHeight = img.height * scale;
          const x = (canvas.width - initWidth) / 2;
          const y = (canvas.height - initHeight) / 2;
          const shape = new Shape('avatar', x, y, '#000000', 1);
          shape.width = initWidth;
          shape.height = initHeight;
          shape._image = img; // メモリ上の参照
          shapes.push(shape);
          redrawCanvas();
          saveToHistory();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // キャンバス座標→CSS座標の変換とオフセット
  function getCanvasTransform() {
    const canvasRect = canvas.getBoundingClientRect();
    const container = document.querySelector('.canvas-container');
    const containerRect = container.getBoundingClientRect();
    return {
      scaleX: canvasRect.width / canvas.width,
      scaleY: canvasRect.height / canvas.height,
      offsetLeft: canvasRect.left - containerRect.left,
      offsetTop: canvasRect.top - containerRect.top,
    };
  }

  function openBubbleEditor(shape) {
    editingShape = shape;
    editingOriginalText = shape.text || '';

    const { scaleX, scaleY, offsetLeft, offsetTop } = getCanvasTransform();
    const px = Math.min(shape.x, shape.x + shape.width);
    const py = Math.min(shape.y, shape.y + shape.height);
    const pw = Math.abs(shape.width);
    const ph = Math.abs(shape.height);
    const padX = (shape.padding || 10) * scaleX;
    const padY = (shape.padding || 10) * scaleY;

    textInput.style.display = 'block';
    textInput.style.left = `${offsetLeft + px * scaleX + padX}px`;
    textInput.style.top = `${offsetTop + py * scaleY + padY}px`;
    textInput.style.width = `${Math.max(50, pw * scaleX - padX * 2)}px`;
    textInput.style.height = `${Math.max(24, ph * scaleY - padY * 2)}px`;
    textInput.style.fontSize = `${(shape.fontSize || 16) * scaleY}px`;
    textInput.style.fontFamily = shape.fontFamily || 'Arial';
    textInput.textContent = editingOriginalText;
    textInput.focus();
    selectEnd(textInput);
  }

  function commitBubbleEditor(save) {
    if (!editingShape) return;
    if (save) {
      editingShape.text = (textInput.textContent || '').replace(/\r\n|\r/g, '\n');
      redrawCanvas();
      saveToHistory();
    }
    textInput.style.display = 'none';
    editingShape = null;
  }

  function handleDoubleClick(e) {
    // バブル上でダブルクリック → テキスト編集
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (s.type === 'bubble' && s.contains(x, y)) {
        selectedShape = s;
        openBubbleEditor(s);
        return;
      }
    }
  }

  // contentEditable内での確定/キャンセル
  textInput.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      commitBubbleEditor(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      textInput.textContent = editingOriginalText;
      commitBubbleEditor(false);
    }
  });
  textInput.addEventListener('blur', () => commitBubbleEditor(true));

  function selectEnd(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // 描画開始
  function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    startX = (e.clientX - rect.left) * scaleX;
    startY = (e.clientY - rect.top) * scaleY;
    lastX = startX;
    lastY = startY;

    if (currentTool === 'selectTool') {
      // まず既存の選択に対するリサイズハンドル当たり判定
      const handles = document.querySelectorAll('.resize-handle');
      for (const handle of handles) {
        const handleRect = handle.getBoundingClientRect();
        if (e.clientX >= handleRect.left && e.clientX <= handleRect.right &&
            e.clientY >= handleRect.top && e.clientY <= handleRect.bottom) {
          isResizing = true;
          resizeHandle = handle.classList[1];
          return;
        }
      }
      
      // 図形の選択（ここで必要なら選び直す）
      const mouseX = startX;
      const mouseY = startY;
      selectedShape = null;
      // 図形の選択
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (shapes[i].contains(mouseX, mouseY)) {
          selectedShape = shapes[i];
          break;
        }
      }
      
      updateResizeHandles();
      return;
    } else if (currentTool === 'eraserTool') {
      const mouseX = startX;
      const mouseY = startY;
      
      // 消しゴムの範囲内にある図形を削除
      shapes = shapes.filter(shape => !shape.contains(mouseX, mouseY));
      redrawCanvas();
      saveToHistory();
    } else if (currentTool && currentTool !== 'selectTool') {
      const toolType = currentTool.replace('Tool', '');
      const shape = new Shape(toolType, startX, startY, currentColor, lineWidthSlider.value);
      // avatarツールの場合はドラッグで矩形を決めて後で画像をはめる（pendingがあれば）
      if (toolType === 'avatar' && pendingAvatarImage) {
        shape._image = pendingAvatarImage;
      }
      if (toolType === 'bubble') {
        shape.text = 'Hello!';
      }
      shapes.push(shape);
    }
  }

  // 描画中
  function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    if (isResizing && selectedShape) {
      const dx = mouseX - lastX;
      const dy = mouseY - lastY;

      // 最小サイズを確保
      const minSize = 10;
      let newX = selectedShape.x;
      let newY = selectedShape.y;
      let newW = selectedShape.width;
      let newH = selectedShape.height;

      switch (resizeHandle) {
        case 'top-left':
          newW -= dx; newH -= dy; newX += dx; newY += dy; break;
        case 'top-right':
          newW += dx; newH -= dy;            newY += dy; break;
        case 'bottom-left':
          newW -= dx; newH += dy; newX += dx;            break;
        case 'bottom-right':
          newW += dx; newH += dy;                        break;
      }

      // 反転防止と最小サイズ
      if (newW < minSize) { newW = minSize; }
      if (newH < minSize) { newH = minSize; }

      selectedShape.x = newX;
      selectedShape.y = newY;
      selectedShape.width = newW;
      selectedShape.height = newH;

      redrawCanvas();
    } else if (currentTool === 'selectTool' && selectedShape) {
      // 図形の移動
      const dx = mouseX - lastX;
      const dy = mouseY - lastY;
      selectedShape.x += dx;
      selectedShape.y += dy;
      redrawCanvas();
    } else if (currentTool && currentTool !== 'selectTool') {
      // 新しい図形の描画
      const shape = shapes[shapes.length - 1];
      if (shape) {
        shape.width = mouseX - shape.x;
        shape.height = mouseY - shape.y;
        redrawCanvas();
      }
    }

    lastX = mouseX;
    lastY = mouseY;
  }

  // 描画終了
  function stopDrawing() {
    if (isDrawing && currentTool && currentTool !== 'selectTool') {
      saveToHistory();
    }
    isDrawing = false;
    isResizing = false;
  }

  // キャンバスの再描画
  function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 背景画像を描画
    if (backgroundImage) {
      ctx.drawImage(backgroundImage, 0, 0);
    }
    
    // 図形を描画
    shapes.forEach(shape => shape.draw(ctx));
    
    // 選択中の図形のリサイズハンドルを更新
    updateResizeHandles();
  }

  // リサイズハンドルの更新
  function updateResizeHandles() {
    const handles = document.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
      handle.style.display = 'none';
    });

    if (selectedShape) {
      const canvasRect = canvas.getBoundingClientRect();
      const container = document.querySelector('.canvas-container');
      const containerRect = container.getBoundingClientRect();

      const scaleX = canvasRect.width / canvas.width;
      const scaleY = canvasRect.height / canvas.height;

      // キャンバスの表示位置（container基準）
      const canvasOffsetLeft = canvasRect.left - containerRect.left;
      const canvasOffsetTop = canvasRect.top - containerRect.top;

      const x = canvasOffsetLeft + selectedShape.x * scaleX;
      const y = canvasOffsetTop + selectedShape.y * scaleY;
      const width = selectedShape.width * scaleX;
      const height = selectedShape.height * scaleY;

      handles.forEach(handle => {
        handle.style.display = 'block';
        
        switch (handle.classList[1]) {
          case 'top-left':
            handle.style.left = `${x - 6}px`;
            handle.style.top = `${y - 6}px`;
            break;
          case 'top-right':
            handle.style.left = `${x + width - 6}px`;
            handle.style.top = `${y - 6}px`;
            break;
          case 'bottom-left':
            handle.style.left = `${x - 6}px`;
            handle.style.top = `${y + height - 6}px`;
            break;
          case 'bottom-right':
            handle.style.left = `${x + width - 6}px`;
            handle.style.top = `${y + height - 6}px`;
            break;
        }
      });
    }
  }

  // 履歴に保存
  function saveToHistory() {
    currentStep++;
    history = history.slice(0, currentStep);
    history.push(shapes.map(shape => ({ ...shape })));
  }

  // 履歴から復元
  function restoreFromHistory() {
    if (currentStep >= 0 && currentStep < history.length) {
      shapes = history[currentStep].map(shape => ({ ...shape }));
      redrawCanvas();
    }
  }

  // Shape クラス
  class Shape {
    constructor(type, x, y, color, lineWidth) {
      this.type = type;
      this.x = x;
      this.y = y;
      this.width = 0;
      this.height = 0;
      this.color = color;
      this.lineWidth = lineWidth;
      // デフォルト値（吹き出し用）
      if (type === 'bubble') {
        this.text = '';
        this.textColor = '#000000';
        this.bgColor = 'rgba(255,255,255,0.95)';
        this.borderColor = '#000000';
        this.borderWidth = 2;
        this.borderRadius = 12;
        this.padding = 10;
        this.fontFamily = 'Arial';
        this.fontSize = 16;
      }
    }

    draw(context) {
      context.strokeStyle = this.color;
      context.lineWidth = this.lineWidth;
      context.fillStyle = this.color;

      switch (this.type) {
        case 'rectangle':
          context.strokeRect(this.x, this.y, this.width, this.height);
          break;
        case 'circle':
          context.beginPath();
          const centerX = this.x + this.width / 2;
          const centerY = this.y + this.height / 2;
          const radiusX = Math.abs(this.width / 2);
          const radiusY = Math.abs(this.height / 2);
          context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
          context.stroke();
          break;
        case 'arrow':
          // 矢印の描画
          const angle = Math.atan2(this.height, this.width);
          const length = Math.sqrt(this.width * this.width + this.height * this.height);
          
          // 矢印の先端の大きさを線の太さに応じて調整
          const arrowHeadLength = Math.max(15, this.lineWidth * 3); // 最小15px、線の太さの3倍
          const arrowHeadWidth = Math.max(12, this.lineWidth * 2.5); // 最小12px、線の太さの2.5倍
          
          // 矢印の本体を描画
          context.beginPath();
          context.moveTo(this.x, this.y);
          context.lineTo(this.x + this.width, this.y + this.height);
          context.stroke();
          
          // 矢印の先端を描画
          context.beginPath();
          context.moveTo(this.x + this.width, this.y + this.height);
          context.lineTo(
            this.x + this.width - arrowHeadLength * Math.cos(angle - Math.PI/6),
            this.y + this.height - arrowHeadLength * Math.sin(angle - Math.PI/6)
          );
          context.lineTo(
            this.x + this.width - arrowHeadLength * Math.cos(angle + Math.PI/6),
            this.y + this.height - arrowHeadLength * Math.sin(angle + Math.PI/6)
          );
          context.closePath();
          context.fill();
          break;
        case 'bubble': {
          // 角丸矩形（吹き出し本体）
          const r = Math.max(0, Math.min(this.borderRadius, Math.min(Math.abs(this.width), Math.abs(this.height)) / 2));
          const x = Math.min(this.x, this.x + this.width);
          const y = Math.min(this.y, this.y + this.height);
          const w = Math.abs(this.width);
          const h = Math.abs(this.height);

          context.save();
          context.fillStyle = this.bgColor || 'rgba(255,255,255,0.95)';
          context.strokeStyle = this.borderColor || '#000000';
          context.lineWidth = this.borderWidth || 2;

          context.beginPath();
          context.moveTo(x + r, y);
          context.lineTo(x + w - r, y);
          context.quadraticCurveTo(x + w, y, x + w, y + r);
          context.lineTo(x + w, y + h - r);
          context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          context.lineTo(x + r, y + h);
          context.quadraticCurveTo(x, y + h, x, y + h - r);
          context.lineTo(x, y + r);
          context.quadraticCurveTo(x, y, x + r, y);
          context.closePath();
          context.fill();
          context.stroke();

          // しっぽ（三角形）右下にデフォルト
          const tailBaseX = x + w - r - 20;
          const tailBaseY = y + h;
          context.beginPath();
          context.moveTo(tailBaseX, tailBaseY);
          context.lineTo(tailBaseX + 16, tailBaseY);
          context.lineTo(tailBaseX + 8, tailBaseY + 16);
          context.closePath();
          context.fill();
          context.stroke();

          // テキスト描画
          context.fillStyle = this.textColor || '#000';
          context.font = `${this.fontSize || 16}px ${this.fontFamily || 'Arial'}`;
          context.textBaseline = 'top';
          const tx = x + (this.padding || 10);
          const ty = y + (this.padding || 10);
          const tw = w - (this.padding || 10) * 2;
          const lines = String(this.text || '').split('\n');
          let cy = ty;
          for (const line of lines) {
            context.fillText(line, tx, cy, tw);
            cy += (this.fontSize || 16) * 1.3;
          }

          context.restore();
          break;
        }
        case 'avatar':
          if (this._image) {
            context.drawImage(this._image, this.x, this.y, this.width, this.height);
          }
          break;
      }
    }

    contains(x, y) {
      const margin = this.lineWidth + 5;  // クリック判定の余白
      
      // 図形の範囲を計算
      const left = Math.min(this.x, this.x + this.width) - margin;
      const right = Math.max(this.x, this.x + this.width) + margin;
      const top = Math.min(this.y, this.y + this.height) - margin;
      const bottom = Math.max(this.y, this.y + this.height) + margin;
      
      return x >= left && x <= right && y >= top && y <= bottom;
    }
  }

  // クリップボードにコピーボタンの処理
  document.getElementById('copyButton').addEventListener('click', async () => {
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve));
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      alert('クリップボードにコピーしました');
    } catch (err) {
      console.error('クリップボードへのコピーに失敗しました:', err);
      alert('クリップボードへのコピーに失敗しました');
    }
  });

  // ダウンロードボタンの処理
  document.getElementById('downloadButton').addEventListener('click', () => {
    const date = new Date();
    const fileName = `screenshot-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}.png`;

    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}); 