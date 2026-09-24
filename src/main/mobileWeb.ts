/**
 * Mobile Web Client generator for MacDrop Web Drop.
 * Provides a fully self-contained HTML/CSS/JS interface for mobile browsers (Android / iOS).
 * Does not depend on external CDNs or internet connectivity.
 */

export function getMobileWebHtml(computerName: string, initialToken: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>MacDrop Mobile</title>
  ${getCss()}
</head>
${getHtmlBody(computerName, initialToken)}
${getScripts(initialToken)}
</body>
</html>`;
}

function getCss(): string {
  return `<style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background-color: #121214;
      color: #f4f4f5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 16px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #1c1c1e;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      margin-bottom: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo-badge {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 16px;
      color: white;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    .brand h1 {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.2px;
    }
    .status-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #34d399;
      background: rgba(52, 211, 153, 0.1);
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px solid rgba(52, 211, 153, 0.2);
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background-color: #34d399;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    /* Tabs */
    .nav-tabs {
      display: flex;
      background: #1c1c1e;
      border-radius: 14px;
      padding: 4px;
      gap: 4px;
      margin-bottom: 16px;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .nav-tab {
      flex: 1;
      padding: 10px 12px;
      border-radius: 10px;
      border: none;
      background: transparent;
      color: #a1a1aa;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .nav-tab.active {
      background: #2c2c2e;
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    /* Upload Area */
    .tab-content {
      display: none;
      flex-direction: column;
      flex: 1;
    }
    .tab-content.active {
      display: flex;
    }
    .drop-card {
      background: #1c1c1e;
      border: 2px dashed rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      padding: 28px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      transition: border-color 0.2s, background-color 0.2s;
    }
    .drop-card.dragover {
      border-color: #3b82f6;
      background: rgba(59, 130, 246, 0.08);
    }
    .drop-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.12);
      color: #60a5fa;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
    }
    .drop-card h2 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .drop-card p {
      font-size: 13px;
      color: #71717a;
      max-width: 260px;
      line-height: 1.4;
      margin-bottom: 18px;
    }
    .btn-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;
      max-width: 280px;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 13px 18px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: transform 0.1s, opacity 0.2s;
    }
    .btn:active {
      transform: scale(0.98);
    }
    .btn-primary {
      background: #3b82f6;
      color: white;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
    }
    .btn-secondary {
      background: #2c2c2e;
      color: #e4e4e7;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* Queue & History */
    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #a1a1aa;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .file-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .file-item {
      background: #1c1c1e;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .file-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .file-name {
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }
    .file-meta {
      font-size: 11px;
      color: #a1a1aa;
      white-space: nowrap;
    }
    .progress-bar-bg {
      width: 100%;
      height: 5px;
      background: #2c2c2e;
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: #3b82f6;
      border-radius: 3px;
      width: 0%;
      transition: width 0.15s ease-out;
    }
    .file-status-success {
      color: #34d399;
      font-size: 11px;
      font-weight: 600;
    }
    .file-status-error {
      color: #f87171;
      font-size: 11px;
      font-weight: 600;
    }

    /* Download List */
    .download-btn {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .download-btn:active {
      background: rgba(59, 130, 246, 0.3);
    }
    .empty-placeholder {
      text-align: center;
      padding: 30px 16px;
      color: #71717a;
      font-size: 13px;
    }

    input[type="file"] {
      display: none;
    }
  </style>`;
}

function getHtmlBody(computerName: string, initialToken: string): string {
  return `<body>

  <!-- Header -->
  <header>
    <div class="brand">
      <img src="/api/mobile/logo?token=${initialToken}" class="logo-badge" style="object-fit: cover; padding: 0; background: none;" onerror="this.outerHTML='<div class=\'logo-badge\'>M</div>'" />
      <div>
        <h1>MacDrop</h1>
        <div style="font-size: 11px; color: #71717a;">ПК: <span id="compName">${escapeHtml(computerName)}</span></div>
      </div>
    </div>
    <div class="status-badge">
      <div class="status-dot"></div>
      <span>В сети</span>
    </div>
  </header>

  <!-- Navigation -->
  <div class="nav-tabs">
    <button class="nav-tab active" onclick="switchTab('sendTab', this)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <span>Отправить на ПК</span>
    </button>
    <button class="nav-tab" onclick="switchTab('receiveTab', this)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      <span>Скачать с ПК</span>
    </button>
  </div>

  <!-- TAB 1: Send to PC -->
  <div id="sendTab" class="tab-content active">
    <div class="drop-card" id="dropArea">
      <div class="drop-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <h2>Отправить файлы на ПК</h2>
      <p>Файлы мгновенно поступят в папку MacDrop на вашем компьютере</p>

      <div class="btn-group">
        <button class="btn btn-primary" onclick="document.getElementById('fileInput').click()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          <span>Выбрать любые файлы</span>
        </button>

        <button class="btn btn-secondary" onclick="document.getElementById('mediaInput').click()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span>Фото или Видео</span>
        </button>
      </div>

      <input type="file" id="fileInput" multiple onchange="handleFilesSelected(this.files)">
      <input type="file" id="mediaInput" accept="image/*,video/*" multiple onchange="handleFilesSelected(this.files)">
    </div>

    <!-- Upload Queue -->
    <div class="section-title">
      <span>Очередь передачи</span>
      <span id="queueCounter" style="font-size: 11px;">0 файлов</span>
    </div>
    <div class="file-list" id="uploadList">
      <div class="empty-placeholder" id="uploadEmpty">
        Выберите файлы для начала передачи
      </div>
    </div>
  </div>

  <!-- TAB 2: Receive from PC -->
  <div id="receiveTab" class="tab-content">
    <div class="section-title">
      <span>Недавние файлы на ПК</span>
      <button onclick="fetchPcFiles()" style="background: none; border: none; color: #3b82f6; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        <span>Обновить</span>
      </button>
    </div>
    <div class="file-list" id="pcFilesList">
      <div class="empty-placeholder" id="pcFilesLoading">
        Загрузка списка файлов...
      </div>
    </div>
  </div>

  `;
}

function getScripts(initialToken: string): string {
  return `<script>
    const urlParams = new URLSearchParams(window.location.search);
    const sessionToken = urlParams.get('token') || '${initialToken}';

    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    }

    function switchTab(tabId, tabEl) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      tabEl.classList.add('active');

      if (tabId === 'receiveTab') {
        fetchPcFiles();
      }
    }

    // Drag & Drop
    const dropArea = document.getElementById('dropArea');
    ['dragenter', 'dragover'].forEach(name => {
      dropArea.addEventListener(name, (e) => {
        e.preventDefault();
        dropArea.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      dropArea.addEventListener(name, (e) => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
      });
    });
    dropArea.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files) {
        handleFilesSelected(e.dataTransfer.files);
      }
    });

    let queue = [];
    let isUploading = false;

    function handleFilesSelected(files) {
      if (!files || files.length === 0) return;
      document.getElementById('uploadEmpty')?.remove();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const item = {
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          file: file,
          name: file.name,
          size: file.size,
          status: 'pending'
        };
        queue.push(item);
        renderQueueItem(item);
      }
      updateQueueCounter();
      processQueue();
    }

    function renderQueueItem(item) {
      const list = document.getElementById('uploadList');
      const div = document.createElement('div');
      div.className = 'file-item';
      div.id = item.id;

      const fileInfo = document.createElement('div');
      fileInfo.className = 'file-info';

      const fileName = document.createElement('div');
      fileName.className = 'file-name';
      fileName.title = item.name;
      fileName.textContent = item.name;

      const fileMeta = document.createElement('div');
      fileMeta.className = 'file-meta';
      fileMeta.id = 'meta_' + item.id;
      fileMeta.textContent = formatBytes(item.size);

      fileInfo.appendChild(fileName);
      fileInfo.appendChild(fileMeta);

      const progressBg = document.createElement('div');
      progressBg.className = 'progress-bar-bg';

      const progressFill = document.createElement('div');
      progressFill.className = 'progress-bar-fill';
      progressFill.id = 'bar_' + item.id;

      progressBg.appendChild(progressFill);

      div.appendChild(fileInfo);
      div.appendChild(progressBg);

      list.prepend(div);
    }

    function updateQueueCounter() {
      const el = document.getElementById('queueCounter');
      if (el) el.textContent = queue.length + ' файлов';
    }

    async function processQueue() {
      if (isUploading) return;
      const next = queue.find(i => i.status === 'pending');
      if (!next) return;

      isUploading = true;
      next.status = 'uploading';

      const bar = document.getElementById('bar_' + next.id);
      const meta = document.getElementById('meta_' + next.id);

      try {
        await uploadSingleFile(next, (percent, speed) => {
          if (bar) bar.style.width = percent + '%';
          if (meta) meta.textContent = percent + '% • ' + speed;
        });

        next.status = 'done';
        if (bar) {
          bar.style.width = '100%';
          bar.style.background = '#34d399';
        }
        if (meta) {
          meta.innerHTML = '';
          const statusSpan = document.createElement('span');
          statusSpan.className = 'file-status-success';
          statusSpan.textContent = '✓ Отправлено';
          meta.appendChild(statusSpan);
        }

        // Haptic feedback on Android
        if (navigator.vibrate) {
          try { navigator.vibrate(80); } catch(e) {}
        }
      } catch (err) {
        next.status = 'error';
        if (bar) bar.style.background = '#f87171';
        if (meta) {
          meta.innerHTML = '';
          const statusSpan = document.createElement('span');
          statusSpan.className = 'file-status-error';
          statusSpan.textContent = '✕ Ошибка';
          meta.appendChild(statusSpan);
        }
      } finally {
        isUploading = false;
        processQueue();
      }
    }

    function uploadSingleFile(item, onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const uploadUrl = '/api/mobile/upload?token=' + encodeURIComponent(sessionToken);

        let startTime = Date.now();
        let lastLoaded = 0;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            const elapsed = (Date.now() - startTime) / 1000;
            const speedBytes = elapsed > 0 ? (e.loaded / elapsed) : 0;
            const speedStr = formatBytes(speedBytes) + '/с';
            onProgress(percent, speedStr);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error('Server error: ' + xhr.status));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Timeout'));

        xhr.open('POST', uploadUrl, true);
        xhr.setRequestHeader('X-Filename', encodeURIComponent(item.name));
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.setRequestHeader('X-Mobile-Token', sessionToken);
        xhr.send(item.file);
      });
    }

    // Fetch PC files
    async function fetchPcFiles() {
      const container = document.getElementById('pcFilesList');
      container.innerHTML = '<div class="empty-placeholder">Загрузка списка...</div>';

      try {
        const res = await fetch('/api/mobile/files?token=' + encodeURIComponent(sessionToken));
        if (!res.ok) throw new Error('Status ' + res.status);
        const data = await res.json();
        
        if (!data.files || data.files.length === 0) {
          container.innerHTML = '<div class="empty-placeholder">В папке MacDrop на ПК пока нет файлов</div>';
          return;
        }

        container.innerHTML = '';
        data.files.forEach(f => {
          const div = document.createElement('div');
          div.className = 'file-item';

          const fileInfo = document.createElement('div');
          fileInfo.className = 'file-info';

          const fileDetails = document.createElement('div');

          const fileName = document.createElement('div');
          fileName.className = 'file-name';
          fileName.title = f.name;
          fileName.textContent = f.name;

          const fileMeta = document.createElement('div');
          fileMeta.className = 'file-meta';
          fileMeta.textContent = formatBytes(f.size) + ' • ' + f.time;

          fileDetails.appendChild(fileName);
          fileDetails.appendChild(fileMeta);

          const downloadUrl = '/api/mobile/download/' + encodeURIComponent(f.name) + '?token=' + encodeURIComponent(sessionToken);
          const downloadBtn = document.createElement('a');
          downloadBtn.href = downloadUrl;
          downloadBtn.download = f.name;
          downloadBtn.className = 'download-btn';
          downloadBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Скачать</span>';

          fileInfo.appendChild(fileDetails);
          fileInfo.appendChild(downloadBtn);
          div.appendChild(fileInfo);

          container.appendChild(div);
        });
      } catch (err) {
        container.innerHTML = '<div class="empty-placeholder" style="color: #f87171;">Не удалось загрузить файлы с ПК</div>';
      }
    }

    // Heartbeat ping to keep PC aware of active mobile browser tab
    setInterval(function() {
      fetch('/api/mobile/status?token=' + encodeURIComponent(sessionToken)).catch(function() {});
    }, 15000);
  </script>
`;
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
