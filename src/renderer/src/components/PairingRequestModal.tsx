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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm bg-[#252528] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-scaleUp">
        {/* Header Progress Bar for Timeout */}
        <div className="w-full bg-zinc-800 h-1">
          <div
            className="bg-blue-500 h-full transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / 30) * 100}%` }}
          />
        </div>

        <div className="p-6 flex flex-col items-center text-center">
          {/* Pulsing Icon */}
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              {isMac ? <Laptop className="w-8 h-8" /> : <Monitor className="w-8 h-8" />}
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-black">
              <ShieldAlert className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>

          <h3 className="text-lg font-semibold text-white tracking-tight">
            Запрос на сопряжение
          </h3>

          <p className="text-xs text-zinc-400 mt-1">
            Новое устройство запрашивает доступ для быстрого обмена файлами
          </p>

          {/* Device Info Card */}
          <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mt-4 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Имя устройства:</span>
              <span className="text-xs font-semibold text-white truncate max-w-[170px]">
                {request.deviceName}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-zinc-400">IP адрес:</span>
              <span className="text-xs font-mono text-blue-300">
                {request.ip}:{request.port}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-zinc-400">ID устройства:</span>
              <span className="text-[11px] font-mono text-zinc-400">
                {request.deviceId}
              </span>
            </div>
          </div>

          {/* Timeout badge */}
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-3">
            <Clock className="w-3 h-3 text-zinc-400" />
            <span>Авто-отклонение через {timeLeft} сек.</span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 w-full mt-5">
            <button
              type="button"
              onClick={() => onRespond(request.requestId, false)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-red-500/20 active:bg-red-500/30 text-zinc-300 hover:text-red-400 border border-white/10 hover:border-red-500/30 font-medium text-xs transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Отклонить</span>
            </button>

            <button
              type="button"
              onClick={() => onRespond(request.requestId, true)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs transition-colors shadow-lg shadow-blue-600/20"
            >
              <Check className="w-4 h-4" />
              <span>Разрешить</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
