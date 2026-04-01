/**
 * Vitest global test setup.
 *
 * Mocks browser APIs not available in Node:
 * - requestAnimationFrame / cancelAnimationFrame
 * - performance.now (already available in Node)
 */

import { vi } from 'vitest';

// Mock requestAnimationFrame for stream-buffer tests
let rafId = 0;
const rafCallbacks = new Map<number, FrameRequestCallback>();

globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback): number => {
  const id = ++rafId;
  rafCallbacks.set(id, cb);
  return id;
});

globalThis.cancelAnimationFrame = vi.fn((id: number): void => {
  rafCallbacks.delete(id);
});

/**
 * Flush all pending requestAnimationFrame callbacks.
 * Call this in tests to simulate animation frame execution.
 */
export function flushRAF(): void {
  const callbacks = Array.from(rafCallbacks.entries());
  rafCallbacks.clear();
  for (const [, cb] of callbacks) {
    cb(performance.now());
  }
}

/**
 * Flush RAF callbacks repeatedly until none remain.
 */
export function flushAllRAF(): void {
  let guard = 0;
  while (rafCallbacks.size > 0 && guard < 100) {
    flushRAF();
    guard++;
  }
}
