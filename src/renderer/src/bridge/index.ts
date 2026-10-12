import type { MacDropApi, LogEntry, UpdateProgressInfo, UpdateStateInfo } from '../vite-env';

// Checks if running inside Tauri webview
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

// Check if running inside Electron
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.macdrop && !isTauri());
};

const DEFAULT_CONFIG = {
  deviceName: 'MacDrop Device',
  port: 52520,
  targetFolder: '',
  theme: 'dark',
  autoStart: false,
  discoveryMode: 'all',
  autoAcceptPaired: true,
  enableRemoteTransfer: true,
  upnpEnabled: true,
  pairedDevices: []
};

const DEFAULT_STATUS = {
  isDiscoverable: true,
  activeTransfers: 0,
  ip: '127.0.0.1',
  port: 52520,
  deviceName: 'MacDrop'
};

export async function initTauriBridge(): Promise<void> {
  // If already set by Electron preload, keep it
  if (window.macdrop && !isTauri()) {
    return;
  }

  let tauriCore: any = null;
  let tauriEvent: any = null;

  if (isTauri()) {
    try {
      tauriCore = await import('@tauri-apps/api/core');
      tauriEvent = await import('@tauri-apps/api/event');
    } catch (e) {
      console.warn('[Bridge] Tauri modules dynamic import failed:', e);
    }
  }

  const invokeTauri = async (cmd: string, args?: Record<string, any>, fallback?: any) => {
    if (tauriCore?.invoke) {
      try {
        return await tauriCore.invoke(cmd, args);
      } catch (err) {
        console.warn(`[Bridge] invoke('${cmd}') failed:`, err);
        return fallback;
      }
    }
    return fallback;
  };

  const bridgeApi: MacDropApi = {
    platform: typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac') ? 'darwin' : 'win32',
    version: '2.3.6',

    getConfig: async () => {
      const cfg = await invokeTauri('get_config', undefined, null);
      return cfg || DEFAULT_CONFIG;
    },

    saveConfig: async (config) => {
      return await invokeTauri('save_config', { config }, config);
    },

    selectFolder: async () => {
      return (await invokeTauri('select_folder', undefined, '')) || '';
    },

    openFolder: async () => {
      return (await invokeTauri('open_folder', undefined, true)) ?? true;
    },

    openFile: async (filename: string) => {
      return (await invokeTauri('open_file', { filename }, true)) ?? true;
    },

    getStatus: async () => {
      const status = await invokeTauri('get_status', undefined, null);
      return status || DEFAULT_STATUS;
    },

    getPathForFile: (file: any) => {
      return file?.path || file?.name || '';
    },

    sendDroppedFiles: async (filePaths, targetDeviceId) => {
      return await invokeTauri('send_dropped_files', { filePaths, targetDeviceId }, { success: true });
    },

    pickAndSendFiles: async (targetDeviceId) => {
      return await invokeTauri('pick_and_send_files', { targetDeviceId }, false);
    },

    pickAndSendFolder: async (targetDeviceId) => {
      return await invokeTauri('pick_and_send_folder', { targetDeviceId }, false);
    },

    cancelTransfer: async () => {
      return await invokeTauri('cancel_transfer', undefined, true);
    },

    respondPairingRequest: async (requestId, approved) => {
      return await invokeTauri('respond_pairing_request', { requestId, approved }, true);
    },

    onPairingRequest: (callback) => {
      if (tauriEvent?.listen) {
        let unlistenFn: (() => void) | null = null;
        tauriEvent.listen('pairing-request', (event: any) => callback(event.payload)).then((fn: any) => {
          unlistenFn = fn;
        });
        return () => { if (unlistenFn) unlistenFn(); };
      }
      return () => {};
    },

    updateDeviceName: async (deviceId, newName) => {
      return await invokeTauri('update_device_name', { deviceId, newName }, true);
    },

    removeDevice: async (deviceId) => {
      return await invokeTauri('remove_device', { deviceId }, true);
    },

    toggleDeviceReceive: async (deviceId, enabled) => {
      return await invokeTauri('toggle_device_receive', { deviceId, enabled }, true);
    },

    getDeviceHistory: async (deviceId) => {
      return (await invokeTauri('get_device_history', { deviceId }, [])) || [];
    },

    toggleAutostart: async (enable) => {
      return await invokeTauri('toggle_autostart', { enable }, true);
    },

    minimizeWindow: () => {
      invokeTauri('minimize_window');
    },

    maximizeWindow: () => {
      invokeTauri('maximize_window');
    },

    closeWindow: () => {
      invokeTauri('close_window');
    },

    resizeWindow: (width, height) => {
      invokeTauri('resize_window', { width, height });
    },

    startDragging: () => {
      invokeTauri('start_dragging');
    },

    pairDevice: async (input) => {
      return await invokeTauri('pair_device', { input }, { success: false, error: 'Not implemented' });
    },

    unpairDevice: async (deviceId) => {
      return await invokeTauri('unpair_device', { deviceId }, true);
    },

    getDiscoveredPeers: async () => {
      const raw = (await invokeTauri('get_discovered_peers', undefined, [])) || [];
      return (Array.isArray(raw) ? raw : []).map((p: any) => ({
        ...p,
        deviceId: p.deviceId || p.id || '',
        deviceName: p.deviceName || p.name || 'Устройство',
        id: p.id || p.deviceId || '',
        name: p.name || p.deviceName || 'Устройство',
      }));
    },

    scanNearbyPeers: async () => {
      const raw = (await invokeTauri('scan_nearby_peers', undefined, [])) || [];
      return (Array.isArray(raw) ? raw : []).map((p: any) => ({
        ...p,
        deviceId: p.deviceId || p.id || '',
        deviceName: p.deviceName || p.name || 'Устройство',
        id: p.id || p.deviceId || '',
        name: p.name || p.deviceName || 'Устройство',
      }));
    },

    onPeersUpdate: (callback) => {
      if (tauriEvent?.listen) {
        let unlistenFn: (() => void) | null = null;
        tauriEvent.listen('peers-update', (event: any) => {
          const raw = event.payload || [];
          const normalized = (Array.isArray(raw) ? raw : []).map((p: any) => ({
            ...p,
            deviceId: p.deviceId || p.id || '',
            deviceName: p.deviceName || p.name || 'Устройство',
            id: p.id || p.deviceId || '',
            name: p.name || p.deviceName || 'Устройство',
          }));
          callback(normalized);
        }).then((fn: any) => {
          unlistenFn = fn;
        });
        return () => { if (unlistenFn) unlistenFn(); };
      }
      return () => {};
    },

    onStatusUpdate: (callback) => {
      if (tauriEvent?.listen) {
        let unlistenFn: (() => void) | null = null;
        tauriEvent.listen('status-update', (event: any) => callback(event.payload)).then((fn: any) => {
          unlistenFn = fn;
        });
        return () => { if (unlistenFn) unlistenFn(); };
      }
      return () => {};
    },

    onProgressUpdate: (callback) => {
      if (tauriEvent?.listen) {
        let unlistenFn: (() => void) | null = null;
        tauriEvent.listen('progress-update', (event: any) => callback(event.payload)).then((fn: any) => {
          unlistenFn = fn;
        });
        return () => { if (unlistenFn) unlistenFn(); };
      }
      return () => {};
    },

    getUpnpStatus: async () => {
      return await invokeTauri('get_upnp_status', undefined, { enabled: false, active: false });
    },

    checkForUpdates: async () => {
      return await invokeTauri('check_for_updates', undefined, null);
    },

    installUpdate: async () => {
      await invokeTauri('install_update');
    },

    getUpdateStatus: async () => {
      return (await invokeTauri('get_update_status', undefined, { status: 'idle' })) || { status: 'idle' };
    },

    onUpdateAvailable: (callback) => {
      if (tauriEvent?.listen) {
        let unlistenFn: (() => void) | null = null;
        tauriEvent.listen('update-available', (event: any) => callback(event.payload)).then((fn: any) => {
          unlistenFn = fn;
        });
        return () => { if (unlistenFn) unlistenFn(); };
      }
      return () => {};
    },

    onUpdateDownloaded: (callback) => {
      if (tauriEvent?.listen) {
        let unlistenFn: (() => void) | null = null;
        tauriEvent.listen('update-downloaded', (event: any) => callback(event.payload)).then((fn: any) => {
          unlistenFn = fn;
        });
        return () => { if (unlistenFn) unlistenFn(); };
      }
      return () => {};
    },

    onUpdateStatus: (callback) => {
      if (tauriEvent?.listen) {
        let unlistenFn: (() => void) | null = null;
        tauriEvent.listen('update-status', (event: any) => callback(event.payload)).then((fn: any) => {
          unlistenFn = fn;
        });
        return () => { if (unlistenFn) unlistenFn(); };
      }
      return () => {};
    },

    onUpdateProgress: (callback) => {
      if (tauriEvent?.listen) {
        let unlistenFn: (() => void) | null = null;
        tauriEvent.listen('update-download-progress', (event: any) => callback(event.payload)).then((fn: any) => {
          unlistenFn = fn;
        });
        return () => { if (unlistenFn) unlistenFn(); };
      }
      return () => {};
    },

    getMobileShareInfo: async () => {
      return await invokeTauri('get_mobile_share_info', undefined, {
        ips: ['127.0.0.1'],
        port: 52520,
        token: 'temp-token',
        url: 'http://127.0.0.1:52520/share',
        computerName: 'MacDrop'
      });
    },

    regenerateMobileToken: async () => {
      return await invokeTauri('regenerate_mobile_token', undefined, {
        ips: ['127.0.0.1'],
        port: 52520,
        token: 'new-token',
        url: 'http://127.0.0.1:52520/share',
        computerName: 'MacDrop'
      });
    },

    getLogs: async () => {
      return (await invokeTauri('get_logs', undefined, [])) || [];
    },

    clearLogs: async () => {
      return await invokeTauri('clear_logs', undefined, true);
    },

    openLogsFolder: async () => {
      return await invokeTauri('open_logs_folder', undefined, true);
    },

    onLogEntry: (callback) => {
      if (tauriEvent?.listen) {
        let unlistenFn: (() => void) | null = null;
        tauriEvent.listen('new-log-entry', (event: any) => callback(event.payload)).then((fn: any) => {
          unlistenFn = fn;
        });
        return () => { if (unlistenFn) unlistenFn(); };
      }
      return () => {};
    },

    onLogsCleared: (callback) => {
      if (tauriEvent?.listen) {
        let unlistenFn: (() => void) | null = null;
        tauriEvent.listen('logs-cleared', () => callback()).then((fn: any) => {
          unlistenFn = fn;
        });
        return () => { if (unlistenFn) unlistenFn(); };
      }
      return () => {};
    }
  };

  window.macdrop = bridgeApi;
}

// Automatically initialize immediately on import
initTauriBridge();
