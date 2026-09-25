import React, { useState, useEffect } from 'react';
import { PairingModal } from './components/PairingModal';
import { PairingRequestModal } from './components/PairingRequestModal';
import { SettingsModal } from './components/SettingsModal';
import { DevToolbar } from './components/DevToolbar';
import { useAppLogic } from './hooks/useAppLogic';
import { availableDesigns, getDesignById } from './designs';

export default function App() {
  const appLogic = useAppLogic();
  const {
    config,
    isPairingOpen,
    setIsPairingOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTab,
    updateState,
    discoveredPeers,
    incomingPairingRequest,
    platform,
    devices,
    handleRespondPairingRequest,
    handleSelectFolder,
    handleToggleAutoStart,
    handleToggleNotifications,
    handlePairWithCode,
    handleUnpairDevice,
    handleCheckForUpdates,
    handleInstallUpdate
  } = appLogic;

  // Active design selection with localStorage persistence
  const [activeDesignId, setActiveDesignId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('macdrop_active_design');
      if (saved && availableDesigns.some((d) => d.id === saved)) {
        return saved;
      }
    } catch {}
    return availableDesigns[0]?.id || 'default';
  });

  const handleSelectDesign = (id: string) => {
    setActiveDesignId(id);
    try {
      localStorage.setItem('macdrop_active_design', id);
    } catch {}
  };

  const currentDesign = getDesignById(activeDesignId);
  const ActiveDesignComponent = currentDesign.component;

  return (
    <div className="flex flex-col h-screen bg-[#090a0f] text-slate-100 select-none antialiased overflow-hidden">
      {/* Dev Mode Design Switcher Bar */}
      <DevToolbar
        currentDesignId={activeDesignId}
        onSelectDesign={handleSelectDesign}
      />

      {/* Active Design Viewport */}
      <div className="flex-1 overflow-hidden relative">
        <ActiveDesignComponent {...appLogic} />
      </div>

      {/* Global Shared Modals */}
      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        deviceId={config.deviceId}
        deviceName={config.deviceName}
        platform={platform}
        discoveredPeers={discoveredPeers}
        onPairWithCode={handlePairWithCode}
        pairedDevices={devices}
      />

      <PairingRequestModal
        request={incomingPairingRequest}
        onRespond={handleRespondPairingRequest}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        initialTab={settingsTab}
        onClose={() => setIsSettingsOpen(false)}
        autoStart={config.autoStart}
        notifications={config.notifications}
        pairedDevices={devices}
        onToggleAutoStart={handleToggleAutoStart}
        onToggleNotifications={handleToggleNotifications}
        onUnpairDevice={handleUnpairDevice}
        onSelectFolder={handleSelectFolder}
        targetFolder={config.targetFolder}
        updateState={updateState}
        onCheckForUpdates={handleCheckForUpdates}
        onInstallUpdate={handleInstallUpdate}
        platform={platform}
      />
    </div>
  );
}
