import { vi } from 'vitest';
import path from 'path';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/path')
  },
  Notification: vi.fn(),
  shell: vi.fn()
}));
