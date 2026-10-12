import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  FolderOpen,
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { PairedDevice } from '../../vite-env';
import { WindowsLogoIcon, MacDesktopIcon, MacLaptopIcon } from '../PairingModal';
import { useTranslation } from '../../i18n';

interface TransferItem {
  id: string;
  filename: string;
  size: number;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  status: 'completed' | 'failed';
  peerDeviceId?: string;
  peerName?: string;
}

interface DeviceHistoryModalProps {
  isOpen: boolean;
  device: PairedDevice | null;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const DeviceHistoryModal: React.FC<DeviceHistoryModalProps> = ({
  isOpen,
  device,
  onClose
}) => {
  const { t } = useTranslation();
  const [history, setHistory] = useState<TransferItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [isLoading, setIsLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!device || !window.macdrop?.getDeviceHistory) return;
    setIsLoading(true);
    try {
      const items = await window.macdrop.getDeviceHistory(device.id);
      if (items) {
        setHistory(items);
      }
    } catch (err) {
      console.error('Failed to load device history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [device]);

  useEffect(() => {
    if (isOpen && device) {
      loadHistory();
    }
  }, [isOpen, device, loadHistory]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !device) return null;

  const nameLower = (device.customName || device.originalName || '').toLowerCase();
  const isWindows =
    device.platform === 'win32' ||
    nameLower.startsWith('desktop-') ||
    nameLower.startsWith('win-') ||
    nameLower.startsWith('laptop-') ||
    nameLower.includes('pc') ||
    nameLower.includes('windows');
  const isLaptop =
    nameLower.includes('air') ||
    nameLower.includes('book') ||
    nameLower.includes('laptop') ||
    nameLower.includes('notebook');

  const filteredHistory = history.filter((item) => {
    if (filter === 'incoming') return item.direction === 'incoming';
    if (filter === 'outgoing') return item.direction === 'outgoing';
    return true;
  });

  const handleOpenFile = (filename: string) => {
    if (window.macdrop?.openFile) {
      window.macdrop.openFile(filename);
    } else if (window.macdrop?.openFolder) {
      window.macdrop.openFolder();
    }
  };

  const timeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return t('history.justNow');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t('history.minAgo', { min: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('history.hrAgo', { hr: hours });
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div
      style={{ WebkitAppRegion: 'no-drag' } as any}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-[10px] w-full max-w-[500px] max-h-[420px] shadow-[0_20px_45px_rgba(0,0,0,0.65),0_0_0_1px_#333336] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-[42px] px-3.5 bg-[#252528] border-b border-[#2C2C2E] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 flex items-center justify-center text-[#8E8E93]">
              {isWindows ? (
                <WindowsLogoIcon className="w-3.5 h-3.5 text-[#007AFF]" />
              ) : isLaptop ? (
                <MacLaptopIcon className="w-4 h-4 text-[#007AFF]" />
              ) : (
                <MacDesktopIcon className="w-4 h-4 text-[#007AFF]" />
              )}
            </span>
            <span className="text-[13px] font-semibold text-[#F2F2F7] truncate">
              {device.customName || device.originalName}
            </span>
            <span className="text-[11px] text-[#8E8E93] shrink-0">
              — {t('devices.transferLog')}
            </span>
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

        {/* Sub-toolbar: Segmented Filter & Count */}
        <div className="px-3.5 py-2 bg-[#202022] border-b border-[#2A2A2C] flex items-center justify-between">
          <div className="inline-flex p-0.5 rounded-[5px] bg-[#161616] border border-[#2C2C2E] text-[11px]">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-0.5 rounded-[3px] font-medium transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-[#3A3A3E] text-white shadow-sm'
                  : 'text-[#8E8E93] hover:text-[#E5E5EA]'
              }`}
            >
              {t('transfers.all')} ({history.length})
            </button>
            <button
              onClick={() => setFilter('incoming')}
              className={`px-2 py-0.5 rounded-[3px] font-medium transition-colors cursor-pointer ${
                filter === 'incoming'
                  ? 'bg-[#3A3A3E] text-white shadow-sm'
                  : 'text-[#8E8E93] hover:text-[#E5E5EA]'
              }`}
            >
              {t('devices.incoming')}
            </button>
            <button
              onClick={() => setFilter('outgoing')}
              className={`px-2 py-0.5 rounded-[3px] font-medium transition-colors cursor-pointer ${
                filter === 'outgoing'
                  ? 'bg-[#3A3A3E] text-white shadow-sm'
                  : 'text-[#8E8E93] hover:text-[#E5E5EA]'
              }`}
            >
              {t('devices.outgoing')}
            </button>
          </div>

          <button
            onClick={() => window.macdrop?.openFolder?.()}
            className="text-[11px] text-[#007AFF] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <FolderOpen className="w-3 h-3" />
            <span>{t('folder.openFolder')}</span>
          </button>
        </div>

        {/* History List Content */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[200px] max-h-[280px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-[12px] text-[#8E8E93]">
              {t('common.loading')}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-[#8E8E93] space-y-2">
              <History className="w-8 h-8 text-[#545458] stroke-[1.5]" />
              <p className="text-[12px] font-medium text-[#AEAEB2]">
                {t('devices.emptyHistoryWithDevice')}
              </p>
              <p className="text-[11px] text-[#636366] max-w-[320px]">
                {t('devices.dragFilesHereOrSend')}
              </p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const isIncoming = item.direction === 'incoming';
              const isFailed = item.status === 'failed';

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenFile(item.filename)}
                  className="flex items-center justify-between p-2 rounded-[6px] hover:bg-[#28282A] border border-transparent hover:border-[#38383A] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    {/* Direction Icon Badge */}
                    <div
                      className={`w-6 h-6 rounded-[5px] flex items-center justify-center shrink-0 ${
                        isIncoming
                          ? 'bg-[#34C759]/15 text-[#34C759]'
                          : 'bg-[#007AFF]/15 text-[#007AFF]'
                      }`}
                    >
                      {isIncoming ? (
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-[#F2F2F7] group-hover:text-[#007AFF] truncate transition-colors">
                        {item.filename}
                      </div>
                      <div className="text-[10px] text-[#8E8E93] flex items-center gap-1.5 font-mono">
                        <span>{isIncoming ? t('devices.incoming') : t('devices.outgoing')}</span>
                        <span>•</span>
                        <span>{formatBytes(item.size)}</span>
                        <span>•</span>
                        <span>{timeAgo(item.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isFailed ? (
                      <span className="flex items-center gap-1 text-[10px] text-[#FF453A]">
                        <AlertCircle className="w-3 h-3" />
                        <span>{t('history.failed')}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-[#34C759]">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{t('history.completed')}</span>
                      </span>
                    )}

                    <span
                      title={t('devices.showInFolder')}
                      className="text-[#8E8E93] group-hover:text-white transition-colors p-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
