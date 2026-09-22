import { useState, useEffect, useCallback } from 'react';
import { PairedDevice } from '../components/DeviceDetailView';
import { PairingRequest } from '../components/PairingRequestModal';

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
  const devices: PairedDevice[] = config.pairedDevices || status.pairedDevices || [];

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

  const handleRespondPairingRequest = async (requestId: string, approved: boolean) => {
    if (window.macdrop?.respondPairingRequest) {
      await window.macdrop.respondPairingRequest(requestId, approved);
    }
    setIncomingPairingRequest(null);
  };

  const handleSelectFolder = useCallback(async () => {
    if (window.macdrop) {
      const newFolder = await window.macdrop.selectFolder();
      if (newFolder) {
        setConfig((prev: any) => ({ ...prev, targetFolder: newFolder }));
      }
    }
  }, []);

  const handleOpenFolder = useCallback(async () => {
    if (window.macdrop) {
      await window.macdrop.openFolder();
    }
  }, []);

  const handleFilesDropped = async (paths: string[], targetDeviceId?: string) => {
    if (window.macdrop) {
      const targetId =
        targetDeviceId ||
        selectedDevice?.id ||
        activeTargetDeviceId ||
        (devices.length > 0 ? devices[0].id : undefined);
      return await window.macdrop.sendDroppedFiles(paths, targetId);
    }
    return [];
  };

  const handleToggleAutoStart = async (enable: boolean) => {
    if (window.macdrop) {
      await window.macdrop.toggleAutostart(enable);
      setConfig((prev: any) => ({ ...prev, autoStart: enable }));
    }
  };

  const handleToggleNotifications = async (enable: boolean) => {
    if (window.macdrop) {
      const updated = await window.macdrop.saveConfig({ notifications: enable });
      setConfig(updated);
    }
  };

  const handlePairWithCode = async (target: string): Promise<{ success: boolean; error?: string }> => {
    if (window.macdrop?.pairDevice) {
      const res = await window.macdrop.pairDevice(target);
      if (res.success && res.peer) {
        const newPeer = res.peer;
        setConfig((prev: any) => {
          const currentList = prev.pairedDevices || [];
          const idx = currentList.findIndex((d: any) => d.id === newPeer.id);
          const updated = idx >= 0
            ? currentList.map((d: any) => d.id === newPeer.id ? newPeer : d)
            : [...currentList, newPeer];
          return { ...prev, pairedDevices: updated };
        });
        setStatus((prev: any) => ({
          ...prev,
          isConnected: true,
          pairedDevices: [...(prev.pairedDevices || []).filter((d: any) => d.id !== newPeer.id), newPeer]
        }));
        return { success: true };
      }
      return { success: false, error: res.error || 'Не удалось подключиться' };
    }
    return { success: false, error: 'API недоступен' };
  };

  const handleUnpairDevice = async (deviceId?: string) => {
    if (window.macdrop?.unpairDevice) {
      await window.macdrop.unpairDevice(deviceId);
      const targetId = deviceId || (devices.length > 0 ? devices[0].id : null);
      if (targetId) {
        handleDeviceRemoved(targetId);
      }
    }
  };

  const handleDeviceUpdated = (updated: PairedDevice) => {
    setConfig((prev: any) => {
      const currentList = prev.pairedDevices || [];
      const updatedList = currentList.map((d: PairedDevice) => (d.id === updated.id ? updated : d));
      return { ...prev, pairedDevices: updatedList };
    });
    setSelectedDevice(updated);
  };

  const handleDeviceRemoved = (deviceId: string) => {
    setConfig((prev: any) => {
      const currentList = prev.pairedDevices || [];
      const updatedList = currentList.filter((d: PairedDevice) => d.id !== deviceId);
      return { ...prev, pairedDevices: updatedList };
    });
    if (selectedDevice?.id === deviceId) {
      setSelectedDevice(null);
    }
  };

  const handleQuickSend = useCallback(async (deviceId: string) => {
    if (window.macdrop?.pickAndSendFiles) {
      await window.macdrop.pickAndSendFiles(deviceId);
    }
  }, []);

  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);
  const handleOpenPairing = useCallback(() => setIsPairingOpen(true), []);

  const setActiveTargetDeviceAndSave = (id: string) => {
    setActiveTargetDeviceId(id);
    try {
      localStorage.setItem('macdrop_target_device_id', id);
    } catch {}
  };

  const handleChooseFiles = (targetId?: string) => {
    const effectiveTargetId =
      targetId ||
      activeTargetDeviceId ||
      (devices.length > 0 ? devices[0].id : undefined);
    window.macdrop?.pickAndSendFiles(effectiveTargetId);
  };

  return {
    config,
    status,
    selectedDevice,
    setSelectedDevice,
    isPairingOpen,
    setIsPairingOpen,
    isSettingsOpen,
    setIsSettingsOpen,
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
    handleChooseFiles
  };
}
