import { Tray, Menu, nativeImage, BrowserWindow, app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { SyncEngine } from './engine';
import { AppConfig } from './config';

export function createTray(
  getMainWindow: () => BrowserWindow | null,
  engine: SyncEngine,
  config: AppConfig
): Tray {
  // Create a clean 16x16 native icon programmatically if file doesn't exist
  let icon: nativeImage;
  const iconPath = path.join(__dirname, '../public/tray-icon.png');

  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    // 16x16 default icon buffer (blue dot circle)
    const size = 16;
    const canvasBuffer = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - size / 2;
        const dy = y - size / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * size + x) * 4;
        if (dist <= size / 2 - 1) {
          // #007aff (Mac accent blue)
          canvasBuffer[idx] = 0x00;     // B
          canvasBuffer[idx + 1] = 0x7a; // G
          canvasBuffer[idx + 2] = 0xff; // R
          canvasBuffer[idx + 3] = 0xff; // A
        } else {
          canvasBuffer[idx + 3] = 0x00; // Transparent
        }
      }
    }
    icon = nativeImage.createFromBuffer(canvasBuffer, { width: size, height: size });
  }

  const tray = new Tray(icon);
  tray.setToolTip('MacDrop — быстрый обмен файлами');

  const updateMenu = () => {
    const status = engine.getStatus();
    const statusLabel = status.isConnected
      ? `🟢 Подключен: ${status.pairedDevice?.name || 'Устройство'}`
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
