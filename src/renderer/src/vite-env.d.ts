/// <reference types="vite/client" />

export interface PairedDevice {
  id: string;
  originalName: string;
  customName: string;
  ip: string;
  port: number;
  remoteIp?: string;
  remotePort?: number;
  pairedAt: string;
  lastSeen?: number;
  receiveEnabled?: boolean;
  connectionMode?: 'local' | 'remote' | 'offline';
  authToken?: string;
}

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
  scanNearbyPeers: () => Promise<any[]>;
  onPeersUpdate: (callback: (peers: any[]) => void) => () => void;
  onStatusUpdate: (callback: (status: any) => void) => () => void;
  onProgressUpdate: (callback: (progress: any) => void) => () => void;
  platform: string;
  version: string;
  getUpnpStatus: () => Promise<any>;
  checkForUpdates: () => Promise<any>;
  installUpdate: () => Promise<void>;
  onUpdateAvailable: (callback: (version: string) => void) => () => void;
  onUpdateDownloaded: (callback: (version: string) => void) => () => void;
  cancelTransfer?: () => Promise<boolean>;
  respondPairingRequest?: (requestId: string, approved: boolean) => Promise<boolean>;
  onPairingRequest?: (callback: (request: { requestId: string; deviceId: string; deviceName: string; ip: string; port: number }) => void) => () => void;
}

declare global {
  interface Window {
    macdrop: MacDropApi;
  }
}
