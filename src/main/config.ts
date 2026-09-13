import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface AppConfig {
  targetFolder: string;
  autoStart: boolean;
  notifications: boolean;
  deviceId: string;
  deviceName: string;
  pairedDevice?: {
    id: string;
    name: string;
    pairedAt: string;
  };
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
    } catch {
      // Disk E not accessible
    }
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
    apiPort: 8384,
    apiKey: generateRandomKey(32)
  };

  if (fs.existsSync(configFile)) {
    try {
      const data = fs.readFileSync(configFile, 'utf-8');
      config = { ...config, ...JSON.parse(data) };
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
    console.error(`Cannot create target folder ${config.targetFolder}, falling back to home dir`, err);
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
