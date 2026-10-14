import React, { useState, useEffect, useRef } from 'react';
import { X, Edit2 } from 'lucide-react';
import { PairedDevice } from '../../vite-env';
import { useTranslation } from '../../i18n';

interface DeviceRenameModalProps {
  isOpen: boolean;
  device: PairedDevice | null;
  onClose: () => void;
  onSave: (device: PairedDevice, newName: string) => Promise<void>;
}

export const DeviceRenameModal: React.FC<DeviceRenameModalProps> = ({
  isOpen,
  device,
  onClose,
  onSave
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && device) {
      setName(device.customName || device.originalName || '');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, device]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !device) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(device, trimmed);
      onClose();
    } catch (err) {
      console.error('Failed to rename device:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{ WebkitAppRegion: 'no-drag' } as any}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[#1c1c20]/80 backdrop-blur-2xl border border-white/10 rounded-[14px] w-full max-w-[360px] shadow-[0_24px_50px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.08)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-[40px] px-3.5 bg-white/[0.04] backdrop-blur-md border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#F2F2F7]">
            <Edit2 className="w-3.5 h-3.5 text-[#007AFF]" />
            <span>{t('devices.renameDevice')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t('common.close')}
            className="w-6 h-6 rounded-full bg-white/[0.05] hover:bg-white/[0.12] text-[#8E8E93] hover:text-[#FFFFFF] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-3.5 flex flex-col gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[#8E8E93]">
              {t('devices.enterNewDeviceName')}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={device.originalName}
              className="w-full h-8 px-2.5 bg-black/30 border border-white/[0.1] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/50 text-[13px] text-[#F2F2F7] rounded-[6px] outline-none transition-all"
            />
            {device.originalName && device.originalName !== name && (
              <p className="text-[10px] text-[#636366] truncate">
                {t('devices.immutableName')}: {device.originalName}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[12px] font-medium bg-white/[0.08] hover:bg-white/[0.14] text-[#D1D1D6] hover:text-white rounded-[6px] border border-white/[0.1] transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSaving}
              className="px-3 py-1.5 text-[12px] font-medium bg-[#007AFF] hover:bg-[#0071E3] disabled:opacity-50 text-white rounded-[6px] transition-colors cursor-pointer shadow-sm"
            >
              {isSaving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
