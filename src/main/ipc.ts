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

  ipcMain.handle('get-mobile-share-info', () => {
    return engine.getMobileShareInfo();
  });

  ipcMain.handle('regenerate-mobile-token', () => {
    engine.regenerateMobileSessionToken();
    return engine.getMobileShareInfo();
  });

  ipcMain.handle('get-upnp-status', () => {
    return engine.getUpnpStatus();
  });

  ipcMain.handle('get-discovered-peers', () => {
    return discovery.getPeers();
  });

  ipcMain.handle('scan-nearby-peers', async () => {
    return discovery.probeSubnetForDevice();
  });

  // Pairing by Device Code OR direct IP
  ipcMain.handle('pair-device', async (_, input: string) => {
    const clean = input.trim();
    if (!clean) return { success: false, error: 'Введите код устройства или IP' };

    let targetIp = '';
    let targetPort = 8384;

    // 1. Direct IP, Hostname, or Tailscale address (e.g. 192.168.0.110, 100.x.x.x, or hostname:8384)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(clean) || clean.includes(':') || clean.includes('.net') || clean.includes('.local') || clean.includes('.')) {
      const parts = clean.split(':');
      targetIp = parts[0];
      if (parts[1]) targetPort = parseInt(parts[1], 10);
    } else {
      // 2. Check if device is already in UDP discovery cache
      let peer = discovery.findPeer(clean);

      // 3. If not found in UDP cache, immediately trigger Fast Subnet Probe!
      if (!peer) {
        console.log(`Peer "${clean}" not in UDP cache. Scanning local subnet...`);
        const found = await discovery.probeSubnetForDevice(clean);
        peer = discovery.findPeer(clean);
        if (!peer && found && found.length > 0) {
          peer = found.find(p => {
            const pId = p.deviceId.toUpperCase();
            const q = clean.toUpperCase();
            return pId === q || pId.endsWith(`-${q}`) || pId.replace(/^(MAC|PC)-/, '') === q;
          }) || found[0];
        }
      }

      if (peer) {
        targetIp = peer.ip;
        targetPort = peer.port || 8384;
      }
    }

    if (!targetIp) {
      return {
        success: false,
        error: `Устройство ${clean} не найдено в сети. Убедитесь, что оба компьютера включены и подключены к одной сети (можно также ввести IP напрямую).`
      };
    }

    console.log(`Connecting to peer at ${targetIp}:${targetPort}...`);
    const result = await engine.pairWithRemote(targetIp, targetPort);
    return result;
  });

  // Respond to incoming pairing request (Approve / Reject)
  ipcMain.handle('respond-pairing-request', (_, arg: { requestId: string; approved: boolean }) => {
    return engine.respondPairingRequest(arg.requestId, arg.approved);
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
      properties: ['openFile', 'multiSelections']
    });

    if (!res.canceled && res.filePaths.length > 0) {
      for (const p of res.filePaths) {
        await engine.sendItem(p, targetDeviceId);
      }
      return true;
    }
    return false;
  });

  // Pick folder dialog and send to device (auto-zipped into .zip)
  ipcMain.handle('pick-and-send-folder', async (_, targetDeviceId?: string) => {
    const win = getMainWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: 'Выберите папку для отправки',
      properties: ['openDirectory']
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

  ipcMain.handle('cancel-transfer', () => {
    return engine.cancelActiveTransfer();
  });

  ipcMain.on('minimize-window', () => {
    const win = getMainWindow();
    win?.minimize();
  });

  ipcMain.on('maximize-window', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on('close-window', () => {
    const win = getMainWindow();
    win?.hide();
  });
}

