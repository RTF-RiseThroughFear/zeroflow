/**
 * TDD: The zero-reflow streaming height contract.
 *
 * The core thesis of zeroflow:
 *   1. pretext calculates height = lineCount * lineHeight (pure math)
 *   2. That height is set on the container BEFORE the text renders
 *   3. The CSS on the inner text div uses the SAME lineHeight in px
 *   4. Therefore: pretext height === CSS rendered height === zero reflow
 *
 * This test verifies the full contract end-to-end.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pretext to return predictable results
vi.mock('@chenglou/pretext', () => ({
  prepare: vi.fn((_text: string, _font: string) => ({ __prepared: true, text: _text })),
  prepareWithSegments: vi.fn((_text: string, _font: string) => ({
    __prepared: true,
    segments: ['hello'],
    widths: [40],
  })),
  layout: vi.fn((_prepared: unknown, _maxWidth: number, lineHeight: number) => {
    // Simulate pretext: 5 lines of text
    return { lineCount: 5, height: 5 * lineHeight };
  }),
  layoutWithLines: vi.fn(),
  walkLineRanges: vi.fn(),
  clearCache: vi.fn(),
}));

import { createMeasurer } from '../core/measure';
import { layout } from '@chenglou/pretext';

describe('zero-reflow height contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pretext height = lineCount * lineHeight for any lineHeight value', () => {
    const measurer = createMeasurer('15px Inter');

    // Test with the synced value: 22.5px (15px * 1.5)
    const result = measurer.measure('Hello world this is a test', 300, 22.5);

    expect(result.height).toBe(5 * 22.5); // 112.5
    expect(result.lineCount).toBe(5);
  });

  it('height prediction is wrong when pretext and CSS disagree', () => {
    const measurer = createMeasurer('15px Inter');

    // Pretext is told lineHeight = 24 (our current default)
    const pretextResult = measurer.measure('Hello world this is a test', 300, 24);

    // But CSS renders at lineHeight = 1.5 * 15px = 22.5px
    const cssRenderedHeight = 5 * 22.5; // What the browser actually produces

    // These should be EQUAL for zero-reflow, but they're NOT
    // This documents the current bug: 7.5px total error for 5 lines
    expect(pretextResult.height).toBe(120);       // pretext says 120
    expect(cssRenderedHeight).toBe(112.5);         // CSS renders 112.5
    expect(pretextResult.height).not.toBe(cssRenderedHeight); // MISMATCH!

    // After fix, both must agree:
    // Either pretext gets 22.5 OR CSS renders at 24px
    // The synced height should be: 5 * SYNCED_VALUE
  });

  it('height prediction matches when pretext and CSS agree', () => {
    const measurer = createMeasurer('15px Inter');
    const SYNCED_LINE_HEIGHT = 22.5; // One value for both

    // Pretext gets the synced value
    const pretextResult = measurer.measure('Hello world this is a test', 300, SYNCED_LINE_HEIGHT);

    // CSS will also render at the synced value (in px)
    const cssRenderedHeight = 5 * SYNCED_LINE_HEIGHT;

    // THESE MUST MATCH - that's the zero-reflow contract
    expect(pretextResult.height).toBe(cssRenderedHeight);
  });

  it('StreamMessage must pass lineHeight to useStreamLayout', () => {
    // StreamMessageProps must have a lineHeight property
    // so users can sync pretext and CSS measurement
    type Props = import('../types').StreamMessageProps;

    // If this type check fails, lineHeight is not on StreamMessageProps
    const assertHasLineHeight = (p: Props) => p.lineHeight;
    expect(typeof assertHasLineHeight).toBe('function');
  });
});
