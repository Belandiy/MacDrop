import dgram from 'dgram';
import os from 'os';
import http from 'http';
import { EventEmitter } from 'events';

export interface DiscoveredPeer {
  deviceId: string;
  deviceName: string;
  ip: string;
  port: number;
  lastSeen: number;
}

export function calculateBroadcast(ip: string, netmask: string): string | null {
  try {
    const ipParts = ip.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    if (ipParts.length !== 4 || maskParts.length !== 4) return null;
    if (ipParts.some(isNaN) || maskParts.some(isNaN)) return null;

    const bcastParts = ipParts.map((part, i) => part | (~maskParts[i] & 255));
    return bcastParts.join('.');
  } catch {
    return null;
  }
}

export class PeerDiscovery extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private broadcastPort = 8385;
  private intervalTimer: NodeJS.Timeout | null = null;
  private peers: Map<string, DiscoveredPeer> = new Map();
  private deviceId: string;
  private deviceName: string;
  private apiPort: number;
  private isProbing = false;

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
          if (!iface.address.startsWith('169.254.')) {
            ips.push(iface.address);
          }
        }
      }
    }
    return ips;
  }

  public getBroadcastTargets(): string[] {
    const targets = new Set<string>();
    targets.add('255.255.255.255');

    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal && iface.address && iface.netmask) {
          if (iface.address.startsWith('169.254.')) continue;
          const bcast = calculateBroadcast(iface.address, iface.netmask);
          if (bcast) targets.add(bcast);
        }
      }
    }

    return Array.from(targets);
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

          // Unicast direct reply so the other device also discovers us immediately
          if (!data.reply && this.socket) {
            const replyMsg = Buffer.from(JSON.stringify({
              deviceId: this.deviceId,
              deviceName: this.deviceName,
              port: this.apiPort,
              reply: true
            }));
            try {
              this.socket.send(replyMsg, 0, replyMsg.length, this.broadcastPort, rinfo.address, () => {});
            } catch {}
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

    // Initial background subnet sweep after 2.5 seconds to populate discoveredPeers
    setTimeout(() => {
      this.probeSubnetForDevice().catch(() => {});
    }, 2500);
  }

  public broadcastPresence() {
    if (!this.socket) return;
    const message = Buffer.from(JSON.stringify({
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      port: this.apiPort
    }));

    const targets = this.getBroadcastTargets();
    for (const target of targets) {
      try {
        this.socket.send(message, 0, message.length, this.broadcastPort, target, () => {});
      } catch {}
    }
  }

  private cleanupStalePeers() {
    const now = Date.now();
    let changed = false;
    for (const [id, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > 15000) {
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
      const peerId = peer.deviceId.toUpperCase();
      if (
        peerId === query ||
        peerId.endsWith(`-${query}`) ||
        peerId.replace(/^(MAC|PC)-/, '') === query
      ) {
        return peer;
      }
    }
    return undefined;
  }

  public async probeSubnetForDevice(targetCode?: string): Promise<DiscoveredPeer[]> {
    if (this.isProbing && !targetCode) {
      return this.getPeers();
    }
    this.isProbing = true;

    try {
      const ifaces = os.networkInterfaces();
      const candidateIps = new Set<string>();
      const query = targetCode ? targetCode.trim().toUpperCase() : null;

      // Extract primary subnets
      const primarySubnets: string[] = [];
      const secondarySubnets: string[] = [];

      for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name] || []) {
          if (iface.family === 'IPv4' && !iface.internal && iface.address) {
            if (iface.address.startsWith('169.254.')) continue;
            const parts = iface.address.split('.');
            if (parts.length === 4) {
              const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
              if (!primarySubnets.includes(prefix)) {
                primarySubnets.push(prefix);
              }
            }
          }
        }
      }

      // Add common neighboring subnets as secondary
      for (const p of primarySubnets) {
        if (p === '192.168.0' && !primarySubnets.includes('192.168.1')) secondarySubnets.push('192.168.1');
        if (p === '192.168.1' && !primarySubnets.includes('192.168.0')) secondarySubnets.push('192.168.0');
      }

      const allSubnets = [...primarySubnets, ...secondarySubnets];
      const myIps = new Set(this.getLocalIps());

      for (const subnet of allSubnets) {
        for (let i = 1; i <= 254; i++) {
          const ip = `${subnet}.${i}`;
          if (!myIps.has(ip)) {
            candidateIps.add(ip);
          }
        }
      }

      const ipList = Array.from(candidateIps);
      const foundPeers: DiscoveredPeer[] = [];
      let matchFound = false;

      const probeAgent = new http.Agent({ keepAlive: false, maxSockets: 50 });
      const concurrency = 40;
      let currentIndex = 0;

      const probeIp = (ip: string): Promise<void> => {
        return new Promise<void>((resolve) => {
          if (matchFound) return resolve();

          const req = http.get(
            `http://${ip}:${this.apiPort}/api/ping`,
            { timeout: 350, agent: probeAgent },
            (res) => {
              if (res.statusCode === 200) {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                  try {
                    const json = JSON.parse(data);
                    if (json.status === 'ok' && json.deviceId && json.deviceId !== this.deviceId) {
                      const peer: DiscoveredPeer = {
                        deviceId: json.deviceId,
                        deviceName: json.deviceName || 'Устройство',
                        ip: ip,
                        port: this.apiPort,
                        lastSeen: Date.now()
                      };
                      this.peers.set(peer.deviceId, peer);
                      foundPeers.push(peer);
                      this.emit('peer-found', peer);
                      this.emit('peers-changed', this.getPeers());

                      if (query) {
                        const pId = peer.deviceId.toUpperCase();
                        if (
                          pId === query ||
                          pId.endsWith(`-${query}`) ||
                          pId.replace(/^(MAC|PC)-/, '') === query
                        ) {
                          matchFound = true;
                        }
                      }
                    }
                  } catch {}
                  resolve();
                });
              } else {
                res.resume();
                resolve();
              }
            }
          );

          req.on('timeout', () => {
            req.destroy();
            resolve();
          });

          req.on('error', () => {
            resolve();
          });
        });
      };

      const workers: Promise<void>[] = [];
      for (let i = 0; i < concurrency; i++) {
        workers.push((async () => {
          while (currentIndex < ipList.length && !matchFound) {
            const idx = currentIndex++;
            if (idx >= ipList.length) break;
            const ip = ipList[idx];
            await probeIp(ip);
          }
        })());
      }

      await Promise.all(workers);
      probeAgent.destroy();
      return foundPeers;
    } finally {
      this.isProbing = false;
    }
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
