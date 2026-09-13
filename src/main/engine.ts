import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';
import { AppConfig, PairedDevice, saveConfig } from './config';
import { Notification, shell } from 'electron';

export interface TransferProgress {
  filename: string;
  bytesTransferred: number;
  totalBytes: number;
  speedBps: number;
  direction: 'incoming' | 'outgoing';
  peerDeviceId?: string;
  peerName?: string;
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

export class SyncEngine extends EventEmitter {
  private config: AppConfig;
  private server: http.Server | null = null;
  private currentProgress: TransferProgress | null = null;
  private history: HistoryItem[] = [];

  constructor(config: AppConfig) {
    super();
    this.config = config;
    this.loadHistory();
  }

  private getHistoryPath(): string {
    if (this.config.targetFolder) {
      return path.join(this.config.targetFolder, '.macdrop_history.json');
    }
    return path.join(os.homedir(), '.macdrop', '.macdrop_history.json');
  }

  private loadHistory() {
    try {
      const p = this.getHistoryPath();
      if (fs.existsSync(p)) {
        const data = fs.readFileSync(p, 'utf-8');
        this.history = JSON.parse(data);
        return;
      }

      // Check legacy paths (e.g. on Desktop or parent directory) to migrate
      const legacyPaths = [
        path.join(path.dirname(this.config.targetFolder), '.macdrop_history.json'),
        path.join(os.homedir(), 'Desktop', '.macdrop_history.json'),
        path.join(os.homedir(), '.macdrop_history.json')
      ];

      for (const leg of legacyPaths) {
        if (fs.existsSync(leg) && leg !== p) {
          try {
            const data = fs.readFileSync(leg, 'utf-8');
            this.history = JSON.parse(data);
            this.saveHistory();
            // Clean up old file from Desktop / parent directory
            fs.unlinkSync(leg);
            break;
          } catch {}
        }
      }
    } catch {}
  }

  private saveHistory() {
    try {
      const p = this.getHistoryPath();
      fs.writeFileSync(p, JSON.stringify(this.history.slice(-100), null, 2), 'utf-8');
    } catch {}
  }

  public updateConfig(newConfig: AppConfig) {
    const folderChanged = this.config.targetFolder !== newConfig.targetFolder;
    this.config = newConfig;
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
    const dev = this.config.pairedDevices.find(d => d.id === deviceId);
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
      saveConfig(this.config);
      this.emit('status-changed', this.getStatus());
      return true;
    }
    return false;
  }

  public toggleDeviceReceive(deviceId: string, enabled: boolean): boolean {
    const dev = this.config.pairedDevices.find(d => d.id === deviceId);
    if (dev) {
      dev.receiveEnabled = enabled;
      saveConfig(this.config);
      this.emit('status-changed', this.getStatus());
      return true;
    }
    return false;
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
      recentHistory: [...this.history].reverse().slice(0, 50)
    };
  }

  public getHistoryForDevice(deviceId: string): HistoryItem[] {
    return this.history.filter(h => h.peerDeviceId === deviceId).reverse();
  }

  public start() {
    this.startLocalServer();
  }

  public stop() {
    if (this.server) {
      try {
        this.server.close();
      } catch {}
      this.server = null;
    }
  }

  public async pairWithRemote(peerIp: string, peerPort = 8384): Promise<{ success: boolean; peer?: PairedDevice; error?: string }> {
    const cleanIp = peerIp.replace(/^::ffff:/, '').trim();
    return new Promise((resolve) => {
      const payload = JSON.stringify({
        deviceId: this.config.deviceId,
        deviceName: this.config.deviceName,
        port: this.config.apiPort || 8384
      });

      const req = http.request({
        hostname: cleanIp,
        port: peerPort,
        path: '/api/pair',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 6000
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(body);
              const deviceId = data.deviceId || 'Peer';
              const originalName = data.deviceName || 'Устройство';

              let existing = this.config.pairedDevices.find(d => d.id === deviceId);
              if (existing) {
                existing.ip = cleanIp;
                existing.port = peerPort;
                existing.lastSeen = Date.now();
              } else {
                existing = {
                  id: deviceId,
                  originalName,
                  customName: originalName,
                  ip: cleanIp,
                  port: peerPort,
                  pairedAt: new Date().toISOString(),
                  lastSeen: Date.now()
                };
                this.config.pairedDevices.push(existing);
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
          resolve({ success: false, error: `Код ответа: HTTP ${res.statusCode}` });
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Таймаут подключения' });
      });

      req.write(payload);
      req.end();
    });
  }

  private startLocalServer() {
    const port = this.config.apiPort || 8384;
    this.server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Device-ID, X-Device-Name, X-Filename, X-Relative-Path');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      if (url.pathname === '/api/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          deviceId: this.config.deviceId,
          deviceName: this.config.deviceName,
          platform: process.platform
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

              let existing = this.config.pairedDevices.find(d => d.id === data.deviceId);
              if (existing) {
                existing.ip = cleanIp;
                existing.port = data.port || 8384;
                existing.originalName = data.deviceName;
                existing.lastSeen = Date.now();
              } else {
                existing = {
                  id: data.deviceId,
                  originalName: data.deviceName,
                  customName: data.deviceName,
                  ip: cleanIp,
                  port: data.port || 8384,
                  pairedAt: new Date().toISOString(),
                  lastSeen: Date.now()
                };
                this.config.pairedDevices.push(existing);
              }

              saveConfig(this.config);
              console.log(`Device paired from ${cleanIp}:`, existing);
              this.emit('device-paired', existing);
              this.emit('status-changed', this.getStatus());

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                deviceId: this.config.deviceId,
                deviceName: this.config.deviceName
              }));
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
        const rawFilename = req.headers['x-filename'] as string || `file_${Date.now()}`;
        const rawRelPath = req.headers['x-relative-path'] as string || '';
        const filename = decodeURIComponent(rawFilename);
        const relPath = rawRelPath ? decodeURIComponent(rawRelPath) : filename;
        const totalSize = parseInt(req.headers['content-length'] || '0', 10);

        const peer = this.config.pairedDevices.find(d => d.id === senderId);
        if (peer && peer.receiveEnabled === false) {
          console.log(`Receiving is disabled for peer ${peer.customName || peer.originalName} (${senderId}).`);
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            error: `Получатель временно отключил приём файлов с вашего устройства.`
          }));
          return;
        }

        const peerName = peer?.customName || peer?.originalName || (senderId ? `Устройство (${senderId})` : 'Второе устройство');

        const targetPath = path.join(this.config.targetFolder, relPath);
        const targetDir = path.dirname(targetPath);

        try {
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
        } catch (e) {
          console.error('Failed to create target dir:', targetDir, e);
        }

        console.log(`Receiving from ${peerName}: ${filename} -> ${targetPath}`);

        let writtenBytes = 0;
        const startTime = Date.now();
        const writeStream = fs.createWriteStream(targetPath);

        this.currentProgress = {
          filename,
          bytesTransferred: 0,
          totalBytes: totalSize,
          speedBps: 0,
          direction: 'incoming',
          peerDeviceId: senderId,
          peerName
        };
        this.emit('progress', this.currentProgress);

        req.on('data', (chunk) => {
          writtenBytes += chunk.length;
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = elapsed > 0 ? writtenBytes / elapsed : 0;

          if (this.currentProgress) {
            this.currentProgress.bytesTransferred = writtenBytes;
            this.currentProgress.speedBps = speed;
            this.emit('progress', this.currentProgress);
          }
        });

        req.pipe(writeStream);

        writeStream.on('finish', () => {
          this.currentProgress = null;
          this.emit('progress', null);

          this.history.push({
            id: Math.random().toString(36).substring(7),
            filename,
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
              const notification = new Notification({
                title: `MacDrop: Файл от ${peerName}!`,
                body: `${filename} сохранен в ${path.basename(this.config.targetFolder)}`
              });
              notification.on('click', () => {
                shell.showItemInFolder(targetPath);
              });
              notification.show();
            } catch {}
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, path: targetPath }));
        });

        writeStream.on('error', (err) => {
          console.error('File write stream error:', err);
          this.currentProgress = null;
          this.emit('progress', null);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
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
  public async sendItem(itemPath: string, targetDeviceId?: string, relativePrefix = ''): Promise<void> {
    if (!fs.existsSync(itemPath)) return;
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      const entries = fs.readdirSync(itemPath);
      for (const entry of entries) {
        const fullChild = path.join(itemPath, entry);
        const childRel = path.join(relativePrefix || path.basename(itemPath), entry);
        await this.sendItem(fullChild, targetDeviceId, childRel);
      }
      return;
    }

    let peer: PairedDevice | undefined;
    if (targetDeviceId) {
      peer = this.config.pairedDevices.find(d => d.id === targetDeviceId);
    } else {
      peer = this.config.pairedDevices[0];
    }

    if (!peer || !peer.ip) {
      throw new Error('Нет доступных связанных устройств. Сначала выполните сопряжение.');
    }

    const peerIp = peer.ip;
    const peerPort = peer.port || 8384;
    const filename = path.basename(itemPath);
    const relPath = relativePrefix ? path.join(relativePrefix) : filename;
    const peerName = peer.customName || peer.originalName;

    return new Promise((resolve, reject) => {
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
          'x-device-name': encodeURIComponent(this.config.deviceName)
        },
        timeout: 30000
      }, (res) => {
        if (res.statusCode === 200) {
          this.currentProgress = null;
          this.emit('progress', null);
          this.history.push({
            id: Math.random().toString(36).substring(7),
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

      req.on('error', (err) => {
        this.currentProgress = null;
        this.emit('progress', null);
        reject(err);
      });

      const fileStream = fs.createReadStream(itemPath);
      let sentBytes = 0;
      const startTime = Date.now();

      this.currentProgress = {
        filename,
        bytesTransferred: 0,
        totalBytes: stat.size,
        speedBps: 0,
        direction: 'outgoing',
        peerDeviceId: peer?.id,
        peerName
      };
      this.emit('progress', this.currentProgress);

      fileStream.on('data', (chunk) => {
        sentBytes += chunk.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? sentBytes / elapsed : 0;
        if (this.currentProgress) {
          this.currentProgress.bytesTransferred = sentBytes;
          this.currentProgress.speedBps = speed;
          this.emit('progress', this.currentProgress);
        }
      });

      fileStream.pipe(req);
    });
  }
}
