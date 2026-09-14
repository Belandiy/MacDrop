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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#242426] border border-white/10 rounded-3xl w-full max-w-[420px] max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Связать устройства</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-center">
          {pairedNotice && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 animate-in zoom-in-95">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{pairedNotice}</span>
            </div>
          )}

          {/* Block 1: QR code for Mobile Web Drop */}
          <div className="flex flex-col items-center">
            <div className="bg-white p-3 rounded-2xl shadow-md mb-2.5">
              {effectiveMobileUrl ? (
                <QRCodeSVG
                  value={effectiveMobileUrl}
                  size={130}
                  level="M"
                  includeMargin={false}
                />
              ) : (
                <div className="w-[130px] h-[130px] flex items-center justify-center text-xs text-zinc-500 font-sans">
                  Генерация QR...
                </div>
              )}
            </div>

            <div className="text-xs font-semibold text-white flex items-center gap-1.5 mb-0.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
              <span>Наведите камеру телефона для Web Drop</span>
            </div>
            <p className="text-[11px] text-zinc-400 max-w-[290px] leading-relaxed">
              Откроется веб-страница для быстрой отправки файлов и фото без установки приложений.
            </p>
          </div>

          {/* Block 2: Current Computer Code */}
          <div className="bg-[#1c1c1e] px-3.5 py-2.5 rounded-xl border border-white/10 flex items-center justify-between text-left">
            <div>
              <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
                Код этого компьютера
              </div>
              <div className="font-mono font-bold text-sm text-white tracking-widest mt-0.5">
                {deviceId}
              </div>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 transition-colors"
              title="Скопировать код"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Скопировано</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Копировать</span>
                </>
              )}
            </button>
          </div>

          {/* Divider: Local Network Wi-Fi */}
          <div className="relative flex items-center justify-center pt-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative bg-[#242426] px-3 text-[10px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Локальная сеть (Wi-Fi)</span>
            </div>
          </div>

          {/* Block 3: Nearby Discovered PCs */}
          {discoveredPeers.length > 0 && (
            <div className="bg-[#1c1c1e] p-2.5 rounded-xl border border-emerald-500/20 text-left">
              <div className="text-[11px] font-medium text-emerald-400 mb-2 flex items-center gap-1">
                <span>Найдено рядом:</span>
              </div>
              <div className="space-y-1.5">
                {discoveredPeers.map((p) => (
                  <div
                    key={p.deviceId}
                    className="flex items-center justify-between bg-zinc-800/80 px-2.5 py-1.5 rounded-lg"
                  >
                    <div className="truncate pr-2">
                      <div className="text-xs font-semibold text-white truncate">{p.deviceName}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">{p.deviceId} • {p.ip}</div>
                    </div>
                    <button
                      onClick={() => handleConnectWith(p.ip)}
                      disabled={isSubmitting}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors shrink-0 flex items-center gap-1"
                    >
                      <span>Связать</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Block 4: Manual Code or IP Input */}
          <form onSubmit={handleSubmit} className="text-left space-y-1.5">
            <label className="text-[11px] text-zinc-400 block">
              Или введите код другого {otherPlatformName} / IP:
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder={isMac ? "PC-5040 или 192.168.0.x" : "MAC-1234 или 192.168.0.x"}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                className="bg-[#1c1c1e] border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono tracking-wider focus:outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-600 flex-1 min-w-0"
              />
              <button
                type="submit"
                disabled={isSubmitting || !inputCode.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors shrink-0 flex items-center gap-1 shadow-md shadow-blue-500/20"
              >
                <span>{isSubmitting ? '...' : 'Связать'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {error && (
              <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2 leading-relaxed">
                {error}
              </div>
            )}

            {success && (
              <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Устройства успешно связаны!</span>
              </div>
            )}
          </form>

          {/* Footer: Network interface info & Key regenerate */}
          <div className="pt-1 flex items-center justify-between text-[10px] text-zinc-500 border-t border-white/5">
            <div className="flex items-center gap-1 font-mono">
              {mobileInfo && mobileInfo.ips && mobileInfo.ips.length > 1 ? (
                <select
                  value={activeMobileIp}
                  onChange={(e) => setSelectedMobileIp(e.target.value)}
                  className="bg-transparent text-zinc-400 font-mono text-[10px] focus:outline-none cursor-pointer hover:text-white"
                  title="Выбрать сетевой интерфейс"
                >
                  {mobileInfo.ips.map((ip) => (
                    <option key={ip} value={ip} className="bg-[#242426] text-white">
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
              className="text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
              title="Сгенерировать новый ключ безопасности Web Drop"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Обновить ключ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
