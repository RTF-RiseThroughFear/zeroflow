/**
 * useFpsCounter: Hook that measures real-time FPS.
 * Uses requestAnimationFrame to count actual frame renders.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface FpsState {
  fps: number;
  frameTime: number;
  isTracking: boolean;
}

/**
 * Hook that tracks frames-per-second in real time.
 *
 * @returns FPS state and control functions
 */
export function useFpsCounter() {
  const [state, setState] = useState<FpsState>({
    fps: 0,
    frameTime: 0,
    isTracking: false,
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const isTrackingRef = useRef(false);

  const tick = useCallback((now: number) => {
    frameCountRef.current++;

    const elapsed = now - lastTimeRef.current;
    if (elapsed >= 500) {
      const fps = Math.round((frameCountRef.current / elapsed) * 1000);
      const frameTime = +(elapsed / frameCountRef.current).toFixed(1);
      setState({ fps, frameTime, isTracking: true });
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    if (isTrackingRef.current) {
      rafIdRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const start = useCallback(() => {
    if (isTrackingRef.current) return;
    isTrackingRef.current = true;
    frameCountRef.current = 0;
    lastTimeRef.current = performance.now();
    setState(prev => ({ ...prev, isTracking: true }));
    rafIdRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = useCallback(() => {
    isTrackingRef.current = false;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setState(prev => ({ ...prev, isTracking: false }));
  }, []);

  const reset = useCallback(() => {
    stop();
    setState({ fps: 0, frameTime: 0, isTracking: false });
  }, [stop]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return { ...state, start, stop, reset };
}

/**
 * useReflowCounter: Counts layout shifts using PerformanceObserver.
 */
export function useReflowCounter() {
  const [count, setCount] = useState(0);
  const observerRef = useRef<PerformanceObserver | null>(null);

  const start = useCallback(() => {
    setCount(0);
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if ('hadRecentInput' in entry && !(entry as PerformanceEntry & { hadRecentInput: boolean }).hadRecentInput) {
            setCount(prev => prev + 1);
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: false });
      observerRef.current = observer;
    } catch {
      // PerformanceObserver not supported or layout-shift not available
    }
  }, []);

  const stop = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stop();
    setCount(0);
  }, [stop]);

  useEffect(() => () => { observerRef.current?.disconnect(); }, []);

  return { count, start, stop, reset };
}
