import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface PairedDevice {
  id: string;
  originalName: string;
  customName: string;
  ip: string;
  port: number;
  pairedAt: string;
  lastSeen: number;
  receiveEnabled?: boolean;
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
}

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

export function getDefaultFolder(): string {
  if (isWin) {
    try {
      if (fs.existsSync('E:\\')) {
        return 'E:\\MacDrop';
      }
    } catch {}
    return path.join(os.homedir(), 'MacDrop');
  }
  return path.join(os.homedir(), 'Desktop', 'MacDrop');
}

function generateRandomKey(length = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateShortDeviceId(): string {
  const prefix = isMac ? 'MAC' : 'PC';
  const num = Math.floor(1000 + Math.random() * 9000);
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
    apiKey: generateRandomKey(32)
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
    } catch (e) {
      console.error('Error reading settings.json, recreating defaults', e);
    }
  } else {
    saveConfig(config);
  }

  // Ensure target folder exists
  try {
    if (!fs.existsSync(config.targetFolder)) {
      fs.mkdirSync(config.targetFolder, { recursive: true });
    }
  } catch (err) {
    config.targetFolder = path.join(os.homedir(), 'MacDrop');
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
