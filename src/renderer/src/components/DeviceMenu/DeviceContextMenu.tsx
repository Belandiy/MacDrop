import React, { useEffect, useRef } from 'react';
import {
  History,
  Edit2,
  Check,
  Ban,
  Unlink
} from 'lucide-react';
import { PairedDevice } from '../../vite-env';
import { useTranslation } from '../../i18n';

interface DeviceContextMenuProps {
  device: PairedDevice;
  position: { x: number; y: number };
  onClose: () => void;
  onOpenHistory: (device: PairedDevice) => void;
  onOpenRename: (device: PairedDevice) => void;
  onToggleReceive: (device: PairedDevice) => void;
  onOpenUnpair: (device: PairedDevice) => void;
}

export const DeviceContextMenu: React.FC<DeviceContextMenuProps> = ({
  device,
  position,
  onClose,
  onOpenHistory,
  onOpenRename,
  onToggleReceive,
  onOpenUnpair
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  const isReceiveEnabled = device.receiveEnabled !== false;

  // Click outside and Escape key listeners
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to stay inside viewport
  const menuWidth = 220;
  const menuHeight = 170;
  const left = Math.min(position.x, window.innerWidth - menuWidth - 10);
  const top = Math.min(position.y, window.innerHeight - menuHeight - 10);

  return (
    <div
      style={{
        position: 'fixed',
        left: `${Math.max(10, left)}px`,
        top: `${Math.max(10, top)}px`,
        zIndex: 9999
      }}
      ref={menuRef}
      className="w-[210px] bg-[#232326]/95 backdrop-blur-xl border border-[#3A3A3C] rounded-[8px] p-1 shadow-[0_12px_30px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.08)] select-none text-[#F2F2F7] animate-in fade-in duration-100"
    >
      {/* Device Name Header */}
      <div className="px-2.5 py-1.5 text-[11px] font-semibold text-[#8E8E93] truncate border-b border-[#2C2C2E] mb-1">
        {device.customName || device.originalName}
      </div>

      {/* 1. History Log */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenHistory(device);
        }}
        className="w-full h-7 px-2 rounded-[5px] flex items-center gap-2 text-[12px] text-[#E5E5EA] hover:bg-[#007AFF] hover:text-white transition-colors cursor-pointer group text-left"
      >
        <History className="w-3.5 h-3.5 text-[#8E8E93] group-hover:text-white shrink-0" />
        <span className="truncate">{t('devices.transferLog')}</span>
      </button>

      {/* 2. Rename Device */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenRename(device);
        }}
        className="w-full h-7 px-2 rounded-[5px] flex items-center gap-2 text-[12px] text-[#E5E5EA] hover:bg-[#007AFF] hover:text-white transition-colors cursor-pointer group text-left"
      >
        <Edit2 className="w-3.5 h-3.5 text-[#8E8E93] group-hover:text-white shrink-0" />
        <span className="truncate">{t('devices.rename')}</span>
      </button>

      {/* 3. Toggle Receive Files */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onToggleReceive(device);
        }}
        className="w-full h-7 px-2 rounded-[5px] flex items-center justify-between text-[12px] text-[#E5E5EA] hover:bg-[#007AFF] hover:text-white transition-colors cursor-pointer group text-left"
      >
        <span className="flex items-center gap-2 truncate">
          {isReceiveEnabled ? (
            <Check className="w-3.5 h-3.5 text-[#34C759] group-hover:text-white shrink-0" />
          ) : (
            <Ban className="w-3.5 h-3.5 text-[#FF9500] group-hover:text-white shrink-0" />
          )}
          <span className="truncate">{t('devices.receiveFiles')}</span>
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
            isReceiveEnabled
              ? 'bg-[#34C759]/20 text-[#34C759] group-hover:bg-white/20 group-hover:text-white'
              : 'bg-[#FF9500]/20 text-[#FF9500] group-hover:bg-white/20 group-hover:text-white'
          }`}
        >
          {isReceiveEnabled ? t('devices.on') : t('devices.off')}
        </span>
      </button>

      {/* Divider */}
      <div className="h-[1px] bg-[#3A3A3C] my-1 mx-1" />

      {/* 4. Unpair Device */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenUnpair(device);
        }}
        className="w-full h-7 px-2 rounded-[5px] flex items-center gap-2 text-[12px] text-[#FF453A] hover:bg-[#FF453A] hover:text-white transition-colors cursor-pointer group text-left"
      >
        <Unlink className="w-3.5 h-3.5 text-[#FF453A] group-hover:text-white shrink-0" />
        <span className="truncate">{t('devices.unlink')}</span>
      </button>
    </div>
  );
};
