import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StatusCard } from './components/StatusCard';
import { FolderSection } from './components/FolderSection';
import { DropZone } from './components/DropZone';
import { PairingModal } from './components/PairingModal';
import { SettingsModal } from './components/SettingsModal';
import { RecentTransfers } from './components/RecentTransfers';

declare global {
  interface Window {
    macdrop: {
      getConfig: () => Promise<any>;
      saveConfig: (config: any) => Promise<any>;
      selectFolder: () => Promise<string>;
      openFolder: () => Promise<boolean>;
      getStatus: () => Promise<any>;
      sendDroppedFiles: (filePaths: string[]) => Promise<any>;
      toggleAutostart: (enable: boolean) => Promise<boolean>;
      onStatusUpdate: (callback: (status: any) => void) => () => void;
      onProgressUpdate: (callback: (progress: any) => void) => () => void;
      platform: string;
    };
  }
}

export default function App() {
  const [config, setConfig] = useState<any>({
    targetFolder: 'E:\\MacDrop',
    autoStart: true,
    notifications: true,
    deviceId: 'PC-1001',
    deviceName: 'ПК Андрей'
  });

  const [status, setStatus] = useState<any>({
    isConnected: false,
    pairedDevice: undefined,
    currentProgress: null,
    recentHistory: []
  });

  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const platform = window.macdrop?.platform || 'win32';

  useEffect(() => {
    // Load initial configuration and status
    if (window.macdrop) {
      window.macdrop.getConfig().then((cfg) => {
        if (cfg) setConfig(cfg);
      });

      window.macdrop.getStatus().then((st) => {
        if (st) setStatus(st);
      });

      const unsubStatus = window.macdrop.onStatusUpdate((newStatus) => {
        setStatus((prev: any) => ({ ...prev, ...newStatus }));
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

  const handleSelectFolder = async () => {
    if (window.macdrop) {
      const newFolder = await window.macdrop.selectFolder();
      if (newFolder) {
        setConfig((prev: any) => ({ ...prev, targetFolder: newFolder }));
      }
    }
  };

  const handleOpenFolder = async () => {
    if (window.macdrop) {
      await window.macdrop.openFolder();
    }
  };

  const handleFilesDropped = async (paths: string[]) => {
    if (window.macdrop) {
      await window.macdrop.sendDroppedFiles(paths);
    }
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

  const handlePairWithCode = async (code: string): Promise<boolean> => {
    // In local demo / network pairing
    if (window.macdrop) {
      const updated = await window.macdrop.saveConfig({
        pairedDevice: {
          id: code,
          name: platform === 'darwin' ? 'Windows ПК' : 'MacBook',
          pairedAt: new Date().toISOString()
        }
      });
      setConfig(updated);
      setStatus((prev: any) => ({ ...prev, isConnected: true, pairedDevice: updated.pairedDevice }));
      return true;
    }
    return false;
  };

  const handleUnpairDevice = async () => {
    if (window.macdrop) {
      const updated = await window.macdrop.saveConfig({ pairedDevice: undefined });
      setConfig(updated);
      setStatus((prev: any) => ({ ...prev, isConnected: false, pairedDevice: undefined }));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#1c1c1e] text-white select-none">
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPairing={() => setIsPairingOpen(true)}
        platform={platform}
      />

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Status Card (Connected / Syncing) */}
        <StatusCard
          isConnected={status.isConnected || !!config.pairedDevice}
          pairedDevice={status.pairedDevice || config.pairedDevice}
          currentProgress={status.currentProgress}
          onOpenPairing={() => setIsPairingOpen(true)}
        />

        {/* Drag and Drop Zone */}
        <DropZone
          onFilesDropped={handleFilesDropped}
          targetFolder={config.targetFolder}
        />

        {/* Target Folder Selector */}
        <FolderSection
          targetFolder={config.targetFolder}
          onSelectFolder={handleSelectFolder}
          onOpenFolder={handleOpenFolder}
        />

        {/* Recent transfers list */}
        <RecentTransfers
          items={status.recentHistory || []}
          onOpenFile={handleOpenFolder}
        />
      </main>

      {/* Modals */}
      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        deviceId={config.deviceId}
        deviceName={config.deviceName}
        platform={platform}
        onPairWithCode={handlePairWithCode}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        autoStart={config.autoStart}
        notifications={config.notifications}
        pairedDevice={config.pairedDevice}
        onToggleAutoStart={handleToggleAutoStart}
        onToggleNotifications={handleToggleNotifications}
        onUnpairDevice={handleUnpairDevice}
        onSelectFolder={handleSelectFolder}
        targetFolder={config.targetFolder}
      />
    </div>
  );
}
