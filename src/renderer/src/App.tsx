import React from 'react';
import { PairingModal } from './components/PairingModal';
import { PairingRequestModal } from './components/PairingRequestModal';
import { SettingsModal } from './components/SettingsModal';
import { useAppLogic } from './hooks/useAppLogic';
import { ClassicNativeDesign } from './designs';
import { LanguageProvider } from './i18n';

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
    handleSetLanguage,
    handlePairWithCode,
    handleUnpairDevice,
    handleCheckForUpdates,
    handleInstallUpdate
  } = appLogic;

  const isMac =
    platform === 'darwin' ||
    (typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent));

  return (
    <LanguageProvider
      language={config.language || 'ru'}
      onLanguageChange={handleSetLanguage}
    >
      <div
        className={`flex flex-col h-screen text-[#F2F2F7] select-none antialiased overflow-hidden ${
          isMac
            ? 'bg-transparent rounded-[14px] border border-white/[0.08] shadow-2xl'
            : 'bg-[#121318]/85 backdrop-blur-2xl rounded-none border-0 shadow-none'
        }`}
      >
        {/* Main Classic Native View */}
        <div className="flex-1 overflow-hidden relative">
          <ClassicNativeDesign {...appLogic} />
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
          language={config.language || 'ru'}
          onSetLanguage={handleSetLanguage}
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
    </LanguageProvider>
  );
}
