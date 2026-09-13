import http from 'http';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { AppConfig, saveConfig } from './config';
import { Notification, shell } from 'electron';

export interface TransferProgress {
  filename: string;
  bytesTransferred: number;
  totalBytes: number;
  speedBps: number;
  direction: 'incoming' | 'outgoing';
}

export class SyncEngine extends EventEmitter {
  private config: AppConfig;
  private server: http.Server | null = null;
  private isConnected = false;
  private currentProgress: TransferProgress | null = null;
  private history: Array<{
    id: string;
    filename: string;
    size: number;
    timestamp: number;
    direction: 'incoming' | 'outgoing';
    status: 'completed' | 'failed';
  }> = [];

  constructor(config: AppConfig) {
    super();
    this.config = config;
  }

  public updateConfig(newConfig: AppConfig) {
    const folderChanged = this.config.targetFolder !== newConfig.targetFolder;
    this.config = newConfig;
    saveConfig(this.config);

    if (folderChanged) {
      console.log('Target folder updated to:', this.config.targetFolder);
      if (!fs.existsSync(this.config.targetFolder)) {
        fs.mkdirSync(this.config.targetFolder, { recursive: true });
      }
      this.emit('folder-changed', this.config.targetFolder);
    }
  }

  public getHistory() {
    return this.history;
  }

  public getStatus() {
    return {
      isConnected: this.isConnected,
      deviceName: this.config.deviceName,
      deviceId: this.config.deviceId,
      targetFolder: this.config.targetFolder,
      pairedDevice: this.config.pairedDevice,
      currentProgress: this.currentProgress,
      recentHistory: this.history.slice(-10).reverse()
    };
  }

  public start() {
    this.startLocalServer();
  }

  public stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  private startLocalServer() {
    const port = this.config.apiPort || 8384;
    this.server = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Device-ID, X-Auth-Key, X-Filename');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      // Handshake / Ping endpoint
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

      // Pairing request
      if (url.pathname === '/api/pair' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.deviceId && data.deviceName) {
              this.config.pairedDevice = {
                id: data.deviceId,
                name: data.deviceName,
                pairedAt: new Date().toISOString()
              };
              this.isConnected = true;
              saveConfig(this.config);
              this.emit('device-paired', this.config.pairedDevice);
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
        const rawFilename = req.headers['x-filename'] as string || `file_${Date.now()}`;
        const filename = decodeURIComponent(rawFilename);
        const totalSize = parseInt(req.headers['content-length'] || '0', 10);
        const targetPath = path.join(this.config.targetFolder, filename);

        console.log(`Receiving incoming file: ${filename} (${totalSize} bytes) -> ${targetPath}`);

        let writtenBytes = 0;
        const startTime = Date.now();
        const writeStream = fs.createWriteStream(targetPath);

        this.currentProgress = {
          filename,
          bytesTransferred: 0,
          totalBytes: totalSize,
          speedBps: 0,
          direction: 'incoming'
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
            status: 'completed'
          });
          this.emit('status-changed', this.getStatus());

          if (this.config.notifications && Notification.isSupported()) {
            const notification = new Notification({
              title: 'MacDrop: Файл получен!',
              body: `${filename} сохранен в ${path.basename(this.config.targetFolder)}`,
              silent: false
            });
            notification.on('click', () => {
              shell.showItemInFolder(targetPath);
            });
            notification.show();
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
      console.log(`MacDrop P2P daemon listening on 0.0.0.0:${port}`);
    });

    this.server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`Port ${port} in use, trying ${port + 1}...`);
        this.config.apiPort = port + 1;
        this.server?.listen(this.config.apiPort, '0.0.0.0');
      } else {
        console.error('P2P Server error:', err);
      }
    });
  }

  // Send a file to target peer (Mac or PC)
  public async sendFile(filePath: string, peerAddress = '127.0.0.1:8384'): Promise<boolean> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    const filename = path.basename(filePath);

    return new Promise((resolve, reject) => {
      const [host, port] = peerAddress.split(':');
      const req = http.request({
        host,
        port: parseInt(port || '8384', 10),
        path: '/api/upload',
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': stat.size,
          'x-filename': encodeURIComponent(filename),
          'x-device-id': this.config.deviceId
        }
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
            status: 'completed'
          });
          this.emit('status-changed', this.getStatus());
          resolve(true);
        } else {
          reject(new Error(`Server returned HTTP ${res.statusCode}`));
        }
      });

      req.on('error', (err) => {
        this.currentProgress = null;
        this.emit('progress', null);
        reject(err);
      });

      const fileStream = fs.createReadStream(filePath);
      let sentBytes = 0;
      const startTime = Date.now();

      this.currentProgress = {
        filename,
        bytesTransferred: 0,
        totalBytes: stat.size,
        speedBps: 0,
        direction: 'outgoing'
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
