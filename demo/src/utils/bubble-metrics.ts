/**
 * Bubble metrics - ported from Chenglou's bubbles-shared.ts.
 *
 * Canonical patterns:
 *   - collectWrapMetrics(): measure at a given width, get lineCount + maxLineWidth
 *   - findTightWrapMetrics(): binary search for narrowest width keeping same lineCount
 *   - computeBubbleRender(): compute render state for a chat layout
 *
 * These are the exact patterns from:
 *   https://github.com/chenglou/pretext/blob/main/pages/demos/bubbles-shared.ts
 */

import {
  prepare,
  layout,
  prepareWithSegments,
  walkLineRanges,
} from '@chenglou/pretext';
import type {
  PreparedText,
  PreparedTextWithSegments,
} from '@chenglou/pretext';

// ── Types ──

export type WrapMetrics = {
  lineCount: number;
  maxLineWidth: number;
  height: number;
};

export type TightWrapMetrics = WrapMetrics & {
  tightWidth: number;
  wastedPixels: number;
};

export type PreparedBubble = {
  text: string;
  prepared: PreparedText;
  preparedWithSegments: PreparedTextWithSegments;
};

export type BubbleWidths = {
  cssWidth: number;
  tightWidth: number;
  wastedPixels: number;
};

export type BubbleRenderState = {
  chatWidth: number;
  bubbleMaxWidth: number;
  widths: BubbleWidths[];
  totalWastedPixels: number;
};

// ── Constants ──

/** Chat bubbles get 80% of chat container width (Chenglou pattern) */
const BUBBLE_MAX_WIDTH_RATIO = 0.8;

/** Default line height for bubble text */
const DEFAULT_LINE_HEIGHT = 22;

// ── Core Functions ──

/**
 * Measure text at a given width. Returns line count, max line width, and height.
 * This is the `collectWrapMetrics` from Chenglou's bubbles-shared.ts.
 */
export function collectWrapMetrics(
  preparedWithSegments: PreparedTextWithSegments,
  maxWidth: number,
  lineHeight: number = DEFAULT_LINE_HEIGHT,
): WrapMetrics {
  let maxLineWidth = 0;
  const lineCount = walkLineRanges(preparedWithSegments, maxWidth, (line) => {
    if (line.width > maxLineWidth) maxLineWidth = line.width;
  });

  return {
    lineCount,
    maxLineWidth,
    height: lineCount * lineHeight,
  };
}

/**
 * Binary search for the tightest container width that keeps the same line count.
 * This is the `findTightWrapMetrics` from Chenglou's bubbles-shared.ts.
 *
 * The algorithm:
 *   1. Get the baseline line count at maxWidth
 *   2. Binary search: find the narrowest width where lineCount stays the same
 *   3. Walk lines at that tight width to get the actual max line width
 *   4. ceil() the max line width for the final tightWidth
 *
 * The result: a chat bubble that is exactly as wide as its widest line,
 * with zero wasted horizontal space.
 */
export function findTightWrapMetrics(
  prepared: PreparedText,
  preparedWithSegments: PreparedTextWithSegments,
  maxWidth: number,
  lineHeight: number = DEFAULT_LINE_HEIGHT,
): TightWrapMetrics {
  const baseline = layout(prepared, maxWidth, lineHeight);

  // Binary search for narrowest width maintaining same lineCount
  let lo = 1;
  let hi = Math.max(1, Math.ceil(maxWidth));

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const midResult = layout(prepared, mid, lineHeight);
    if (midResult.lineCount <= baseline.lineCount) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }

  // Walk lines at the tight width to get actual max line width
  let maxLineWidth = 0;
  walkLineRanges(preparedWithSegments, lo, (line) => {
    if (line.width > maxLineWidth) maxLineWidth = line.width;
  });

  const tightWidth = Math.ceil(maxLineWidth);
  const cssWidth = Math.ceil(maxWidth);
  const wastedPixels = Math.max(0, (cssWidth - tightWidth) * baseline.height);

  return {
    lineCount: baseline.lineCount,
    maxLineWidth,
    height: baseline.height,
    tightWidth,
    wastedPixels,
  };
}

/**
 * Prepare bubble texts for rendering.
 * Calls prepare() and prepareWithSegments() once per text.
 */
export function prepareBubbleTexts(
  texts: string[],
  font: string,
): PreparedBubble[] {
  return texts.map((text) => ({
    text,
    prepared: prepare(text, font),
    preparedWithSegments: prepareWithSegments(text, font),
  }));
}

/**
 * Compute the full render state for a set of chat bubbles.
 * This is the `computeBubbleRender` from Chenglou's bubbles.ts.
 *
 * @param bubbles - Prepared bubble data from prepareBubbleTexts()
 * @param chatWidth - Total chat container width in pixels
 * @param lineHeight - Line height in pixels
 * @returns Render state with per-bubble widths and total wasted pixels
 */
export function computeBubbleRender(
  bubbles: PreparedBubble[],
  chatWidth: number,
  lineHeight: number = DEFAULT_LINE_HEIGHT,
): BubbleRenderState {
  const bubbleMaxWidth = Math.floor(chatWidth * BUBBLE_MAX_WIDTH_RATIO);
  let totalWastedPixels = 0;

  const widths: BubbleWidths[] = bubbles.map((bubble) => {
    const tight = findTightWrapMetrics(
      bubble.prepared,
      bubble.preparedWithSegments,
      bubbleMaxWidth,
      lineHeight,
    );

    totalWastedPixels += tight.wastedPixels;

    return {
      cssWidth: bubbleMaxWidth,
      tightWidth: tight.tightWidth,
      wastedPixels: tight.wastedPixels,
    };
  });

  return {
    chatWidth,
    bubbleMaxWidth,
    widths,
    totalWastedPixels,
  };
}

/**
 * Format a pixel count for display (e.g. "11,944px²").
 * From Chenglou's bubbles-shared.ts.
 */
export function formatPixelCount(pixels: number): string {
  return `${Math.round(pixels).toLocaleString()}px²`;
}

/**
 * Calculate the max chat width from viewport, matching Chenglou's pattern.
 */
export function getMaxChatWidth(minWidth: number, viewportWidth: number): number {
  return Math.max(minWidth, Math.min(viewportWidth - 48, 800));
}
