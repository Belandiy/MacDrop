import React, { useState, useEffect } from 'react';
import { ShieldAlert, Check, X, Laptop, Monitor, Clock } from 'lucide-react';

export interface PairingRequest {
  requestId: string;
  deviceId: string;
  deviceName: string;
  ip: string;
  port: number;
}

interface PairingRequestModalProps {
  request: PairingRequest | null;
  onRespond: (requestId: string, approved: boolean) => void;
}

const ProgressHeader: React.FC<{ timeLeft: number }> = ({ timeLeft }) => (
  <div className="w-full bg-white/[0.06] h-1.5">
    <div
      className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-400 h-full transition-all duration-1000 ease-linear shadow-[0_0_8px_rgba(6,182,212,0.5)]"
      style={{ width: `${(timeLeft / 30) * 100}%` }}
    />
  </div>
);

const DeviceIcon: React.FC<{ isMac: boolean }> = ({ isMac }) => (
  <div className="relative mb-3.5">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-md">
      {isMac ? <Laptop className="w-8 h-8" /> : <Monitor className="w-8 h-8" />}
    </div>
    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-black shadow-md">
      <ShieldAlert className="w-3.5 h-3.5 stroke-[2.5]" />
    </div>
  </div>
);

const DeviceInfoCard: React.FC<{ request: PairingRequest }> = ({ request }) => (
  <div className="w-full bg-[#111319] border border-white/[0.08] rounded-xl p-3.5 mt-4 text-left space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-slate-400">Имя устройства:</span>
      <span className="text-xs font-semibold text-white truncate max-w-[170px]">
        {request.deviceName}
      </span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-slate-400">IP адрес:</span>
      <span className="text-xs font-mono text-cyan-300 font-semibold">
        {request.ip}:{request.port}
      </span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-slate-400">ID устройства:</span>
      <span className="text-[11px] font-mono text-slate-400">
        {request.deviceId}
      </span>
    </div>
  </div>
);

interface ActionButtonsProps {
  onRespond: (approved: boolean) => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ onRespond }) => (
  <div className="grid grid-cols-2 gap-3 w-full mt-5">
    <button
      type="button"
      onClick={() => onRespond(false)}
      className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-300 hover:text-white border border-rose-500/25 font-semibold text-xs transition-all"
    >
      <X className="w-4 h-4" />
      <span>Отклонить</span>
    </button>

    <button
      type="button"
      onClick={() => onRespond(true)}
      className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/30"
    >
      <Check className="w-4 h-4" />
      <span>Разрешить</span>
    </button>
  </div>
);

export const PairingRequestModal: React.FC<PairingRequestModalProps> = ({ request, onRespond }) => {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (!request) {
      setTimeLeft(30);
      return;
    }

    setTimeLeft(30);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onRespond(request.requestId, false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [request?.requestId]);

  if (!request) return null;

  const isMac =
    request.deviceId.toUpperCase().startsWith('MAC') ||
    request.deviceName.toLowerCase().includes('mac');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-[#171a23] border border-white/[0.12] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header Progress Bar for Timeout */}
        <ProgressHeader timeLeft={timeLeft} />

        <div className="p-6 flex flex-col items-center text-center">
          {/* Pulsing Icon */}
          <DeviceIcon isMac={isMac} />

          <h3 className="text-base font-bold text-white tracking-tight">
            Запрос на сопряжение
          </h3>

          <p className="text-xs text-slate-400 mt-1">
            Новое устройство запрашивает доступ для быстрого обмена файлами
          </p>

          {/* Device Info Card */}
          <DeviceInfoCard request={request} />

          {/* Timeout badge */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-3 font-mono">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Авто-отклонение через {timeLeft} сек.</span>
          </div>

          {/* Action Buttons */}
          <ActionButtons onRespond={(approved) => onRespond(request.requestId, approved)} />
        </div>
      </div>
    </div>
  );
};
