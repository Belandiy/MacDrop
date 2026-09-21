import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain, app, shell } from 'electron';

export function setupAutoUpdater(getMainWindow: () => BrowserWindow | null) {
  // In development, autoUpdater will log but not crash
  if (!app.isPackaged) {
    console.log('App is not packaged, autoUpdater is in dev mode.');
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    const win = getMainWindow();
    win?.webContents.send('update-available', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Current version is up to date:', info.version);
  });

  autoUpdater.on('error', (err) => {
    console.warn('AutoUpdater warning:', err?.message || err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`Download progress: ${Math.round(progressObj.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    const win = getMainWindow();
    win?.webContents.send('update-downloaded', info.version);
  });

  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) return { inDev: true };
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('install-update', async () => {
    console.log('Quit and install update now...');

    if (process.platform === 'darwin') {
      try {
        // macOS unsigned apps cannot use autoUpdater.quitAndInstall() via zip/Squirrel reliably.
        // Instead, we open the latest release page so the user can download the DMG.
        console.log('macOS: Opening releases page for manual DMG download');
        await shell.openExternal('https://github.com/Belandiy/MacDrop/releases/latest');
        return;
      } catch (e) {
        console.error('Failed to open release page on macOS', e);
      }
    }

    // Set quitting flag so windows actually close instead of minimizing to tray
    (app as any).isQuitting = true;

    // Close all windows immediately
    BrowserWindow.getAllWindows().forEach((win) => {
      win.removeAllListeners('close');
      win.close();
    });

    // On Windows, giving it a tiny delay ensures file locks are released
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 300);
  });

  // Automatically check for updates 3.5 seconds after launch
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn('Initial update check failed:', err?.message || err);
      });
    }, 3500);
  }
}
