import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStableDropZone } from './useStableDropZone';

describe('useStableDropZone', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const createMockZoneRef = (rect = { left: 100, top: 100, right: 300, bottom: 200, width: 200, height: 100 }) => {
    const el = document.createElement('div');
    el.getBoundingClientRect = vi.fn(() => rect as DOMRect);
    return { current: el };
  };

  it('should initialize with resting state', () => {
    const zoneRef = createMockZoneRef();
    const onDropFiles = vi.fn();

    const { result } = renderHook(() =>
      useStableDropZone({
        zoneRef,
        onDropFiles
      })
    );

    expect(result.current.isDragging).toBe(false);
    expect(result.current.isOverZone).toBe(false);
    expect(result.current.hoveredTargetId).toBeNull();
  });

  it('should activate dragging on window dragover with Files', () => {
    const zoneRef = createMockZoneRef();
    const onDropFiles = vi.fn();

    const { result } = renderHook(() =>
      useStableDropZone({
        zoneRef,
        onDropFiles
      })
    );

    act(() => {
      const event = new Event('dragover') as any;
      event.preventDefault = vi.fn();
      event.dataTransfer = { types: ['Files'], items: [] };
      event.clientX = 50; // Outside zone
      event.clientY = 50;
      window.dispatchEvent(event);
    });

    expect(result.current.isDragging).toBe(true);
    expect(result.current.isOverZone).toBe(false);
  });

  it('should detect when cursor is geometrically inside zone', () => {
    const zoneRef = createMockZoneRef({ left: 100, top: 100, right: 300, bottom: 200, width: 200, height: 100 });
    const onDropFiles = vi.fn();

    const { result } = renderHook(() =>
      useStableDropZone({
        zoneRef,
        onDropFiles
      })
    );

    act(() => {
      const event = new Event('dragover') as any;
      event.preventDefault = vi.fn();
      event.dataTransfer = { types: ['Files'], items: [] };
      event.clientX = 150; // Inside zone
      event.clientY = 150;
      window.dispatchEvent(event);
    });

    expect(result.current.isDragging).toBe(true);
    expect(result.current.isOverZone).toBe(true);
  });

  it('should NOT reset immediately on dragleave due to Watchdog Debounce', () => {
    const zoneRef = createMockZoneRef();
    const onDropFiles = vi.fn();

    const { result } = renderHook(() =>
      useStableDropZone({
        zoneRef,
        onDropFiles,
        debounceMs: 100
      })
    );

    // Enter
    act(() => {
      const event = new Event('dragover') as any;
      event.preventDefault = vi.fn();
      event.dataTransfer = { types: ['Files'], items: [] };
      event.clientX = 150;
      event.clientY = 150;
      window.dispatchEvent(event);
    });

    expect(result.current.isDragging).toBe(true);

    // Leave event (Chromium coordinates 0,0)
    act(() => {
      const leaveEvent = new Event('dragleave') as any;
      window.dispatchEvent(leaveEvent);
    });

    // Still true because watchdog debounce is running!
    expect(result.current.isDragging).toBe(true);

    // Fast-forward 50ms (before debounce expires)
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current.isDragging).toBe(true);

    // Subsequent dragover cancels watchdog: prevents flicker!
    act(() => {
      const event = new Event('dragover') as any;
      event.preventDefault = vi.fn();
      event.dataTransfer = { types: ['Files'], items: [] };
      event.clientX = 155;
      event.clientY = 155;
      window.dispatchEvent(event);
    });

    // Fast-forward another 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });
    // Still active because watchdog was canceled by the dragover
    expect(result.current.isDragging).toBe(true);

    // Now truly leave and let watchdog expire
    act(() => {
      const leaveEvent = new Event('dragleave') as any;
      window.dispatchEvent(leaveEvent);
      vi.advanceTimersByTime(110);
    });

    // Now cleanly reset
    expect(result.current.isDragging).toBe(false);
    expect(result.current.isOverZone).toBe(false);
  });
});
