/**
 * useFpsCounter: Hook that measures real-time FPS.
 * Uses requestAnimationFrame to count actual frame renders.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

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
 * useHeightChangeCounter: Counts how many times an element's
 * height changes. This is a per-element proxy for "layout shifts"
 * since PerformanceObserver layout-shift is page-global.
 *
 * For the react-markdown side, the container height changes on
 * every token because the browser recalculates layout.
 * For the zeroflow side, the height is pre-set via pretext, so
 * it changes smoothly and predictably (or not at all).
 */
export function useHeightChangeCounter() {
  const [count, setCount] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const lastHeightRef = useRef(0);
  const isTrackingRef = useRef(false);

  const setElement = useCallback((el: HTMLDivElement | null) => {
    elementRef.current = el;
  }, []);

  const start = useCallback(() => {
    setCount(0);
    lastHeightRef.current = 0;
    isTrackingRef.current = true;

    if (!elementRef.current) return;

    try {
      const observer = new ResizeObserver((entries) => {
        if (!isTrackingRef.current) return;
        for (const entry of entries) {
          const newHeight = entry.contentRect.height;
          // Only count if height actually changed by more than 1px
          // (ignoring sub-pixel rounding)
          if (Math.abs(newHeight - lastHeightRef.current) > 1) {
            lastHeightRef.current = newHeight;
            setCount(prev => prev + 1);
          }
        }
      });
      observer.observe(elementRef.current);
      observerRef.current = observer;
    } catch {
      // ResizeObserver not supported
    }
  }, []);

  const stop = useCallback(() => {
    isTrackingRef.current = false;
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stop();
    setCount(0);
  }, [stop]);

  useEffect(() => () => { observerRef.current?.disconnect(); }, []);

  return { count, setElement, start, stop, reset };
}
