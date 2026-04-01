/**
 * Tests for core/measure.ts
 *
 * Mocks @chenglou/pretext since it requires canvas (not available in Node).
 * Tests the full measurer API: measure(), measureLines(), shrinkWrap(), and caching.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pretext with ALL APIs we now use
vi.mock('@chenglou/pretext', () => ({
  prepare: vi.fn((_text: string, _font: string) => ({ __prepared: true })),
  prepareWithSegments: vi.fn((_text: string, _font: string) => ({
    __prepared: true,
    segments: ['hello', ' ', 'world'],
    widths: [40, 4, 43],
  })),
  layout: vi.fn((_prepared: unknown, _maxWidth: number, _lineHeight: number) => ({
    lineCount: 3,
    height: 72,
  })),
  layoutWithLines: vi.fn((_prepared: unknown, _maxWidth: number, _lineHeight: number) => ({
    lineCount: 3,
    height: 72,
    lines: [
      { text: 'hello world', width: 87, start: { segmentIndex: 0, graphemeIndex: 0 }, end: { segmentIndex: 3, graphemeIndex: 0 } },
      { text: 'foo bar', width: 55, start: { segmentIndex: 3, graphemeIndex: 0 }, end: { segmentIndex: 6, graphemeIndex: 0 } },
      { text: 'baz', width: 25, start: { segmentIndex: 6, graphemeIndex: 0 }, end: { segmentIndex: 7, graphemeIndex: 0 } },
    ],
  })),
  walkLineRanges: vi.fn((_prepared: unknown, _maxWidth: number, onLine: (line: Record<string, unknown>) => void) => {
    // Simulate walking 3 lines with different widths
    onLine({ width: 87, start: { segmentIndex: 0, graphemeIndex: 0 }, end: { segmentIndex: 3, graphemeIndex: 0 } });
    onLine({ width: 55, start: { segmentIndex: 3, graphemeIndex: 0 }, end: { segmentIndex: 6, graphemeIndex: 0 } });
    onLine({ width: 25, start: { segmentIndex: 6, graphemeIndex: 0 }, end: { segmentIndex: 7, graphemeIndex: 0 } });
    return 3;
  }),
  clearCache: vi.fn(),
}));

import { createMeasurer, clearMeasurerCache } from '../core/measure';
import { prepare, layout, prepareWithSegments, layoutWithLines, walkLineRanges, clearCache } from '@chenglou/pretext';

describe('createMeasurer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a measurer object with measure, measureLines, shrinkWrap, and font', () => {
    const measurer = createMeasurer('16px Inter');
    expect(measurer).toHaveProperty('measure');
    expect(measurer).toHaveProperty('measureLines');
    expect(measurer).toHaveProperty('shrinkWrap');
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

  // Caching tests
  it('caches PreparedText: second measure() with same text skips prepare()', () => {
    const measurer = createMeasurer('16px Inter');
    measurer.measure('Hello world', 400);
    measurer.measure('Hello world', 300); // same text, different width

    // prepare() should only be called once (cached)
    expect(prepare).toHaveBeenCalledTimes(1);
    // layout() should be called twice (different widths)
    expect(layout).toHaveBeenCalledTimes(2);
  });

  it('invalidates cache when text changes', () => {
    const measurer = createMeasurer('16px Inter');
    measurer.measure('Hello world', 400);
    measurer.measure('Different text', 400);

    expect(prepare).toHaveBeenCalledTimes(2);
  });
});

describe('measureLines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty for empty text', () => {
    const measurer = createMeasurer('16px Inter');
    const result = measurer.measureLines('', 400);

    expect(result).toEqual({ height: 0, lineCount: 0, lines: [] });
    expect(prepareWithSegments).not.toHaveBeenCalled();
  });

  it('calls prepareWithSegments and layoutWithLines', () => {
    const measurer = createMeasurer('16px Inter');
    const result = measurer.measureLines('Hello world foo bar baz', 400);

    expect(prepareWithSegments).toHaveBeenCalledWith('Hello world foo bar baz', '16px Inter');
    expect(layoutWithLines).toHaveBeenCalled();
    expect(result.lineCount).toBe(3);
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0].text).toBe('hello world');
    expect(result.lines[0].width).toBe(87);
  });
});

describe('shrinkWrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero for empty text', () => {
    const measurer = createMeasurer('16px Inter');
    const result = measurer.shrinkWrap('', 400);

    expect(result).toEqual({ tightWidth: 0, height: 0, lineCount: 0 });
  });

  it('uses binary search + walkLineRanges for tight width', () => {
    const measurer = createMeasurer('16px Inter');
    const result = measurer.shrinkWrap('Hello world foo bar baz', 400);

    // walkLineRanges mock reports max line width of 87
    expect(result.tightWidth).toBe(87);
    expect(result.height).toBe(72);
    expect(result.lineCount).toBe(3);
    expect(walkLineRanges).toHaveBeenCalled();
  });

  it('calls prepareWithSegments for shrink-wrap', () => {
    const measurer = createMeasurer('16px Inter');
    measurer.shrinkWrap('Hello world', 400);

    expect(prepareWithSegments).toHaveBeenCalledWith('Hello world', '16px Inter');
  });
});

describe('clearMeasurerCache', () => {
  it('delegates to pretext clearCache()', () => {
    clearMeasurerCache();
    expect(clearCache).toHaveBeenCalled();
  });
});
