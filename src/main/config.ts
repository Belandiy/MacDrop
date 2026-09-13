import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

export interface PairedDevice {
  id: string;
  originalName: string;
  customName: string;
  ip: string;
  port: number;
  remoteIp?: string;
  remotePort?: number;
  pairedAt: string;
  lastSeen: number;
  receiveEnabled?: boolean;
  connectionMode?: 'local' | 'remote' | 'offline';
  authToken?: string;
}

export interface AppConfig {
  targetFolder: string;
  autoStart: boolean;
  notifications: boolean;
  deviceId: string;
  deviceName: string;
  pairedDevices: PairedDevice[];
  apiPort: number;
  apiKey: string;
  upnpEnabled?: boolean;
  wanIp?: string;
  customRemoteHost?: string;
}

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

export function getServiceDir(): string {
  const dir = path.join(os.homedir(), '.macdrop');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return dir;
}

export function getDefaultFolder(): string {
  if (isWin) {
    try {
      if (fs.existsSync('E:\\')) {
        return 'E:\\MacDrop';
      }
    } catch {}
    return path.join(os.homedir(), 'MacDrop');
  }
  // macOS & Linux: ~/MacDrop (visible user folder for files)
  return path.join(os.homedir(), 'MacDrop');
}

function generateRandomKey(length = 32): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

function generateShortDeviceId(): string {
  const prefix = isMac ? 'MAC' : 'PC';
  const num = 1000 + (crypto.randomInt ? crypto.randomInt(0, 9000) : (crypto.randomBytes(2).readUInt16BE(0) % 9000));
  return `${prefix}-${num}`;
}

const configDir = path.join(app.getPath('userData'));
const configFile = path.join(configDir, 'settings.json');

export function loadConfig(): AppConfig {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let config: AppConfig = {
    targetFolder: getDefaultFolder(),
    autoStart: true,
    notifications: true,
    deviceId: generateShortDeviceId(),
    deviceName: os.hostname() || (isMac ? "Andrey's Mac" : "Andrey's PC"),
    pairedDevices: [],
    apiPort: 8384,
    apiKey: generateRandomKey(32),
    upnpEnabled: true
  };

  if (fs.existsSync(configFile)) {
    try {
      const data = fs.readFileSync(configFile, 'utf-8');
      const parsed = JSON.parse(data);
      config = { ...config, ...parsed };

      // Migrate single pairedDevice to pairedDevices array if needed
      if ((parsed as any).pairedDevice && (!config.pairedDevices || config.pairedDevices.length === 0)) {
        const old = (parsed as any).pairedDevice;
        config.pairedDevices = [{
          id: old.id,
          originalName: old.name || 'Устройство',
          customName: old.name || 'Устройство',
          ip: old.ip || '127.0.0.1',
          port: old.port || 8384,
          pairedAt: old.pairedAt || new Date().toISOString(),
          lastSeen: Date.now()
        }];
      }

      // Ensure internal service directory exists
      getServiceDir();

      // Migration for macOS: ~/.macdrop is service dir, ~/MacDrop is user file folder
      if (isMac) {
        const legacyServiceTarget = path.join(os.homedir(), '.macdrop');
        const legacyDesktopTarget = path.join(os.homedir(), 'Desktop', 'MacDrop');
        if (config.targetFolder === legacyServiceTarget || config.targetFolder === legacyDesktopTarget) {
          config.targetFolder = path.join(os.homedir(), 'MacDrop');
          saveConfig(config);

          // Migrate any user files from ~/.macdrop to ~/MacDrop
          try {
            if (fs.existsSync(legacyServiceTarget)) {
              if (!fs.existsSync(config.targetFolder)) {
                fs.mkdirSync(config.targetFolder, { recursive: true });
              }
              const entries = fs.readdirSync(legacyServiceTarget);
              for (const file of entries) {
                // Keep service and hidden files in ~/.macdrop
                if (file.startsWith('.') || file.endsWith('.json')) continue;
                const oldPath = path.join(legacyServiceTarget, file);
                const newPath = path.join(config.targetFolder, file);
                if (!fs.existsSync(newPath) && fs.statSync(oldPath).isFile()) {
                  fs.renameSync(oldPath, newPath);
                  console.log(`[Config] Migrated user file to ~/MacDrop: ${file}`);
                }
              }
            }
          } catch (mErr) {
            console.error('Migration error from legacy ~/.macdrop:', mErr);
          }
        }
      }
    } catch (e) {
      console.error('Error reading settings.json, recreating defaults', e);
    }
  } else {
    saveConfig(config);
  }

  // Ensure internal service directory exists
  getServiceDir();

  // Ensure target folder exists
  try {
    if (!fs.existsSync(config.targetFolder)) {
      fs.mkdirSync(config.targetFolder, { recursive: true });
    }
  } catch (err) {
    config.targetFolder = getDefaultFolder();
    try {
      fs.mkdirSync(config.targetFolder, { recursive: true });
    } catch {}
  }

  return config;
}

export function saveConfig(config: AppConfig): void {
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save config:', err);
  }
}
