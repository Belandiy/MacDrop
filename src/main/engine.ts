import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { AppConfig, PairedDevice, saveConfig } from './config';
import { Notification, shell, app } from 'electron';
import { PeerDiscovery } from './discovery';
import { isPrivateIp, UpnpStatus } from './upnp';
import { getMobileWebHtml } from './mobileWeb';
import { createZipFromFolder, isArchiveFile, FolderZipResult } from './archiver';

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

export function getSafeResolvedPath(baseFolder: string, relPath: string, filename: string): string | null {
  const sanitizedFilename = path.basename(filename).replace(/[/\\?%*:|"<>]/g, '_').trim();
  if (!sanitizedFilename || sanitizedFilename === '.' || sanitizedFilename === '..') {
    return null;
  }

  const cleanRel = path.normalize(relPath || sanitizedFilename)
    .replace(/^(\.\.[\/\\])+/, '')
    .replace(/^[\/\\]+/, '');

  const targetBase = path.resolve(baseFolder);
  const targetResolved = path.resolve(targetBase, cleanRel);

  if (!targetResolved.startsWith(targetBase + path.sep) && targetResolved !== targetBase) {
    return null;
  }

  return targetResolved;
}

export function getNonConflictingPath(targetPath: string): string {
  if (!fs.existsSync(targetPath)) return targetPath;
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  let counter = 1;
  while (fs.existsSync(path.join(dir, `${base} (${counter})${ext}`))) {
    counter++;
  }
  return path.join(dir, `${base} (${counter})${ext}`);
}

export interface BatchContext {
  currentIndex: number;
  totalCount: number;
  batchCompletedBytes: number;
  batchTotalBytes: number;
  isLastItem: boolean;
}

export interface TransferProgress {
  filename: string;
  bytesTransferred: number;
  totalBytes: number;
  speedBps: number;
  direction: 'incoming' | 'outgoing';
  peerDeviceId?: string;
  peerName?: string;
  currentIndex?: number;
  totalCount?: number;
  batchBytesTransferred?: number;
  batchTotalBytes?: number;
}

export interface HistoryItem {
  id: string;
  filename: string;
  size: number;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  status: 'completed' | 'failed';
  peerDeviceId?: string;
  peerName?: string;
}

export interface PendingTransfer {
  transferId: string;
  filePath: string;
  filename: string;
  relPath: string;
  size: number;
  targetDeviceId: string;
  createdAt: number;
}

export class SyncEngine extends EventEmitter {
  private config: AppConfig;
  private server: http.Server | null = null;
  private currentProgress: TransferProgress | null = null;
  private history: HistoryItem[] = [];
  private discovery?: PeerDiscovery;
  private upnpStatus: UpnpStatus | null = null;
  private pendingTransfers: Map<string, PendingTransfer> = new Map();
  private remotePollTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isDownloadingRemote = false;
  private activeCancelHandlers: Set<() => void> = new Set();
  private deviceMap: Map<string, PairedDevice> = new Map();
  private pendingPairingRequests: Map<string, {
    res: http.ServerResponse;
    timer: NodeJS.Timeout;
    data: any;
    cleanIp: string;
  }> = new Map();
  private pendingOutgoingPairings: Set<string> = new Set();
  private mobileSessionToken: string = crypto.randomBytes(16).toString('hex');
  private isBatchCancelled = false;
  private batchReceiverTimeout: NodeJS.Timeout | null = null;

  constructor(config: AppConfig) {
    super();
    this.config = config;
    this.rebuildDeviceMap();
    this.loadHistory();
  }

  private rebuildDeviceMap() {
    this.deviceMap.clear();
    for (const d of this.config.pairedDevices) {
      this.deviceMap.set(d.id, d);
    }
  }

  public getMobileSessionToken(): string {
    return this.mobileSessionToken;
  }

  public regenerateMobileSessionToken(): string {
    this.mobileSessionToken = crypto.randomBytes(16).toString('hex');
    return this.mobileSessionToken;
  }

  public getLocalIps(): string[] {
    if (this.discovery) {
      const ips = this.discovery.getLocalIps();
      if (ips.length > 0) return ips;
    }
    const ips: string[] = [];
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
          ips.push(iface.address);
        }
      }
    }
    return ips;
  }

  public getMobileShareInfo() {
    const ips = this.getLocalIps();
    const port = this.config.apiPort || 8384;
    const primaryIp = ips[0] || '127.0.0.1';
    const url = `http://${primaryIp}:${port}/mobile?token=${this.mobileSessionToken}`;
    return {
      ips,
      port,
      token: this.mobileSessionToken,
      url,
      computerName: this.config.deviceName
    };
  }

  private getServiceDir(): string {
    const dir = path.join(os.homedir(), '.macdrop');
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }
    return dir;
  }

  private getHistoryPath(): string {
    // History is strictly internal service data, saved in ~/.macdrop/history.json
    return path.join(this.getServiceDir(), 'history.json');
  }

  private loadHistory() {
    try {
      const p = this.getHistoryPath();
      if (fs.existsSync(p)) {
        const data = fs.readFileSync(p, 'utf-8');
        this.history = JSON.parse(data);
        this.cleanupDirtyHistoryFiles();
        return;
      }

      // Check legacy paths (e.g. inside targetFolder or old .macdrop_history.json) to migrate
      const legacyPaths = [
        path.join(this.getServiceDir(), '.macdrop_history.json'),
        path.join(this.config.targetFolder, '.macdrop_history.json'),
        path.join(path.dirname(this.config.targetFolder), '.macdrop_history.json'),
        path.join(os.homedir(), 'Desktop', '.macdrop_history.json'),
        path.join(os.homedir(), '.macdrop', '.macdrop_history.json')
      ];

      for (const leg of legacyPaths) {
        if (fs.existsSync(leg) && leg !== p) {
          try {
            const data = fs.readFileSync(leg, 'utf-8');
            this.history = JSON.parse(data);
            this.saveHistory();
            try { fs.unlinkSync(leg); } catch {}
            break;
          } catch {}
        }
      }
      this.cleanupDirtyHistoryFiles();
    } catch {}
  }

  private cleanupDirtyHistoryFiles() {
    try {
      const dirtyFile = path.join(this.config.targetFolder, '.macdrop_history.json');
      if (fs.existsSync(dirtyFile)) {
        fs.unlinkSync(dirtyFile);
      }
    } catch {}
  }

  private saveHistory() {
    try {
      const p = this.getHistoryPath();
      fs.writeFileSync(p, JSON.stringify(this.history.slice(-100), null, 2), 'utf-8');
      this.cleanupDirtyHistoryFiles();
    } catch {}
  }

  public updateConfig(newConfig: AppConfig) {
    const folderChanged = this.config.targetFolder !== newConfig.targetFolder;
    this.config = newConfig;
    this.rebuildDeviceMap();
    saveConfig(this.config);

    if (folderChanged) {
      if (!fs.existsSync(this.config.targetFolder)) {
        try {
          fs.mkdirSync(this.config.targetFolder, { recursive: true });
        } catch {}
      }
      this.emit('folder-changed', this.config.targetFolder);
    }
  }

  public updateDeviceCustomName(deviceId: string, newCustomName: string): boolean {
    const dev = this.deviceMap.get(deviceId);
    if (dev) {
      dev.customName = newCustomName.trim() || dev.originalName;
      saveConfig(this.config);
      this.emit('status-changed', this.getStatus());
      return true;
    }
    return false;
  }

  public removeDevice(deviceId: string): boolean {
    const initialLen = this.config.pairedDevices.length;
    this.config.pairedDevices = this.config.pairedDevices.filter(d => d.id !== deviceId);
    if (this.config.pairedDevices.length !== initialLen) {
      this.deviceMap.delete(deviceId);
      saveConfig(this.config);
      this.emit('status-changed', this.getStatus());
      return true;
    }
    return false;
  }

  public toggleDeviceReceive(deviceId: string, enabled: boolean): boolean {
    const dev = this.deviceMap.get(deviceId);
    if (dev) {
      dev.receiveEnabled = enabled;
      saveConfig(this.config);
      this.emit('status-changed', this.getStatus());
      return true;
    }
    return false;
  }

  public setUpnpStatus(status: UpnpStatus) {
    this.upnpStatus = status;
    if (status.wanIp) {
      this.config.wanIp = status.wanIp;
      saveConfig(this.config);
    }
    this.emit('status-changed', this.getStatus());
  }

  public getUpnpStatus(): UpnpStatus | null {
    return this.upnpStatus;
  }

  public getStatus() {
    const isConnected = this.config.pairedDevices.length > 0;
    return {
      isConnected,
      deviceName: this.config.deviceName,
      deviceId: this.config.deviceId,
      targetFolder: this.config.targetFolder,
      pairedDevices: this.config.pairedDevices,
      currentProgress: this.currentProgress,
      recentHistory: [...this.history].reverse().slice(0, 50),
      upnpStatus: this.upnpStatus,
      pendingTransfersCount: this.pendingTransfers.size
    };
  }

  public getHistoryForDevice(deviceId: string): HistoryItem[] {
    return this.history.filter(h => h.peerDeviceId === deviceId).reverse();
  }

  public cancelActiveTransfer(): boolean {
    let cancelledAny = false;

    if (this.activeCancelHandlers.size > 0) {
      for (const handler of Array.from(this.activeCancelHandlers)) {
        try {
          handler();
        } catch {}
      }
      this.activeCancelHandlers.clear();
      cancelledAny = true;
    }

    if (this.pendingTransfers.size > 0) {
      this.pendingTransfers.clear();
      cancelledAny = true;
    }

    this.isBatchCancelled = true;
    if (this.batchReceiverTimeout) {
      clearTimeout(this.batchReceiverTimeout);
      this.batchReceiverTimeout = null;
    }

    if (this.currentProgress) {
      this.currentProgress = null;
      this.emit('progress', null);
      cancelledAny = true;
    }

    this.emit('remote-transfer-cancelled');
    this.emit('status-changed', this.getStatus());
    return cancelledAny;
  }

  public setDiscovery(discovery: PeerDiscovery) {
    this.discovery = discovery;
  }

  public updatePeerAddress(deviceId: string, ip: string, port?: number, forceRemote = false, remotePort?: number): boolean {
    if (!deviceId || !ip) return false;
    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    if (cleanIp === '127.0.0.1' || cleanIp === '::1') return false;

    const peer = this.deviceMap.get(deviceId);
    if (peer) {
      let changed = false;
      const isPrivate = isPrivateIp(cleanIp);

      if (forceRemote || !isPrivate) {
        if (peer.remoteIp !== cleanIp) {
          console.log(`Remote IP Sync: device ${deviceId} remote IP set to ${cleanIp}`);
          peer.remoteIp = cleanIp;
          changed = true;
        }
        if (remotePort && peer.remotePort !== remotePort) {
          peer.remotePort = remotePort;
          changed = true;
        }
        if (peer.connectionMode !== 'remote') {
          peer.connectionMode = 'remote';
          changed = true;
        }
      } else {
        if (peer.ip !== cleanIp) {
          console.log(`Live IP Sync: device ${deviceId} (${peer.customName || peer.originalName}) changed IP from ${peer.ip} to ${cleanIp}`);
          peer.ip = cleanIp;
          changed = true;
        }
        if (port && peer.port !== port) {
          peer.port = port;
          changed = true;
        }
        if (peer.connectionMode !== 'local') {
          peer.connectionMode = 'local';
          changed = true;
        }
      }

      peer.lastSeen = Date.now();
      if (changed) {
        saveConfig(this.config);
        this.emit('status-changed', this.getStatus());
      }
      return changed;
    }
    return false;
  }

  private checkPeerPing(ip: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get({
        hostname: ip,
        port,
        path: '/api/ping',
        headers: {
          'x-device-id': this.config.deviceId,
          'x-device-name': encodeURIComponent(this.config.deviceName)
        },
        timeout: 700
      }, (res) => {
        if (res.statusCode === 200) {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolve(json.status === 'ok');
            } catch {
              resolve(true);
            }
          });
        } else {
          resolve(false);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.on('error', () => {
        resolve(false);
      });
    });
  }

  public async resolvePeerIp(peer: PairedDevice): Promise<{ ip: string; port: number }> {
    const port = peer.port || 8384;

    // 1. First check if current peer.ip is reachable locally
    if (peer.ip && await this.checkPeerPing(peer.ip, port)) {
      peer.lastSeen = Date.now();
      peer.connectionMode = 'local';
      return { ip: peer.ip, port };
    }

    console.log(`Device ${peer.id} at ${peer.ip} is unreachable locally. Searching for updated IP...`);

    // 2. Check if discovery recently saw a new IP for this device
    if (this.discovery) {
      const discovered = this.discovery.findPeer(peer.id);
      if (discovered && discovered.ip && discovered.ip !== peer.ip) {
        const dPort = discovered.port || port;
        if (await this.checkPeerPing(discovered.ip, dPort)) {
          console.log(`Device ${peer.id} found at new IP in discovery cache: ${discovered.ip}`);
          this.updatePeerAddress(peer.id, discovered.ip, dPort);
          peer.connectionMode = 'local';
          return { ip: discovered.ip, port: dPort };
        }
      }

      // 3. Actively probe the subnet for this device
      console.log(`Probing local subnet for device ${peer.id}...`);
      const probed = await this.discovery.probeSubnetForDevice(peer.id);
      const match = probed.find(p => p.deviceId.toUpperCase() === peer.id.toUpperCase())
        || this.discovery.findPeer(peer.id);

      if (match && match.ip && await this.checkPeerPing(match.ip, match.port || port)) {
        const mPort = match.port || port;
        console.log(`Device ${peer.id} found at new IP via subnet probe: ${match.ip}`);
        this.updatePeerAddress(peer.id, match.ip, mPort);
        peer.connectionMode = 'local';
        return { ip: match.ip, port: mPort };
      }
    }

    // 4. Check if peer has a remote / WAN address reachable directly
    const remoteHost = peer.remoteIp || (this.config.customRemoteHost ? this.config.customRemoteHost : undefined);
    const remotePort = peer.remotePort || 8384;
    if (remoteHost && await this.checkPeerPing(remoteHost, remotePort)) {
      console.log(`Device ${peer.id} found at remote address: ${remoteHost}:${remotePort}`);
      peer.lastSeen = Date.now();
      peer.connectionMode = 'remote';
      return { ip: remoteHost, port: remotePort };
    }

    // 5. Asymmetric NAT / Cellular: peer cannot receive incoming connections, but is checking in via reverse poll
    if (peer.lastSeen > Date.now() - 60000 || peer.connectionMode === 'remote') {
      console.log(`Device ${peer.id} is connected remotely behind cellular NAT. Using reverse transfer queue.`);
      return { ip: 'REVERSE_PULL', port: 0 };
    }

    peer.connectionMode = 'offline';
    throw new Error(`Устройство «${peer.customName || peer.originalName}» не в сети или недоступно.`);
  }

  public start() {
    this.startLocalServer();
    this.startHealthCheck();
    this.startRemotePolling();
  }

  public stop() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    if (this.remotePollTimer) {
      clearInterval(this.remotePollTimer);
      this.remotePollTimer = null;
    }
    if (this.server) {
      try {
        this.server.close();
      } catch {}
      this.server = null;
    }
  }

  private startHealthCheck() {
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    this.healthCheckTimer = setInterval(async () => {
      for (const peer of this.config.pairedDevices) {
        const localPort = peer.port || 8384;
        const isLocal = peer.ip && await this.checkPeerPing(peer.ip, localPort);
        if (isLocal) {
          if (peer.connectionMode !== 'local') {
            peer.connectionMode = 'local';
            peer.lastSeen = Date.now();
            this.emit('status-changed', this.getStatus());
          }
          continue;
        }

        const remoteHost = peer.remoteIp || this.config.customRemoteHost;
        const remotePort = peer.remotePort || 8384;
        const isRemote = remoteHost && await this.checkPeerPing(remoteHost, remotePort);
        if (isRemote) {
          if (peer.connectionMode !== 'remote') {
            peer.connectionMode = 'remote';
            peer.lastSeen = Date.now();
            this.emit('status-changed', this.getStatus());
          }
          continue;
        }

        // If not responding to direct ping, check if seen in last 40 seconds (from reverse poll)
        if (Date.now() - (peer.lastSeen || 0) < 40000) {
          if (peer.connectionMode !== 'remote') {
            peer.connectionMode = 'remote';
            this.emit('status-changed', this.getStatus());
          }
        } else {
          if (peer.connectionMode !== 'offline') {
            peer.connectionMode = 'offline';
            this.emit('status-changed', this.getStatus());
          }
        }
      }
    }, 12000);
  }

  private startRemotePolling() {
    if (this.remotePollTimer) clearInterval(this.remotePollTimer);
    this.remotePollTimer = setInterval(async () => {
      if (this.isDownloadingRemote) return;

      for (const peer of this.config.pairedDevices) {
        const targetHost = peer.remoteIp || (peer.connectionMode === 'remote' ? peer.ip : undefined);
        const targetPort = peer.remotePort || 8384;
        if (!targetHost || targetHost === '127.0.0.1' || targetHost.startsWith('169.254.')) continue;

        try {
          const req = http.get({
            hostname: targetHost,
            port: targetPort,
            path: '/api/remote/poll',
            headers: {
              'x-device-id': this.config.deviceId,
              'x-device-name': encodeURIComponent(this.config.deviceName),
              'x-auth-token': peer.authToken || ''
            },
            timeout: 2500
          }, (res) => {
            if (res.statusCode === 200) {
              let body = '';
              res.on('data', chunk => { body += chunk; });
              res.on('end', async () => {
                try {
                  const data = JSON.parse(body);
                  peer.lastSeen = Date.now();
                  if (peer.connectionMode !== 'local') {
                    peer.connectionMode = 'remote';
                    this.emit('status-changed', this.getStatus());
                  }

                  if (Array.isArray(data.pending) && data.pending.length > 0 && !this.isDownloadingRemote) {
                    for (const item of data.pending) {
                      try {
                        this.isDownloadingRemote = true;
                        await this.downloadPendingRemoteItem(targetHost, targetPort, item, peer.id);
                      } catch (err) {
                        console.error('Failed to download pending remote item:', err);
                      } finally {
                        this.isDownloadingRemote = false;
                      }
                    }
                  }
                } catch {}
              });
            }
          });

          req.on('error', () => {});
          req.on('timeout', () => req.destroy());
        } catch {}
      }
    }, 4000);
  }

  public async pairWithRemote(peerIp: string, peerPort = 8384): Promise<{ success: boolean; peer?: PairedDevice; error?: string }> {
    const cleanIp = peerIp.replace(/^::ffff:/, '').trim();
    return new Promise((resolve) => {
      const localToken = crypto.randomBytes(24).toString('hex');
      const payload = JSON.stringify({
        deviceId: this.config.deviceId,
        deviceName: this.config.deviceName,
        authToken: localToken,
        port: this.config.apiPort || 8384,
        wanIp: this.upnpStatus?.wanIp || this.config.wanIp,
        remotePort: this.upnpStatus?.externalPort || this.config.apiPort || 8384
      });

      this.pendingOutgoingPairings.add(cleanIp);
      const cleanupOutgoing = () => {
        this.pendingOutgoingPairings.delete(cleanIp);
      };

      const req = http.request({
        hostname: cleanIp,
        port: peerPort,
        path: '/api/pair',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 35000
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          cleanupOutgoing();
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(body);
              const deviceId = data.deviceId || 'Peer';
              const originalName = data.deviceName || 'Устройство';
              const sharedToken = data.authToken || localToken;

              let existing = this.deviceMap.get(deviceId);
              if (existing) {
                existing.ip = cleanIp;
                existing.port = peerPort;
                if (data.wanIp) existing.remoteIp = data.wanIp;
                if (data.remotePort) existing.remotePort = data.remotePort;
                existing.connectionMode = isPrivateIp(cleanIp) ? 'local' : 'remote';
                existing.authToken = sharedToken;
                existing.lastSeen = Date.now();
              } else {
                existing = {
                  id: deviceId,
                  originalName,
                  customName: originalName,
                  ip: cleanIp,
                  port: peerPort,
                  remoteIp: data.wanIp,
                  remotePort: data.remotePort || peerPort,
                  connectionMode: isPrivateIp(cleanIp) ? 'local' : 'remote',
                  authToken: sharedToken,
                  pairedAt: new Date().toISOString(),
                  lastSeen: Date.now()
                };
                this.config.pairedDevices.push(existing);
                this.deviceMap.set(existing.id, existing);
              }

              saveConfig(this.config);
              this.emit('device-paired', existing);
              this.emit('status-changed', this.getStatus());
              resolve({ success: true, peer: existing });
              return;
            } catch (err: any) {
              resolve({ success: false, error: err.message });
              return;
            }
          }
          let errMsg = `Код ответа: HTTP ${res.statusCode}`;
          try {
            const errData = JSON.parse(body);
            if (errData.error) errMsg = errData.error;
          } catch {}
          resolve({ success: false, error: errMsg });
        });
      });

      req.on('error', (err) => {
        cleanupOutgoing();
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        cleanupOutgoing();
        req.destroy();
        resolve({ success: false, error: 'Таймаут подключения: устройство не ответило' });
      });

      req.write(payload);
      req.end();
    });
  }

  public respondPairingRequest(requestId: string, approved: boolean): boolean {
    const item = this.pendingPairingRequests.get(requestId);
    if (!item) return false;

    clearTimeout(item.timer);
    this.pendingPairingRequests.delete(requestId);

    const { res, data, cleanIp } = item;
    if (!approved) {
      try {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Сопряжение отклонено пользователем' }));
      } catch {}
      return true;
    }

    const sharedToken = data.authToken || crypto.randomBytes(24).toString('hex');
    let existing = this.deviceMap.get(data.deviceId);
    if (existing) {
      existing.ip = cleanIp;
      existing.port = data.port || 8384;
      if (data.wanIp) existing.remoteIp = data.wanIp;
      if (data.remotePort) existing.remotePort = data.remotePort;
      existing.connectionMode = isPrivateIp(cleanIp) ? 'local' : 'remote';
      existing.originalName = data.deviceName;
      existing.authToken = sharedToken;
      existing.lastSeen = Date.now();
    } else {
      existing = {
        id: data.deviceId,
        originalName: data.deviceName,
        customName: data.deviceName,
        ip: cleanIp,
        port: data.port || 8384,
        remoteIp: data.wanIp,
        remotePort: data.remotePort || data.port || 8384,
        connectionMode: isPrivateIp(cleanIp) ? 'local' : 'remote',
        authToken: sharedToken,
        pairedAt: new Date().toISOString(),
        lastSeen: Date.now()
      };
      this.config.pairedDevices.push(existing);
      this.deviceMap.set(existing.id, existing);
    }

    saveConfig(this.config);
    console.log(`Device pairing approved by user from ${cleanIp}:`, existing);
    this.emit('device-paired', existing);
    this.emit('status-changed', this.getStatus());

    try {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        deviceId: this.config.deviceId,
        deviceName: this.config.deviceName,
        authToken: sharedToken,
        wanIp: this.upnpStatus?.wanIp || this.config.wanIp,
        remotePort: this.upnpStatus?.externalPort || this.config.apiPort || 8384
      }));
    } catch {}
    return true;
  }

  private startLocalServer() {
    const port = this.config.apiPort || 8384;
    this.server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

      // Handle Web Drop for Mobile Browsers
      const isMobileWeb = url.pathname === '/mobile' || url.pathname.startsWith('/api/mobile/');

      // Security: Block non-mobile requests from web browsers (CORS / Drive-by attack mitigation)
      if (req.headers.origin && !isMobileWeb) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Browser cross-origin requests are forbidden' }));
        return;
      }

      if (req.method === 'OPTIONS') {
        if (isMobileWeb) {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Filename, X-Mobile-Token'
          });
          res.end();
          return;
        }
        res.writeHead(405);
        res.end();
        return;
      }

      // --- Mobile Web Endpoints ---
      if (isMobileWeb) {
        const queryToken = url.searchParams.get('token') || (req.headers['x-mobile-token'] as string);
        const isAuthorized = Boolean(queryToken && queryToken === this.mobileSessionToken);

        // 1. Mobile Web UI entry point
        if (url.pathname === '/mobile' && req.method === 'GET') {
          if (!isAuthorized) {
            res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html><html><body style="background:#121214;color:#fff;font-family:sans-serif;padding:30px;text-align:center;"><h2>401 Доступ запрещен</h2><p style="color:#a1a1aa;">Недействительный или устаревший токен сессии MacDrop.<br>Отсканируйте QR-код в приложении заново.</p></body></html>`);
            return;
          }
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          });
          res.end(getMobileWebHtml(this.config.deviceName, this.mobileSessionToken));
          return;
        }

        if (!isAuthorized) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized: Invalid mobile token' }));
          return;
        }

        // Mobile Logo icon
        if (url.pathname === '/api/mobile/logo' && req.method === 'GET') {
          const candidates = [
            path.join(app.getAppPath(), 'public/logo.png'),
            path.join(__dirname, '../public/logo.png'),
            path.join(process.resourcesPath, 'public/logo.png'),
            path.join(process.resourcesPath, 'logo.png')
          ];
          for (const cand of candidates) {
            try {
              if (fs.existsSync(cand)) {
                res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
                fs.createReadStream(cand).pipe(res);
                return;
              }
            } catch {}
          }
          res.writeHead(404);
          res.end();
          return;
        }

        // 2. Mobile status check
        if (url.pathname === '/api/mobile/status' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'ok',
            computerName: this.config.deviceName,
            deviceId: this.config.deviceId
          }));
          return;
        }

        // 3. Mobile file upload stream
        if (url.pathname === '/api/mobile/upload' && req.method === 'POST') {
          const rawFilename = (req.headers['x-filename'] as string) || url.searchParams.get('filename') || `mobile_${Date.now()}`;
          const filename = decodeURIComponent(rawFilename);
          const totalSize = parseInt(req.headers['content-length'] || '0', 10);

          const safePath = getSafeResolvedPath(this.config.targetFolder, '', filename);
          if (!safePath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Недопустимое имя файла' }));
            return;
          }

          const finalPath = getNonConflictingPath(safePath);
          const writeStream = fs.createWriteStream(finalPath);

          let bytesReceived = 0;
          let lastReportTime = Date.now();
          let lastBytes = 0;

          req.on('data', (chunk) => {
            bytesReceived += chunk.length;
            writeStream.write(chunk);

            const now = Date.now();
            if (now - lastReportTime >= 200) {
              const speed = (bytesReceived - lastBytes) / ((now - lastReportTime) / 1000);
              this.currentProgress = {
                filename,
                bytesTransferred: bytesReceived,
                totalBytes: totalSize || bytesReceived,
                speedBps: speed,
                direction: 'incoming',
                peerDeviceId: 'mobile-web',
                peerName: 'Телефон (Web Drop)'
              };
              this.emit('progress', this.currentProgress);
              lastReportTime = now;
              lastBytes = bytesReceived;
            }
          });

          req.on('end', () => {
            writeStream.end(() => {
              this.currentProgress = null;
              this.emit('progress', null);

              const actualFilename = path.basename(finalPath);
              this.history.push({
                id: crypto.randomBytes(8).toString('hex'),
                filename: actualFilename,
                size: bytesReceived,
                timestamp: Date.now(),
                direction: 'incoming',
                status: 'completed',
                peerDeviceId: 'mobile-web',
                peerName: 'Телефон (Web Drop)'
              });
              this.saveHistory();
              this.emit('status-changed', this.getStatus());

              if (this.config.notifications && Notification.isSupported()) {
                try {
                  const notification = new Notification({
                    title: 'MacDrop: Файл с телефона!',
                    body: `${actualFilename} (${formatFileSize(bytesReceived)}) сохранён в папку.`
                  });
                  notification.show();
                } catch {}
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, filename: actualFilename }));
            });
          });

          req.on('error', (err) => {
            writeStream.destroy();
            try { fs.unlinkSync(finalPath); } catch {}
            this.currentProgress = null;
            this.emit('progress', null);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          });
          return;
        }

        // 4. List PC files for download to mobile
        if (url.pathname === '/api/mobile/files' && req.method === 'GET') {
          try {
            if (!fs.existsSync(this.config.targetFolder)) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ files: [] }));
              return;
            }

            const entries = fs.readdirSync(this.config.targetFolder, { withFileTypes: true });
            const files = entries
              .filter(e => e.isFile() && !e.name.startsWith('.'))
              .map(e => {
                const fullPath = path.join(this.config.targetFolder, e.name);
                const stat = fs.statSync(fullPath);
                return {
                  name: e.name,
                  size: stat.size,
                  mtime: stat.mtimeMs,
                  time: new Date(stat.mtimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
              })
              .sort((a, b) => b.mtime - a.mtime)
              .slice(0, 30);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ files }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 5. Download PC file to mobile
        if (url.pathname.startsWith('/api/mobile/download/') && req.method === 'GET') {
          const rawName = url.pathname.replace('/api/mobile/download/', '');
          const filename = decodeURIComponent(rawName);
          const safePath = getSafeResolvedPath(this.config.targetFolder, '', filename);

          if (!safePath || !fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Файл не найден');
            return;
          }

          const stat = fs.statSync(safePath);
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            'Content-Length': stat.size
          });

          const stream = fs.createReadStream(safePath);
          stream.pipe(res);
          return;
        }
      }

      // Basic ping/status endpoint
      if (url.pathname === '/api/status' && req.method === 'GET') {
        const senderId = req.headers['x-device-id'] as string || '';
        if (senderId) {
          const rawIp = req.socket.remoteAddress || '127.0.0.1';
          this.updatePeerAddress(senderId, rawIp);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          deviceId: this.config.deviceId,
          deviceName: this.config.deviceName,
          platform: process.platform,
          wanIp: this.upnpStatus?.wanIp || this.config.wanIp,
          remotePort: this.upnpStatus?.externalPort || this.config.apiPort || 8384
        }));
        return;
      }

      if (url.pathname === '/api/ping') {
        const senderId = req.headers['x-device-id'] as string;
        if (senderId) {
          const rawIp = req.socket.remoteAddress || '127.0.0.1';
          this.updatePeerAddress(senderId, rawIp);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          deviceId: this.config.deviceId,
          deviceName: this.config.deviceName,
          platform: process.platform,
          wanIp: this.upnpStatus?.wanIp || this.config.wanIp,
          remotePort: this.upnpStatus?.externalPort || this.config.apiPort || 8384
        }));
        return;
      }

      // Pairing request from remote device
      if (url.pathname === '/api/pair' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.deviceId && data.deviceName) {
              const rawIp = req.socket.remoteAddress || '127.0.0.1';
              const cleanIp = rawIp.replace(/^::ffff:/, '');

              let existing = this.deviceMap.get(data.deviceId);
              const sharedToken = data.authToken || existing?.authToken || crypto.randomBytes(24).toString('hex');

              // If device was already paired, update IP/port and sync info without re-prompting
              if (existing) {
                existing.ip = cleanIp;
                existing.port = data.port || 8384;
                if (data.wanIp) existing.remoteIp = data.wanIp;
                if (data.remotePort) existing.remotePort = data.remotePort;
                existing.connectionMode = isPrivateIp(cleanIp) ? 'local' : 'remote';
                existing.originalName = data.deviceName;
                existing.authToken = sharedToken;
                existing.lastSeen = Date.now();
                saveConfig(this.config);
                this.emit('device-paired', existing);
                this.emit('status-changed', this.getStatus());

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: true,
                  deviceId: this.config.deviceId,
                  deviceName: this.config.deviceName,
                  authToken: sharedToken,
                  wanIp: this.upnpStatus?.wanIp || this.config.wanIp,
                  remotePort: this.upnpStatus?.externalPort || this.config.apiPort || 8384
                }));
                return;
              }

              // If we initiated pairing with this peer IP, auto-approve
              if (this.pendingOutgoingPairings.has(cleanIp)) {
                existing = {
                  id: data.deviceId,
                  originalName: data.deviceName,
                  customName: data.deviceName,
                  ip: cleanIp,
                  port: data.port || 8384,
                  remoteIp: data.wanIp,
                  remotePort: data.remotePort || data.port || 8384,
                  connectionMode: isPrivateIp(cleanIp) ? 'local' : 'remote',
                  authToken: sharedToken,
                  pairedAt: new Date().toISOString(),
                  lastSeen: Date.now()
                };
                this.config.pairedDevices.push(existing);
                this.deviceMap.set(existing.id, existing);
                saveConfig(this.config);
                console.log(`Device pairing auto-approved (outgoing pairing) from ${cleanIp}:`, existing);
                this.emit('device-paired', existing);
                this.emit('status-changed', this.getStatus());

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: true,
                  deviceId: this.config.deviceId,
                  deviceName: this.config.deviceName,
                  authToken: sharedToken,
                  wanIp: this.upnpStatus?.wanIp || this.config.wanIp,
                  remotePort: this.upnpStatus?.externalPort || this.config.apiPort || 8384
                }));
                return;
              }

              // Interactive Security: Ask user in UI before allowing new device pairing
              const requestId = crypto.randomUUID();
              console.log(`[Security] Incoming pairing request [${requestId}] from "${data.deviceName}" (${cleanIp}). Awaiting user approval...`);

              const timer = setTimeout(() => {
                if (this.pendingPairingRequests.has(requestId)) {
                  this.pendingPairingRequests.delete(requestId);
                  try {
                    res.writeHead(408, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Время ожидания подтверждения сопряжения истекло' }));
                  } catch {}
                }
              }, 30000);

              this.pendingPairingRequests.set(requestId, {
                res,
                timer,
                data,
                cleanIp
              });

              this.emit('pairing-request', {
                requestId,
                deviceId: data.deviceId,
                deviceName: data.deviceName,
                ip: cleanIp,
                port: data.port || 8384
              });
              return;
            }
          } catch {}
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid pairing payload' }));
        });
        return;
      }

      // Incoming file upload stream
      if (url.pathname === '/api/upload' && req.method === 'POST') {
        const senderId = req.headers['x-device-id'] as string || '';
        if (senderId) {
          const rawIp = req.socket.remoteAddress || '127.0.0.1';
          this.updatePeerAddress(senderId, rawIp);
        }
        const rawFilename = req.headers['x-filename'] as string || `file_${Date.now()}`;
        const rawRelPath = req.headers['x-relative-path'] as string || '';
        const filename = decodeURIComponent(rawFilename);
        const relPath = rawRelPath ? decodeURIComponent(rawRelPath) : filename;
        const totalSize = parseInt(req.headers['content-length'] || '0', 10);

        const batchIndexHeader = req.headers['x-batch-index'];
        const batchTotalHeader = req.headers['x-batch-total'];
        const batchIndex = batchIndexHeader ? parseInt(batchIndexHeader as string, 10) : undefined;
        const batchTotal = batchTotalHeader ? parseInt(batchTotalHeader as string, 10) : undefined;
        const batchTotalBytes = req.headers['x-batch-total-bytes'] ? parseInt(req.headers['x-batch-total-bytes'] as string, 10) : undefined;
        const batchBytesOffset = req.headers['x-batch-bytes-offset'] ? parseInt(req.headers['x-batch-bytes-offset'] as string, 10) : 0;
        const isBatch = typeof batchIndex === 'number' && typeof batchTotal === 'number' && batchTotal > 1;
        const isLastInBatch = isBatch ? batchIndex >= batchTotal : true;

        if (this.batchReceiverTimeout) {
          clearTimeout(this.batchReceiverTimeout);
          this.batchReceiverTimeout = null;
        }

        // Security: Block unauthorized / unpaired clients from uploading files
        const peer = this.deviceMap.get(senderId);
        if (!peer) {
          console.warn(`Blocked unauthorized upload attempt from unpaired device: ${senderId}`);
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            error: 'Устройство не сопряжено. Выполните сопряжение в MacDrop.'
          }));
          return;
        }

        if (peer.receiveEnabled === false) {
          console.log(`Receiving is disabled for peer ${peer.customName || peer.originalName} (${senderId}).`);
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            error: `Получатель временно отключил приём файлов с вашего устройства.`
          }));
          return;
        }

        // Security: Verify authToken if established during pairing
        const reqToken = req.headers['x-auth-token'] as string;
        if (peer.authToken && reqToken && peer.authToken !== reqToken) {
          console.warn(`Blocked upload attempt with invalid auth token from ${senderId}`);
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Неверный токен авторизации устройства' }));
          return;
        }

        const peerName = peer.customName || peer.originalName;

        // Security: Path Traversal defense - ensure resolved path strictly resides within targetFolder
        const safeTarget = getSafeResolvedPath(this.config.targetFolder, relPath, filename);
        if (!safeTarget) {
          console.warn(`Path Traversal attempt blocked from ${senderId}: relPath="${relPath}", filename="${filename}"`);
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Недопустимый путь файла (Path Traversal)' }));
          return;
        }

        // Data Integrity: Never overwrite existing files, generate non-conflicting filename
        const targetPath = getNonConflictingPath(safeTarget);
        const actualFilename = path.basename(targetPath);
        const targetDir = path.dirname(targetPath);

        try {
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
        } catch (e) {
          console.error('Failed to create target dir:', targetDir, e);
        }

        console.log(`Receiving from ${peerName}: ${actualFilename} -> ${targetPath}`);

        let writtenBytes = 0;
        const startTime = Date.now();
        const writeStream = fs.createWriteStream(targetPath);

        const cancelFn = () => {
          try { req.destroy(); } catch {}
          try { writeStream.destroy(); } catch {}
          try {
            if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
          } catch {}
          if (this.batchReceiverTimeout) {
            clearTimeout(this.batchReceiverTimeout);
            this.batchReceiverTimeout = null;
          }
          this.currentProgress = null;
          this.emit('progress', null);
        };
        this.activeCancelHandlers.add(cancelFn);

        const cleanupCancel = () => {
          this.activeCancelHandlers.delete(cancelFn);
        };

        this.currentProgress = {
          filename: actualFilename,
          bytesTransferred: 0,
          totalBytes: totalSize,
          speedBps: 0,
          direction: 'incoming',
          peerDeviceId: senderId,
          peerName,
          currentIndex: batchIndex,
          totalCount: batchTotal,
          batchBytesTransferred: isBatch ? batchBytesOffset : undefined,
          batchTotalBytes: isBatch ? batchTotalBytes : undefined
        };
        this.emit('progress', this.currentProgress);

        req.on('data', (chunk) => {
          writtenBytes += chunk.length;
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = elapsed > 0 ? writtenBytes / elapsed : 0;

          if (this.currentProgress) {
            this.currentProgress.bytesTransferred = writtenBytes;
            if (isBatch) {
              this.currentProgress.batchBytesTransferred = batchBytesOffset + writtenBytes;
            }
            this.currentProgress.speedBps = speed;
            this.emit('progress', this.currentProgress);
          }
        });

        req.pipe(writeStream);

        writeStream.on('finish', () => {
          cleanupCancel();
          if (isLastInBatch) {
            this.currentProgress = null;
            this.emit('progress', null);
          } else {
            if (this.currentProgress) {
              this.currentProgress.bytesTransferred = totalSize;
              if (isBatch) {
                this.currentProgress.batchBytesTransferred = batchBytesOffset + totalSize;
              }
              this.emit('progress', this.currentProgress);
            }
            this.batchReceiverTimeout = setTimeout(() => {
              this.currentProgress = null;
              this.emit('progress', null);
              this.batchReceiverTimeout = null;
            }, 3000);
          }

          this.history.push({
            id: crypto.randomBytes(8).toString('hex'),
            filename: actualFilename,
            size: totalSize,
            timestamp: Date.now(),
            direction: 'incoming',
            status: 'completed',
            peerDeviceId: senderId,
            peerName
          });
          this.saveHistory();
          this.emit('status-changed', this.getStatus());

          if (this.config.notifications && Notification.isSupported()) {
            try {
              if (isBatch) {
                if (isLastInBatch) {
                  const notification = new Notification({
                    title: `MacDrop: Файлы от ${peerName}!`,
                    body: `Получено ${batchTotal} файлов в ${path.basename(this.config.targetFolder)}`
                  });
                  notification.on('click', () => {
                    shell.showItemInFolder(targetPath);
                  });
                  notification.show();
                }
              } else {
                const notification = new Notification({
                  title: `MacDrop: Файл от ${peerName}!`,
                  body: `${actualFilename} сохранен в ${path.basename(this.config.targetFolder)}`
                });
                notification.on('click', () => {
                  shell.showItemInFolder(targetPath);
                });
                notification.show();
              }
            } catch {}
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, path: targetPath }));
        });

        writeStream.on('error', (err) => {
          cleanupCancel();
          console.error('File write stream error:', err);
          if (this.batchReceiverTimeout) {
            clearTimeout(this.batchReceiverTimeout);
            this.batchReceiverTimeout = null;
          }
          this.currentProgress = null;
          this.emit('progress', null);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });

        req.on('close', () => {
          cleanupCancel();
        });

        return;
      }

      // Remote polling for pending files (Reverse Pull)
      if (url.pathname === '/api/remote/poll') {
        const senderId = req.headers['x-device-id'] as string;
        if (senderId) {
          const rawIp = req.socket.remoteAddress || '127.0.0.1';
          this.updatePeerAddress(senderId, rawIp, undefined, true);
        }

        const peer = this.deviceMap.get(senderId);
        if (!peer) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unpaired peer' }));
          return;
        }

        const reqToken = req.headers['x-auth-token'] as string;
        if (peer.authToken && reqToken && peer.authToken !== reqToken) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid auth token' }));
          return;
        }

        const pendingForPeer = Array.from(this.pendingTransfers.values())
          .filter(t => t.targetDeviceId === senderId)
          .map(t => ({
            transferId: t.transferId,
            filename: t.filename,
            relPath: t.relPath,
            size: t.size
          }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', pending: pendingForPeer }));
        return;
      }

      // Remote download endpoint (Reverse Pull delivery)
      if (url.pathname.startsWith('/api/remote/download/') && req.method === 'GET') {
        const transferId = url.pathname.replace('/api/remote/download/', '').trim();
        const transfer = this.pendingTransfers.get(transferId);
        if (!transfer || !fs.existsSync(transfer.filePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Transfer not found or expired' }));
          return;
        }

        const senderId = req.headers['x-device-id'] as string;
        if (senderId && transfer.targetDeviceId && senderId !== transfer.targetDeviceId) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized transfer download' }));
          return;
        }

        const peer = this.deviceMap.get(transfer.targetDeviceId);
        const reqToken = req.headers['x-auth-token'] as string;
        if (peer?.authToken && reqToken && peer.authToken !== reqToken) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid auth token' }));
          return;
        }

        const peerName = peer?.customName || peer?.originalName || 'Устройство';

        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': transfer.size,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(transfer.filename)}"`,
          'X-Filename': encodeURIComponent(transfer.filename),
          'X-Relative-Path': encodeURIComponent(transfer.relPath)
        });

        this.currentProgress = {
          filename: transfer.filename,
          bytesTransferred: 0,
          totalBytes: transfer.size,
          speedBps: 0,
          direction: 'outgoing',
          peerDeviceId: transfer.targetDeviceId,
          peerName
        };
        this.emit('progress', this.currentProgress);

        const stream = fs.createReadStream(transfer.filePath);
        let sentBytes = 0;
        const startTime = Date.now();

        const cancelFn = () => {
          try { stream.destroy(); } catch {}
          try { res.destroy(); } catch {}
        };
        this.activeCancelHandlers.add(cancelFn);

        const cleanupCancel = () => {
          this.activeCancelHandlers.delete(cancelFn);
        };

        stream.on('data', (chunk) => {
          sentBytes += chunk.length;
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = elapsed > 0 ? sentBytes / elapsed : 0;
          if (this.currentProgress) {
            this.currentProgress.bytesTransferred = sentBytes;
            this.currentProgress.speedBps = speed;
            this.emit('progress', this.currentProgress);
          }
        });

        stream.pipe(res);

        res.on('finish', () => {
          cleanupCancel();
          this.pendingTransfers.delete(transferId);
          this.emit('remote-transfer-completed', transferId);
          this.currentProgress = null;
          this.emit('progress', null);
          this.history.push({
            id: Math.random().toString(36).substring(7),
            filename: transfer.filename,
            size: transfer.size,
            timestamp: Date.now(),
            direction: 'outgoing',
            status: 'completed',
            peerDeviceId: transfer.targetDeviceId,
            peerName
          });
          this.saveHistory();
          this.emit('status-changed', this.getStatus());
        });

        res.on('close', () => {
          cleanupCancel();
        });

        stream.on('error', (err) => {
          cleanupCancel();
          console.error('Remote download stream error:', err);
          this.currentProgress = null;
          this.emit('progress', null);
          res.destroy();
        });

        return;
      }

      res.writeHead(404);
      res.end();
    });

    this.server.listen(port, '0.0.0.0', () => {
      console.log(`MacDrop server listening on port ${port}`);
    });

    this.server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        this.config.apiPort = port + 1;
        this.server?.listen(this.config.apiPort, '0.0.0.0');
      }
    });
  }

  // Send single file or folder recursively across network to target device
  public async sendItem(
    itemPath: string,
    targetDeviceId?: string,
    relativePrefix = '',
    resolvedTarget?: { ip: string; port: number },
    overrideFilename?: string,
    batchContext?: BatchContext
  ): Promise<void> {
    if (!fs.existsSync(itemPath)) return;
    const stat = fs.statSync(itemPath);

    let peer: PairedDevice | undefined;
    if (targetDeviceId) {
      peer = this.deviceMap.get(targetDeviceId);
    } else {
      peer = this.config.pairedDevices[0];
    }

    if (!peer) {
      throw new Error('Нет доступных связанных устройств. Сначала выполните сопряжение.');
    }

    // If item is a directory, compress it to a zip archive first and send the archive
    if (stat.isDirectory()) {
      const folderName = path.basename(itemPath);
      const peerName = peer.customName || peer.originalName;

      this.currentProgress = {
        filename: `Сжатие папки ${folderName}...`,
        bytesTransferred: 0,
        totalBytes: 0,
        speedBps: 0,
        direction: 'outgoing',
        peerDeviceId: peer.id,
        peerName,
        currentIndex: batchContext?.currentIndex,
        totalCount: batchContext?.totalCount,
        batchBytesTransferred: batchContext?.batchCompletedBytes,
        batchTotalBytes: batchContext?.batchTotalBytes
      };
      this.emit('progress', this.currentProgress);

      const abortController = new AbortController();
      const cancelArchive = () => {
        try {
          abortController.abort();
        } catch {}
      };
      this.activeCancelHandlers.add(cancelArchive);

      let zipResult: FolderZipResult | null = null;
      try {
        zipResult = await createZipFromFolder(itemPath, {
          signal: abortController.signal,
          onProgress: (prog) => {
            if (this.currentProgress) {
              this.currentProgress.filename = `Сжатие ${folderName} (${formatFileSize(prog.processedBytes)})...`;
              this.emit('progress', this.currentProgress);
            }
          }
        });
      } finally {
        this.activeCancelHandlers.delete(cancelArchive);
      }

      try {
        await this.sendItem(
          zipResult.zipPath,
          targetDeviceId,
          relativePrefix,
          resolvedTarget,
          zipResult.zipFilename,
          batchContext
        );
      } finally {
        await zipResult.cleanup();
      }
      return;
    }

    // Resolve active IP (with automatic re-discovery if device changed IP)
    const { ip: peerIp, port: peerPort } = resolvedTarget || await this.resolvePeerIp(peer);

    const filename = overrideFilename || path.basename(itemPath);
    const relPath = relativePrefix ? path.join(relativePrefix, filename) : filename;
    const peerName = peer.customName || peer.originalName;

    if (peerIp === 'REVERSE_PULL') {
      const transferIds = await this.enqueuePendingTransfer(itemPath, peer.id, relativePrefix, filename);
      const totalBytes = transferIds.reduce((sum, id) => sum + (this.pendingTransfers.get(id)?.size || 0), 0);
      await this.waitForPendingTransfers(transferIds, peer, filename, totalBytes);
      return;
    }

    return new Promise((resolve, reject) => {
      let isCancelled = false;
      const fileStream = fs.createReadStream(itemPath);

      const req = http.request({
        hostname: peerIp,
        port: peerPort,
        path: '/api/upload',
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': stat.size,
          'x-filename': encodeURIComponent(filename),
          'x-relative-path': encodeURIComponent(relPath),
          'x-device-id': this.config.deviceId,
          'x-device-name': encodeURIComponent(this.config.deviceName),
          'x-auth-token': peer?.authToken || '',
          ...(batchContext ? {
            'x-batch-index': String(batchContext.currentIndex),
            'x-batch-total': String(batchContext.totalCount),
            'x-batch-total-bytes': String(batchContext.batchTotalBytes),
            'x-batch-bytes-offset': String(batchContext.batchCompletedBytes)
          } : {})
        },
        timeout: 60000
      }, (res) => {
        cleanup();
        if (res.statusCode === 200) {
          if (!batchContext || batchContext.isLastItem) {
            this.currentProgress = null;
            this.emit('progress', null);
          } else {
            if (this.currentProgress) {
              this.currentProgress.bytesTransferred = stat.size;
              if (batchContext) {
                this.currentProgress.batchBytesTransferred = batchContext.batchCompletedBytes + stat.size;
              }
              this.emit('progress', this.currentProgress);
            }
          }
          this.history.push({
            id: crypto.randomBytes(8).toString('hex'),
            filename,
            size: stat.size,
            timestamp: Date.now(),
            direction: 'outgoing',
            status: 'completed',
            peerDeviceId: peer?.id,
            peerName
          });
          this.saveHistory();
          this.emit('status-changed', this.getStatus());
          resolve();
        } else {
          this.currentProgress = null;
          this.emit('progress', null);
          let errBody = '';
          res.on('data', chunk => { errBody += chunk; });
          res.on('end', () => {
            let errorMsg = `Устройство вернуло ошибку HTTP ${res.statusCode}`;
            let isReceiveDisabled = res.statusCode === 403;
            try {
              const parsed = JSON.parse(errBody);
              if (parsed.error) {
                errorMsg = parsed.error;
                if (errorMsg.includes('отключил приём') || errorMsg.includes('выключен приём')) {
                  isReceiveDisabled = true;
                }
              }
            } catch {}

            // Не засоряем журнал, если у получателя приём файлов временно отключен
            if (!isReceiveDisabled) {
              this.history.push({
                id: Math.random().toString(36).substring(7),
                filename,
                size: stat.size,
                timestamp: Date.now(),
                direction: 'outgoing',
                status: 'failed',
                peerDeviceId: peer?.id,
                peerName
              });
              this.saveHistory();
              this.emit('status-changed', this.getStatus());
            }
            reject(new Error(errorMsg));
          });
        }
      });

      const cancelFn = () => {
        isCancelled = true;
        try { fileStream.destroy(); } catch {}
        try { req.destroy(new Error('Передача отменена')); } catch {}
        this.currentProgress = null;
        this.emit('progress', null);
      };
      this.activeCancelHandlers.add(cancelFn);

      const cleanup = () => {
        this.activeCancelHandlers.delete(cancelFn);
      };

      req.on('close', () => {
        cleanup();
      });

      req.on('error', (err) => {
        cleanup();
        this.currentProgress = null;
        this.emit('progress', null);
        if (isCancelled) {
          reject(new Error('Передача отменена'));
        } else {
          reject(err);
        }
      });

      let sentBytes = 0;
      const startTime = Date.now();

      this.currentProgress = {
        filename,
        bytesTransferred: 0,
        totalBytes: stat.size,
        speedBps: 0,
        direction: 'outgoing',
        peerDeviceId: peer?.id,
        peerName,
        currentIndex: batchContext?.currentIndex,
        totalCount: batchContext?.totalCount,
        batchBytesTransferred: batchContext ? batchContext.batchCompletedBytes : undefined,
        batchTotalBytes: batchContext ? batchContext.batchTotalBytes : undefined
      };
      this.emit('progress', this.currentProgress);

      fileStream.on('data', (chunk) => {
        sentBytes += chunk.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? sentBytes / elapsed : 0;
        if (this.currentProgress) {
          this.currentProgress.bytesTransferred = sentBytes;
          if (batchContext) {
            this.currentProgress.batchBytesTransferred = batchContext.batchCompletedBytes + sentBytes;
          }
          this.currentProgress.speedBps = speed;
          this.emit('progress', this.currentProgress);
        }
      });

      fileStream.pipe(req);
    });
  }

  // Calculate recursive size of directory
  private getFolderSize(dirPath: string): number {
    let total = 0;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          total += this.getFolderSize(full);
        } else if (entry.isFile()) {
          try {
            total += fs.statSync(full).size;
          } catch {}
        }
      }
    } catch {}
    return total;
  }

  // Send batch of files or folders with aggregate progress tracking
  public async sendBatch(
    itemPaths: string[],
    targetDeviceId?: string,
    onFileSuccess?: (itemPath: string, filename: string) => void
  ): Promise<{ name: string; success: boolean; error?: string }[]> {
    this.isBatchCancelled = false;
    const results: { name: string; success: boolean; error?: string }[] = [];

    const validPaths = itemPaths.filter(p => fs.existsSync(p));
    if (validPaths.length === 0) return results;

    const totalCount = validPaths.length;
    let batchTotalBytes = 0;
    const itemSizes: number[] = [];

    for (const p of validPaths) {
      try {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          const dirSize = this.getFolderSize(p);
          itemSizes.push(dirSize);
          batchTotalBytes += dirSize;
        } else {
          itemSizes.push(stat.size);
          batchTotalBytes += stat.size;
        }
      } catch {
        itemSizes.push(0);
      }
    }

    let batchCompletedBytes = 0;

    for (let i = 0; i < validPaths.length; i++) {
      if (this.isBatchCancelled) {
        break;
      }

      const p = validPaths[i];
      const filename = path.basename(p);
      const isLastItem = (i === validPaths.length - 1);
      const currentItemSize = itemSizes[i] || 0;

      const batchContext: BatchContext = {
        currentIndex: i + 1,
        totalCount,
        batchCompletedBytes,
        batchTotalBytes,
        isLastItem
      };

      try {
        await this.sendItem(p, targetDeviceId, '', undefined, undefined, batchContext);
        batchCompletedBytes += currentItemSize;
        if (onFileSuccess) {
          try { onFileSuccess(p, filename); } catch {}
        }
        results.push({ name: filename, success: true });
      } catch (err: any) {
        batchCompletedBytes += currentItemSize;
        results.push({ name: filename, success: false, error: err?.message || 'Ошибка передачи' });
        if (isLastItem || this.isBatchCancelled) {
          this.currentProgress = null;
          this.emit('progress', null);
        }
      }
    }

    if (this.currentProgress) {
      this.currentProgress = null;
      this.emit('progress', null);
    }

    return results;
  }

  private async enqueuePendingTransfer(
    itemPath: string,
    targetDeviceId: string,
    relativePrefix = '',
    overrideFilename?: string
  ): Promise<string[]> {
    if (!fs.existsSync(itemPath)) return [];
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      const ids: string[] = [];
      const entries = fs.readdirSync(itemPath);
      for (const entry of entries) {
        const fullChild = path.join(itemPath, entry);
        const childRel = path.join(relativePrefix || path.basename(itemPath), entry);
        const subIds = await this.enqueuePendingTransfer(fullChild, targetDeviceId, childRel);
        ids.push(...subIds);
      }
      return ids;
    }

    const filename = overrideFilename || path.basename(itemPath);
    const relPath = relativePrefix ? path.join(relativePrefix, filename) : filename;
    const transferId = Math.random().toString(36).substring(2) + Date.now().toString(36);

    this.pendingTransfers.set(transferId, {
      transferId,
      filePath: itemPath,
      filename,
      relPath,
      size: stat.size,
      targetDeviceId,
      createdAt: Date.now()
    });

    const peer = this.deviceMap.get(targetDeviceId);
    const peerName = peer?.customName || peer?.originalName || 'Устройство';

    console.log(`Queued pending remote transfer ${transferId} (${filename}) for ${peerName}`);
    this.emit('status-changed', this.getStatus());
    return [transferId];
  }

  private async waitForPendingTransfers(
    transferIds: string[],
    peer: PairedDevice,
    overallName: string,
    totalBytes: number
  ): Promise<void> {
    if (transferIds.length === 0) return;

    const peerName = peer.customName || peer.originalName;

    return new Promise((resolve, reject) => {
      const remaining = new Set(transferIds);
      let isDone = false;

      this.currentProgress = {
        filename: overallName,
        bytesTransferred: 0,
        totalBytes,
        speedBps: 0,
        direction: 'outgoing',
        peerDeviceId: peer.id,
        peerName: `${peerName} (Ожидание скачивания...)`
      };
      this.emit('progress', this.currentProgress);

      const cleanup = () => {
        isDone = true;
        this.activeCancelHandlers.delete(cancelFn);
        this.off('remote-transfer-completed', onComplete);
        this.off('remote-transfer-cancelled', onCancel);
        clearTimeout(timer);
      };

      const cancelFn = () => {
        if (isDone) return;
        cleanup();
        for (const id of transferIds) {
          this.pendingTransfers.delete(id);
        }
        reject(new Error('Передача отменена'));
      };

      const onCancel = () => {
        if (isDone) return;
        cleanup();
        reject(new Error('Передача отменена'));
      };

      const onComplete = (completedId: string) => {
        if (isDone) return;
        remaining.delete(completedId);
        if (remaining.size === 0) {
          cleanup();
          this.currentProgress = null;
          this.emit('progress', null);
          resolve();
        }
      };

      // 90 second timeout if peer never polls / starts download
      const timer = setTimeout(() => {
        if (isDone) return;
        cleanup();
        for (const id of transferIds) {
          this.pendingTransfers.delete(id);
        }
        this.currentProgress = null;
        this.emit('progress', null);
        this.emit('status-changed', this.getStatus());
        reject(new Error(`Устройство «${peerName}» не запросило файл за отведенное время (таймаут). Убедитесь, что MacDrop запущен на втором устройстве.`));
      }, 90000);

      this.activeCancelHandlers.add(cancelFn);
      this.on('remote-transfer-completed', onComplete);
      this.on('remote-transfer-cancelled', onCancel);
    });
  }

  private async downloadPendingRemoteItem(
    remoteHost: string,
    remotePort: number,
    item: { transferId: string; filename: string; relPath: string; size: number },
    senderDeviceId: string
  ): Promise<void> {
    // Security: Path Traversal defense
    const safeTarget = getSafeResolvedPath(this.config.targetFolder, item.relPath || item.filename, item.filename);
    if (!safeTarget) {
      throw new Error(`Недопустимый путь удаленного файла (Path Traversal): ${item.filename}`);
    }

    // Data Integrity: Never overwrite existing files, generate non-conflicting filename
    const targetPath = getNonConflictingPath(safeTarget);
    const actualFilename = path.basename(targetPath);
    const targetDir = path.dirname(targetPath);

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create target dir for remote download:', err);
    }

    const peer = this.deviceMap.get(senderDeviceId);
    const peerName = peer?.customName || peer?.originalName || 'Устройство';

    return new Promise((resolve, reject) => {
      let isCancelled = false;
      let writeStream: fs.WriteStream | null = null;

      const req = http.get({
        hostname: remoteHost,
        port: remotePort,
        path: `/api/remote/download/${item.transferId}`,
        headers: {
          'x-device-id': this.config.deviceId,
          'x-device-name': encodeURIComponent(this.config.deviceName),
          'x-auth-token': peer?.authToken || ''
        },
        timeout: 60000
      }, (res) => {
        if (res.statusCode !== 200) {
          cleanup();
          reject(new Error(`Remote download HTTP ${res.statusCode}`));
          return;
        }

        let receivedBytes = 0;
        const startTime = Date.now();
        writeStream = fs.createWriteStream(targetPath);

        this.currentProgress = {
          filename: actualFilename,
          bytesTransferred: 0,
          totalBytes: item.size,
          speedBps: 0,
          direction: 'incoming',
          peerDeviceId: senderDeviceId,
          peerName
        };
        this.emit('progress', this.currentProgress);

        res.on('data', (chunk) => {
          receivedBytes += chunk.length;
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = elapsed > 0 ? receivedBytes / elapsed : 0;
          if (this.currentProgress) {
            this.currentProgress.bytesTransferred = receivedBytes;
            this.currentProgress.speedBps = speed;
            this.emit('progress', this.currentProgress);
          }
        });

        res.pipe(writeStream);

        writeStream.on('finish', () => {
          cleanup();
          this.currentProgress = null;
          this.emit('progress', null);
          this.history.push({
            id: crypto.randomBytes(8).toString('hex'),
            filename: actualFilename,
            size: item.size,
            timestamp: Date.now(),
            direction: 'incoming',
            status: 'completed',
            peerDeviceId: senderDeviceId,
            peerName
          });
          this.saveHistory();
          this.emit('status-changed', this.getStatus());

          if (this.config.notifications && Notification.isSupported()) {
            try {
              const notification = new Notification({
                title: `MacDrop: Файл от ${peerName}!`,
                body: `${actualFilename} сохранен в ${path.basename(this.config.targetFolder)}`
              });
              notification.on('click', () => {
                shell.showItemInFolder(targetPath);
              });
              notification.show();
            } catch {}
          }
          resolve();
        });

        writeStream.on('error', (err) => {
          cleanup();
          this.currentProgress = null;
          this.emit('progress', null);
          reject(err);
        });

        res.on('close', () => {
          cleanup();
        });
      });

      const cancelFn = () => {
        isCancelled = true;
        try { req.destroy(); } catch {}
        try { if (writeStream) (writeStream as any).destroy(); } catch {}
        try {
          if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
        } catch {}
        this.currentProgress = null;
        this.emit('progress', null);
      };
      this.activeCancelHandlers.add(cancelFn);

      const cleanup = () => {
        this.activeCancelHandlers.delete(cancelFn);
      };

      req.on('close', () => {
        cleanup();
      });

      req.on('error', (err) => {
        cleanup();
        this.currentProgress = null;
        this.emit('progress', null);
        if (isCancelled) {
          reject(new Error('Передача отменена'));
        } else {
          reject(err);
        }
      });
    });
  }
}
