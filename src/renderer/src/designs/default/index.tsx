import React from 'react';
import { Header } from '../../components/Header';
import { DeviceList } from '../../components/DeviceList';
import { DeviceDetailView } from '../../components/DeviceDetailView';
import { FolderSection } from '../../components/FolderSection';
import { DropZone } from '../../components/DropZone';
import { RecentTransfers } from '../../components/RecentTransfers';
import { DesignProps } from '../types';

export const name = 'Default (Vertical)';
export const windowSize = { width: 440, height: 660 };

export default function DefaultDesign(props: DesignProps) {
  const {
    config,
    status,
    selectedDevice,
    setSelectedDevice,
    updateState,
    activeTargetDeviceId,
    setActiveTargetDeviceAndSave,
    platform,
    devices,
    handleSelectFolder,
    handleOpenFolder,
    handleFilesDropped,
    handleQuickSend,
    handleOpenSettings,
    handleOpenPairing,
    handleChooseFiles,
    handleInstallUpdate,
    handleDeviceUpdated,
    handleDeviceRemoved
  } = props;

  return (
    <div className="flex flex-col h-full bg-[#090a0f] text-slate-100 select-none antialiased">
      <Header
        onOpenSettings={handleOpenSettings}
        onOpenPairing={handleOpenPairing}
        platform={platform}
        updateState={updateState}
        onInstallUpdate={handleInstallUpdate}
      />

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
        {selectedDevice ? (
          <DeviceDetailView
            device={selectedDevice}
            onBack={() => setSelectedDevice(null)}
            onDeviceUpdated={handleDeviceUpdated}
            onDeviceRemoved={handleDeviceRemoved}
            onOpenFile={handleOpenFolder}
            currentProgress={status.currentProgress}
          />
        ) : (
          <>
            <DeviceList
              devices={devices}
              onSelectDevice={setSelectedDevice}
              onOpenPairing={handleOpenPairing}
              onQuickSend={handleQuickSend}
              currentProgress={status.currentProgress}
            />

            <DropZone
              onFilesDropped={handleFilesDropped}
              targetFolder={config.targetFolder}
              devices={devices}
              selectedDeviceId={activeTargetDeviceId}
              onSelectDevice={setActiveTargetDeviceAndSave}
              onOpenPairing={handleOpenPairing}
              onChooseFiles={handleChooseFiles}
            />

            <FolderSection
              targetFolder={config.targetFolder}
              onSelectFolder={handleSelectFolder}
              onOpenFolder={handleOpenFolder}
            />

            <RecentTransfers
              items={status.recentHistory || []}
              onOpenFile={handleOpenFolder}
            />
          </>
        )}
      </main>
    </div>
  );
}
