import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTauriBridge, isTauri, isElectron } from './index';

describe('Tauri Compatibility Bridge', () => {
  beforeEach(() => {
    // Reset window mock
    // @ts-ignore
    delete window.macdrop;
    // @ts-ignore
    delete window.__TAURI_INTERNALS__;
    // @ts-ignore
    delete window.__TAURI__;
  });

  it('detects runtime environment correctly', () => {
    expect(isTauri()).toBe(false);
    expect(isElectron()).toBe(false);

    // @ts-ignore
    window.__TAURI_INTERNALS__ = {};
    expect(isTauri()).toBe(true);

    // @ts-ignore
    delete window.__TAURI_INTERNALS__;
    // @ts-ignore
    window.macdrop = {} as any;
    expect(isElectron()).toBe(true);
  });

  it('initializes bridgeApi with startDragging method', async () => {
    // @ts-ignore
    window.__TAURI_INTERNALS__ = {};

    await initTauriBridge();

    expect(window.macdrop).toBeDefined();
    expect(typeof window.macdrop.startDragging).toBe('function');
    expect(typeof window.macdrop.minimizeWindow).toBe('function');
    expect(typeof window.macdrop.maximizeWindow).toBe('function');
    expect(typeof window.macdrop.closeWindow).toBe('function');

    // Calling startDragging should not throw
    await expect(window.macdrop.startDragging?.()).resolves.toBeUndefined();
  });
});
