import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getServiceDir } from '../config';

// Mock electron to avoid errors when importing config.ts
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mocked/user/data/path')
  }
}));

describe('getServiceDir', () => {
  const MOCK_HOMEDIR = '/mock/home/user';
  const EXPECTED_DIR = path.join(MOCK_HOMEDIR, '.macdrop');

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(os, 'homedir').mockReturnValue(MOCK_HOMEDIR);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return the correct directory path', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = getServiceDir();

    expect(result).toBe(EXPECTED_DIR);
    expect(os.homedir).toHaveBeenCalled();
  });

  it('should not try to create the directory if it already exists', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined as any);

    getServiceDir();

    expect(existsSpy).toHaveBeenCalledWith(EXPECTED_DIR);
    expect(mkdirSpy).not.toHaveBeenCalled();
  });

  it('should create the directory if it does not exist', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined as any);

    getServiceDir();

    expect(existsSpy).toHaveBeenCalledWith(EXPECTED_DIR);
    expect(mkdirSpy).toHaveBeenCalledWith(EXPECTED_DIR, { recursive: true });
  });

  it('should silently handle errors when creating the directory fails', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw new Error('Permission denied');
    });

    expect(() => getServiceDir()).not.toThrow();
  });
});
