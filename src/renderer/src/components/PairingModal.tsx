import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, QrCode, KeyRound, ShieldCheck, Laptop, Monitor, Wifi } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'myCode' | 'enterCode'>('myCode');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [initialDeviceCount, setInitialDeviceCount] = useState<number | null>(null);
  const [pairedNotice, setPairedNotice] = useState<string | null>(null);

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (isOpen) {
      window.macdrop?.scanNearbyPeers?.().catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMac = platform === 'darwin';
  const otherPlatformName = isMac ? 'Windows ПК' : 'Mac';

  const handleCopy = () => {
    navigator.clipboard.writeText(deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      <div className="bg-[#242426] border border-white/10 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Связать Mac и ПК</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-[#1c1c1e]">
          <button
            onClick={() => setActiveTab('myCode')}
            className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'myCode'
                ? 'text-blue-400 border-b-2 border-blue-500 bg-white/5'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Мой код ({deviceId})</span>
          </button>
          <button
            onClick={() => setActiveTab('enterCode')}
            className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'enterCode'
                ? 'text-blue-400 border-b-2 border-blue-500 bg-white/5'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {isMac ? <Monitor className="w-3.5 h-3.5" /> : <Laptop className="w-3.5 h-3.5" />}
            <span>Подключить {otherPlatformName}</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {pairedNotice && (
            <div className="mb-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-in zoom-in-95">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{pairedNotice}</span>
            </div>
          )}

          {activeTab === 'myCode' ? (
            <div className="flex flex-col items-center text-center">
              <div className="bg-white p-3 rounded-2xl shadow-md mb-4">
                <QRCodeSVG
                  value={`macdrop://${deviceId}`}
                  size={140}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div className="text-xs text-zinc-400 mb-2">
                Код этого устройства:
              </div>

              <div className="flex items-center gap-2 bg-[#1c1c1e] px-4 py-2.5 rounded-xl border border-white/10 w-full justify-between">
                <span className="font-mono font-bold text-base text-white tracking-widest">
                  {deviceId}
                </span>
                <button
                  onClick={handleCopy}
                  className="text-zinc-400 hover:text-blue-400 transition-colors p-1"
                  title="Скопировать"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <p className="text-[11px] text-zinc-400 mt-4 leading-relaxed flex items-center gap-1.5 text-left">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Введите этот код или IP на {otherPlatformName}. Настройка выполняется 1 раз.
                </span>
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Nearby discovered devices on local Wi-Fi */}
              {discoveredPeers.length > 0 && (
                <div className="mb-2 bg-[#1c1c1e] p-3 rounded-xl border border-emerald-500/20">
                  <div className="text-[11px] font-medium text-emerald-400 mb-2 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 animate-pulse" />
                    <span>Найдено в вашей сети Wi-Fi:</span>
                  </div>
                  <div className="space-y-1.5">
                    {discoveredPeers.map((p) => (
                      <div
                        key={p.deviceId}
                        className="flex items-center justify-between bg-zinc-800/80 p-2 rounded-lg"
                      >
                        <div className="truncate pr-2">
                          <div className="text-xs font-semibold text-white truncate">{p.deviceName}</div>
                          <div className="text-[10px] text-zinc-400 font-mono">{p.deviceId} • {p.ip}</div>
                        </div>
                        <button
                          onClick={() => handleConnectWith(p.ip)}
                          disabled={isSubmitting}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors shrink-0"
                        >
                          Связать
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                <div className="text-xs text-zinc-300">
                  Или введите код / IP-адрес вручную:
                </div>

                <input
                  type="text"
                  placeholder={isMac ? "Например: PC-5040 или 192.168.0.110" : "Например: MAC-1234 или 192.168.0.x"}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  className="bg-[#1c1c1e] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono tracking-wider focus:outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-600"
                />

                {error && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2 leading-relaxed">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    <span>Устройства успешно связаны!</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !inputCode.trim()}
                  className="mt-1 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold py-2.5 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                >
                  {isSubmitting ? 'Подключение...' : `Подключить ${otherPlatformName}`}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
