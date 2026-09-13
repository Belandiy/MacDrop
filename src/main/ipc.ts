import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import { SyncEngine } from './engine';
import { AppConfig, saveConfig } from './config';
import fs from 'fs';
import path from 'path';

export function setupIpc(engine: SyncEngine, config: AppConfig, getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle('get-config', () => {
    return config;
  });

  ipcMain.handle('save-config', (_, newConfig: Partial<AppConfig>) => {
    Object.assign(config, newConfig);
    saveConfig(config);
    engine.updateConfig(config);
    return config;
  });

  ipcMain.handle('select-folder', async () => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Выберите папку для MacDrop',
      defaultPath: config.targetFolder,
      properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      config.targetFolder = selectedPath;
      saveConfig(config);
      engine.updateConfig(config);
      return selectedPath;
    }
    return config.targetFolder;
  });

  ipcMain.handle('open-target-folder', () => {
    if (fs.existsSync(config.targetFolder)) {
      shell.openPath(config.targetFolder);
      return true;
    }
    return false;
  });

  ipcMain.handle('get-status', () => {
    return engine.getStatus();
  });

  ipcMain.handle('send-dropped-files', async (_, filePaths: string[]) => {
    // When files or entire folders are dropped into the UI, copy them recursively to target folder
    const results = [];
    for (const srcPath of filePaths) {
      if (fs.existsSync(srcPath)) {
        const destPath = path.join(config.targetFolder, path.basename(srcPath));
        try {
          fs.cpSync(srcPath, destPath, { recursive: true });
          results.push({ name: path.basename(srcPath), success: true });
        } catch (e: any) {
          results.push({ name: path.basename(srcPath), success: false, error: e.message });
        }
      }
    }
    return results;
  });

  ipcMain.handle('toggle-autostart', (_, enable: boolean) => {
    config.autoStart = enable;
    saveConfig(config);
    app.setLoginItemSettings({
      openAtLogin: enable,
      openAsHidden: true
    });
    return enable;
  });
}
