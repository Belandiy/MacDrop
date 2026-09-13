import { Tray, Menu, nativeImage, BrowserWindow, app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { SyncEngine } from './engine';
import { AppConfig } from './config';

function getIconPath(): string {
  const candidates = [
    path.join(__dirname, '../dist/tray-icon.png'),
    path.join(__dirname, '../public/tray-icon.png'),
    path.join(app.getAppPath(), 'dist/tray-icon.png'),
    path.join(app.getAppPath(), 'public/tray-icon.png'),
    path.join(process.resourcesPath, 'tray-icon.png')
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return p;
      }
    } catch {}
  }
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
