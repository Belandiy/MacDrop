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

// Mock fs and os
vi.mock('fs');
vi.mock('os');

describe('getServiceDir', () => {
  const MOCK_HOMEDIR = '/mock/home/user';
  const EXPECTED_DIR = path.join(MOCK_HOMEDIR, '.macdrop');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(os.homedir).mockReturnValue(MOCK_HOMEDIR);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return the correct directory path', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = getServiceDir();

    expect(result).toBe(EXPECTED_DIR);
    expect(os.homedir).toHaveBeenCalled();
  });

  it('should not try to create the directory if it already exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    getServiceDir();

    expect(fs.existsSync).toHaveBeenCalledWith(EXPECTED_DIR);
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it('should create the directory if it does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    getServiceDir();

    expect(fs.existsSync).toHaveBeenCalledWith(EXPECTED_DIR);
    expect(fs.mkdirSync).toHaveBeenCalledWith(EXPECTED_DIR, { recursive: true });
  });

  it('should silently handle errors when creating the directory fails', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    // Should not throw
    const result = getServiceDir();

    expect(result).toBe(EXPECTED_DIR);
    expect(fs.mkdirSync).toHaveBeenCalledWith(EXPECTED_DIR, { recursive: true });
  });
});
