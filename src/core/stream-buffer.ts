/**
 * Stream buffer: collects tokens between animation frames.
 *
 * Instead of triggering a React re-render for every single token,
 * we batch tokens and flush them at the target frame rate.
 * This prevents React reconciliation from becoming the bottleneck.
 */

export interface StreamBufferOptions {
  /** Maximum tokens to buffer before forcing a flush (default: 8) */
  maxBuffer?: number;
  /** Target FPS for flushing (default: 60) */
  targetFps?: number;
  /** Callback when buffer is flushed with accumulated text */
  onFlush: (accumulated: string) => void;
  /** Callback when the stream ends */
  onComplete: (fullText: string) => void;
  /** Callback on stream error */
  onError?: (error: Error) => void;
}

/**
 * Creates a stream buffer that batches incoming tokens
 * and flushes them at the target frame rate.
 */
export function createStreamBuffer(options: StreamBufferOptions) {
  const {
    maxBuffer = 8,
    targetFps = 60,
    onFlush,
    onComplete,
    onError,
  } = options;

  const frameInterval = 1000 / targetFps;
  let buffer = '';
  let fullText = '';
  let lastFlushTime = 0;
  let rafId: number | null = null;
  let isActive = false;

  function flush() {
    if (buffer.length > 0) {
      fullText += buffer;
      const flushed = fullText;
      buffer = '';
      lastFlushTime = performance.now();
      onFlush(flushed);
    }
  }

  function scheduleFlush() {
    if (rafId !== null) return;

    rafId = requestAnimationFrame(() => {
      rafId = null;
      flush();

      // Keep scheduling if there might be more tokens
      if (isActive && buffer.length > 0) {
        scheduleFlush();
      }
    });
  }

  return {
    /**
     * Push a token into the buffer.
     * Automatically schedules flush at the target frame rate.
     */
    push(token: string) {
      buffer += token;
      isActive = true;

      // Force flush if buffer is full
      if (buffer.length >= maxBuffer) {
        flush();
        return;
      }

      // Throttle to target FPS
      const now = performance.now();
      if (now - lastFlushTime >= frameInterval) {
        flush();
      } else {
        scheduleFlush();
      }
    },

    /**
     * Signal that the stream has ended.
     * Flushes any remaining buffer and calls onComplete.
     */
    complete() {
      isActive = false;
      flush();
      onComplete(fullText);
    },

    /**
     * Signal a stream error.
     */
    error(err: Error) {
      isActive = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      onError?.(err);
    },

    /**
     * Cancel the stream buffer and clean up.
     */
    cancel() {
      isActive = false;
      buffer = '';
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },

    /** Get the full accumulated text so far */
    getText() {
      return fullText + buffer;
    },
  };
}
