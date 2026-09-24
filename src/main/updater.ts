import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain, app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { execSync, spawn } from 'child_process';

export interface UpdateProgressInfo {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface UpdateStateInfo {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';
  version?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  error?: string;
}

let currentState: UpdateStateInfo = {
  status: 'idle'
};

let downloadedZipPath: string | null = null;
let downloadedUpdateVersion: string | null = null;

function broadcastState(getMainWindow: () => BrowserWindow | null) {
  const win = getMainWindow();
  win?.webContents.send('update-status', currentState);
}

function broadcastProgress(getMainWindow: () => BrowserWindow | null, progress: UpdateProgressInfo) {
  const win = getMainWindow();
  win?.webContents.send('update-download-progress', progress);
}

function findDownloadedMacZip(version?: string): string | null {
  if (downloadedZipPath && fs.existsSync(downloadedZipPath)) {
    return downloadedZipPath;
  }

  const helperFile = (autoUpdater as any).downloadedUpdateHelper?.file;
  if (helperFile && fs.existsSync(helperFile)) {
    return helperFile;
  }

  const possibleDirs = [
    (autoUpdater as any).downloadedUpdateHelper?.cacheDir,
    path.join(app.getPath('home'), 'Library/Caches/macdrop-updater'),
    path.join(app.getPath('userData'), '../macdrop-updater'),
    path.join(app.getPath('temp'), 'macdrop-updater')
  ].filter(Boolean) as string[];

  for (const dir of possibleDirs) {
    if (!fs.existsSync(dir)) continue;

    // Check direct update.zip
    const directZip = path.join(dir, 'update.zip');
    if (fs.existsSync(directZip)) {
      return directZip;
    }

    // Check pending directory
    const pendingDir = path.join(dir, 'pending');
    if (fs.existsSync(pendingDir)) {
      try {
        const files = fs.readdirSync(pendingDir);
        if (version) {
          const matching = files.find((f) => f.endsWith('.zip') && f.includes(version));
          if (matching) return path.join(pendingDir, matching);
        }
        const anyZip = files.find((f) => f.endsWith('.zip'));
        if (anyZip) return path.join(pendingDir, anyZip);
      } catch (e) {
        console.warn('Error reading pending updates dir:', e);
      }
    }
  }

  return null;
}

export function setupAutoUpdater(getMainWindow: () => BrowserWindow | null) {
  // In development, autoUpdater will log but not crash
  if (!app.isPackaged) {
    console.log('App is not packaged, autoUpdater is in dev mode.');
  }

  autoUpdater.autoDownload = true;
  // On macOS without signing, Squirrel.Mac fails with signature check if autoInstallOnAppQuit is true.
  // We handle in-place replacement manually for macOS.
  autoUpdater.autoInstallOnAppQuit = process.platform !== 'darwin';

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
    currentState = { status: 'checking' };
    broadcastState(getMainWindow);
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    currentState = {
      status: 'available',
      version: info.version,
      percent: 0
    };
    broadcastState(getMainWindow);
    const win = getMainWindow();
    win?.webContents.send('update-available', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Current version is up to date:', info.version);
    currentState = {
      status: 'not-available',
      version: info.version
    };
    broadcastState(getMainWindow);
  });

  autoUpdater.on('error', (err) => {
    console.warn('AutoUpdater warning:', err?.message || err);
    if (currentState.status === 'checking' || currentState.status === 'downloading') {
      currentState = {
        status: 'error',
        error: err?.message || String(err)
      };
      broadcastState(getMainWindow);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`Download progress: ${Math.round(progressObj.percent)}%`);
    currentState = {
      status: 'downloading',
      version: currentState.version,
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond
    };
    broadcastProgress(getMainWindow, {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond
    });
    broadcastState(getMainWindow);
  });

  autoUpdater.on('update-downloaded', (info: any) => {
    console.log('Update downloaded:', info?.version, info?.downloadedFile);
    downloadedUpdateVersion = info?.version || null;
    downloadedZipPath = info?.downloadedFile || (autoUpdater as any).downloadedUpdateHelper?.file || null;

    currentState = {
      status: 'downloaded',
      version: info?.version,
      percent: 100
    };
    broadcastState(getMainWindow);
    const win = getMainWindow();
    win?.webContents.send('update-downloaded', info?.version);
  });

  ipcMain.handle('get-update-status', () => {
    return currentState;
  });

  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) {
      console.log('check-for-updates: dev mode');
      return { inDev: true };
    }
    try {
      currentState = { status: 'checking' };
      broadcastState(getMainWindow);
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (e: any) {
      currentState = { status: 'error', error: e.message };
      broadcastState(getMainWindow);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('install-update', async () => {
    console.log('Quit and install update now...');

    if (process.platform === 'darwin') {
      try {
        if (!app.isPackaged) {
          console.log('In dev mode, skipping actual macOS app bundle replacement.');
          return { success: false, inDev: true };
        }

        const zipFile = findDownloadedMacZip(downloadedUpdateVersion || undefined);
        if (!zipFile || !fs.existsSync(zipFile)) {
          console.warn('Downloaded zip archive not found on disk, fallback to releases page');
          await shell.openExternal('https://github.com/Belandiy/MacDrop/releases/latest');
          return;
        }

        console.log(`Found downloaded update archive: ${zipFile}`);

        const currentExe = process.execPath;
        let currentAppBundle = path.resolve(currentExe, '../../..');

        if (currentAppBundle.startsWith('/Volumes/')) {
          console.log('App running from /Volumes, targeting /Applications/MacDrop.app');
          currentAppBundle = '/Applications/MacDrop.app';
        }

        if (!currentAppBundle.endsWith('.app')) {
          console.warn('Current app bundle path invalid:', currentAppBundle);
          await shell.openExternal('https://github.com/Belandiy/MacDrop/releases/latest');
          return;
        }

        console.log(`Target app bundle to update: ${currentAppBundle}`);

        const tempExtractDir = path.join(app.getPath('temp'), `macdrop-update-${Date.now()}`);
        fs.mkdirSync(tempExtractDir, { recursive: true });

        console.log(`Extracting ${zipFile} to ${tempExtractDir}...`);
        execSync(`/usr/bin/ditto -xk "${zipFile}" "${tempExtractDir}"`);

        const extractedEntries = fs.readdirSync(tempExtractDir);
        const appEntry = extractedEntries.find((e) => e.endsWith('.app'));
        if (!appEntry) {
          throw new Error('No .app bundle found inside downloaded zip');
        }

        const extractedAppPath = path.join(tempExtractDir, appEntry);
        console.log(`Extracted new app: ${extractedAppPath}`);

        try {
          execSync(`/usr/bin/xattr -cr "${extractedAppPath}"`);
        } catch (xErr) {
          console.warn('Warning removing xattr before move:', xErr);
        }

        let isWritable = true;
        try {
          if (fs.existsSync(currentAppBundle)) {
            fs.accessSync(currentAppBundle, fs.constants.W_OK);
          }
          fs.accessSync(path.dirname(currentAppBundle), fs.constants.W_OK);
        } catch {
          isWritable = false;
        }

        const currentPid = process.pid;
        const scriptPath = path.join(app.getPath('temp'), `macdrop-updater-${Date.now()}.sh`);

        let scriptContent = '';
        if (isWritable) {
          scriptContent = `#!/bin/bash
while kill -0 ${currentPid} 2>/dev/null; do
  sleep 0.2
done
sleep 0.5

rm -rf "${currentAppBundle}"
/usr/bin/ditto "${extractedAppPath}" "${currentAppBundle}"
/usr/bin/xattr -cr "${currentAppBundle}" 2>/dev/null
rm -rf "${tempExtractDir}"

open -n "${currentAppBundle}"
rm -f "${scriptPath}"
`;
        } else {
          const escapedDest = currentAppBundle.replace(/"/g, '\\"');
          const escapedSrc = extractedAppPath.replace(/"/g, '\\"');
          const escapedTemp = tempExtractDir.replace(/"/g, '\\"');
          const innerCmd = `rm -rf \\"${escapedDest}\\" && /usr/bin/ditto \\"${escapedSrc}\\" \\"${escapedDest}\\" && /usr/bin/xattr -cr \\"${escapedDest}\\" && rm -rf \\"${escapedTemp}\\" && open -n \\"${escapedDest}\\"`;
          scriptContent = `#!/bin/bash
while kill -0 ${currentPid} 2>/dev/null; do
  sleep 0.2
done
sleep 0.5

osascript -e 'do shell script "${innerCmd}" with administrator privileges'
rm -f "${scriptPath}"
`;
        }

        fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });

        console.log('Spawning update script and terminating current process...');
        const child = spawn('/bin/bash', [scriptPath], {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();

        (app as any).isQuitting = true;
        BrowserWindow.getAllWindows().forEach((win) => {
          win.removeAllListeners('close');
          win.close();
        });

        app.quit();
        setTimeout(() => {
          app.exit(0);
        }, 1000);
        return;
      } catch (e: any) {
        console.error('macOS in-place update failed, falling back to release page:', e);
        await shell.openExternal('https://github.com/Belandiy/MacDrop/releases/latest');
        return;
      }
    }

    // Windows update logic
    (app as any).isQuitting = true;
    BrowserWindow.getAllWindows().forEach((win) => {
      win.removeAllListeners('close');
      win.close();
    });

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
