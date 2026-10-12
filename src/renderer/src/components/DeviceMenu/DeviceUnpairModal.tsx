import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Unlink } from 'lucide-react';
import { PairedDevice } from '../../vite-env';
import { useTranslation } from '../../i18n';

interface DeviceUnpairModalProps {
  isOpen: boolean;
  device: PairedDevice | null;
  onClose: () => void;
  onConfirm: (device: PairedDevice) => Promise<void>;
}

export const DeviceUnpairModal: React.FC<DeviceUnpairModalProps> = ({
  isOpen,
  device,
  onClose,
  onConfirm
}) => {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleUnpair = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(device);
      onClose();
    } catch (err) {
      console.error('Failed to unpair device:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const deviceName = device.customName || device.originalName;

  return (
    <div
      style={{ WebkitAppRegion: 'no-drag' } as any}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-[10px] w-full max-w-[360px] shadow-[0_20px_45px_rgba(0,0,0,0.65),0_0_0_1px_#333336] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-[38px] px-3.5 bg-[#252528] border-b border-[#2C2C2E] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#FF453A]">
            <Unlink className="w-3.5 h-3.5" />
            <span>{t('devices.unpairDeviceConfirmTitle')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t('common.close')}
            className="w-6 h-6 rounded-full hover:bg-[#3A3A3C] text-[#8E8E93] hover:text-[#FFFFFF] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#FF453A]/15 text-[#FF453A] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-[12px] text-[#D1D1D6] leading-relaxed">
              {t('devices.unpairDeviceConfirmDesc', { name: deviceName })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2A2A2C]">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-3 py-1 text-[12px] font-medium bg-[#2C2C2E] hover:bg-[#38383A] text-[#D1D1D6] hover:text-white rounded-[5px] border border-[#3A3A3C] transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleUnpair}
              disabled={isDeleting}
              className="px-3 py-1 text-[12px] font-medium bg-[#FF453A] hover:bg-[#D73329] disabled:opacity-50 text-white rounded-[5px] transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Unlink className="w-3 h-3" />
              <span>{isDeleting ? t('common.deleting') : t('devices.unlink')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
