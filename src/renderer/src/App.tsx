import React from 'react';
import { Header } from './components/Header';
import { DeviceList } from './components/DeviceList';
import { DeviceDetailView } from './components/DeviceDetailView';
import { FolderSection } from './components/FolderSection';
import { DropZone } from './components/DropZone';
import { PairingModal } from './components/PairingModal';
import { PairingRequestModal } from './components/PairingRequestModal';
import { SettingsModal } from './components/SettingsModal';
import { RecentTransfers } from './components/RecentTransfers';
import { useAppLogic } from './hooks/useAppLogic';

export default function App() {
  const {
    config,
    status,
    selectedDevice,
    setSelectedDevice,
    isPairingOpen,
    setIsPairingOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTab,
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
  } = useAppLogic();

  return (
    <div className="flex flex-col h-screen bg-[#090a0f] text-slate-100 select-none antialiased">
      <Header
        onOpenSettings={handleOpenSettings}
        onOpenPairing={handleOpenPairing}
        platform={platform}
        updateState={updateState}
        onInstallUpdate={handleInstallUpdate}
      />

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
        {selectedDevice ? (
          /* Device Detail Drill-Down View */
          <DeviceDetailView
            device={selectedDevice}
            onBack={() => setSelectedDevice(null)}
            onDeviceUpdated={handleDeviceUpdated}
            onDeviceRemoved={handleDeviceRemoved}
            onOpenFile={handleOpenFolder}
            currentProgress={status.currentProgress}
          />
        ) : (
          /* Main Dashboard */
          <>
            {/* Connected Devices List */}
            <DeviceList
              devices={devices}
              onSelectDevice={setSelectedDevice}
              onOpenPairing={handleOpenPairing}
              onQuickSend={handleQuickSend}
              currentProgress={status.currentProgress}
            />

            {/* Drag and Drop Zone */}
            <DropZone
              onFilesDropped={handleFilesDropped}
              targetFolder={config.targetFolder}
              devices={devices}
              selectedDeviceId={activeTargetDeviceId}
              onSelectDevice={setActiveTargetDeviceAndSave}
              onOpenPairing={handleOpenPairing}
              onChooseFiles={handleChooseFiles}
            />

            {/* Target Folder Selector */}
            <FolderSection
              targetFolder={config.targetFolder}
              onSelectFolder={handleSelectFolder}
              onOpenFolder={handleOpenFolder}
            />

            {/* Global Recent Transfers List */}
            <RecentTransfers
              items={status.recentHistory || []}
              onOpenFile={handleOpenFolder}
            />
          </>
        )}
      </main>

      {/* Modals rendered instantly without lazy load pause */}
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
