import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain, app } from 'electron';

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

  ipcMain.handle('install-update', () => {
    console.log('Quit and install update now...');
    autoUpdater.quitAndInstall(false, true);
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
