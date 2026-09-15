import { useState, useEffect, useRef } from 'react';

export interface ProgressData {
  filename: string;
  bytesTransferred: number;
  totalBytes: number;
  speedBps: number;
  direction: 'incoming' | 'outgoing';
  peerDeviceId?: string;
  peerName?: string;
  currentIndex?: number;
  totalCount?: number;
  batchBytesTransferred?: number;
  batchTotalBytes?: number;
}

export function useSmoothProgress(
  currentProgress: ProgressData | null | undefined,
  hideDelayMs = 800
) {
  const [activeProgress, setActiveProgress] = useState<ProgressData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentProgress) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setActiveProgress(currentProgress);
      setIsVisible(true);
      setIsCompleted(false);
    } else {
      if (activeProgress && isVisible) {
        setIsCompleted(true);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          setIsVisible(false);
          setIsCompleted(false);
          setActiveProgress(null);
          timerRef.current = null;
        }, hideDelayMs);
      }
    }
  }, [currentProgress, hideDelayMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    progress: activeProgress,
    isVisible,
    isCompleted
  };
}
