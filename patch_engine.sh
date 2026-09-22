cat << 'DIFF' > engine.diff
<<<<<<< SEARCH
  private pendingOutgoingPairings: Set<string> = new Set();
  private mobileSessionToken: string = crypto.randomBytes(16).toString('hex');
  private isBatchCancelled = false;
  private batchReceiverTimeout: NodeJS.Timeout | null = null;
=======
  private pendingOutgoingPairings: Set<string> = new Set();
  private mobileSessionToken: string = crypto.randomBytes(16).toString('hex');
  private isBatchCancelled = false;
  private batchReceiverTimeout: NodeJS.Timeout | null = null;
  private mobileSessionQueue: Array<{ filename: string; path: string; size: number; mtimeMs: number }> = [];
>>>>>>> REPLACE
<<<<<<< SEARCH
  public regenerateMobileSessionToken(): string {
    this.mobileSessionToken = crypto.randomBytes(16).toString('hex');
    return this.mobileSessionToken;
  }
=======
  public regenerateMobileSessionToken(): string {
    this.mobileSessionToken = crypto.randomBytes(16).toString('hex');
    this.mobileSessionQueue = [];
    return this.mobileSessionToken;
  }

  public enqueueForMobileSession(filename: string, filePath: string, size: number) {
    this.mobileSessionQueue.unshift({
      filename,
      path: filePath,
      size,
      mtimeMs: Date.now()
    });
    // Keep max 50 items
    if (this.mobileSessionQueue.length > 50) {
      this.mobileSessionQueue.pop();
    }
    this.emit('status-changed', this.getStatus());
  }
>>>>>>> REPLACE
<<<<<<< SEARCH
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
=======
  public getStatus() {
    // Append virtual mobile device to UI
    const virtualMobileDevice: PairedDevice = {
      id: 'mobile-web',
      originalName: 'Телефон (Web Drop)',
      customName: 'Телефон (Web Drop)',
      ip: '127.0.0.1',
      port: 8384,
      pairedAt: new Date().toISOString(),
      lastSeen: Date.now(),
      connectionMode: 'local'
    };

    const pairedWithVirtual = [...this.config.pairedDevices, virtualMobileDevice];

    const isConnected = pairedWithVirtual.length > 0;
    return {
      isConnected,
      deviceName: this.config.deviceName,
      deviceId: this.config.deviceId,
      targetFolder: this.config.targetFolder,
      pairedDevices: pairedWithVirtual,
      currentProgress: this.currentProgress,
      recentHistory: [...this.history].reverse().slice(0, 50),
      upnpStatus: this.upnpStatus,
      pendingTransfersCount: this.pendingTransfers.size
    };
  }
>>>>>>> REPLACE
<<<<<<< SEARCH
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
=======
        // 4. List PC files for download to mobile (from secure session queue)
        if (url.pathname === '/api/mobile/files' && req.method === 'GET') {
          try {
            const files = this.mobileSessionQueue.map(item => ({
              name: item.filename,
              size: item.size,
              mtime: item.mtimeMs,
              time: new Date(item.mtimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }));

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

          const queuedItem = this.mobileSessionQueue.find(i => i.filename === filename);
          if (!queuedItem || !fs.existsSync(queuedItem.path)) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Файл не найден или недоступен для скачивания');
            return;
          }

          const safePath = queuedItem.path;
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
>>>>>>> REPLACE
<<<<<<< SEARCH
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
=======
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

    if (targetDeviceId === 'mobile-web') {
      const filename = overrideFilename || path.basename(itemPath);
      // Simulate progress for UI
      this.currentProgress = {
        filename,
        bytesTransferred: stat.size,
        totalBytes: stat.size,
        speedBps: stat.size,
        direction: 'outgoing',
        peerDeviceId: 'mobile-web',
        peerName: 'Телефон (Web Drop)',
        currentIndex: batchContext?.currentIndex,
        totalCount: batchContext?.totalCount,
        batchBytesTransferred: batchContext ? batchContext.batchCompletedBytes + stat.size : undefined,
        batchTotalBytes: batchContext ? batchContext.batchTotalBytes : undefined
      };
      this.emit('progress', this.currentProgress);

      if (stat.isDirectory()) {
        const folderName = path.basename(itemPath);
        const abortController = new AbortController();
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
          const zipStat = fs.statSync(zipResult.zipPath);
          this.enqueueForMobileSession(zipResult.zipFilename, zipResult.zipPath, zipStat.size);
        } catch (e) {
          console.error("Failed to zip folder for mobile", e);
        }
      } else {
        this.enqueueForMobileSession(filename, itemPath, stat.size);
      }

      setTimeout(() => {
        if (!batchContext || batchContext.isLastItem) {
          this.currentProgress = null;
          this.emit('progress', null);
        }
        this.history.push({
          id: crypto.randomBytes(8).toString('hex'),
          filename,
          size: stat.size,
          timestamp: Date.now(),
          direction: 'outgoing',
          status: 'completed',
          peerDeviceId: 'mobile-web',
          peerName: 'Телефон (Web Drop)'
        });
        this.saveHistory();
        this.emit('status-changed', this.getStatus());
      }, 500);

      return;
    }

    let peer: PairedDevice | undefined;
    if (targetDeviceId) {
      peer = this.deviceMap.get(targetDeviceId);
    } else {
      peer = this.config.pairedDevices[0];
    }
>>>>>>> REPLACE
DIFF
