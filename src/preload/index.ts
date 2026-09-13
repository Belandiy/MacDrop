import { contextBridge, ipcRenderer } from 'electron';

export interface MacDropApi {
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<any>;
  selectFolder: () => Promise<string>;
  openFolder: () => Promise<boolean>;
  getStatus: () => Promise<any>;
  sendDroppedFiles: (filePaths: string[]) => Promise<any>;
  toggleAutostart: (enable: boolean) => Promise<boolean>;
  minimizeWindow: () => void;
  closeWindow: () => void;
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
  sendDroppedFiles: (filePaths) => ipcRenderer.invoke('send-dropped-files', filePaths),
  toggleAutostart: (enable) => ipcRenderer.invoke('toggle-autostart', enable),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
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
