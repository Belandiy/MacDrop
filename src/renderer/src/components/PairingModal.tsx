import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Smartphone,
  RefreshCw,
  Check,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from '../i18n';

interface DiscoveredPeerItem {
  deviceId: string;
  deviceName: string;
  ip: string;
  port?: number;
  platform?: string;
}

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
  platform?: string;
  discoveredPeers?: DiscoveredPeerItem[];
  onPairWithCode: (codeOrIp: string) => Promise<{ success: boolean; error?: string }>;
  pairedDevices?: any[];
}

/**
 * Modern Windows logo (4-quadrant tiles)
 */
export const WindowsLogoIcon: React.FC<{ className?: string; isSelected?: boolean }> = ({
  className = 'w-6 h-6',
  isSelected
}) => (
  <svg viewBox="0 0 24 24" className={className} fill={isSelected ? '#FFFFFF' : '#00ADEF'}>
    <path d="M2.5 3.5h8.5v8.5H2.5zm9.5 0h8.5v8.5H12zm-9.5 9.5h8.5v8.5H2.5zm9.5 0h8.5v8.5H12z" />
  </svg>
);

/**
 * Apple iMac / Desktop monitor icon
 */
export const MacDesktopIcon: React.FC<{ className?: string; isSelected?: boolean }> = ({
  className = 'w-7 h-7',
  isSelected
}) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    fill="none"
    stroke={isSelected ? '#FFFFFF' : '#007AFF'}
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect
      x="5"
      y="6"
      width="38"
      height="26"
      rx="3"
      fill={isSelected ? 'rgba(255,255,255,0.18)' : 'rgba(0,122,255,0.15)'}
    />
    <line x1="24" y1="32" x2="24" y2="40" />
    <line x1="16" y1="40" x2="32" y2="40" />
    <circle cx="24" cy="19" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * Apple MacBook laptop icon
 */
export const MacLaptopIcon: React.FC<{ className?: string; isSelected?: boolean }> = ({
  className = 'w-7 h-7',
  isSelected
}) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    fill="none"
    stroke={isSelected ? '#FFFFFF' : '#007AFF'}
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect
      x="8"
      y="9"
      width="32"
      height="23"
      rx="2.5"
      fill={isSelected ? 'rgba(255,255,255,0.18)' : 'rgba(0,122,255,0.15)'}
    />
    <path
      d="M3 36h42a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"
      fill={isSelected ? 'rgba(255,255,255,0.22)' : 'rgba(0,122,255,0.2)'}
    />
    <line x1="21" y1="33" x2="27" y2="33" />
  </svg>
);

function getDevicePlatformAndType(peer: DiscoveredPeerItem): {
  isWindows: boolean;
  deviceType: 'desktop' | 'laptop';
} {
  const name = (peer.deviceName || '').toLowerCase();
  const isWindows =
    peer.platform === 'win32' ||
    name.startsWith('desktop-') ||
    name.startsWith('win-') ||
    name.startsWith('laptop-') ||
    name.includes('pc') ||
    name.includes('windows');

  const isLaptop =
    name.includes('air') ||
    name.includes('book') ||
    name.includes('laptop') ||
    name.includes('notebook');

  return {
    isWindows,
    deviceType: isLaptop ? 'laptop' : 'desktop'
  };
}

export const PairingModal: React.FC<PairingModalProps> = ({
  isOpen,
  onClose,
  deviceId,
  discoveredPeers = [],
  onPairWithCode,
  pairedDevices = []
}) => {
  const { t } = useTranslation();
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [showMobileQr, setShowMobileQr] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Mobile Web Drop info
  const [mobileInfo, setMobileInfo] = useState<{
    ips: string[];
    port: number;
    token: string;
    url: string;
    computerName: string;
  } | null>(null);
  const [selectedMobileIp, setSelectedMobileIp] = useState<string>('');

  // Filter out our own device
  const peers = useMemo(() => {
    return (discoveredPeers || []).filter((p) => p.deviceId !== deviceId);
  }, [discoveredPeers, deviceId]);

  // Selected peer object
  const selectedPeer = useMemo(() => {
    return peers.find((p) => p.deviceId === selectedPeerId) || null;
  }, [peers, selectedPeerId]);

  // Handle ESC key
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

  // Trigger discovery sweep and fetch mobile URL on modal open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessNotice(null);
      setIsSubmitting(false);
      setShowMobileQr(false);

      handleTriggerScan();

      window.macdrop?.getMobileShareInfo?.().then((info) => {
        if (info) {
          setMobileInfo(info);
          if (info.ips && info.ips.length > 0) {
            setSelectedMobileIp((prev) => prev || info.ips[0]);
          }
        }
      }).catch(() => {});
    } else {
      setSelectedPeerId(null);
    }
  }, [isOpen]);

  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      await window.macdrop?.scanNearbyPeers?.();
    } catch {}
    setTimeout(() => setIsScanning(false), 1500);
  };

  const handleConnectWith = async (peer: DiscoveredPeerItem) => {
    if (!peer || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await onPairWithCode(peer.ip || peer.deviceId);
      if (res.success) {
        setSuccessNotice(t('pairing.connectedSuccess', { name: peer.deviceName }));
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res.error || t('pairing.connectionFailed'));
      }
    } catch (err: any) {
      setError(err?.message || t('pairing.connectionFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerateMobileToken = async () => {
    try {
      const updated = await window.macdrop?.regenerateMobileToken?.();
      if (updated) {
        setMobileInfo(updated);
      }
    } catch {}
  };

  if (!isOpen) return null;

  const activeMobileIp = selectedMobileIp || (mobileInfo?.ips && mobileInfo.ips[0]) || '127.0.0.1';
  const effectiveMobileUrl = mobileInfo
    ? `http://${activeMobileIp}:${mobileInfo.port}/mobile?token=${mobileInfo.token}`
    : '';

  // Compact 204px radar center and slot coordinates
  const radarCenter = 102;
  const predefinedSlots = [
    { angle: -25, radius: 70 },   // Top-Right (like iMac in reference)
    { angle: 165, radius: 72 },  // Mid-Left (like MacBook Air in reference)
    { angle: 45, radius: 76 },   // Bottom-Right (like Mac mini in reference)
    { angle: -130, radius: 66 },  // Top-Left
    { angle: 95, radius: 72 },   // Bottom-Center
    { angle: -80, radius: 74 }   // Top-Center
  ];

  return (
    <div
      data-modal="true"
      style={{ WebkitAppRegion: 'no-drag' } as any}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/65 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      <div
        className="relative w-full max-w-[370px] bg-[#1C1C1F] border border-[#2C2C30] rounded-[16px] shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col p-4 text-center select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button Top-Right */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#8E8E93] hover:text-white flex items-center justify-center transition-colors cursor-pointer z-30"
          title={t('window.close')}
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Header: MacDrop Title & Subtitle */}
        <div className="mb-2">
          <h2 className="text-[17px] font-semibold text-white tracking-tight">
            {t('pairing.radarTitle')}
          </h2>
          <p className="text-[11px] text-[#8E8E93] mt-0.5">
            {showMobileQr ? t('pairing.mobileQrSubtitle') : t('pairing.radarLookingFor')}
          </p>
        </div>

        {/* ===================== VIEW 1: AIRDROP RADAR ===================== */}
        {!showMobileQr ? (
          <div className="flex flex-col items-center">
            {/* The AirDrop Radar Canvas (204x204 px, strictly circular) */}
            <div className="relative w-[204px] h-[204px] my-1 flex items-center justify-center overflow-hidden rounded-full shrink-0">
              {/* Background Radial Glow */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle at 50% 50%, rgba(0, 122, 255, 0.14) 0%, rgba(0, 122, 255, 0.04) 50%, transparent 72%)'
                }}
              />

              {/* Concentric Expanding Circular Waves (Strictly centered, equal width & height) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#007AFF]/40 pointer-events-none animate-radar-wave-1" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#007AFF]/35 pointer-events-none animate-radar-wave-2" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#007AFF]/30 pointer-events-none animate-radar-wave-3" />

              {/* Concentric Static Radar Circles (Centered, perfectly round) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] rounded-full border border-[#007AFF]/25 bg-[#007AFF]/[0.02] pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[124px] h-[124px] rounded-full border border-[#007AFF]/20 pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[196px] h-[196px] rounded-full border border-[#007AFF]/15 pointer-events-none shadow-[inset_0_0_20px_rgba(0,122,255,0.08)]" />

              {/* Rotating Radar Sweep Cone: authentic sweeping beam (bright leading edge in front, fading trail behind) */}
              <div className="absolute inset-0 rounded-full animate-radar-sweep pointer-events-none overflow-hidden">
                <div
                  className="w-full h-full rounded-full"
                  style={{
                    background:
                      'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(0, 122, 255, 0.03) 10deg, rgba(0, 122, 255, 0.12) 32deg, rgba(0, 122, 255, 0.32) 48deg, transparent 48.5deg, transparent 360deg)'
                  }}
                />
              </div>

              {/* Central Origin Dot */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center pointer-events-none">
                <div className="w-4 h-4 rounded-full bg-[#007AFF]/30 animate-ping absolute" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#007AFF] shadow-[0_0_10px_#007AFF]" />
              </div>

              {/* Discovered Peers Positioned on the Radar */}
              {peers.map((peer, idx) => {
                const slot = predefinedSlots[idx] || {
                  angle: (idx * 360) / Math.max(peers.length, 1),
                  radius: idx % 2 === 0 ? 68 : 76
                };
                const rad = (slot.angle * Math.PI) / 180;
                const x = radarCenter + slot.radius * Math.cos(rad);
                const y = radarCenter + slot.radius * Math.sin(rad);

                const isSelected = selectedPeerId === peer.deviceId;
                const { isWindows, deviceType } = getDevicePlatformAndType(peer);
                const isAlreadyPaired = (pairedDevices || []).some((d: any) => d.id === peer.deviceId);

                return (
                  <div
                    key={peer.deviceId}
                    onClick={() => setSelectedPeerId(peer.deviceId)}
                    onDoubleClick={() => handleConnectWith(peer)}
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    className={`absolute z-20 flex flex-col items-center cursor-pointer group transition-all duration-200 ${
                      isSelected ? 'scale-105' : 'hover:scale-105'
                    }`}
                    title={`${peer.deviceName} (${peer.ip})`}
                  >
                    {/* Device Icon Container */}
                    <div
                      className={`relative flex items-center justify-center p-1 rounded-[10px] transition-all duration-200 ${
                        isSelected
                          ? 'bg-[#007AFF]/30 ring-2 ring-[#007AFF] shadow-[0_0_12px_rgba(0,122,255,0.5)]'
                          : 'bg-[#232328]/85 hover:bg-[#2A2A30] border border-white/10'
                      }`}
                    >
                      {isWindows ? (
                        <WindowsLogoIcon className="w-5 h-5 drop-shadow-sm" isSelected={isSelected} />
                      ) : deviceType === 'laptop' ? (
                        <MacLaptopIcon className="w-6 h-6 drop-shadow-sm" isSelected={isSelected} />
                      ) : (
                        <MacDesktopIcon className="w-6 h-6 drop-shadow-sm" isSelected={isSelected} />
                      )}

                      {/* Paired check badge if already linked */}
                      {isAlreadyPaired && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#34C759] border border-[#1C1C1F] flex items-center justify-center">
                          <Check className="w-1.5 h-1.5 text-white stroke-[3]" />
                        </div>
                      )}
                    </div>

                    {/* Device Name Label */}
                    <div className="mt-0.5 flex flex-col items-center max-w-[85px]">
                      <span
                        className={`text-[10px] font-medium truncate max-w-full text-center transition-colors ${
                          isSelected
                            ? 'bg-[#007AFF] text-white px-2 py-0.5 rounded-full shadow-md'
                            : 'text-[#D1D1D6] group-hover:text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] px-1 py-0.5'
                        }`}
                      >
                        {peer.deviceName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Clean Searching Status Hint Below Radar (Never clipped) */}
            {peers.length === 0 && (
              <div className="py-1 text-center animate-in fade-in">
                <span className="text-[11px] text-[#8E8E93]">
                  {t('pairing.searchingLocalNetwork')}
                </span>
              </div>
            )}

            {/* Error or Success notification banner */}
            {error && (
              <div className="w-full text-[10px] text-[#FF453A] bg-[#FF453A]/10 border border-[#FF453A]/20 rounded-[6px] p-1.5 my-1 leading-relaxed animate-in fade-in">
                {error}
              </div>
            )}
            {successNotice && (
              <div className="w-full text-[10px] text-[#34C759] bg-[#34C759]/10 border border-[#34C759]/20 rounded-[6px] p-1.5 my-1 flex items-center justify-center gap-1 font-medium animate-in fade-in">
                <Check className="w-3 h-3" />
                <span>{successNotice}</span>
              </div>
            )}

            {/* Middle Status Row + Phone QR Button */}
            <div className="w-full flex items-center justify-between mt-1 pt-2 border-t border-[#2C2C30]">
              {/* Ready to connect status indicator */}
              <div className="flex items-center gap-1.5 text-[11px] text-[#8E8E93] truncate mr-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3 h-3 text-[#007AFF] animate-spin shrink-0" />
                    <span className="text-[#007AFF] truncate">
                      {selectedPeer
                        ? t('pairing.pairingWith', { name: selectedPeer.deviceName })
                        : t('pairing.connecting')}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#007AFF] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#007AFF]"></span>
                    </span>
                    <span className="truncate">
                      {selectedPeer
                        ? selectedPeer.deviceName
                        : t('pairing.readyToConnect')}
                    </span>
                  </>
                )}
              </div>

              {/* Refresh & QR-код Button for Mobile Phone */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleTriggerScan}
                  title="Обновить радар"
                  className="p-1 rounded-[5px] text-[#8E8E93] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin text-[#007AFF]' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setShowMobileQr(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-[5px] bg-[#2C2C30] hover:bg-[#38383E] text-[#D1D1D6] hover:text-white border border-[#3A3A3C] text-[10px] font-medium transition-colors cursor-pointer"
                  title="Подключить телефон через локальный Web Drop"
                >
                  <Smartphone className="w-3 h-3 text-[#007AFF]" />
                  <span>{t('pairing.mobileQrBtn')}</span>
                </button>
              </div>
            </div>

            {/* Footer Buttons: Cancel & Pair */}
            <div className="w-full grid grid-cols-2 gap-2 mt-2.5">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-1.5 rounded-[7px] bg-[#2C2C30] hover:bg-[#38383E] text-[#F2F2F7] text-[11px] font-medium border border-[#3A3A3C] transition-colors cursor-pointer"
              >
                {t('pairing.cancel')}
              </button>

              <button
                type="button"
                disabled={!selectedPeer || isSubmitting}
                onClick={() => selectedPeer && handleConnectWith(selectedPeer)}
                className="w-full py-1.5 rounded-[7px] bg-[#007AFF] hover:bg-[#0071E3] active:bg-[#0062C4] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-medium transition-all shadow-[0_1px_2px_rgba(0,122,255,0.4)] flex items-center justify-center gap-1 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <span>{t('pairing.pair')}</span>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* ===================== VIEW 2: MOBILE WEB DROP QR ===================== */
          <div className="flex flex-col items-center py-1 animate-in fade-in duration-200">
            {/* White QR Card */}
            <div className="p-2.5 bg-white rounded-[12px] shadow-md mb-2">
              <div className="w-[140px] h-[140px] flex items-center justify-center">
                {effectiveMobileUrl ? (
                  <QRCodeSVG
                    value={effectiveMobileUrl}
                    size={140}
                    level="M"
                    style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                  />
                ) : (
                  <div className="text-[10px] text-[#8E8E93] animate-pulse font-mono">
                    {t('pairing.generatingQr')}
                  </div>
                )}
              </div>
            </div>

            <div className="text-[12px] font-medium text-[#F2F2F7] flex items-center gap-1 mb-0.5">
              <Smartphone className="w-3.5 h-3.5 text-[#007AFF]" />
              <span>{t('pairing.scanQr')}</span>
            </div>
            <p className="text-[10px] text-[#8E8E93] max-w-[280px] leading-relaxed mb-2">
              {t('pairing.webDropDesc')}
            </p>

            {/* Network Interface selection if multiple IPs */}
            {mobileInfo && mobileInfo.ips && mobileInfo.ips.length > 1 && (
              <div className="w-full bg-[#161619] border border-[#2C2C30] rounded-[5px] px-2.5 py-1 mb-2 flex items-center justify-between text-[10px] text-[#8E8E93]">
                <span>IP сети:</span>
                <select
                  value={activeMobileIp}
                  onChange={(e) => setSelectedMobileIp(e.target.value)}
                  className="bg-transparent text-white font-mono text-[10px] focus:outline-none cursor-pointer"
                >
                  {mobileInfo.ips.map((ip) => (
                    <option key={ip} value={ip} className="bg-[#232328] text-white">
                      {ip}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Action buttons: Back to radar & Refresh key */}
            <div className="w-full flex items-center justify-between pt-2 border-t border-[#2C2C30]">
              <button
                type="button"
                onClick={() => setShowMobileQr(false)}
                className="flex items-center gap-1 text-[11px] text-[#007AFF] hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>{t('pairing.backToRadar')}</span>
              </button>

              <button
                type="button"
                onClick={handleRegenerateMobileToken}
                className="text-[10px] text-[#8E8E93] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                title={t('pairing.newKeyTitle')}
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>{t('pairing.refreshKey')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
