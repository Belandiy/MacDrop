import dgram from 'dgram';
import os from 'os';
import { EventEmitter } from 'events';

export interface DiscoveredPeer {
  deviceId: string;
  deviceName: string;
  ip: string;
  port: number;
  lastSeen: number;
}

export class PeerDiscovery extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private broadcastPort = 8385;
  private intervalTimer: NodeJS.Timeout | null = null;
  private peers: Map<string, DiscoveredPeer> = new Map();
  private deviceId: string;
  private deviceName: string;
  private apiPort: number;

  constructor(deviceId: string, deviceName: string, apiPort: number) {
    super();
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.apiPort = apiPort;
  }

  public updateInfo(deviceId: string, deviceName: string, apiPort: number) {
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.apiPort = apiPort;
  }

  public getLocalIps(): string[] {
    const ips: string[] = [];
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    return ips;
  }

  public start() {
    this.stop();
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.socket.on('error', (err) => {
      console.warn('UDP Discovery socket error:', err.message);
    });

    this.socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString('utf-8'));
        if (data && data.deviceId && data.deviceId !== this.deviceId) {
          const peer: DiscoveredPeer = {
            deviceId: data.deviceId,
            deviceName: data.deviceName || 'Устройство',
            ip: rinfo.address,
            port: data.port || 8384,
            lastSeen: Date.now()
          };

          const isNew = !this.peers.has(peer.deviceId);
          this.peers.set(peer.deviceId, peer);

          if (isNew) {
            this.emit('peer-found', peer);
            this.emit('peers-changed', this.getPeers());
          }
        }
      } catch {}
    });

    this.socket.bind(this.broadcastPort, () => {
      try {
        this.socket?.setBroadcast(true);
      } catch {}
      console.log(`Peer discovery bound on UDP port ${this.broadcastPort}`);
    });

    // Broadcast presence every 2.5 seconds
    this.intervalTimer = setInterval(() => {
      this.broadcastPresence();
      this.cleanupStalePeers();
    }, 2500);

    // Initial broadcast
    setTimeout(() => this.broadcastPresence(), 500);
  }

  private broadcastPresence() {
    if (!this.socket) return;
    const message = Buffer.from(JSON.stringify({
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      port: this.apiPort
    }));

    try {
      this.socket.send(message, 0, message.length, this.broadcastPort, '255.255.255.255');
    } catch {}
  }

  private cleanupStalePeers() {
    const now = Date.now();
    let changed = false;
    for (const [id, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > 8000) {
        this.peers.delete(id);
        changed = true;
      }
    }
    if (changed) {
      this.emit('peers-changed', this.getPeers());
    }
  }

  public getPeers(): DiscoveredPeer[] {
    return Array.from(this.peers.values());
  }

  public findPeer(idOrCode: string): DiscoveredPeer | undefined {
    const query = idOrCode.trim().toUpperCase();
    for (const peer of this.peers.values()) {
      if (peer.deviceId.toUpperCase() === query) {
        return peer;
      }
    }
    return undefined;
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
  }
}
