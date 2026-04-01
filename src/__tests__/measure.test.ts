/**
 * Tests for core/measure.ts
 *
 * Mocks @chenglou/pretext since it requires canvas (not available in Node).
 * Tests the measurer API contract, empty text handling, and cache clearing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pretext
vi.mock('@chenglou/pretext', () => ({
  prepare: vi.fn((_text: string, _font: string) => ({ __prepared: true })),
  layout: vi.fn((_prepared: unknown, _maxWidth: number, _lineHeight: number) => ({
    lineCount: 3,
    height: 72,
  })),
  clearCache: vi.fn(),
}));

import { createMeasurer, clearMeasurerCache } from '../core/measure';
import { prepare, layout, clearCache } from '@chenglou/pretext';

describe('createMeasurer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a measurer object with measure() and font', () => {
    const measurer = createMeasurer('16px Inter');
    expect(measurer).toHaveProperty('measure');
    expect(measurer).toHaveProperty('font');
    expect(measurer.font).toBe('16px Inter');
  });

  it('measure() returns zero dimensions for empty text', () => {
    const measurer = createMeasurer('16px Inter');
    const result = measurer.measure('', 400);

    expect(result).toEqual({ width: 0, height: 0, lineCount: 0 });
    expect(prepare).not.toHaveBeenCalled();
    expect(layout).not.toHaveBeenCalled();
  });

  it('measure() calls pretext prepare() with text and font', () => {
    const measurer = createMeasurer('16px Inter');
    measurer.measure('Hello world', 400);

    expect(prepare).toHaveBeenCalledWith('Hello world', '16px Inter');
  });

  it('measure() calls pretext layout() with prepared, maxWidth, and lineHeight', () => {
    const measurer = createMeasurer('16px Inter');
    measurer.measure('Hello world', 400, 28);

    expect(layout).toHaveBeenCalledWith({ __prepared: true }, 400, 28);
  });

  it('measure() uses default lineHeight of 24 when not specified', () => {
    const measurer = createMeasurer('16px Inter');
    measurer.measure('Hello world', 400);

    expect(layout).toHaveBeenCalledWith({ __prepared: true }, 400, 24);
  });

  it('measure() returns correct dimensions from pretext result', () => {
    const measurer = createMeasurer('16px Inter');
    const result = measurer.measure('Hello world', 400);

    expect(result).toEqual({
      width: 400,
      height: 72,
      lineCount: 3,
    });
  });

  it('different measurers use different font strings', () => {
    const m1 = createMeasurer('16px Inter');
    const m2 = createMeasurer('14px Roboto');

    m1.measure('text', 400);
    m2.measure('text', 400);

    expect(prepare).toHaveBeenCalledWith('text', '16px Inter');
    expect(prepare).toHaveBeenCalledWith('text', '14px Roboto');
  });
});

describe('clearMeasurerCache', () => {
  it('delegates to pretext clearCache()', () => {
    clearMeasurerCache();
    expect(clearCache).toHaveBeenCalled();
  });
});
