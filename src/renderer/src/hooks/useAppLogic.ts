import { useState, useEffect, useCallback, useMemo } from 'react';
import { PairedDevice } from '../components/DeviceDetailView';
import { PairingRequest } from '../components/PairingRequestModal';
import { SettingsTab } from '../components/SettingsModal';
import { UpdateStateInfo } from '../vite-env';

export function useAppLogic() {
  const [config, setConfig] = useState<any>({
    targetFolder: window.macdrop?.platform === 'darwin' ? '~/MacDrop' : 'MacDrop',
    autoStart: true,
    notifications: true,
    deviceId: 'DEVICE',
    deviceName: 'MacDrop',
    pairedDevices: []
  });

  const [status, setStatus] = useState<any>({
    isConnected: false,
    pairedDevices: [],
    currentProgress: null,
    recentHistory: []
  });

  const [selectedDevice, setSelectedDevice] = useState<PairedDevice | null>(null);
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [updateState, setUpdateState] = useState<UpdateStateInfo>({ status: 'idle' });

  const [discoveredPeers, setDiscoveredPeers] = useState<any[]>([]);
  const [incomingPairingRequest, setIncomingPairingRequest] = useState<PairingRequest | null>(null);
  const [activeTargetDeviceId, setActiveTargetDeviceId] = useState<string>(() => {
    try {
      return localStorage.getItem('macdrop_target_device_id') || '';
    } catch {
      return '';
    }
  });

  const platform = window.macdrop?.platform || 'win32';
  const devicesRaw = config.pairedDevices || status.pairedDevices || [];
  // Stabilize reference — only changes when actual device data changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const devices: PairedDevice[] = useMemo(() => devicesRaw, [JSON.stringify(devicesRaw)]);

  useEffect(() => {
    if (window.macdrop) {
      window.macdrop.getConfig().then((cfg) => {
        if (cfg) setConfig(cfg);
      });

      window.macdrop.getStatus().then((st) => {
        if (st) setStatus(st);
      });

      const unsubStatus = window.macdrop.onStatusUpdate((newStatus) => {
        setStatus((prev: any) => ({ ...prev, ...newStatus }));
        if (newStatus.pairedDevices) {
          setConfig((prev: any) => ({ ...prev, pairedDevices: newStatus.pairedDevices }));
          // Update selectedDevice if it's currently open
          setSelectedDevice((current) => {
            if (!current) return null;
            const updated = newStatus.pairedDevices.find((d: PairedDevice) => d.id === current.id);
            return updated || null;
          });
        }
      });

      const unsubProgress = window.macdrop.onProgressUpdate((progress) => {
        setStatus((prev: any) => ({ ...prev, currentProgress: progress }));
      });

      return () => {
        unsubStatus();
        unsubProgress();
      };
    }
  }, []);

  useEffect(() => {
    if (window.macdrop?.getDiscoveredPeers) {
      window.macdrop.getDiscoveredPeers().then((peers) => {
        if (peers) setDiscoveredPeers(peers);
      });
    }

    if (window.macdrop?.onPeersUpdate) {
      const unsubPeers = window.macdrop.onPeersUpdate((peers) => {
        setDiscoveredPeers(peers || []);
      });
      return unsubPeers;
    }
  }, []);

  // Listen for incoming pairing requests from other devices (Interactive security modal)
  useEffect(() => {
    if (window.macdrop?.onPairingRequest) {
      const unsubPairing = window.macdrop.onPairingRequest((req) => {
        setIncomingPairingRequest(req);
      });
      return unsubPairing;
    }
  }, []);

  // Listen for auto-updater events and status
  useEffect(() => {
    if (window.macdrop?.getUpdateStatus) {
      window.macdrop.getUpdateStatus().then((st) => {
        if (st) setUpdateState(st);
      }).catch(() => {});
    }

    const unsubStatus = window.macdrop?.onUpdateStatus?.((st) => {
      setUpdateState(st);
    });

    const unsubProgress = window.macdrop?.onUpdateProgress?.((prog) => {
      setUpdateState((prev) => ({
        ...prev,
        status: 'downloading',
        percent: prog.percent,
        transferred: prog.transferred,
        total: prog.total,
        bytesPerSecond: prog.bytesPerSecond
      }));
    });

    const unsubAvailable = window.macdrop?.onUpdateAvailable?.((ver) => {
      setUpdateState((prev) => ({
        ...prev,
        status: 'available',
        version: ver
      }));
    });

    const unsubDownloaded = window.macdrop?.onUpdateDownloaded?.((ver) => {
      setUpdateState({
        status: 'downloaded',
        version: ver,
        percent: 100
      });
    });

    return () => {
      unsubStatus?.();
      unsubProgress?.();
      unsubAvailable?.();
      unsubDownloaded?.();
    };
  }, []);

  // Ensure activeTargetDeviceId always points to a valid connected device if available
  useEffect(() => {
    if (devices.length > 0) {
      if (!activeTargetDeviceId || !devices.some((d) => d.id === activeTargetDeviceId)) {
        const fallbackId = devices[0].id;
        setActiveTargetDeviceId(fallbackId);
        try {
          localStorage.setItem('macdrop_target_device_id', fallbackId);
        } catch {}
      }
    }
  }, [devices, activeTargetDeviceId]);

  const handleRespondPairingRequest = useCallback(async (requestId: string, approved: boolean) => {
    if (window.macdrop?.respondPairingRequest) {
      await window.macdrop.respondPairingRequest(requestId, approved);
      setIncomingPairingRequest(null);
    }
  }, []);

  const handleSelectFolder = useCallback(async () => {
    if (window.macdrop) {
      const folder = await window.macdrop.selectFolder();
      if (folder) {
        const updated = await window.macdrop.saveConfig({ targetFolder: folder });
        setConfig(updated);
      }
    }
  }, []);

  const handleOpenFolder = useCallback(() => {
    if (window.macdrop) {
      window.macdrop.openFolder();
    }
  }, []);

  const handleFilesDropped = useCallback(async (filePaths: string[]) => {
    if (window.macdrop && filePaths.length > 0) {
      try {
        const targetId = activeTargetDeviceId || (devices.length > 0 ? devices[0].id : undefined);
        await window.macdrop.sendDroppedFiles(filePaths, targetId);
      } catch (err) {
        console.error('Failed to send dropped files:', err);
      }
    }
  }, [activeTargetDeviceId, devices]);

  const handleToggleAutoStart = useCallback(async (enable: boolean) => {
    if (window.macdrop) {
      await window.macdrop.toggleAutostart(enable);
      const updated = await window.macdrop.saveConfig({ autoStart: enable });
      setConfig(updated);
    }
  }, []);

  const handleToggleNotifications = useCallback(async (enable: boolean) => {
    if (window.macdrop) {
      const updated = await window.macdrop.saveConfig({ notifications: enable });
      setConfig(updated);
    }
  }, []);

  const handlePairWithCode = useCallback(async (code: string) => {
    if (window.macdrop) {
      const res = await window.macdrop.pairDevice(code);
      if (res.success && res.peer) {
        setConfig((prev: any) => {
          const current = prev.pairedDevices || [];
          const idx = current.findIndex((d: PairedDevice) => d.id === res.peer.id);
          const updated = idx >= 0
            ? current.map((d: PairedDevice) => (d.id === res.peer.id ? res.peer : d))
            : [...current, res.peer];
          return { ...prev, pairedDevices: updated };
        });
        return { success: true };
      }
      return { success: false, error: res.error || 'Failed to pair device' };
    }
    return { success: false, error: 'Bridge not available' };
  }, []);

  const handleUnpairDevice = useCallback(async (deviceId?: string) => {
    if (window.macdrop) {
      await window.macdrop.unpairDevice(deviceId);
      setConfig((prev: any) => {
        if (!deviceId) return { ...prev, pairedDevices: [] };
        return {
          ...prev,
          pairedDevices: (prev.pairedDevices || []).filter((d: PairedDevice) => d.id !== deviceId)
        };
      });
      if (!deviceId || selectedDevice?.id === deviceId) {
        setSelectedDevice(null);
      }
    }
  }, [selectedDevice]);

  const handleDeviceUpdated = useCallback((updated: PairedDevice) => {
    setConfig((prev: any) => {
      const currentList = prev.pairedDevices || [];
      const updatedList = currentList.map((d: PairedDevice) => (d.id === updated.id ? updated : d));
      return { ...prev, pairedDevices: updatedList };
    });
    setSelectedDevice(updated);
  }, []);

  const handleDeviceRemoved = useCallback((deviceId: string) => {
    setConfig((prev: any) => {
      const currentList = prev.pairedDevices || [];
      const updatedList = currentList.filter((d: PairedDevice) => d.id !== deviceId);
      return { ...prev, pairedDevices: updatedList };
    });
    setSelectedDevice((current) => current?.id === deviceId ? null : current);
  }, []);

  const handleQuickSend = useCallback(async (deviceId: string) => {
    if (window.macdrop?.pickAndSendFiles) {
      await window.macdrop.pickAndSendFiles(deviceId);
    }
  }, []);

  const handleOpenSettings = useCallback((tab: SettingsTab = 'general') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  }, []);

  const handleOpenPairing = useCallback(() => setIsPairingOpen(true), []);

  const handleCheckForUpdates = useCallback(async () => {
    if (window.macdrop?.checkForUpdates) {
      setUpdateState((prev) => ({ ...prev, status: 'checking', error: undefined }));
      await window.macdrop.checkForUpdates();
    }
  }, []);

  const handleInstallUpdate = useCallback(() => {
    if (window.macdrop?.installUpdate) {
      window.macdrop.installUpdate();
    }
  }, []);

  const setActiveTargetDeviceAndSave = useCallback((id: string) => {
    setActiveTargetDeviceId(id);
    try {
      localStorage.setItem('macdrop_target_device_id', id);
    } catch {}
  }, []);

  const handleChooseFiles = useCallback((targetId?: string) => {
    const effectiveTargetId =
      targetId ||
      activeTargetDeviceId ||
      (devices.length > 0 ? devices[0].id : undefined);
    window.macdrop?.pickAndSendFiles(effectiveTargetId);
  }, [activeTargetDeviceId, devices]);

  return {
    config,
    status,
    selectedDevice,
    setSelectedDevice,
    isPairingOpen,
    setIsPairingOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTab,
    setSettingsTab,
    updateState,
    discoveredPeers,
    incomingPairingRequest,
    activeTargetDeviceId,
    setActiveTargetDeviceAndSave,
    platform,
    devices,
    handleRespondPairingRequest,
    handleSelectFolder,
    handleOpenFolder,
    handleFilesDropped,
    handleToggleAutoStart,
    handleToggleNotifications,
    handlePairWithCode,
    handleUnpairDevice,
    handleDeviceUpdated,
    handleDeviceRemoved,
    handleQuickSend,
    handleOpenSettings,
    handleOpenPairing,
    handleChooseFiles,
    handleCheckForUpdates,
    handleInstallUpdate
  };
}
