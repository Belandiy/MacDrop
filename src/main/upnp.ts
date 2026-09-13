import dgram from 'dgram';
import os from 'os';
import { EventEmitter } from 'events';

export interface UpnpStatus {
  enabled: boolean;
  active: boolean;
  routerName?: string;
  internalIp?: string;
  internalPort: number;
  externalPort: number;
  wanIp?: string;
  isPublicIp: boolean;
  publicInternetIp?: string;
  error?: string;
}

export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  const clean = ip.replace(/^::ffff:/, '').trim();
  if (clean === '127.0.0.1' || clean === 'localhost' || clean === '::1') return true;

  const parts = clean.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  // 10.0.0.0 - 10.255.255.255
  if (parts[0] === 10) return true;
  // 172.16.0.0 - 172.31.255.255 (RFC 1918)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0 - 192.168.255.255
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 100.64.0.0 - 100.127.255.255 (Carrier-Grade NAT RFC 6598)
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;

  return false;
}

export class UpnpManager extends EventEmitter {
  private port: number;
  private status: UpnpStatus;
  private controlUrl: string | null = null;
  private serviceType: string = 'urn:schemas-upnp-org:service:WANIPConnection:1';
  private renewTimer: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  constructor(port = 8384) {
    super();
    this.port = port;
    this.status = {
      enabled: true,
      active: false,
      internalPort: port,
      externalPort: port,
      isPublicIp: false
    };
  }

  public getStatus(): UpnpStatus {
    return { ...this.status };
  }

  public async start(): Promise<UpnpStatus> {
    this.status.enabled = true;
    try {
      await this.discoverAndMap();
    } catch (err: any) {
      console.warn('UPnP setup warning:', err?.message || err);
      this.status.active = false;
      this.status.error = err?.message || String(err);
      this.emit('status', this.getStatus());
    }

    // Set up renewal every 20 minutes
    if (this.renewTimer) clearInterval(this.renewTimer);
    this.renewTimer = setInterval(() => {
      if (this.status.active && !this.isDestroyed) {
        this.addPortMapping(this.status.internalIp || this.getLocalIp(), this.port).catch(() => {});
      }
    }, 20 * 60 * 1000);

    return this.getStatus();
  }

  public async stop(): Promise<void> {
    this.isDestroyed = true;
    if (this.renewTimer) {
      clearInterval(this.renewTimer);
      this.renewTimer = null;
    }
    if (this.controlUrl && this.status.active) {
      try {
        await this.deletePortMapping(this.port);
      } catch {}
    }
    this.status.active = false;
    this.emit('status', this.getStatus());
  }

  private getLocalIp(): string {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          if (!iface.address.startsWith('169.254.') && !iface.address.startsWith('127.')) {
            return iface.address;
          }
        }
      }
    }
    return '127.0.0.1';
  }

  private async discoverAndMap(): Promise<void> {
    const localIp = this.getLocalIp();
    this.status.internalIp = localIp;

    // 1. Locate IGD control URL (via direct router gate probe or SSDP)
    const igdInfo = await this.locateIgd();
    if (!igdInfo) {
      this.status.active = false;
      this.status.error = 'Роутер с поддержкой UPnP не обнаружен в локальной сети';
      this.emit('status', this.getStatus());
      return;
    }

    this.controlUrl = igdInfo.controlUrl;
    this.serviceType = igdInfo.serviceType;
    this.status.routerName = igdInfo.friendlyName;

    // 2. Perform AddPortMapping
    await this.addPortMapping(localIp, this.port);

    // 3. Query router WAN IP
    const wanIp = await this.queryWanIp();
    this.status.wanIp = wanIp;
    this.status.isPublicIp = !isPrivateIp(wanIp);

    // 4. In background, fetch actual public internet IP to verify CGNAT
    this.queryPublicInternetIp().then(pubIp => {
      if (pubIp) {
        this.status.publicInternetIp = pubIp;
        // If WAN IP reported by router differs from public IP, it's behind CGNAT
        if (this.status.wanIp && this.status.wanIp !== pubIp) {
          this.status.isPublicIp = false;
        }
        this.emit('status', this.getStatus());
      }
    }).catch(() => {});

    this.status.active = true;
    this.status.error = undefined;
    console.log(`UPnP Port Forwarding Active: ${this.status.routerName} -> port ${this.port}, WAN IP: ${wanIp} (${this.status.isPublicIp ? 'Белый IP' : 'CGNAT / Серый IP'})`);
    this.emit('status', this.getStatus());
  }

  private async locateIgd(): Promise<{ controlUrl: string; serviceType: string; friendlyName?: string } | null> {
    // Generate candidate gateway IPs from local IP
    const localIp = this.getLocalIp();
    const parts = localIp.split('.');
    const candidateIps = [
      `${parts[0]}.${parts[1]}.${parts[2]}.1`,
      '192.168.0.1',
      '192.168.1.1',
      '10.0.0.1',
      '192.168.31.1'
    ];

    const uniqueCandidates = Array.from(new Set(candidateIps));

    // Try direct probes first (super fast: 50-150ms)
    for (const ip of uniqueCandidates) {
      const probeUrls = [
        `http://${ip}:1900/igd.xml`,
        `http://${ip}:1900/rootDesc.xml`,
        `http://${ip}:2869/gatedesc.xml`,
        `http://${ip}:5431/dyndev/generic.xml`
      ];

      for (const url of probeUrls) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(600) });
          if (res.ok) {
            const xml = await res.text();
            const parsed = this.parseIgdXml(xml, url);
            if (parsed) return parsed;
          }
        } catch {}
      }
    }

    // If direct probes didn't find it, fall back to standard SSDP M-SEARCH
    return this.searchSsdp();
  }

  private parseIgdXml(xml: string, rootUrl: string): { controlUrl: string; serviceType: string; friendlyName?: string } | null {
    const baseUrl = new URL(rootUrl);

    // Look for WANIPConnection:1 or WANPPPConnection:1
    const serviceMatch = xml.match(/<serviceType>(urn:schemas-upnp-org:service:WAN(IP|PPP)Connection:1)<\/serviceType>[\s\S]*?<controlURL>([^<]+)<\/controlURL>/i);
    if (!serviceMatch) return null;

    const serviceType = serviceMatch[1];
    let controlPath = serviceMatch[3].trim();

    // Resolve control URL relative to base URL
    let fullControlUrl: string;
    if (controlPath.startsWith('http://') || controlPath.startsWith('https://')) {
      fullControlUrl = controlPath;
    } else {
      if (!controlPath.startsWith('/')) controlPath = '/' + controlPath;
      fullControlUrl = `${baseUrl.protocol}//${baseUrl.host}${controlPath}`;
    }

    let friendlyName: string | undefined;
    const nameMatch = xml.match(/<friendlyName>([^<]+)<\/friendlyName>/i);
    if (nameMatch) {
      friendlyName = nameMatch[1].trim();
    }

    return {
      controlUrl: fullControlUrl,
      serviceType,
      friendlyName
    };
  }

  private searchSsdp(): Promise<{ controlUrl: string; serviceType: string; friendlyName?: string } | null> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      let resolved = false;

      const finish = (result: { controlUrl: string; serviceType: string; friendlyName?: string } | null) => {
        if (!resolved) {
          resolved = true;
          try { socket.close(); } catch {}
          resolve(result);
        }
      };

      const timer = setTimeout(() => finish(null), 2000);

      socket.on('message', async (msg) => {
        const text = msg.toString('utf-8');
        if (text.includes('WANIPConnection:1') || text.includes('WANPPPConnection:1') || text.includes('InternetGatewayDevice')) {
          const locMatch = text.match(/LOCATION:\s*([^\r\n]+)/i);
          if (locMatch) {
            const locationUrl = locMatch[1].trim();
            try {
              const res = await fetch(locationUrl, { signal: AbortSignal.timeout(1000) });
              if (res.ok) {
                const xml = await res.text();
                const parsed = this.parseIgdXml(xml, locationUrl);
                if (parsed) {
                  clearTimeout(timer);
                  finish(parsed);
                }
              }
            } catch {}
          }
        }
      });

      socket.on('error', () => {
        finish(null);
      });

      try {
        socket.bind(0, () => {
          const mSearch =
            'M-SEARCH * HTTP/1.1\r\n' +
            'HOST: 239.255.255.250:1900\r\n' +
            'MAN: "ssdp:discover"\r\n' +
            'MX: 2\r\n' +
            'ST: urn:schemas-upnp-org:device:InternetGatewayDevice:1\r\n\r\n';

          socket.send(mSearch, 0, mSearch.length, 1900, '239.255.255.250');
        });
      } catch {
        finish(null);
      }
    });
  }

  private async addPortMapping(internalIp: string, port: number): Promise<void> {
    if (!this.controlUrl) throw new Error('Control URL not available');

    const soap = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:AddPortMapping xmlns:u="${this.serviceType}">
      <NewRemoteHost></NewRemoteHost>
      <NewExternalPort>${port}</NewExternalPort>
      <NewProtocol>TCP</NewProtocol>
      <NewInternalPort>${port}</NewInternalPort>
      <NewInternalClient>${internalIp}</NewInternalClient>
      <NewEnabled>1</NewEnabled>
      <NewPortMappingDescription>MacDrop</NewPortMappingDescription>
      <NewLeaseDuration>0</NewLeaseDuration>
    </u:AddPortMapping>
  </s:Body>
</s:Envelope>`;

    const res = await fetch(this.controlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        'SOAPAction': `"${this.serviceType}#AddPortMapping"`
      },
      body: soap,
      signal: AbortSignal.timeout(3000)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AddPortMapping failed HTTP ${res.status}: ${errText.substring(0, 100)}`);
    }
  }

  private async deletePortMapping(port: number): Promise<void> {
    if (!this.controlUrl) return;

    const soap = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:DeletePortMapping xmlns:u="${this.serviceType}">
      <NewRemoteHost></NewRemoteHost>
      <NewExternalPort>${port}</NewExternalPort>
      <NewProtocol>TCP</NewProtocol>
    </u:DeletePortMapping>
  </s:Body>
</s:Envelope>`;

    try {
      await fetch(this.controlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          'SOAPAction': `"${this.serviceType}#DeletePortMapping"`
        },
        body: soap,
        signal: AbortSignal.timeout(2000)
      });
    } catch {}
  }

  private async queryWanIp(): Promise<string> {
    if (!this.controlUrl) return '';

    const soap = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:GetExternalIPAddress xmlns:u="${this.serviceType}">
    </u:GetExternalIPAddress>
  </s:Body>
</s:Envelope>`;

    const res = await fetch(this.controlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        'SOAPAction': `"${this.serviceType}#GetExternalIPAddress"`
      },
      body: soap,
      signal: AbortSignal.timeout(3000)
    });

    if (res.ok) {
      const text = await res.text();
      const ipMatch = text.match(/<NewExternalIPAddress>([^<]+)<\/NewExternalIPAddress>/i);
      if (ipMatch) {
        return ipMatch[1].trim();
      }
    }

    return '';
  }

  private async queryPublicInternetIp(): Promise<string> {
    try {
      const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const json = await res.json() as any;
        if (json && json.ip) return json.ip;
      }
    } catch {}

    try {
      const res = await fetch('https://icanhazip.com', { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const text = (await res.text()).trim();
        if (text) return text;
      }
    } catch {}

    return '';
  }
}
