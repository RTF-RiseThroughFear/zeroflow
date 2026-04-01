/**
 * TDD: Pretext API completeness and v0.0.4 upgrade contract.
 *
 * v0.0.4 fixed layout()/layoutWithLines()/layoutNextLine() alignment on
 * narrow ZWSP/grapheme-breaking edge cases. These tests ensure:
 *   1. We expose clearCache and setLocale for completeness
 *   2. Our measurer correctly delegates to pretext for all edge cases
 *   3. The layout contract (height = lineCount * lineHeight) holds for
 *      edge cases like ZWSP, empty strings, and single characters
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pretext with all v0.0.4 APIs
vi.mock('@chenglou/pretext', () => ({
  prepare: vi.fn((_text: string, _font: string) => ({
    __prepared: true,
    text: _text,
    widths: _text.length > 0 ? [10] : [],
  })),
  prepareWithSegments: vi.fn((_text: string, _font: string) => ({
    __prepared: true,
    segments: _text.length > 0 ? [_text] : [],
    widths: _text.length > 0 ? [10] : [],
  })),
  layout: vi.fn((_prepared: unknown, _maxWidth: number, lineHeight: number) => {
    const p = _prepared as { text?: string; widths?: number[] };
    if (!p.widths || p.widths.length === 0) {
      return { lineCount: 0, height: 0 };
    }
    // Simulate wrapping for narrow widths
    const lineCount = _maxWidth < 5 ? 2 : 1;
    return { lineCount, height: lineCount * lineHeight };
  }),
  layoutWithLines: vi.fn((_prepared: unknown, _maxWidth: number, lineHeight: number) => {
    const p = _prepared as { widths?: number[] };
    if (!p.widths || p.widths.length === 0) {
      return { lineCount: 0, height: 0, lines: [] };
    }
    return {
      lineCount: 1,
      height: lineHeight,
      lines: [
        {
          text: 'test',
          width: 10,
          start: { segmentIndex: 0, graphemeIndex: 0 },
          end: { segmentIndex: 1, graphemeIndex: 0 },
        },
      ],
    };
  }),
  walkLineRanges: vi.fn(
    (_prepared: unknown, _maxWidth: number, onLine: (line: Record<string, unknown>) => void) => {
      onLine({
        width: 10,
        start: { segmentIndex: 0, graphemeIndex: 0 },
        end: { segmentIndex: 1, graphemeIndex: 0 },
      });
      return 1;
    }
  ),
  clearCache: vi.fn(),
  setLocale: vi.fn(),
}));

import { createMeasurer, clearMeasurerCache } from '../core/measure';
import { prepare, layout, clearCache, setLocale } from '@chenglou/pretext';

describe('pretext API completeness (v0.0.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('clearCache delegation', () => {
    it('clearMeasurerCache delegates to pretext clearCache()', () => {
      clearMeasurerCache();
      expect(clearCache).toHaveBeenCalledTimes(1);
    });

    it('clearCache is importable from @chenglou/pretext', () => {
      expect(typeof clearCache).toBe('function');
    });
  });

  describe('setLocale availability', () => {
    it('setLocale is importable from @chenglou/pretext', () => {
      // v0.0.4 exports setLocale for i18n locale overrides
      expect(typeof setLocale).toBe('function');
    });

    it('setLocale is re-exported from our measure module', async () => {
      // Verify the re-export exists so users can import from zeroflow
      const measureModule = await import('../core/measure');
      expect(typeof measureModule.setLocale).toBe('function');
    });
  });

  describe('ZWSP and grapheme edge cases', () => {
    it('measure() handles text with ZWSP (zero-width space) character', () => {
      const measurer = createMeasurer('16px Inter');
      // ZWSP = U+200B — the character fixed in v0.0.4
      const textWithZWSP = 'hello\u200Bworld';
      const result = measurer.measure(textWithZWSP, 400, 24);

      // Should NOT throw or return NaN
      expect(result.height).toBeGreaterThan(0);
      expect(result.lineCount).toBeGreaterThan(0);
      expect(Number.isNaN(result.height)).toBe(false);
      expect(prepare).toHaveBeenCalledWith(textWithZWSP, '16px Inter');
    });

    it('measure() handles single grapheme cluster', () => {
      const measurer = createMeasurer('16px Inter');
      const result = measurer.measure('👨‍👩‍👧‍👦', 400, 24);

      expect(result.height).toBeGreaterThan(0);
      expect(Number.isNaN(result.height)).toBe(false);
    });

    it('measure() handles text with combining characters', () => {
      const measurer = createMeasurer('16px Inter');
      // Combining diacritical marks
      const result = measurer.measure('e\u0301', 400, 24);

      expect(result.height).toBeGreaterThan(0);
      expect(Number.isNaN(result.height)).toBe(false);
    });

    it('measure() handles CJK text', () => {
      const measurer = createMeasurer('16px Inter');
      const result = measurer.measure('春天到了', 400, 24);

      expect(result.height).toBeGreaterThan(0);
      expect(Number.isNaN(result.height)).toBe(false);
    });

    it('measure() handles RTL text', () => {
      const measurer = createMeasurer('16px Inter');
      const result = measurer.measure('بدأت الرحلة', 400, 24);

      expect(result.height).toBeGreaterThan(0);
      expect(Number.isNaN(result.height)).toBe(false);
    });

    it('measure() handles mixed content (CJK + RTL + emoji + Latin)', () => {
      const measurer = createMeasurer('16px Inter');
      // This is from Chenglou's accordion demo section 4
      const mixedText = 'AGI 春天到了. بدأت الرحلة 🚀';
      const result = measurer.measure(mixedText, 400, 24);

      expect(result.height).toBeGreaterThan(0);
      expect(Number.isNaN(result.height)).toBe(false);
    });
  });

  describe('layout contract for narrow widths', () => {
    it('layout() produces valid height at very narrow container (1px)', () => {
      const measurer = createMeasurer('16px Inter');
      const result = measurer.measure('Hello world', 1, 24);

      // Should produce more lines when container is very narrow
      expect(result.lineCount).toBeGreaterThanOrEqual(1);
      expect(result.height).toBe(result.lineCount * 24);
    });

    it('height = lineCount * lineHeight is ALWAYS the layout formula', () => {
      const measurer = createMeasurer('16px Inter');
      const lineHeight = 20;
      const result = measurer.measure('Some text here', 200, lineHeight);

      // This is pretext's invariant: height = lineCount * lineHeight
      expect(result.height).toBe(result.lineCount * lineHeight);
    });
  });

  describe('prepare caching correctness across edge cases', () => {
    it('calling measure twice with same ZWSP text uses cached prepare', () => {
      const measurer = createMeasurer('16px Inter');
      const textWithZWSP = 'hello\u200Bworld';

      measurer.measure(textWithZWSP, 400, 24);
      measurer.measure(textWithZWSP, 200, 24); // same text, different width

      // prepare() called once, layout() called twice
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(layout).toHaveBeenCalledTimes(2);
    });

    it('calling measure with different text invalidates cache', () => {
      const measurer = createMeasurer('16px Inter');

      measurer.measure('hello\u200Bworld', 400, 24);
      measurer.measure('different\u200Btext', 400, 24);

      expect(prepare).toHaveBeenCalledTimes(2);
    });
  });
});
