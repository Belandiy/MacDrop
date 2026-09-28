import React from 'react';
import { Laptop, Monitor, Globe, WifiOff, CheckCircle2, Edit2, Check, X, Smartphone } from 'lucide-react';
import { PairedDevice } from '../DeviceDetailView';
import { useTranslation } from '../../i18n';

interface DeviceHeaderProps {
  device: PairedDevice;
  isMac: boolean;
  isEditingName: boolean;
  nameInput: string;
  setNameInput: (name: string) => void;
  handleSaveName: () => void;
  setIsEditingName: (isEditing: boolean) => void;
}

// ⚡ Bolt Performance Optimization:
// Wrapped in React.memo to prevent re-renders on high-frequency progress updates.
export const DeviceHeader: React.FC<DeviceHeaderProps> = React.memo(({
  device,
  isMac,
  isEditingName,
  nameInput,
  setNameInput,
  handleSaveName,
  setIsEditingName
}) => {
  const { t } = useTranslation();
  const isMobile = device.id === 'mobile-web';

  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center relative ${
          isMac ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
        }`}>
          {isMobile ? <Smartphone className="w-6 h-6" /> : isMac ? <Laptop className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
          {device.connectionMode === 'remote' ? (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#111319] bg-cyan-500 shadow-sm shadow-cyan-500/50 flex items-center justify-center" title={t('devices.remoteInternet')}>
              <Globe className="w-2.5 h-2.5 text-white" />
            </span>
          ) : device.connectionMode === 'offline' ? (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#111319] bg-slate-500 shadow-sm" title={t('devices.offline')} />
          ) : (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#111319] bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]" title={t('devices.wifi')} />
          )}
        </div>

        <div>
          {/* Editable Display Name */}
          {isEditingName ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                autoFocus
                className="bg-[#171a23] border border-indigo-500/60 rounded-lg px-2.5 py-1 text-sm font-semibold text-white focus:outline-none w-48 shadow-inner"
                placeholder={t('devices.primaryDisplayName')}
              />
              <button
                onClick={handleSaveName}
                title={t('devices.save')}
                className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setNameInput(device.customName || device.originalName);
                  setIsEditingName(false);
                }}
                title={t('devices.cancel')}
                className="p-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h2 className="text-base font-bold text-white">
                {device.customName || device.originalName}
              </h2>
              <button
                onClick={() => setIsEditingName(true)}
                title={t('devices.renameDevice')}
                className="text-slate-400 hover:text-white transition-colors p-1 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <p className="text-[11px] text-slate-400">{t('devices.primaryDisplayName')}</p>
        </div>
      </div>

      {device.connectionMode === 'remote' ? (
        <div className="flex items-center gap-1.5 bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 px-2.5 py-1 rounded-full text-[11px] font-semibold">
          <Globe className="w-3 h-3" />
          <span>{t('devices.remoteShort')}</span>
        </div>
      ) : device.connectionMode === 'offline' ? (
        <div className="flex items-center gap-1.5 bg-white/[0.05] text-slate-400 border border-white/[0.08] px-2.5 py-1 rounded-full text-[11px] font-medium">
          <WifiOff className="w-3 h-3" />
          <span>{t('devices.offline')}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 rounded-full text-[11px] font-semibold">
          <CheckCircle2 className="w-3 h-3" />
          <span>{t('devices.wifi')}</span>
        </div>
      )}
    </div>
  );
});
