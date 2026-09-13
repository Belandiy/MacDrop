import { contextBridge, ipcRenderer, webUtils } from 'electron';

export interface MacDropApi {
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<any>;
  selectFolder: () => Promise<string>;
  openFolder: () => Promise<boolean>;
  getStatus: () => Promise<any>;
  getPathForFile: (file: any) => string;
  sendDroppedFiles: (filePaths: string[], targetDeviceId?: string) => Promise<any>;
  pickAndSendFiles: (targetDeviceId?: string) => Promise<boolean>;
  updateDeviceName: (deviceId: string, newName: string) => Promise<boolean>;
  removeDevice: (deviceId: string) => Promise<boolean>;
  toggleDeviceReceive: (deviceId: string, enabled: boolean) => Promise<boolean>;
  getDeviceHistory: (deviceId: string) => Promise<any[]>;
  toggleAutostart: (enable: boolean) => Promise<boolean>;
  minimizeWindow: () => void;
  closeWindow: () => void;
  pairDevice: (input: string) => Promise<{ success: boolean; peer?: any; error?: string }>;
  unpairDevice: (deviceId?: string) => Promise<boolean>;
  getDiscoveredPeers: () => Promise<any[]>;
  onPeersUpdate: (callback: (peers: any[]) => void) => () => void;
  onStatusUpdate: (callback: (status: any) => void) => () => void;
  onProgressUpdate: (callback: (progress: any) => void) => () => void;
  platform: string;
}

const api: MacDropApi = {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openFolder: () => ipcRenderer.invoke('open-target-folder'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  getPathForFile: (file: any) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
    } catch {}
    return file.path || '';
  },
  sendDroppedFiles: (filePaths, targetDeviceId) => ipcRenderer.invoke('send-dropped-files', { filePaths, targetDeviceId }),
  pickAndSendFiles: (targetDeviceId) => ipcRenderer.invoke('pick-and-send-files', targetDeviceId),
  updateDeviceName: (deviceId, newName) => ipcRenderer.invoke('update-device-name', { deviceId, newName }),
  removeDevice: (deviceId) => ipcRenderer.invoke('remove-device', deviceId),
  toggleDeviceReceive: (deviceId, enabled) => ipcRenderer.invoke('toggle-device-receive', { deviceId, enabled }),
  getDeviceHistory: (deviceId) => ipcRenderer.invoke('get-device-history', deviceId),
  toggleAutostart: (enable) => ipcRenderer.invoke('toggle-autostart', enable),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  pairDevice: (input) => ipcRenderer.invoke('pair-device', input),
  unpairDevice: (deviceId) => ipcRenderer.invoke('unpair-device', deviceId),
  getDiscoveredPeers: () => ipcRenderer.invoke('get-discovered-peers'),
  onPeersUpdate: (callback) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('peers-update', handler);
    return () => ipcRenderer.removeListener('peers-update', handler);
  },
  onStatusUpdate: (callback) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('status-update', handler);
    return () => ipcRenderer.removeListener('status-update', handler);
  },
  onProgressUpdate: (callback) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('progress-update', handler);
    return () => ipcRenderer.removeListener('progress-update', handler);
  },
  platform: process.platform
};

contextBridge.exposeInMainWorld('macdrop', api);
