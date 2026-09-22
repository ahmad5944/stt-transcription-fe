import { useCallback, useEffect, useRef, useState } from 'react';

const COMPACT_THRESHOLD = 400;

// Experimental Document Picture-in-Picture API - not yet in the standard DOM lib types.
interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

interface PiPSize {
  width: number;
  height: number;
}

interface UsePictureInPictureReturn {
  isPiPActive: boolean;
  pipWindow: Window | null;
  pipSize: PiPSize;
  isCompact: boolean;
  useFallbackModal: boolean;
  openPiP: () => void;
  closePiP: () => void;
  pipContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function usePictureInPicture(isRecording: boolean = false): UsePictureInPictureReturn {
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipSize, setPipSize] = useState<PiPSize>({ width: 500, height: 400 });
  const [isCompact, setIsCompact] = useState(false);
  const [useFallbackModal, setUseFallbackModal] = useState(false);

  const pipContainerRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const isRecordingRef = useRef(isRecording);
  const isPiPActiveRef = useRef(false);
  // Tracks whether the currently open PiP was opened by the navbar button or by the
  // tab-hidden auto-open, so only the auto-opened one gets auto-closed on tab return.
  const openReasonRef = useRef<'manual' | 'auto' | null>(null);

  // Check if Document PiP API is supported
  const isNativeSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const openPiP = useCallback((reason: 'manual' | 'auto' = 'manual') => {
    openReasonRef.current = reason;
    // Try native PiP first
    if (isNativeSupported && window.documentPictureInPicture) {
      window.documentPictureInPicture.requestWindow({
        width: 500,
        height: 400,
      }).then((pip: Window) => {
        pipWindowRef.current = pip;
        setPipWindow(pip);
        isPiPActiveRef.current = true;
        setIsPiPActive(true);
        setUseFallbackModal(false);

        // Copy all stylesheets from main document to PiP window
        const styleSheets = Array.from(document.styleSheets);
        styleSheets.forEach((styleSheet) => {
          try {
            const cssRules = Array.from(styleSheet.cssRules);
            const style = document.createElement('style');
            style.textContent = cssRules.map((rule) => rule.cssText).join('\n');
            pip.document.head.appendChild(style);
          } catch (e) {
            console.warn('Could not copy stylesheet:', e);
          }
        });

        // Set up resize observer for responsive behavior
        const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const width = entry.contentRect.width;
            const height = entry.contentRect.height;
            setPipSize({ width, height });
            setIsCompact(width < COMPACT_THRESHOLD);
          }
        });

        resizeObserver.observe(pip.document.body);
        resizeObserverRef.current = resizeObserver;

        // Handle PiP window close
        pip.addEventListener('pagehide', () => {
          pipWindowRef.current = null;
          isPiPActiveRef.current = false;
          setIsPiPActive(false);
          setPipWindow(null);
          resizeObserverRef.current?.disconnect();
          resizeObserverRef.current = null;
        });
      }).catch((error: Error) => {
        console.warn('Native PiP failed, falling back to modal:', error);
        // Fallback to modal if native PiP fails
        setUseFallbackModal(true);
        setIsPiPActive(true);
      });
    } else {
      // Browser doesn't support PiP, use fallback modal
      setUseFallbackModal(true);
      isPiPActiveRef.current = true;
      setIsPiPActive(true);
    }
  }, [isNativeSupported]);

  // Auto-open PiP when the tab becomes hidden/minimized WHILE actively recording, and auto-close it
  // again once the tab is visible — but only if it was auto-opened (a manually-opened PiP stays open).
  const closePiP = useCallback(() => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
    }
    openReasonRef.current = null;
    pipWindowRef.current = null;
    isPiPActiveRef.current = false;
    setIsPiPActive(false);
    setPipWindow(null);
    setUseFallbackModal(false);
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (!isPiPActiveRef.current && isRecordingRef.current) {
          openPiP('auto');
        }
      } else if (isPiPActiveRef.current && openReasonRef.current === 'auto') {
        closePiP();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPiPActive, isRecording, openPiP, closePiP]);

  // Handle fallback modal resize — observes pipContainerRef, which DeviceSelection.tsx
  // attaches to the .pip-fallback-overlay element (this ref is the one actually exposed below).
  useEffect(() => {
    if (useFallbackModal && pipContainerRef.current) {
      const handleResize = () => {
        const rect = pipContainerRef.current?.getBoundingClientRect();
        if (rect) {
          const width = rect.width;
          const height = rect.height;
          setPipSize({ width, height });
          setIsCompact(width < COMPACT_THRESHOLD);
        }
      };

      handleResize();
      const observer = new ResizeObserver(handleResize);
      observer.observe(pipContainerRef.current);

      return () => {
        observer.disconnect();
      };
    }
  }, [useFallbackModal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
      if (pipWindowRef.current) {
        pipWindowRef.current.close();
      }
    };
  }, []);

  return {
    isPiPActive,
    pipWindow,
    pipSize,
    isCompact,
    useFallbackModal,
    openPiP,
    closePiP,
    pipContainerRef,
  };
}
