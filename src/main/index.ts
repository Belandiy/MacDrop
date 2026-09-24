import { app, BrowserWindow, Menu, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { loadConfig } from './config';
import { SyncEngine } from './engine';
import { PeerDiscovery } from './discovery';
import { createTray } from './tray';
import { setupIpc } from './ipc';
import { setupAutoUpdater } from './updater';
import { UpnpManager } from './upnp';
import { logger } from './logger';

// Optimization flags for low-end Windows hardware (APUs, Intel HD Graphics, slow HDDs)
if (process.platform === 'win32') {
  // Prevent occlusion lag where Windows stalls inactive/occluded windows
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
}

// Disable standard menu bar completely
Menu.setApplicationMenu(null);

// Prevent multiple instances and focus existing window on duplicate launch
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

let mainWindow: BrowserWindow | null = null;
let engine: SyncEngine | null = null;
let discovery: PeerDiscovery | null = null;
let upnp: UpnpManager | null = null;
let tray: any = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let cachedAppIcon: Electron.NativeImage | string | null = null;

function getAppIcon(): Electron.NativeImage | string {
  if (cachedAppIcon) return cachedAppIcon;
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const candidates = [
    path.join(process.resourcesPath, iconName),
    path.join(__dirname, '../dist', iconName),
    path.join(__dirname, '../../public', iconName),
    path.join(app.getAppPath(), 'public', iconName),
    path.join(process.resourcesPath, 'public', iconName)
  ];
  for (const cand of candidates) {
    try {
      if (fs.existsSync(cand)) {
        const img = nativeImage.createFromPath(cand);
        if (!img.isEmpty()) {
          cachedAppIcon = img;
          return img;
        }
        cachedAppIcon = cand;
        return cand;
      }
    } catch {}
  }
  // Fallback for Windows if ico loading failed
  if (process.platform === 'win32') {
    const pngCandidates = [
      path.join(process.resourcesPath, 'icon.png'),
      path.join(__dirname, '../dist', 'icon.png'),
      path.join(__dirname, '../../public/icon.png'),
      path.join(app.getAppPath(), 'public/icon.png')
    ];
    for (const cand of pngCandidates) {
      try {
        if (fs.existsSync(cand)) {
          const img = nativeImage.createFromPath(cand);
          if (!img.isEmpty()) {
            cachedAppIcon = img;
            return img;
          }
        }
      } catch {}
    }
  }
  const fallback = path.join(app.getAppPath(), 'public', iconName);
  cachedAppIcon = fallback;
  return fallback;
}

function createWindow() {
  const appIcon = getAppIcon();
  mainWindow = new BrowserWindow({
    width: 440,
    height: 660,
    minWidth: 400,
    minHeight: 550,
    resizable: true,
    title: 'MacDrop',
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#090a0f',
    icon: appIcon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (typeof appIcon !== 'string') {
    mainWindow.setIcon(appIcon);
  }

  const devUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL;
  if (isDev && devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Fast visual appearance: show immediately when ready, with safety fallback
  let hasShown = false;
  const showWindow = () => {
    if (!hasShown && mainWindow && !mainWindow.isDestroyed()) {
      hasShown = true;
      mainWindow.show();
    }
  };

  mainWindow.once('ready-to-show', showWindow);
  // Ensure the window displays within 350ms even on slow systems
  setTimeout(showWindow, 350);

  // Minimize to tray instead of quitting when user closes window
  mainWindow.on('close', (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    // Only bind to global com.andrey.macdrop if running from installed location (Program Files)
    // To prevent Windows taskbar from binding unpacked/portable exe to stale shortcuts
    if (process.execPath.toLowerCase().includes('program files')) {
      app.setAppUserModelId('com.andrey.macdrop');
    } else {
      app.setAppUserModelId(`com.andrey.macdrop.${app.getVersion()}`);
    }
  }

  const config = loadConfig();
  logger.info('App', `MacDrop v${app.getVersion()} started on ${process.platform} (${process.arch})`);

  engine = new SyncEngine(config);
  discovery = new PeerDiscovery(config.deviceId, config.deviceName, config.apiPort || 8384);
  engine.setDiscovery(discovery);

  // Live IP sync when discovery detects peers
  discovery.on('peer-found', (peer) => {
    engine?.updatePeerAddress(peer.deviceId, peer.ip, peer.port);
  });
  discovery.on('peers-changed', (peers) => {
    for (const p of peers) {
      engine?.updatePeerAddress(p.deviceId, p.ip, p.port);
    }
  });

  // UI FIRST: Create window and tray immediately so user sees the app instantly
  createWindow();
  tray = createTray(() => mainWindow, engine, config);
  setupIpc(engine, discovery, config, () => mainWindow);

  // Relay engine and discovery events to renderer
  engine.on('status-changed', (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('status-update', status);
    }
  });

  engine.on('progress', (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('progress-update', progress);
    }
  });

  engine.on('pairing-request', (req) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('pairing-request', req);
    }
  });

  discovery.on('peers-changed', (peers) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('peers-update', peers);
    }
  });

  // Deferred startup of local network servers to unblock UI thread completely
  setImmediate(() => {
    engine?.start();
    discovery?.start();
  });

  // Delayed startup of UPnP and auto-updater to avoid network & CPU spikes during launch
  setTimeout(() => {
    setupAutoUpdater(() => mainWindow);

    upnp = new UpnpManager(config.apiPort || 8384);
    if (config.upnpEnabled !== false) {
      upnp.start().then((status) => {
        engine?.setUpnpStatus(status);
      });
      upnp.on('status', (status) => {
        engine?.setUpnpStatus(status);
      });
    }
  }, 3000);

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
  upnp?.stop();
  engine?.stop();
});

app.on('window-all-closed', () => {
  // Keep app running in background tray on all platforms
});
