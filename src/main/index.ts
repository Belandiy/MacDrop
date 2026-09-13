import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { loadConfig } from './config';
import { SyncEngine } from './engine';
import { PeerDiscovery } from './discovery';
import { createTray } from './tray';
import { setupIpc } from './ipc';

// Disable standard menu bar completely
Menu.setApplicationMenu(null);

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let engine: SyncEngine | null = null;
let discovery: PeerDiscovery | null = null;
let tray: any = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 660,
    minWidth: 400,
    minHeight: 550,
    resizable: true,
    title: 'MacDrop',
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#1c1c1e',
    icon: path.join(__dirname, '../dist/tray-icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Minimize to tray instead of quitting when user closes window
  mainWindow.on('close', (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

app.whenReady().then(() => {
  const config = loadConfig();
  engine = new SyncEngine(config);
  engine.start();

  discovery = new PeerDiscovery(config.deviceId, config.deviceName, config.apiPort || 8384);
  engine.setDiscovery(discovery);
  discovery.start();

  // Live IP sync when discovery detects peers
  discovery.on('peer-found', (peer) => {
    engine?.updatePeerAddress(peer.deviceId, peer.ip, peer.port);
  });
  discovery.on('peers-changed', (peers) => {
    for (const p of peers) {
      engine?.updatePeerAddress(p.deviceId, p.ip, p.port);
    }
  });

  createWindow();
  tray = createTray(() => mainWindow, engine, config);
  setupIpc(engine, discovery, config, () => mainWindow);

  // Relay engine and discovery events to renderer
  engine.on('status-changed', (status) => {
    mainWindow?.webContents.send('status-update', status);
  });

  engine.on('progress', (progress) => {
    mainWindow?.webContents.send('progress-update', progress);
  });

  discovery.on('peers-changed', (peers) => {
    mainWindow?.webContents.send('peers-update', peers);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
  engine?.stop();
});

app.on('window-all-closed', () => {
  // Keep app running in background tray on all platforms
});
