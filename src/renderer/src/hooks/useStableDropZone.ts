import { useState, useRef, useEffect, useCallback } from 'react';
import { isTauri } from '../bridge';
import type { DragDropPayload } from '../vite-env';

export interface UseStableDropZoneOptions {
  zoneRef: React.RefObject<HTMLElement | null>;
  onDropFiles: (filePaths: string[], targetDeviceId?: string) => Promise<any> | void;
  hysteresisBuffer?: number;
  debounceMs?: number;
  onHoveredTargetChange?: (targetDeviceId: string | null) => void;
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

function checkInsideZone(
  rawX: number,
  rawY: number,
  isCssPixel: boolean,
  zoneEl: HTMLElement | null,
  buffer: number = 0
): boolean {
  if (!zoneEl) return false;
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  const zoneRect = zoneEl.getBoundingClientRect();

  // Test DPR scaled coords
  const x1 = isCssPixel ? rawX : rawX / dpr;
  const y1 = isCssPixel ? rawY : rawY / dpr;
  if (isPointInsideRect(x1, y1, zoneRect, buffer)) return true;

  // Test unscaled coords (if already CSS coords)
  if (!isCssPixel && isPointInsideRect(rawX, rawY, zoneRect, buffer)) return true;

  // Test DOM element check
  if (typeof document !== 'undefined' && typeof document.elementFromPoint === 'function') {
    try {
      const el1 = document.elementFromPoint(x1, y1);
      if (el1 && (zoneEl === el1 || zoneEl.contains(el1))) return true;
      if (!isCssPixel) {
        const el2 = document.elementFromPoint(rawX, rawY);
        if (el2 && (zoneEl === el2 || zoneEl.contains(el2))) return true;
      }
    } catch {}
  }

  return false;
}

/**
 * Robust Drag & Drop Hook:
 * - Native Tauri Webview DragDrop integration (WebKit on macOS does not provide file paths in DOM).
 * - Fallback HTML5 Drag & Drop with Watchdog Debounce (100ms) for Electron and test environments.
 * - Continuous geometric collision detection for main dropzone and individual device targets.
 * - Hit-tests both explicitly registered elements and DOM nodes marked with [data-device-id].
 */
export function useStableDropZone({
  zoneRef,
  onDropFiles,
  hysteresisBuffer = 8,
  debounceMs = 100,
  onHoveredTargetChange
}: UseStableDropZoneOptions): UseStableDropZoneReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [isOverZone, setIsOverZone] = useState(false);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [draggedFileName, setDraggedFileName] = useState<string | null>(null);

  // Map of target tiles: deviceId -> HTMLElement
  const targetsMapRef = useRef<Map<string, HTMLElement>>(new Map());

  // Cached file paths from Tauri drag-enter/over events
  const cachedPathsRef = useRef<string[]>([]);

  // Watchdog debounce timer to prevent dragleave flutter
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest refs to prevent stale closures inside global event listeners
  const isOverZoneRef = useRef(false);
  const hoveredTargetIdRef = useRef<string | null>(null);
  const onDropFilesRef = useRef(onDropFiles);
  const onHoveredTargetChangeRef = useRef(onHoveredTargetChange);

  useEffect(() => {
    onDropFilesRef.current = onDropFiles;
  }, [onDropFiles]);

  useEffect(() => {
    onHoveredTargetChangeRef.current = onHoveredTargetChange;
  }, [onHoveredTargetChange]);

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
    cachedPathsRef.current = [];
    onHoveredTargetChangeRef.current?.(null);
  }, [clearWatchdog]);

  /**
   * Updates hit-testing state for both the central zone and target devices.
   */
  const updateCoordinates = useCallback((rawX: number, rawY: number, isCssPixel = false) => {
    const dpr = isCssPixel ? 1 : (typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1);
    const x = rawX / dpr;
    const y = rawY / dpr;

    // 1. Geometric hit-testing for central dropzone (strictly inside dropzone element)
    const zoneEl = zoneRef.current;
    const insideZone = checkInsideZone(rawX, rawY, isCssPixel, zoneEl, isOverZoneRef.current ? hysteresisBuffer : 0);

    if (insideZone !== isOverZoneRef.current) {
      isOverZoneRef.current = insideZone;
      setIsOverZone(insideZone);
    }

    // 2. Geometric hit-testing for target devices
    let matchedId: string | null = null;

    // Check explicitly registered targets first
    for (const [id, el] of targetsMapRef.current.entries()) {
      const tileRect = el.getBoundingClientRect();
      if (isPointInsideRect(x, y, tileRect, 2)) {
        matchedId = id;
        break;
      }
    }

    // Fallback: Check elements under point for [data-device-id] (e.g. sidebar devices)
    if (!matchedId && typeof document !== 'undefined' && typeof document.elementFromPoint === 'function') {
      try {
        const el = document.elementFromPoint(x, y);
        const targetEl = el?.closest('[data-device-id]') as HTMLElement | null;
        if (targetEl) {
          matchedId = targetEl.getAttribute('data-device-id');
        }
      } catch {
        // Ignore any hit-testing errors
      }
    }

    if (matchedId !== hoveredTargetIdRef.current) {
      hoveredTargetIdRef.current = matchedId;
      setHoveredTargetId(matchedId);
      onHoveredTargetChangeRef.current?.(matchedId);
    }
  }, [zoneRef, hysteresisBuffer]);

  // ==================== 1. TAURI NATIVE DRAG & DROP ====================
  useEffect(() => {
    if (typeof window === 'undefined' || !window.macdrop?.onDragDrop) {
      return;
    }

    const unlisten = window.macdrop.onDragDrop(async (payload: DragDropPayload) => {
      if (payload.type === 'enter') {
        clearWatchdog();
        setIsDragging(true);
        const paths = payload.paths || [];
        cachedPathsRef.current = paths;
        if (paths.length > 0) {
          const first = paths[0].split(/[/\\]/).pop() || '';
          setDraggedFileName(paths.length > 1 ? `${first} (+${paths.length - 1})` : first);
        }
        if (payload.position) {
          updateCoordinates(payload.position.x, payload.position.y, false);
        }
      } else if (payload.type === 'over') {
        clearWatchdog();
        setIsDragging(true);
        if (payload.position) {
          updateCoordinates(payload.position.x, payload.position.y, false);
        }
      } else if (payload.type === 'drop') {
        clearWatchdog();
        let droppedInside = isOverZoneRef.current;
        if (payload.position) {
          droppedInside = checkInsideZone(
            payload.position.x,
            payload.position.y,
            false,
            zoneRef.current,
            hysteresisBuffer
          );
        }
        const targetId = hoveredTargetIdRef.current || undefined;
        const paths = (payload.paths && payload.paths.length > 0) ? payload.paths : cachedPathsRef.current;

        resetDragState();

        // ONLY trigger transfer if the drop happened strictly over the dropzone or a target device
        if ((droppedInside || targetId) && paths && paths.length > 0) {
          await onDropFilesRef.current(paths, targetId);
        }
      } else if (payload.type === 'leave') {
        clearWatchdog();
        watchdogTimerRef.current = setTimeout(() => {
          resetDragState();
        }, debounceMs);
      }
    });

    return () => {
      unlisten();
    };
  }, [clearWatchdog, debounceMs, resetDragState, updateCoordinates, hysteresisBuffer, zoneRef]);

  // ==================== 2. HTML5 DOM FALLBACK ====================
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();

      if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) {
        return;
      }

      clearWatchdog();
      setIsDragging(true);

      // In non-Tauri environments, extract filename from dataTransfer.items
      if (!isTauri() && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const first = e.dataTransfer.items[0];
        if (first.kind === 'file') {
          const file = first.getAsFile();
          if (file && file.name) {
            setDraggedFileName(
              e.dataTransfer.items.length > 1
                ? `${file.name} (+${e.dataTransfer.items.length - 1})`
                : file.name
            );
          }
        }
      }

      updateCoordinates(e.clientX, e.clientY, true);
    };

    const handleWindowDragLeave = (_e: DragEvent) => {
      clearWatchdog();
      watchdogTimerRef.current = setTimeout(() => {
        resetDragState();
      }, debounceMs);
    };

    const handleWindowDrop = async (e: DragEvent) => {
      e.preventDefault();
      clearWatchdog();

      // If Tauri is active, Tauri native onDragDrop handles drop with native absolute paths.
      // This prevents duplicate drop actions.
      if (isTauri()) {
        return;
      }

      const droppedInside = checkInsideZone(e.clientX, e.clientY, true, zoneRef.current, hysteresisBuffer);
      const targetId = hoveredTargetIdRef.current || undefined;
      const files = Array.from(e.dataTransfer?.files || []);

      resetDragState();

      // ONLY trigger transfer if dropped inside dropzone or on a target device
      if ((droppedInside || targetId) && files.length > 0) {
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
  }, [debounceMs, clearWatchdog, resetDragState, updateCoordinates]);

  const handleChooseFiles = useCallback((targetDeviceId?: string) => {
    if (window.macdrop?.pickAndSendFiles) {
      window.macdrop.pickAndSendFiles(targetDeviceId);
    }
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
