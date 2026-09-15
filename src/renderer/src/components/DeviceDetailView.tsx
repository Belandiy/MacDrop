import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Edit2,
  Check,
  X,
  Trash2,
  Send,
  Laptop,
  Monitor,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  File,
  Copy,
  Clock,
  HardDrive,
  Ban,
  AlertCircle,
  Globe,
  WifiOff,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw
} from 'lucide-react';
import { useSmoothProgress } from '../hooks/useSmoothProgress';

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

interface DeviceDetailViewProps {
  device: PairedDevice;
  onBack: () => void;
  onDeviceUpdated: (device: PairedDevice) => void;
  onDeviceRemoved: (deviceId: string) => void;
  onOpenFile: (filename: string) => void;
  currentProgress?: any;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSpeed(bps: number): string {
  return `${formatBytes(bps)}/с`;
}

function timeAgo(timestamp: number): string {
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
        {/* Device Header with Icon and Editable Name */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center relative ${
              isMac ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
            }`}>
              {isMac ? <Laptop className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
              {device.connectionMode === 'remote' ? (
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#111319] bg-cyan-500 shadow-sm shadow-cyan-500/50 flex items-center justify-center" title="Подключено удалённо">
                  <Globe className="w-2.5 h-2.5 text-white" />
                </span>
              ) : device.connectionMode === 'offline' ? (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#111319] bg-slate-500 shadow-sm" title="Не в сети" />
              ) : (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#111319] bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]" title="В сети (Wi-Fi)" />
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
                    placeholder="Основное название"
                  />
                  <button
                    onClick={handleSaveName}
                    title="Сохранить"
                    className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setNameInput(device.customName || device.originalName);
                      setIsEditingName(false);
                    }}
                    title="Отмена"
                    className="p-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-slate-300 transition-colors"
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
                    title="Переименовать устройство"
                    className="text-slate-400 hover:text-white transition-colors p-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-[11px] text-slate-400">Основное отображаемое имя</p>
            </div>
          </div>

          {device.connectionMode === 'remote' ? (
            <div className="flex items-center gap-1.5 bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 px-2.5 py-1 rounded-full text-[11px] font-semibold">
              <Globe className="w-3 h-3" />
              <span>В сети (Удалённо)</span>
            </div>
          ) : device.connectionMode === 'offline' ? (
            <div className="flex items-center gap-1.5 bg-white/[0.05] text-slate-400 border border-white/[0.08] px-2.5 py-1 rounded-full text-[11px] font-medium">
              <WifiOff className="w-3 h-3" />
              <span>Не в сети</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 rounded-full text-[11px] font-semibold">
              <CheckCircle2 className="w-3 h-3" />
              <span>В сети (Wi-Fi)</span>
            </div>
          )}
        </div>

        {/* Immutable Device Attributes Grid */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/[0.06]">
          <div className="bg-[#171a23] border border-white/[0.06] rounded-xl p-2.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold mb-0.5">
              Неизменяемое имя
            </span>
            <span className="text-xs text-slate-200 font-medium truncate block" title={device.originalName}>
              {device.originalName}
            </span>
          </div>

          <div className="bg-[#171a23] border border-white/[0.06] rounded-xl p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold mb-0.5">
                ID устройства
              </span>
              <button
                onClick={handleCopyId}
                className="text-slate-400 hover:text-white transition-colors"
                title="Скопировать ID"
              >
                {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <span className="text-xs font-mono text-cyan-300 font-semibold">
              {device.id}
            </span>
          </div>

          <div className="bg-[#171a23] border border-white/[0.06] rounded-xl p-2.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold mb-0.5">
              Сетевой адрес
            </span>
            <span className="text-xs font-mono text-slate-300 truncate block">
              {device.connectionMode === 'remote' && device.remoteIp
                ? `${device.remoteIp}:${device.remotePort || 8384} (WAN)`
                : `${device.ip}:${device.port || 8384} (LAN)`}
            </span>
          </div>

          <div className="bg-[#171a23] border border-white/[0.06] rounded-xl p-2.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold mb-0.5">
              Связано
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3" />
              {new Date(device.pairedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Temporary File Reception Toggle (On / Off) */}
        <div className="bg-[#171a23] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
              {isReceiveEnabled ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Ban className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>Приём файлов от этого устройства</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {isReceiveEnabled
                ? 'Разрешено: устройство может отправлять вам файлы'
                : 'Запрещено: приём временно заблокирован без потери связи'}
            </div>
          </div>

          <div className="flex items-center bg-[#111319] p-0.5 rounded-xl border border-white/[0.08] shrink-0 ml-3">
            <button
              onClick={() => handleToggleReceive(true)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                isReceiveEnabled
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Вкл
            </button>
            <button
              onClick={() => handleToggleReceive(false)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                !isReceiveEnabled
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Выкл
            </button>
          </div>
        </div>

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

        {/* Action Buttons: Send File & Delete Link */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handlePickAndSend}
            disabled={isSending}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 text-white font-semibold py-2 px-3 rounded-xl text-xs transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSending ? 'Отправка...' : 'Отправить файл(ы)'}</span>
          </button>

          {isConfirmingDelete ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDeleteDevice}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-2.5 py-2 rounded-xl font-semibold transition-colors"
              >
                Удалить связь
              </button>
              <button
                onClick={() => setIsConfirmingDelete(false)}
                className="bg-white/[0.08] hover:bg-white/[0.12] text-slate-200 text-xs px-2 py-2 rounded-xl transition-colors"
              >
                Отмена
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsConfirmingDelete(true)}
              className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 py-2 px-3 rounded-xl text-xs font-semibold transition-colors"
              title="Удалить связь с устройством"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Разорвать связь</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Transfer Progress Bar for this device (Smooth Transition Container) */}
      <div
        className={`transition-all duration-300 ease-out overflow-hidden ${
          isVisible && progress
            ? 'max-h-36 opacity-100'
            : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        {progress && (
          <div className="bg-[#111319]/90 border border-white/[0.08] rounded-2xl p-3 shadow-xl">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-white truncate max-w-[240px]">
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : progress.direction === 'incoming' ? (
                  <ArrowDownCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <ArrowUpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                )}
                {isBatch && !isCompleted && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-medium shrink-0">
                    {progress.currentIndex} из {progress.totalCount}
                  </span>
                )}
                <span className="truncate">{progress.filename}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-bold font-mono ${isCompleted ? 'text-emerald-400' : 'text-cyan-400'}`}>
                  {isCompleted ? '100%' : `${percent}%`}
                </span>
                {!isCompleted && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.macdrop?.cancelTransfer) {
                        await window.macdrop.cancelTransfer();
                      }
                    }}
                    title="Отменить передачу"
                    className="px-1.5 py-0.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/40 text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 text-[10px] font-medium"
                  >
                    <X className="w-3 h-3" />
                    <span>Отмена</span>
                  </button>
                )}
              </div>
            </div>

            <div className="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isCompleted
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                    : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 font-mono">
              <span>
                {isCompleted
                  ? isBatch
                    ? `Все файлы переданы (${progress.totalCount} шт.)`
                    : 'Передача завершена'
                  : isBatch && progress.batchTotalBytes
                  ? `${formatBytes(progress.batchBytesTransferred || 0)} из ${formatBytes(progress.batchTotalBytes)}`
                  : `${formatBytes(progress.bytesTransferred)} из ${formatBytes(progress.totalBytes)}`}
              </span>
              <span className="flex items-center gap-1 text-slate-300">
                {isCompleted ? (
                  <span className="text-emerald-400 font-sans font-medium flex items-center gap-1">
                    ✓ Завершено
                  </span>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                    {formatSpeed(progress.speedBps)}
                  </>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Transfer History For This Specific Device */}
      <div className="bg-[#111319]/90 border border-white/[0.08] rounded-2xl p-4 shadow-xl backdrop-blur-md flex-1 flex flex-col min-h-[220px]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
            <span>Журнал передач с этим устройством</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">{history.length} файл(ов)</span>
        </div>

        {history.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 space-y-2 border border-dashed border-white/[0.08] rounded-xl">
            <File className="w-8 h-8 text-slate-600 stroke-[1.5]" />
            <p className="text-xs font-semibold text-slate-400">История передач с этим устройством пуста</p>
            <p className="text-[11px] text-slate-500">
              Перетащите файлы прямо сюда или нажмите «Отправить файл(ы)»
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto max-h-56 pr-1">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenFile(item.filename)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#171a23]/70 hover:bg-[#1f2330] border border-white/[0.06] hover:border-white/[0.14] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    item.direction === 'incoming'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                      : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25'
                  }`}>
                    {item.direction === 'incoming' ? (
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                      {item.filename}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                      <span>{item.direction === 'incoming' ? 'Получен' : 'Отправлен'}</span>
                      <span>•</span>
                      <span>{formatBytes(item.size)}</span>
                      <span>•</span>
                      <span>{timeAgo(item.timestamp)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-slate-500 group-hover:text-slate-300 transition-colors pl-2">
                  <File className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
