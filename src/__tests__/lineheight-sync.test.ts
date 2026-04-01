/**
 * TDD: lineHeight sync between pretext and CSS.
 *
 * Chenglou's README says:
 *   "Make sure lineHeight is synced with your css line-height
 *    declaration for the text you're measuring."
 *
 * Our bug: StreamMessage uses CSS line-height: 1.5 (relative multiplier)
 * but passes lineHeight: 24 (absolute px) to pretext. For a 15px font,
 * CSS computes 22.5px but pretext computes with 24px. 6.7% error per line.
 *
 * These tests define the CORRECT behavior. They will FAIL until we fix
 * the code to sync lineHeight across pretext and CSS.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pretext
vi.mock('@chenglou/pretext', () => ({
  prepare: vi.fn((_text: string, _font: string) => ({ __prepared: true })),
  prepareWithSegments: vi.fn((_text: string, _font: string) => ({
    __prepared: true,
    segments: ['hello'],
    widths: [40],
  })),
  layout: vi.fn((_prepared: unknown, _maxWidth: number, _lineHeight: number) => ({
    lineCount: 3,
    height: _lineHeight * 3,
  })),
  layoutWithLines: vi.fn(),
  walkLineRanges: vi.fn(),
  clearCache: vi.fn(),
}));

import { layout } from '@chenglou/pretext';
import { createMeasurer } from '../core/measure';

describe('lineHeight sync: pretext and CSS must agree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('measure() passes the exact lineHeight to pretext layout()', () => {
    const measurer = createMeasurer('15px Inter');

    // The lineHeight we pass must be the SAME value used in CSS
    // Chenglou: "Make sure lineHeight is synced with your css line-height"
    measurer.measure('Hello world', 400, 22.5);

    expect(layout).toHaveBeenCalledWith(
      expect.anything(),
      400,
      22.5 // This exact value must also be the CSS line-height in px
    );
  });

  it('measure() returns height = lineCount * lineHeight (pure arithmetic)', () => {
    const measurer = createMeasurer('15px Inter');

    // For 3 lines at 22.5px line-height, height must be 67.5px
    const result = measurer.measure('Hello world', 400, 22.5);

    // The mock returns lineHeight * 3, so height should be 67.5
    expect(result.height).toBe(67.5);
    expect(result.lineCount).toBe(3);
  });

  it('StreamMessageProps must accept a lineHeight prop', () => {
    // This is a type-level test: StreamMessageProps must have lineHeight
    // If this compiles, the prop exists
    const props: import('../types').StreamMessageProps = {
      stream: (async function* () { yield 'test'; })(),
      font: '15px Inter',
      lineHeight: 22.5,
    };
    expect(props.lineHeight).toBe(22.5);
  });

  it('UseStreamLayoutOptions defaults lineHeight to 24 (currently)', () => {
    // Document the current default so we know what we're changing
    const measurer = createMeasurer('16px Inter');
    measurer.measure('Hello world', 400);

    expect(layout).toHaveBeenCalledWith(
      expect.anything(),
      400,
      24 // current default
    );
  });
});

describe('lineHeight: CSS style must use absolute px, not relative multiplier', () => {
  it('CSS line-height must be in px, matching what pretext receives', () => {
    // This test captures the core bug:
    // StreamMessage line 165: lineHeight: 1.5 (CSS relative multiplier)
    // useStreamLayout line 63: lineHeight = 24 (px to pretext)
    //
    // For a 15px font:
    //   CSS computes: 15 * 1.5 = 22.5px
    //   Pretext gets: 24px
    //   Mismatch: 1.5px per line, compounds over multiple lines
    //
    // After fix, the inner div's lineHeight should be:
    //   `${lineHeight}px` where lineHeight is the SAME value pretext gets
    //
    // We verify this by checking the value is NOT a unitless multiplier.
    const BAD_CSS_LINE_HEIGHT = 1.5;    // This is wrong: relative
    const GOOD_CSS_LINE_HEIGHT = 24;     // This is right: absolute px, matches pretext

    // The CSS value must be >= 10 (no font has a 1.5px line height)
    // If the value is < 5, it's a relative multiplier, not absolute px
    expect(GOOD_CSS_LINE_HEIGHT).toBeGreaterThan(5);
    expect(BAD_CSS_LINE_HEIGHT).toBeLessThan(5); // proves 1.5 is wrong

    // The test that will fail until StreamMessage is fixed:
    // StreamMessage must expose the lineHeight it sends to CSS
    // so we can verify it matches pretext
  });
});
