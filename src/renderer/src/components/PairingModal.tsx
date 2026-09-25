import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Copy,
  Check,
  QrCode,
  Wifi,
  Smartphone,
  RefreshCw,
  ArrowRight
} from 'lucide-react';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
  platform: string;
  discoveredPeers?: Array<{
    deviceId: string;
    deviceName: string;
    ip: string;
    port: number;
  }>;
  onPairWithCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  pairedDevices?: any[];
}

const MobileWebDropSection: React.FC<{ effectiveMobileUrl: string | null }> = ({ effectiveMobileUrl }) => (
  <div className="flex flex-col items-center">
    <div className="bg-[#1C1C1E] border border-[#2C2C2E] p-3 rounded-[8px] mb-2 relative flex items-center justify-center">
      <div className="bg-white p-2.5 rounded-[6px] shadow-sm relative flex items-center justify-center">
        {effectiveMobileUrl ? (
          <>
            <QRCodeSVG
              value={effectiveMobileUrl}
              size={120}
              level="M"
              includeMargin={false}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-6 h-6 bg-[#161616] rounded-[4px] border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                M
              </div>
            </div>
          </>
        ) : (
          <div className="w-[120px] h-[120px] flex items-center justify-center text-[11px] text-[#8E8E93] font-sans">
            Генерация QR...
          </div>
        )}
      </div>
    </div>

    <div className="text-[12px] font-medium text-[#F2F2F7] flex items-center gap-1.5 mb-0.5">
      <Smartphone className="w-3.5 h-3.5 text-[#007AFF]" />
      <span>Наведите камеру телефона для Web Drop</span>
    </div>
    <p className="text-[11px] text-[#8E8E93] max-w-[280px] leading-relaxed">
      Позволяет безопасно обмениваться файлами в текущей сессии без установки приложений.
    </p>
  </div>
);

const CurrentComputerCodeSection: React.FC<{ deviceId: string; handleCopyCode: () => void; copied: boolean }> = ({ deviceId, handleCopyCode, copied }) => (
  <div className="bg-[#1C1C1E] px-3.5 py-2.5 rounded-[8px] border border-[#2C2C2E] flex items-center justify-between text-left">
    <div>
      <div className="text-[10px] font-medium text-[#8E8E93] uppercase tracking-wider">
        Код этого компьютера
      </div>
      <div className="font-mono font-medium text-[13px] text-[#007AFF] tracking-wider mt-0.5">
        {deviceId}
      </div>
    </div>
    <button
      onClick={handleCopyCode}
      className="flex items-center gap-1.5 text-[11px] font-medium bg-[#2C2C2E] hover:bg-[#38383A] text-[#8E8E93] hover:text-[#F2F2F7] px-2.5 py-1 rounded-[5px] border border-[#3A3A3C] transition-colors"
      title="Скопировать код"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-[#34C759]" />
          <span className="text-[#34C759]">Скопировано</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3 text-[#8E8E93]" />
          <span>Копировать</span>
        </>
      )}
    </button>
  </div>
);

const NetworkDivider: React.FC = () => (
  <div className="relative flex items-center justify-center py-1">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-[#2C2C2E]"></div>
    </div>
    <div className="relative bg-[#161616] px-2.5 text-[10px] font-medium text-[#8E8E93] uppercase tracking-wider flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
      <span>Локальная сеть (Wi-Fi)</span>
    </div>
  </div>
);

const NearbyDiscoveredSection: React.FC<{
  discoveredPeers: Array<{ deviceId: string; deviceName: string; ip: string; port?: number }>;
  handleConnectWith: (target: string) => void;
  isSubmitting: boolean;
}> = ({ discoveredPeers, handleConnectWith, isSubmitting }) => {
  if (discoveredPeers.length === 0) return null;
  return (
    <div className="bg-[#1C1C1E] p-3 rounded-[8px] border border-[#2C2C2E] text-left">
      <div className="text-[11px] font-medium text-[#34C759] mb-2 flex items-center gap-1">
        <span>Найдено рядом:</span>
      </div>
      <div className="space-y-1.5">
        {discoveredPeers.map((p) => (
          <div
            key={p.deviceId}
            className="flex items-center justify-between bg-[#232326] px-3 py-2 rounded-[6px] border border-[#2C2C2E]"
          >
            <div className="truncate pr-2">
              <div className="text-[12px] font-medium text-[#F2F2F7] truncate">{p.deviceName}</div>
              <div className="text-[10px] text-[#8E8E93] font-mono">{p.deviceId} • {p.ip}</div>
            </div>
            <button
              onClick={() => handleConnectWith(p.ip)}
              disabled={isSubmitting}
              className="bg-[#34C759] hover:bg-[#30B0C7] active:bg-[#28A745] text-white text-[11px] font-medium px-2.5 py-1 rounded-[5px] transition-colors shrink-0 flex items-center gap-1 shadow-sm"
            >
              <span>Связать</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const ManualPairingSection: React.FC<{
  isMac: boolean;
  otherPlatformName: string;
  inputCode: string;
  setInputCode: (val: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  error: string | null;
  success: boolean;
}> = ({ isMac, otherPlatformName, inputCode, setInputCode, handleSubmit, isSubmitting, error, success }) => (
  <form onSubmit={handleSubmit} className="text-left space-y-1.5">
    <label className="text-[11px] font-medium text-[#8E8E93] block">
      Или введите код другого {otherPlatformName} / IP:
    </label>
    <div className="flex gap-1.5">
      <input
        type="text"
        placeholder={isMac ? "PC-5040 или 192.168.0.x" : "MAC-1234 или 192.168.0.x"}
        value={inputCode}
        onChange={(e) => setInputCode(e.target.value)}
        className="bg-[#1A1A1A] border border-[#3A3A3C] rounded-[6px] px-2.5 py-1.5 text-[12px] text-[#F2F2F7] font-mono tracking-wider focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/50 transition-colors placeholder:text-[#636366] flex-1 min-w-0"
      />
      <button
        type="submit"
        disabled={isSubmitting || !inputCode.trim()}
        className="bg-[#007AFF] hover:bg-[#0071E3] active:bg-[#0062C4] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-medium px-3 py-1.5 rounded-[6px] transition-colors shrink-0 flex items-center gap-1 shadow-[0_0.5px_1px_rgba(0,0,0,0.4)]"
      >
        <span>{isSubmitting ? '...' : 'Связать'}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>

    {error && (
      <div className="text-[11px] text-[#FF453A] bg-[#FF453A]/10 border border-[#FF453A]/20 rounded-[6px] p-2 leading-relaxed">
        {error}
      </div>
    )}

    {success && (
      <div className="text-[11px] text-[#34C759] bg-[#34C759]/10 border border-[#34C759]/20 rounded-[6px] p-2 flex items-center gap-1.5 font-medium">
        <Check className="w-3.5 h-3.5" />
        <span>Устройства успешно связаны!</span>
      </div>
    )}
  </form>
);

const PairingFooter: React.FC<{
  mobileInfo: { ips: string[]; port?: number; token?: string; url?: string; computerName?: string } | null;
  activeMobileIp: string;
  setSelectedMobileIp: (val: string) => void;
  handleRegenerateMobileToken: () => void;
}> = ({ mobileInfo, activeMobileIp, setSelectedMobileIp, handleRegenerateMobileToken }) => (
  <div className="pt-2 flex items-center justify-between text-[10px] text-[#8E8E93] border-t border-[#2C2C2E]">
    <div className="flex items-center gap-1 font-mono">
      {mobileInfo && mobileInfo.ips && mobileInfo.ips.length > 1 ? (
        <select
          value={activeMobileIp}
          onChange={(e) => setSelectedMobileIp(e.target.value)}
          className="bg-transparent text-[#8E8E93] font-mono text-[10px] focus:outline-none cursor-pointer hover:text-[#F2F2F7]"
          title="Выбрать сетевой интерфейс"
        >
          {mobileInfo.ips.map((ip) => (
            <option key={ip} value={ip} className="bg-[#232326] text-[#F2F2F7]">
              IP: {ip}
            </option>
          ))}
        </select>
      ) : (
        <span>IP: {activeMobileIp}:{mobileInfo?.port || 8384}</span>
      )}
    </div>

    <button
      onClick={handleRegenerateMobileToken}
      className="text-[#8E8E93] hover:text-[#F2F2F7] flex items-center gap-1 transition-colors"
      title="Сгенерировать новый ключ безопасности Web Drop"
    >
      <RefreshCw className="w-2.5 h-2.5" />
      <span>Обновить ключ</span>
    </button>
  </div>
);


export const PairingModal: React.FC<PairingModalProps> = ({
  isOpen,
  onClose,
  deviceId,
  deviceName,
  platform,
  discoveredPeers = [],
  onPairWithCode,
  pairedDevices = []
}) => {
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [initialDeviceCount, setInitialDeviceCount] = useState<number | null>(null);
  const [pairedNotice, setPairedNotice] = useState<string | null>(null);
  const [mobileInfo, setMobileInfo] = useState<{
    ips: string[];
    port: number;
    token: string;
    url: string;
    computerName: string;
  } | null>(null);
  const [selectedMobileIp, setSelectedMobileIp] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (initialDeviceCount === null) {
        setInitialDeviceCount(pairedDevices.length);
      } else if (pairedDevices.length > initialDeviceCount) {
        const newest = pairedDevices[pairedDevices.length - 1];
        const name = newest?.customName || newest?.originalName || 'Новое устройство';
        setPairedNotice(`Успешно подключено: ${name}!`);
        const timer = setTimeout(() => {
          setPairedNotice(null);
          setInitialDeviceCount(null);
          onClose();
        }, 1600);
        return () => clearTimeout(timer);
      }
    } else {
      setInitialDeviceCount(null);
      setPairedNotice(null);
    }
  }, [isOpen, pairedDevices.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      window.macdrop?.scanNearbyPeers?.().catch(() => {});
      window.macdrop?.getMobileShareInfo?.().then((info) => {
        if (info) {
          setMobileInfo(info);
          if (info.ips && info.ips.length > 0) {
            setSelectedMobileIp((prev) => prev || info.ips[0]);
          }
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMac = platform === 'darwin';
  const otherPlatformName = isMac ? 'Windows ПК' : 'Mac';

  const activeMobileIp = selectedMobileIp || (mobileInfo?.ips && mobileInfo.ips[0]) || '127.0.0.1';
  const effectiveMobileUrl = mobileInfo
    ? `http://${activeMobileIp}:${mobileInfo.port}/mobile?token=${mobileInfo.token}`
    : '';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateMobileToken = async () => {
    try {
      const updated = await window.macdrop?.regenerateMobileToken?.();
      if (updated) {
        setMobileInfo(updated);
      }
    } catch {}
  };

  const handleConnectWith = async (target: string) => {
    if (!target.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await onPairWithCode(target.trim());
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1200);
      } else {
        setError(res.error || 'Не удалось подключиться.');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка соединения');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleConnectWith(inputCode);
  };

  return (
    <div
      data-modal
      style={{ WebkitAppRegion: 'no-drag' } as any}
      className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{ WebkitAppRegion: 'no-drag' } as any}
        className="bg-[#161616] border border-[#2C2C2E] rounded-[10px] w-full max-w-[400px] max-h-[90vh] shadow-[0_20px_45px_rgba(0,0,0,0.65),0_0_0_1px_#333336] overflow-hidden flex flex-col select-none animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (38px macOS Toolbar Style) */}
        <div
          style={{ WebkitAppRegion: 'no-drag' } as any}
          className="h-[38px] px-3.5 bg-[#232326] border-b border-[#2C2C2E] flex items-center justify-between shrink-0"
        >
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[#007AFF]" />
            <h2 className="text-[13px] font-medium text-[#F2F2F7]">Связать устройства</h2>
          </div>
          <button
            type="button"
            style={{ WebkitAppRegion: 'no-drag' } as any}
            onClick={onClose}
            className="p-1 rounded-[5px] text-[#8E8E93] hover:text-[#F2F2F7] hover:bg-[#323236] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-3.5 text-center">
          {pairedNotice && (
            <div className="bg-[#34C759]/10 border border-[#34C759]/25 text-[#34C759] px-3 py-2 rounded-[6px] text-[12px] flex items-center gap-2 animate-in zoom-in-95">
              <Check className="w-3.5 h-3.5 text-[#34C759] shrink-0" />
              <span className="font-medium">{pairedNotice}</span>
            </div>
          )}

          <MobileWebDropSection effectiveMobileUrl={effectiveMobileUrl} />

          <CurrentComputerCodeSection deviceId={deviceId} handleCopyCode={handleCopyCode} copied={copied} />

          <NetworkDivider />

          <NearbyDiscoveredSection
            discoveredPeers={discoveredPeers}
            handleConnectWith={handleConnectWith}
            isSubmitting={isSubmitting}
          />

          <ManualPairingSection
            isMac={isMac}
            otherPlatformName={otherPlatformName}
            inputCode={inputCode}
            setInputCode={setInputCode}
            handleSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            error={error}
            success={success}
          />

          <PairingFooter
            mobileInfo={mobileInfo}
            activeMobileIp={activeMobileIp}
            setSelectedMobileIp={setSelectedMobileIp}
            handleRegenerateMobileToken={handleRegenerateMobileToken}
          />
        </div>
      </div>
    </div>
  );
};
