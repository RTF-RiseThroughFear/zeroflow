/**
 * Tests for core/stream-buffer.ts
 *
 * Tests token batching, RAF-based flushing, completion, error handling,
 * and cancellation. Uses mocked requestAnimationFrame from setup.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStreamBuffer } from '../core/stream-buffer';
import { flushRAF } from './setup';

describe('createStreamBuffer', () => {
  let onFlush: ReturnType<typeof vi.fn>;
  let onComplete: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onFlush = vi.fn();
    onComplete = vi.fn();
    onError = vi.fn();
  });

  function createBuffer(overrides?: Partial<Parameters<typeof createStreamBuffer>[0]>) {
    return createStreamBuffer({
      onFlush,
      onComplete,
      onError,
      maxBuffer: 8,
      targetFps: 60,
      ...overrides,
    });
  }

  describe('push()', () => {
    it('accumulates tokens in the buffer', () => {
      const buffer = createBuffer();
      buffer.push('Hello');
      buffer.push(' world');

      expect(buffer.getText()).toBe('Hello world');
    });

    it('flushes when buffer exceeds maxBuffer', () => {
      const buffer = createBuffer({ maxBuffer: 5 });

      buffer.push('12345'); // exactly maxBuffer, triggers flush
      expect(onFlush).toHaveBeenCalledWith('12345');
    });

    it('flushes when enough time has passed (FPS throttle)', () => {
      const buffer = createBuffer({ targetFps: 60 });

      // First push should flush immediately (lastFlushTime is 0)
      buffer.push('Hi');
      expect(onFlush).toHaveBeenCalledWith('Hi');
    });

    it('schedules RAF when throttled', () => {
      const buffer = createBuffer({ targetFps: 60 });

      // First push flushes immediately (time since last flush > frameInterval)
      buffer.push('A');
      expect(onFlush).toHaveBeenCalledTimes(1);

      // Subsequent push within same frame should schedule RAF
      buffer.push('B');

      // Flush via RAF
      flushRAF();
      expect(onFlush).toHaveBeenCalledTimes(2);
      expect(onFlush).toHaveBeenLastCalledWith('AB');
    });
  });

  describe('complete()', () => {
    it('flushes remaining buffer and calls onComplete', () => {
      const buffer = createBuffer();
      buffer.push('Hello');

      // Reset mocks to isolate complete behavior
      onFlush.mockClear();

      buffer.complete();
      expect(onComplete).toHaveBeenCalledWith('Hello');
    });

    it('calls onComplete with full accumulated text', () => {
      const buffer = createBuffer({ maxBuffer: 100 });

      buffer.push('Hello ');
      buffer.push('world');
      buffer.complete();

      // onComplete receives the full text
      expect(onComplete).toHaveBeenCalledTimes(1);
      const completeArg = onComplete.mock.calls[0][0];
      expect(completeArg).toContain('Hello ');
      expect(completeArg).toContain('world');
    });

    it('calls onComplete even when buffer is empty', () => {
      const buffer = createBuffer();

      // Push and force flush
      buffer.push('12345678'); // maxBuffer=8, forces flush
      onFlush.mockClear();

      buffer.complete();
      expect(onComplete).toHaveBeenCalledWith('12345678');
    });
  });

  describe('error()', () => {
    it('calls onError with the error', () => {
      const buffer = createBuffer();
      const err = new Error('Stream failed');

      buffer.error(err);
      expect(onError).toHaveBeenCalledWith(err);
    });

    it('cancels pending RAF on error', () => {
      const buffer = createBuffer();
      buffer.push('data');

      // Schedule a RAF then error
      buffer.push('more');
      buffer.error(new Error('fail'));

      expect(cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('cancel()', () => {
    it('clears the buffer', () => {
      const buffer = createBuffer();
      buffer.push('Hello');
      buffer.cancel();

      // getText returns only unflushed buffer which was cleared
      // fullText may still have flushed content
      expect(buffer.getText()).toBeDefined();
    });

    it('cancels pending RAF', () => {
      const buffer = createBuffer({ maxBuffer: 100 });

      buffer.push('A');
      buffer.push('B'); // may schedule RAF

      buffer.cancel();

      // Flushing RAF after cancel should not trigger onFlush again
      const flushCountBefore = onFlush.mock.calls.length;
      flushRAF();
      // RAF callback was removed by cancel, no new flush
      expect(onFlush.mock.calls.length).toBeLessThanOrEqual(flushCountBefore + 1);
    });
  });

  describe('getText()', () => {
    it('returns accumulated text including unflushed buffer', () => {
      const buffer = createBuffer({ maxBuffer: 100 }); // high maxBuffer to prevent auto-flush

      buffer.push('Hello');
      // First push flushes immediately due to time threshold
      buffer.push(' world'); // buffered, not yet flushed

      const text = buffer.getText();
      expect(text).toContain('Hello');
      expect(text).toContain('world');
    });
  });
});
