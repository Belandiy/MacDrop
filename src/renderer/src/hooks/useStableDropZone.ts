import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseStableDropZoneOptions {
  zoneRef: React.RefObject<HTMLElement | null>;
  onDropFiles: (filePaths: string[], targetDeviceId?: string) => Promise<any> | void;
  hysteresisBuffer?: number;
  debounceMs?: number;
}

export interface UseStableDropZoneReturn {
  isDragging: boolean;
  isOverZone: boolean;
  hoveredTargetId: string | null;
  draggedFileName: string | null;
  registerTarget: (id: string, element: HTMLElement | null) => void;
  handleChooseFiles: (targetDeviceId?: string) => void;
}

/**
 * Checks if coordinates (x, y) fall within a DOMRect with an optional hysteresis buffer.
 */
function isPointInsideRect(x: number, y: number, rect: DOMRect, buffer: number = 0): boolean {
  return (
    x >= rect.left - buffer &&
    x <= rect.right + buffer &&
    y >= rect.top - buffer &&
    y <= rect.bottom + buffer
  );
}

/**
 * Robust Chromium-proof Drag & Drop Hook:
 * - Solves e.relatedTarget === null quirk.
 * - Solves dragleave (0,0) coordinates quirk.
 * - Replaces unstable dragCounters with a Watchdog Debounce (100ms).
 * - Uses continuous window.dragover geometric collision detection with hysteresis.
 * - Children can use pointer-events-none to eliminate parasitic bubbling.
 */
export function useStableDropZone({
  zoneRef,
  onDropFiles,
  hysteresisBuffer = 8,
  debounceMs = 100
}: UseStableDropZoneOptions): UseStableDropZoneReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [isOverZone, setIsOverZone] = useState(false);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [draggedFileName, setDraggedFileName] = useState<string | null>(null);

  // Map of target tiles: deviceId -> HTMLElement
  const targetsMapRef = useRef<Map<string, HTMLElement>>(new Map());

  // Watchdog debounce timer to prevent dragleave flutter
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest refs to prevent stale closures inside global event listeners
  const isOverZoneRef = useRef(false);
  const hoveredTargetIdRef = useRef<string | null>(null);
  const onDropFilesRef = useRef(onDropFiles);

  useEffect(() => {
    onDropFilesRef.current = onDropFiles;
  }, [onDropFiles]);

  const registerTarget = useCallback((id: string, element: HTMLElement | null) => {
    if (element) {
      targetsMapRef.current.set(id, element);
    } else {
      targetsMapRef.current.delete(id);
    }
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  const resetDragState = useCallback(() => {
    clearWatchdog();
    setIsDragging(false);
    setIsOverZone(false);
    isOverZoneRef.current = false;
    setHoveredTargetId(null);
    hoveredTargetIdRef.current = null;
    setDraggedFileName(null);
  }, [clearWatchdog]);

  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      // Must preventDefault to allow dropping in Chromium
      e.preventDefault();

      if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) {
        return;
      }

      // 1. WATCHDOG: Any ongoing dragover cancels pending leave watchdog
      clearWatchdog();

      // Ensure dragging state is active
      setIsDragging(true);

      // Extract filename once if present
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const first = e.dataTransfer.items[0];
        if (first.kind === 'file') {
          const file = first.getAsFile();
          if (file && file.name) {
            setDraggedFileName(file.name);
          }
        }
      }

      const x = e.clientX;
      const y = e.clientY;

      // 2. GEOMETRIC HIT-TESTING FOR MAIN ZONE
      const zoneEl = zoneRef.current;
      if (!zoneEl) return;

      const zoneRect = zoneEl.getBoundingClientRect();
      // Apply hysteresis buffer only if already inside to prevent boundary jitter
      const buffer = isOverZoneRef.current ? hysteresisBuffer : 0;
      const insideZone = isPointInsideRect(x, y, zoneRect, buffer);

      if (insideZone !== isOverZoneRef.current) {
        isOverZoneRef.current = insideZone;
        setIsOverZone(insideZone);
      }

      // 3. GEOMETRIC HIT-TESTING FOR DEVICE TILES
      if (insideZone) {
        let matchedId: string | null = null;

        for (const [id, el] of targetsMapRef.current.entries()) {
          const tileRect = el.getBoundingClientRect();
          if (isPointInsideRect(x, y, tileRect, 2)) {
            matchedId = id;
            break;
          }
        }

        if (matchedId !== hoveredTargetIdRef.current) {
          hoveredTargetIdRef.current = matchedId;
          setHoveredTargetId(matchedId);
        }
      } else if (hoveredTargetIdRef.current !== null) {
        hoveredTargetIdRef.current = null;
        setHoveredTargetId(null);
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      // Chromium quirk: dragleave coordinates are always (0, 0) for OS drags.
      // We start a watchdog debounce instead of immediately tearing down state.
      clearWatchdog();

      watchdogTimerRef.current = setTimeout(() => {
        resetDragState();
      }, debounceMs);
    };

    const handleWindowDrop = async (e: DragEvent) => {
      e.preventDefault();
      clearWatchdog();

      const wasOverZone = isOverZoneRef.current;
      const targetId = hoveredTargetIdRef.current || undefined;

      const files = Array.from(e.dataTransfer?.files || []);

      resetDragState();

      if (wasOverZone && files.length > 0) {
        const filePaths = files
          .map((f: any) => {
            if (window.macdrop?.getPathForFile) {
              return window.macdrop.getPathForFile(f);
            }
            return f.path;
          })
          .filter(Boolean);

        if (filePaths.length > 0) {
          await onDropFilesRef.current(filePaths, targetId);
        }
      }
    };

    window.addEventListener('dragover', handleWindowDragOver, { passive: false });
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      clearWatchdog();
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [zoneRef, hysteresisBuffer, debounceMs, clearWatchdog, resetDragState]);

  const handleChooseFiles = useCallback((targetDeviceId?: string) => {
    // Choose files callback handler
  }, []);

  return {
    isDragging,
    isOverZone,
    hoveredTargetId,
    draggedFileName,
    registerTarget,
    handleChooseFiles
  };
}
