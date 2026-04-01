/**
 * TDD: Pretext layout contract tests.
 *
 * These test the REAL claims the StreamingPlayground demo makes:
 *   1. layout() returns consistent height for same text at same width
 *   2. height = lineCount * lineHeight ALWAYS holds
 *   3. prepare() is cached — not re-called for same text
 *   4. layout() at different widths produces different line counts
 *   5. layout() at narrow width produces MORE lines
 *   6. layout() is deterministic (same input = same output)
 *
 * Grounded in Chenglou's bubbles-shared.ts patterns:
 *   - prepare() once per font+text combo
 *   - layout() on every frame (pure math)
 *   - walkLineRanges() for maxLineWidth discovery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pretext — simulates realistic behavior
vi.mock('@chenglou/pretext', () => ({
  prepare: vi.fn((text: string, _font: string) => ({
    __prepared: true,
    text,
    widths: text.length > 0 ? Array.from({ length: text.length }, () => 8) : [],
  })),
  prepareWithSegments: vi.fn((text: string, _font: string) => ({
    __prepared: true,
    text,
    segments: text.length > 0 ? [text] : [],
    widths: text.length > 0 ? Array.from({ length: text.length }, () => 8) : [],
  })),
  layout: vi.fn((prepared: { text?: string; widths?: number[] }, maxWidth: number, lineHeight: number) => {
    if (!prepared.widths || prepared.widths.length === 0) {
      return { lineCount: 0, height: 0 };
    }
    // Simulate line wrapping: each char is 8px wide
    const charWidth = 8;
    const charsPerLine = Math.max(1, Math.floor(maxWidth / charWidth));
    const lineCount = Math.ceil((prepared.text?.length ?? 1) / charsPerLine);
    return { lineCount, height: lineCount * lineHeight };
  }),
  layoutWithLines: vi.fn(),
  walkLineRanges: vi.fn(
    (prepared: { text?: string; widths?: number[] }, maxWidth: number, onLine: (line: Record<string, unknown>) => void) => {
      const charWidth = 8;
      const charsPerLine = Math.max(1, Math.floor(maxWidth / charWidth));
      const totalChars = prepared.text?.length ?? 0;
      const lineCount = Math.ceil(totalChars / charsPerLine);
      for (let i = 0; i < lineCount; i++) {
        const lineChars = Math.min(charsPerLine, totalChars - i * charsPerLine);
        onLine({
          width: lineChars * charWidth,
          start: { segmentIndex: 0, graphemeIndex: i * charsPerLine },
          end: { segmentIndex: 0, graphemeIndex: (i + 1) * charsPerLine },
        });
      }
      return lineCount;
    }
  ),
  clearCache: vi.fn(),
  setLocale: vi.fn(),
}));

import { createMeasurer } from '../core/measure';
import { prepare, layout } from '@chenglou/pretext';

const SAMPLE_TEXT = 'Pretext eliminates layout reflow by measuring text with pure mathematics instead of the DOM.';
const FONT = '16px Inter';
const LINE_HEIGHT = 24;

describe('pretext layout contract (StreamingPlayground foundation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('height invariant', () => {
    it('height = lineCount * lineHeight ALWAYS holds', () => {
      const measurer = createMeasurer(FONT);
      const result = measurer.measure(SAMPLE_TEXT, 400, LINE_HEIGHT);

      expect(result.height).toBe(result.lineCount * LINE_HEIGHT);
    });

    it('height invariant holds at different widths', () => {
      const measurer = createMeasurer(FONT);
      const widths = [100, 200, 300, 400, 500, 600, 700];

      for (const w of widths) {
        const result = measurer.measure(SAMPLE_TEXT, w, LINE_HEIGHT);
        expect(result.height).toBe(result.lineCount * LINE_HEIGHT);
      }
    });

    it('height invariant holds with different line heights', () => {
      const measurer = createMeasurer(FONT);
      const lineHeights = [16, 20, 24, 28, 32];

      for (const lh of lineHeights) {
        const result = measurer.measure(SAMPLE_TEXT, 400, lh);
        expect(result.height).toBe(result.lineCount * lh);
      }
    });
  });

  describe('consistency (determinism)', () => {
    it('same text + same width = same result every time', () => {
      const measurer = createMeasurer(FONT);
      const r1 = measurer.measure(SAMPLE_TEXT, 400, LINE_HEIGHT);
      const r2 = measurer.measure(SAMPLE_TEXT, 400, LINE_HEIGHT);

      expect(r1.height).toBe(r2.height);
      expect(r1.lineCount).toBe(r2.lineCount);
    });

    it('layout() is called twice but prepare() only once (cached)', () => {
      const measurer = createMeasurer(FONT);
      measurer.measure(SAMPLE_TEXT, 400, LINE_HEIGHT);
      measurer.measure(SAMPLE_TEXT, 400, LINE_HEIGHT);

      expect(prepare).toHaveBeenCalledTimes(1);
      expect(layout).toHaveBeenCalledTimes(2);
    });
  });

  describe('reflow at different widths', () => {
    it('narrower width produces more lines', () => {
      const measurer = createMeasurer(FONT);
      const wide = measurer.measure(SAMPLE_TEXT, 600, LINE_HEIGHT);
      const narrow = measurer.measure(SAMPLE_TEXT, 200, LINE_HEIGHT);

      expect(narrow.lineCount).toBeGreaterThan(wide.lineCount);
    });

    it('wider width produces fewer lines', () => {
      const measurer = createMeasurer(FONT);
      const narrow = measurer.measure(SAMPLE_TEXT, 100, LINE_HEIGHT);
      const wide = measurer.measure(SAMPLE_TEXT, 500, LINE_HEIGHT);

      expect(wide.lineCount).toBeLessThan(narrow.lineCount);
    });

    it('different widths can produce different heights', () => {
      const measurer = createMeasurer(FONT);
      const wide = measurer.measure(SAMPLE_TEXT, 600, LINE_HEIGHT);
      const narrow = measurer.measure(SAMPLE_TEXT, 100, LINE_HEIGHT);

      expect(narrow.height).toBeGreaterThan(wide.height);
    });
  });

  describe('prepare caching across reflow (drag-to-resize pattern)', () => {
    it('prepare() called once even when layout() called at many widths', () => {
      const measurer = createMeasurer(FONT);
      // Simulating 60 width changes during a drag (Chenglou's pattern)
      for (let w = 200; w <= 700; w += 10) {
        measurer.measure(SAMPLE_TEXT, w, LINE_HEIGHT);
      }

      // prepare() called ONCE, layout() called 51 times
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(layout).toHaveBeenCalledTimes(51);
    });
  });

  describe('streaming text growth', () => {
    it('longer text produces taller layout at same width', () => {
      const measurer = createMeasurer(FONT);
      const short = measurer.measure('Hello', 400, LINE_HEIGHT);
      const long = measurer.measure(SAMPLE_TEXT, 400, LINE_HEIGHT);

      expect(long.height).toBeGreaterThanOrEqual(short.height);
    });

    it('each text length gets its own prepare() call', () => {
      const measurer = createMeasurer(FONT);
      measurer.measure('Hello', 400, LINE_HEIGHT);
      measurer.measure('Hello world', 400, LINE_HEIGHT);
      measurer.measure(SAMPLE_TEXT, 400, LINE_HEIGHT);

      // 3 different texts = 3 prepare() calls
      expect(prepare).toHaveBeenCalledTimes(3);
    });
  });
});
