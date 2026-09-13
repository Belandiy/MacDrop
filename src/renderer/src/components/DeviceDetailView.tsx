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
  Ban
} from 'lucide-react';

export interface PairedDevice {
  id: string;
  originalName: string;
  customName: string;
  ip: string;
  port: number;
  pairedAt: string;
  lastSeen?: number;
  receiveEnabled?: boolean;
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(device.customName || device.originalName);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [history, setHistory] = useState<TransferItem[]>([]);
  const [copiedId, setCopiedId] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

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
      try {
        await window.macdrop.pickAndSendFiles(device.id);
        await loadHistory();
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
        try {
          await window.macdrop.sendDroppedFiles(paths, device.id);
          await loadHistory();
        } finally {
          setIsSending(false);
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
        isDraggingOver ? 'bg-blue-500/10' : ''
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
    >
      {/* Top Bar: Back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-[#2c2c2e] hover:bg-[#3a3a3c] px-3 py-1.5 rounded-xl border border-white/10 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Все устройства</span>
        </button>

        <span className="text-xs text-zinc-500 font-mono">ID: {device.id}</span>
      </div>

      {/* Main Device Information Card */}
      <div className="bg-[#2c2c2e]/90 border border-white/10 rounded-2xl p-4 shadow-lg space-y-4">
        {/* Device Header with Icon and Editable Name */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center relative ${
              isMac ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
            }`}>
              {isMac ? <Laptop className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#2c2c2e] bg-emerald-500 shadow-sm shadow-emerald-500/50" />
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
                    className="bg-[#1c1c1e] border border-blue-500/60 rounded-lg px-2.5 py-1 text-sm font-semibold text-white focus:outline-none w-48 shadow-inner"
                    placeholder="Основное название"
                  />
                  <button
                    onClick={handleSaveName}
                    title="Сохранить"
                    className="p-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setNameInput(device.customName || device.originalName);
                      setIsEditingName(false);
                    }}
                    title="Отмена"
                    className="p-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h2 className="text-base font-semibold text-white">
                    {device.customName || device.originalName}
                  </h2>
                  <button
                    onClick={() => setIsEditingName(true)}
                    title="Переименовать устройство"
                    className="text-zinc-400 hover:text-white transition-colors p-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-[11px] text-zinc-400">Основное отображаемое имя</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[11px] font-medium">
            <CheckCircle2 className="w-3 h-3" />
            <span>Подключено</span>
          </div>
        </div>

        {/* Immutable Device Attributes Grid */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/5">
          <div className="bg-[#1c1c1e]/70 border border-white/5 rounded-xl p-2.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold mb-0.5">
              Неизменяемое имя
            </span>
            <span className="text-xs text-zinc-200 font-medium truncate block" title={device.originalName}>
              {device.originalName}
            </span>
          </div>

          <div className="bg-[#1c1c1e]/70 border border-white/5 rounded-xl p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold mb-0.5">
                ID устройства
              </span>
              <button
                onClick={handleCopyId}
                className="text-zinc-400 hover:text-white transition-colors"
                title="Скопировать ID"
              >
                {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <span className="text-xs font-mono text-zinc-200 font-medium">
              {device.id}
            </span>
          </div>

          <div className="bg-[#1c1c1e]/70 border border-white/5 rounded-xl p-2.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold mb-0.5">
              Сетевой адрес
            </span>
            <span className="text-xs font-mono text-zinc-300">
              {device.ip}:{device.port || 8384}
            </span>
          </div>

          <div className="bg-[#1c1c1e]/70 border border-white/5 rounded-xl p-2.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold mb-0.5">
              Связано
            </span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(device.pairedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Temporary File Reception Toggle (On / Off) */}
        <div className="bg-[#1c1c1e]/70 border border-white/5 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-white flex items-center gap-1.5">
              {isReceiveEnabled ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Ban className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>Приём файлов от этого устройства</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              {isReceiveEnabled
                ? 'Разрешено: устройство может отправлять вам файлы'
                : 'Запрещено: приём временно заблокирован без потери связи'}
            </div>
          </div>

          <div className="flex items-center bg-[#252528] p-0.5 rounded-xl border border-white/10 shrink-0 ml-3">
            <button
              onClick={() => handleToggleReceive(true)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                isReceiveEnabled
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Вкл
            </button>
            <button
              onClick={() => handleToggleReceive(false)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                !isReceiveEnabled
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Выкл
            </button>
          </div>
        </div>

        {/* Action Buttons: Send File & Delete Link */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handlePickAndSend}
            disabled={isSending}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium py-2 px-3 rounded-xl text-xs transition-colors shadow-sm disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSending ? 'Отправка...' : 'Отправить файл(ы)'}</span>
          </button>

          {isConfirmingDelete ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDeleteDevice}
                className="bg-red-600 hover:bg-red-500 text-white text-xs px-2.5 py-2 rounded-xl font-medium transition-colors"
              >
                Удалить связь
              </button>
              <button
                onClick={() => setIsConfirmingDelete(false)}
                className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs px-2 py-2 rounded-xl transition-colors"
              >
                Отмена
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsConfirmingDelete(true)}
              className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 py-2 px-3 rounded-xl text-xs font-medium transition-colors"
              title="Удалить связь с устройством"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Разорвать связь</span>
            </button>
          )}
        </div>
      </div>

      {/* Transfer History For This Specific Device */}
      <div className="bg-[#2c2c2e]/90 border border-white/10 rounded-2xl p-4 shadow-lg flex-1 flex flex-col min-h-[220px]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
            <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
            <span>Журнал передач с этим устройством</span>
          </div>
          <span className="text-[10px] text-zinc-400">{history.length} файл(ов)</span>
        </div>

        {history.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 space-y-2 border border-dashed border-white/10 rounded-xl">
            <File className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
            <p className="text-xs text-zinc-400">История передач с этим устройством пуста</p>
            <p className="text-[11px] text-zinc-500">
              Перетащите файлы прямо сюда или нажмите «Отправить файл(ы)»
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto max-h-56 pr-1">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenFile(item.filename)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#1c1c1e]/80 hover:bg-[#1c1c1e] border border-white/5 hover:border-white/15 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    item.direction === 'incoming'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {item.direction === 'incoming' ? (
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                      {item.filename}
                    </div>
                    <div className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                      <span>{item.direction === 'incoming' ? 'Получен' : 'Отправлен'}</span>
                      <span>•</span>
                      <span>{formatBytes(item.size)}</span>
                      <span>•</span>
                      <span>{timeAgo(item.timestamp)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors pl-2">
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
