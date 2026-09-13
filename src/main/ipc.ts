import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import { SyncEngine } from './engine';
import { PeerDiscovery } from './discovery';
import { AppConfig, saveConfig } from './config';
import fs from 'fs';
import path from 'path';

export function setupIpc(
  engine: SyncEngine,
  discovery: PeerDiscovery,
  config: AppConfig,
  getMainWindow: () => BrowserWindow | null
) {
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

  ipcMain.handle('get-discovered-peers', () => {
    return discovery.getPeers();
  });

  // Pairing by Device Code OR direct IP
  ipcMain.handle('pair-device', async (_, input: string) => {
    const clean = input.trim();
    if (!clean) return { success: false, error: 'Введите код устройства или IP' };

    let targetIp = '';
    let targetPort = 8384;

    // 1. Check if device is in discovered peers map
    const peer = discovery.findPeer(clean);
    if (peer) {
      targetIp = peer.ip;
      targetPort = peer.port || 8384;
    } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(clean)) {
      // Direct IP:port input (e.g. 192.168.0.110 or 192.168.0.110:8384)
      const parts = clean.split(':');
      targetIp = parts[0];
      if (parts[1]) targetPort = parseInt(parts[1], 10);
    } else {
      // Broadcast discovery might take a couple seconds, try all discovered peers
      const allPeers = discovery.getPeers();
      if (allPeers.length === 1) {
        // Only one peer on LAN, connect directly
        targetIp = allPeers[0].ip;
        targetPort = allPeers[0].port;
      }
    }

    if (!targetIp) {
      return {
        success: false,
        error: `Устройство ${clean} не найдено в сети. Убедитесь, что оба компьютера включены и подключены к сети (можно также ввести IP напрямую).`
      };
    }

    console.log(`Connecting to peer at ${targetIp}:${targetPort}...`);
    const result = await engine.pairWithRemote(targetIp, targetPort);
    return result;
  });

  // Update device custom name
  ipcMain.handle('update-device-name', (_, arg1: any, arg2?: string) => {
    const deviceId = typeof arg1 === 'object' ? arg1.deviceId : arg1;
    const newName = typeof arg1 === 'object' ? arg1.newName : (arg2 || '');
    return engine.updateDeviceCustomName(deviceId, newName);
  });

  // Remove / unpair device
  ipcMain.handle('remove-device', (_, deviceId: string) => {
    return engine.removeDevice(deviceId);
  });

  ipcMain.handle('unpair-device', (_, deviceId?: string) => {
    if (deviceId) {
      return engine.removeDevice(deviceId);
    }
    if (config.pairedDevices.length > 0) {
      return engine.removeDevice(config.pairedDevices[0].id);
    }
    return false;
  });

  // Toggle receiving files from a device
  ipcMain.handle('toggle-device-receive', (_, arg1: any, arg2?: boolean) => {
    const deviceId = typeof arg1 === 'object' ? arg1.deviceId : arg1;
    const enabled = typeof arg1 === 'object' ? arg1.enabled : (arg2 !== false);
    return engine.toggleDeviceReceive(deviceId, enabled);
  });

  // Get transfer history for specific device
  ipcMain.handle('get-device-history', (_, deviceId: string) => {
    return engine.getHistoryForDevice(deviceId);
  });

  // Send dropped files (optionally to specific device)
  ipcMain.handle('send-dropped-files', async (_, payload: any, maybeTarget?: string) => {
    let filePaths: string[] = [];
    let targetDeviceId: string | undefined;

    if (Array.isArray(payload)) {
      filePaths = payload;
      targetDeviceId = maybeTarget;
    } else if (payload && Array.isArray(payload.filePaths)) {
      filePaths = payload.filePaths;
      targetDeviceId = payload.targetDeviceId;
    }

    const results = [];
    for (const srcPath of filePaths) {
      if (fs.existsSync(srcPath)) {
        try {
          const filename = path.basename(srcPath);
          await engine.sendItem(srcPath, targetDeviceId);

          const destPath = path.join(config.targetFolder, filename);
          if (path.resolve(srcPath) !== path.resolve(destPath)) {
            try {
              fs.cpSync(srcPath, destPath, { recursive: true });
            } catch {}
          }

          results.push({ name: filename, success: true });
        } catch (e: any) {
          console.error('Send error:', e);
          results.push({ name: path.basename(srcPath), success: false, error: e.message });
        }
      }
    }
    return results;
  });

  // Pick files dialog and send to device
  ipcMain.handle('pick-and-send-files', async (_, targetDeviceId?: string) => {
    const win = getMainWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: 'Выберите файлы для отправки',
      properties: ['openFile', 'openDirectory', 'multiSelections']
    });

    if (!res.canceled && res.filePaths.length > 0) {
      for (const p of res.filePaths) {
        await engine.sendItem(p, targetDeviceId);
      }
      return true;
    }
    return false;
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

  ipcMain.on('minimize-window', () => {
    const win = getMainWindow();
    win?.minimize();
  });

  ipcMain.on('close-window', () => {
    const win = getMainWindow();
    win?.hide();
  });
}
