import { Tray, Menu, nativeImage, BrowserWindow, app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { SyncEngine } from './engine';
import { AppConfig } from './config';

let cachedTrayIconPath: string | null = null;

function getIconPath(): string {
  if (cachedTrayIconPath !== null) return cachedTrayIconPath;
  const isMac = process.platform === 'darwin';
  const specificName = isMac ? 'tray-icon-mac.png' : 'tray-icon-win.png';
  const defaultName = 'tray-icon.png';

  const candidates = [
    path.join(process.resourcesPath, specificName),
    path.join(__dirname, '../dist', specificName),
    path.join(__dirname, '../public', specificName),
    path.join(app.getAppPath(), 'dist', specificName),
    path.join(app.getAppPath(), 'public', specificName),
    path.join(process.resourcesPath, defaultName),
    path.join(__dirname, '../dist', defaultName),
    path.join(__dirname, '../public', defaultName)
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        cachedTrayIconPath = p;
        return p;
      }
    } catch {}
  }
  cachedTrayIconPath = '';
  return '';
}

export function createTray(
  getMainWindow: () => BrowserWindow | null,
  engine: SyncEngine,
  config: AppConfig
): Tray {
  let icon: Electron.NativeImage;
  const iconPath = getIconPath();

  if (iconPath) {
    icon = nativeImage.createFromPath(iconPath);
    if (process.platform === 'darwin') {
      icon = icon.resize({ width: 18, height: 18 });
      icon.setTemplateImage(true);
    } else {
      icon = icon.resize({ width: 16, height: 16 });
    }
  } else {
    // Fallback icon
    icon = nativeImage.createEmpty();
  }

  const tray = new Tray(icon);
  tray.setToolTip('MacDrop — быстрый обмен файлами');

  const updateMenu = () => {
    const status = engine.getStatus();
    const devices = status.pairedDevices || [];
    const statusLabel = devices.length > 0
      ? `🟢 Подключено (${devices.length}): ${devices[0].customName || devices[0].originalName}`
      : '⚪ Ожидание подключения...';

    const contextMenu = Menu.buildFromTemplate([
      { label: 'MacDrop', enabled: false },
      { label: statusLabel, enabled: false },
      { type: 'separator' },
      {
        label: `📂 Открыть папку (${path.basename(config.targetFolder)})`,
        click: () => {
          shell.openPath(config.targetFolder);
        }
      },
      {
        label: '🖥️ Показать окно MacDrop',
        click: () => {
          const win = getMainWindow();
          if (win) {
            win.show();
            win.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: '❌ Выход',
        click: () => {
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
  };

  updateMenu();
  engine.on('status-changed', updateMenu);

  // Left click on tray toggles the popup window
  tray.on('click', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
        win.focus();
      }
    }
  });

  return tray;
}
