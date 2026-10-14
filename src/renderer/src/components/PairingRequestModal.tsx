import React, { useState, useEffect } from 'react';
import { ShieldAlert, Check, X, Laptop, Monitor, Clock } from 'lucide-react';
import { useTranslation } from '../i18n';

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
  <div className="w-full bg-[#2C2C2E] h-1 overflow-hidden">
    <div
      className="bg-[#007AFF] h-full transition-all duration-1000 ease-linear"
      style={{ width: `${(timeLeft / 30) * 100}%` }}
    />
  </div>
);

const DeviceIcon: React.FC<{ isMac: boolean }> = ({ isMac }) => (
  <div className="relative mb-3">
    <div className="w-14 h-14 rounded-[12px] bg-[#202023] border border-[#2C2C2E] flex items-center justify-center text-[#007AFF] shadow-inner">
      {isMac ? <Laptop className="w-7 h-7" /> : <Monitor className="w-7 h-7" />}
    </div>
    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF9F0A] flex items-center justify-center text-black shadow-sm">
      <ShieldAlert className="w-2.5 h-2.5 stroke-[2.5]" />
    </div>
  </div>
);

const DeviceInfoCard: React.FC<{ request: PairingRequest }> = ({ request }) => {
  const { t } = useTranslation();

  return (
    <div className="w-full bg-black/30 border border-white/[0.08] rounded-[8px] p-3 mt-3.5 text-left space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[#8E8E93]">{t('pairing.deviceName')}</span>
        <span className="text-[12px] font-medium text-[#F2F2F7] truncate max-w-[170px]">
          {request.deviceName}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[#8E8E93]">{t('pairing.ipAddress')}</span>
        <span className="text-[11px] font-mono text-[#007AFF] font-medium">
          {request.ip}:{request.port}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[#8E8E93]">{t('devices.deviceId')}</span>
        <span className="text-[11px] font-mono text-[#636366]">
          {request.deviceId}
        </span>
      </div>
    </div>
  );
};

interface ActionButtonsProps {
  onRespond: (approved: boolean) => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ onRespond }) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-2.5 w-full mt-4">
      <button
        type="button"
        onClick={() => onRespond(false)}
        className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[6px] bg-white/[0.08] hover:bg-white/[0.14] active:bg-white/[0.05] text-[#FF453A] border border-white/[0.1] font-medium text-[12px] transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
        <span>{t('pairing.decline')}</span>
      </button>

      <button
        type="button"
        onClick={() => onRespond(true)}
        className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[6px] bg-[#007AFF] hover:bg-[#0071E3] active:bg-[#0062C4] text-white font-medium text-[12px] transition-colors shadow-[0_0.5px_1px_rgba(0,0,0,0.4)] cursor-pointer"
      >
        <Check className="w-3.5 h-3.5" />
        <span>{t('pairing.allow')}</span>
      </button>
    </div>
  );
};

export const PairingRequestModal: React.FC<PairingRequestModalProps> = ({ request, onRespond }) => {
  const { t } = useTranslation();
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

  useEffect(() => {
    if (!request) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onRespond(request.requestId, false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [request?.requestId, onRespond]);

  if (!request) return null;

  const isMac =
    request.deviceId.toUpperCase().startsWith('MAC') ||
    request.deviceName.toLowerCase().includes('mac');

  return (
    <div
      data-modal
      style={{ WebkitAppRegion: 'no-drag' } as any}
      className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onRespond(request.requestId, false);
        }
      }}
    >
      <div
        style={{ WebkitAppRegion: 'no-drag' } as any}
        className="relative w-full max-w-[340px] bg-[#1c1c20]/80 backdrop-blur-2xl border border-white/10 rounded-[14px] shadow-[0_24px_50px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.08)] overflow-hidden select-none animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Progress Bar for Timeout */}
        <ProgressHeader timeLeft={timeLeft} />

        <div className="p-5 flex flex-col items-center text-center">
          {/* Device Icon */}
          <DeviceIcon isMac={isMac} />

          <h3 className="text-[14px] font-semibold text-[#F2F2F7] tracking-tight">
            {t('pairing.requestTitle')}
          </h3>

          <p className="text-[12px] text-[#8E8E93] mt-1 leading-normal">
            {t('pairing.requestDesc')}
          </p>

          {/* Device Info Card */}
          <DeviceInfoCard request={request} />

          {/* Timeout badge */}
          <div className="flex items-center gap-1.5 text-[11px] text-[#8E8E93] mt-3 font-mono">
            <Clock className="w-3 h-3 text-[#8E8E93]" />
            <span>{t('pairing.autoDecline', { seconds: timeLeft })}</span>
          </div>

          {/* Action Buttons */}
          <ActionButtons onRespond={(approved) => onRespond(request.requestId, approved)} />
        </div>
      </div>
    </div>
  );
};
