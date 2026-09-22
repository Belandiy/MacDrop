import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSmoothProgress, ProgressData } from './useSmoothProgress';

describe('useSmoothProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const mockProgress: ProgressData = {
    filename: 'test.txt',
    bytesTransferred: 50,
    totalBytes: 100,
    speedBps: 1024,
    direction: 'incoming',
  };

  it('should initialize with default states', () => {
    const { result } = renderHook(() => useSmoothProgress(null));

    expect(result.current.progress).toBeNull();
    expect(result.current.isVisible).toBe(false);
    expect(result.current.isCompleted).toBe(false);
  });

  it('should show progress immediately when provided', () => {
    const { result } = renderHook(() => useSmoothProgress(mockProgress));

    expect(result.current.progress).toEqual(mockProgress);
    expect(result.current.isVisible).toBe(true);
    expect(result.current.isCompleted).toBe(false);
  });

  it('should mark as completed and hide after delay when progress becomes null', () => {
    const { result, rerender } = renderHook(
      ({ progress }) => useSmoothProgress(progress, 800),
      { initialProps: { progress: mockProgress as ProgressData | null } }
    );

    // Initial state with progress
    expect(result.current.isVisible).toBe(true);
    expect(result.current.isCompleted).toBe(false);

    // Update to null
    rerender({ progress: null });

    // Should immediately be marked as completed but still visible and retain progress data
    expect(result.current.isCompleted).toBe(true);
    expect(result.current.isVisible).toBe(true);
    expect(result.current.progress).toEqual(mockProgress);

    // Fast-forward time slightly before delay
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Should still be visible and completed
    expect(result.current.isCompleted).toBe(true);
    expect(result.current.isVisible).toBe(true);
    expect(result.current.progress).toEqual(mockProgress);

    // Fast-forward time to complete the delay
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Should now be hidden and reset
    expect(result.current.isVisible).toBe(false);
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.progress).toBeNull();
  });

  it('should resume progress if new progress is provided during the hide delay', () => {
    const { result, rerender } = renderHook(
      ({ progress }) => useSmoothProgress(progress, 800),
      { initialProps: { progress: mockProgress as ProgressData | null } }
    );

    // Update to null to start the completion sequence
    rerender({ progress: null });

    expect(result.current.isCompleted).toBe(true);
    expect(result.current.isVisible).toBe(true);

    // Fast-forward slightly
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const newProgress: ProgressData = {
      ...mockProgress,
      bytesTransferred: 100,
    };

    // Provide new progress before the hide delay finishes
    rerender({ progress: newProgress });

    // Should immediately become active again and not completed
    expect(result.current.isVisible).toBe(true);
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.progress).toEqual(newProgress);

    // Fast-forward past the original hide delay time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // It should STILL be visible and not reset because the timer should have been cleared
    expect(result.current.isVisible).toBe(true);
    expect(result.current.progress).toEqual(newProgress);
  });

  it('should clear timer on unmount', () => {
    const { unmount, rerender } = renderHook(
      ({ progress }) => useSmoothProgress(progress, 800),
      { initialProps: { progress: mockProgress as ProgressData | null } }
    );

    rerender({ progress: null });

    // Timer is set, now unmount
    unmount();

    // Since it's unmounted, we can't easily assert on state, but we can verify
    // that running timers doesn't throw or cause side effects if handled properly.
    // Vitest will complain if state updates happen after unmount.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  });
});
