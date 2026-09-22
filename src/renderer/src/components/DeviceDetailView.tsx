import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  Ban,
  AlertCircle
} from 'lucide-react';
import { useSmoothProgress } from '../hooks/useSmoothProgress';

import {
  DeviceHeader,
  DeviceAttributesGrid,
  DeviceReceiveToggle,
  DeviceActionButtons,
  ActiveTransferProgress,
  TransferHistoryLog
} from './DeviceDetail';


export interface PairedDevice {
  id: string;
  originalName: string;
  customName: string;
  ip: string;
  port: number;
  remoteIp?: string;
  remotePort?: number;
  pairedAt: string;
  lastSeen?: number;
  receiveEnabled?: boolean;
  connectionMode?: 'local' | 'remote' | 'offline';
  authToken?: string;
}

export interface TransferItem {
  id: string;
  filename: string;
  size: number;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  status: 'completed' | 'failed';
  peerDeviceId?: string;
  peerName?: string;
}

interface DeviceDetailViewProps {
  device: PairedDevice;
  onBack: () => void;
  onDeviceUpdated: (device: PairedDevice) => void;
  onDeviceRemoved: (deviceId: string) => void;
  onOpenFile: (filename: string) => void;
  currentProgress?: any;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatSpeed(bps: number): string {
  return `${formatBytes(bps)}/с`;
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'только что';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return new Date(timestamp).toLocaleDateString();
}

export const DeviceDetailView: React.FC<DeviceDetailViewProps> = ({
  device,
  onBack,
  onDeviceUpdated,
  onDeviceRemoved,
  onOpenFile,
  currentProgress
}) => {
  const { progress, isVisible, isCompleted } = useSmoothProgress(currentProgress, 800);

  const isBatch = Boolean(progress?.totalCount && progress.totalCount > 1);
  const percent = isCompleted
    ? 100
    : isBatch && progress?.batchTotalBytes && progress.batchTotalBytes > 0
    ? Math.min(100, Math.round(((progress.batchBytesTransferred || 0) / progress.batchTotalBytes) * 100))
    : progress && progress.totalBytes > 0
    ? Math.min(100, Math.round((progress.bytesTransferred / progress.totalBytes) * 100))
    : 0;

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(device.customName || device.originalName);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [history, setHistory] = useState<TransferItem[]>([]);
  const [copiedId, setCopiedId] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [sendNotice, setSendNotice] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const isMac = device.id.startsWith('MAC') || device.originalName.toLowerCase().includes('mac');

  // Load device-specific history
  const loadHistory = async () => {
    if (window.macdrop?.getDeviceHistory) {
      try {
        const items = await window.macdrop.getDeviceHistory(device.id);
        if (items) setHistory(items);
      } catch (err) {
        console.error('Failed to load device history:', err);
      }
    }
  };

  useEffect(() => {
    setNameInput(device.customName || device.originalName);
    loadHistory();
  }, [device.id, device.customName]);

  // Periodically refresh device history or when progress finishes
  useEffect(() => {
    if (!currentProgress) {
      loadHistory();
    }
  }, [currentProgress]);

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    if (window.macdrop?.updateDeviceName) {
      await window.macdrop.updateDeviceName(device.id, trimmed);
      const updated = { ...device, customName: trimmed };
      onDeviceUpdated(updated);
      setIsEditingName(false);
    }
  };

  const handleDeleteDevice = async () => {
    if (device.id === 'mobile-web') {
      onBack(); // Just go back, can't delete virtual device
      return;
    }
    if (window.macdrop?.removeDevice) {
      await window.macdrop.removeDevice(device.id);
      onDeviceRemoved(device.id);
      onBack();
    }
  };

  const isReceiveEnabled = device.receiveEnabled !== false;

  const handleToggleReceive = async (enabled: boolean) => {
    if (window.macdrop?.toggleDeviceReceive) {
      await window.macdrop.toggleDeviceReceive(device.id, enabled);
      const updated = { ...device, receiveEnabled: enabled };
      onDeviceUpdated(updated);
    }
  };

  const handlePickAndSend = async () => {
    if (window.macdrop?.pickAndSendFiles) {
      setIsSending(true);
      setSendNotice(null);
      try {
        await window.macdrop.pickAndSendFiles(device.id);
        await loadHistory();
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('отключил приём') || msg.includes('выключен приём') || msg.includes('403')) {
          setSendNotice({
            type: 'warning',
            message: 'У этого устройства выключен приём файлов'
          });
        } else {
          setSendNotice({
            type: 'error',
            message: msg || 'Ошибка отправки файла'
          });
        }
        setTimeout(() => setSendNotice(null), 4500);
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const paths = Array.from(e.dataTransfer.files)
        .map((f: any) => {
          if (window.macdrop?.getPathForFile) {
            try {
              const p = window.macdrop.getPathForFile(f);
              if (p) return p;
            } catch {}
          }
          return f.path || '';
        })
        .filter(Boolean);

      if (paths.length > 0 && window.macdrop?.sendDroppedFiles) {
        setIsSending(true);
        setSendNotice(null);
        try {
          const results = await window.macdrop.sendDroppedFiles(paths, device.id);
          if (Array.isArray(results) && results.length > 0) {
            const blocked = results.find(
              (r) =>
                r.error &&
                (r.error.includes('отключил приём') ||
                  r.error.includes('выключен приём') ||
                  r.error.includes('403'))
            );
            const failed = results.find((r) => !r.success);

            if (blocked) {
              setSendNotice({
                type: 'warning',
                message: 'У этого устройства выключен приём файлов'
              });
            } else if (failed) {
              setSendNotice({
                type: 'error',
                message: failed.error || 'Ошибка отправки файла'
              });
            } else {
              setSendNotice({
                type: 'success',
                message: `Файл(ы) успешно отправлены!`
              });
            }
          }
          await loadHistory();
        } catch (err: any) {
          const msg = err?.message || '';
          if (
            msg.includes('отключил приём') ||
            msg.includes('выключен приём') ||
            msg.includes('403')
          ) {
            setSendNotice({
              type: 'warning',
              message: 'У этого устройства выключен приём файлов'
            });
          } else {
            setSendNotice({
              type: 'error',
              message: msg || 'Ошибка отправки файла'
            });
          }
        } finally {
          setIsSending(false);
          setTimeout(() => setSendNotice(null), 4500);
        }
      }
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(device.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div
      className={`flex flex-col h-full space-y-4 transition-colors ${
        isDraggingOver ? 'bg-indigo-500/10' : ''
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
    >
      {/* Top Bar: Back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-200 hover:text-white bg-[#171a23] hover:bg-[#1f2330] px-3 py-1.5 rounded-xl border border-white/[0.08] transition-all font-semibold active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
          <span>Все устройства</span>
        </button>

        <span className="text-xs text-slate-500 font-mono">ID: {device.id}</span>
      </div>

      {/* Main Device Information Card */}
      <div className="bg-[#111319]/90 border border-white/[0.08] rounded-2xl p-4 shadow-xl backdrop-blur-md space-y-4">
        <DeviceHeader
          device={device}
          isMac={isMac}
          isEditingName={isEditingName}
          nameInput={nameInput}
          setNameInput={setNameInput}
          handleSaveName={handleSaveName}
          setIsEditingName={setIsEditingName}
        />

        <DeviceAttributesGrid
          device={device}
          copiedId={copiedId}
          handleCopyId={handleCopyId}
        />

        {device.id !== 'mobile-web' && (
          <DeviceReceiveToggle
            isReceiveEnabled={isReceiveEnabled}
            handleToggleReceive={handleToggleReceive}
          />
        )}

        {/* Notice Banner (Warning if receiving is disabled / Error / Success) */}
        {sendNotice && (
          <div
            className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
              sendNotice.type === 'warning'
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : sendNotice.type === 'error'
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            }`}
          >
            {sendNotice.type === 'warning' ? (
              <Ban className="w-4 h-4 text-amber-400 shrink-0" />
            ) : sendNotice.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="font-semibold">{sendNotice.message}</span>
          </div>
        )}

        <DeviceActionButtons
          isSending={isSending}
          handlePickAndSend={handlePickAndSend}
          isConfirmingDelete={isConfirmingDelete}
          setIsConfirmingDelete={setIsConfirmingDelete}
          handleDeleteDevice={handleDeleteDevice}
          hideDelete={device.id === 'mobile-web'}
        />
      </div>

      <ActiveTransferProgress
        isVisible={isVisible}
        progress={progress}
        isCompleted={isCompleted}
        isBatch={isBatch}
        percent={percent}
      />

      <TransferHistoryLog
        history={history}
        onOpenFile={onOpenFile}
      />
    </div>
  );
};
