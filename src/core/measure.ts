/**
 * Core text measurement engine wrapping @chenglou/pretext.
 *
 * Uses the FULL pretext API:
 *   - prepare() + layout() for fast height-only measurement
 *   - prepareWithSegments() + layoutWithLines() for real line data
 *   - walkLineRanges() for shrink-wrap (tightest bubble width)
 *
 * Key patterns from Chenglou's own demos:
 *   - Cache PreparedText between calls (only re-prepare when text changes)
 *   - Binary search with walkLineRanges for shrink-wrap
 *   - layout() is pure arithmetic (~0.0002ms), so call it freely on resize
 *   - prepare() does the heavy work (~19ms per 500 texts), call only when text changes
 */

import {
  prepare,
  layout,
  prepareWithSegments,
  walkLineRanges,
  layoutWithLines,
  clearCache,
  setLocale,
} from '@chenglou/pretext';
import type {
  PreparedText,
  PreparedTextWithSegments,
  LayoutLine as PretextLayoutLine,
} from '@chenglou/pretext';
import type { MeasureResult, ShrinkWrapResult } from '../types';

/** Default line height in pixels when not specified */
const DEFAULT_LINE_HEIGHT = 24;

/**
 * Creates a text measurer for a specific font configuration.
 * Uses the full pretext API for measurement, line layout, and shrink-wrap.
 *
 * Caches the last PreparedText to avoid redundant prepare() calls.
 * Following Chenglou's guidance: "Do not rerun prepare() for the same
 * text and configs; that'd defeat its precomputation."
 *
 * @param font - CSS font string, e.g. '16px Inter'. Must be a named font,
 *   NOT system-ui (unsafe on macOS per Chenglou's docs).
 * @returns Measurer object with measure(), measureLines(), shrinkWrap(), and font
 */
export function createMeasurer(font: string) {
  // Cache last prepared text (prepare is expensive, layout is cheap)
  let cachedText = '';
  let cachedPrepared: PreparedText | null = null;
  let cachedPreparedWithSegments: PreparedTextWithSegments | null = null;

  /**
   * Get or create a PreparedText for the given text.
   * Reuses cache when text hasn't changed (e.g. on resize, only width changes).
   */
  function getPrepared(text: string): PreparedText {
    if (text === cachedText && cachedPrepared !== null) {
      return cachedPrepared;
    }
    cachedPrepared = prepare(text, font);
    cachedPreparedWithSegments = null; // invalidate segments cache
    cachedText = text;
    return cachedPrepared;
  }

  /**
   * Get or create a PreparedTextWithSegments for the given text.
   * Required for line-level APIs (layoutWithLines, walkLineRanges).
   */
  function getPreparedWithSegments(text: string): PreparedTextWithSegments {
    if (text === cachedText && cachedPreparedWithSegments !== null) {
      return cachedPreparedWithSegments;
    }
    cachedPreparedWithSegments = prepareWithSegments(text, font);
    cachedPrepared = cachedPreparedWithSegments; // segments variant is a superset
    cachedText = text;
    return cachedPreparedWithSegments;
  }

  return {
    /**
     * Measure text height and line count without touching the DOM.
     * Uses pretext prepare() + layout() with caching.
     * layout() is pure arithmetic (~0.0002ms per call).
     *
     * @param text - The text to measure
     * @param containerWidth - Available width in pixels
     * @param lineHeight - Line height in pixels (default: 24)
     * @returns Measurement result with width, height, and line count
     */
    measure(text: string, containerWidth: number, lineHeight: number = DEFAULT_LINE_HEIGHT): MeasureResult {
      if (!text) {
        return { width: 0, height: 0, lineCount: 0 };
      }

      const prepared = getPrepared(text);
      const result = layout(prepared, containerWidth, lineHeight);

      return {
        width: containerWidth,
        height: result.height,
        lineCount: result.lineCount,
      };
    },

    /**
     * Get actual line objects with real measured widths and text content.
     * Uses pretext's prepareWithSegments() + layoutWithLines().
     *
     * Each LayoutLine contains:
     *   - text: actual line content (e.g. 'hello world')
     *   - width: measured pixel width (e.g. 87.5)
     *   - start/end: cursors into the prepared segments
     *
     * @param text - The text to lay out
     * @param containerWidth - Available width in pixels
     * @param lineHeight - Line height in pixels (default: 24)
     * @returns Lines result with height, lineCount, and line objects
     */
    measureLines(text: string, containerWidth: number, lineHeight: number = DEFAULT_LINE_HEIGHT) {
      if (!text) {
        return { height: 0, lineCount: 0, lines: [] as PretextLayoutLine[] };
      }

      const prepared = getPreparedWithSegments(text);
      return layoutWithLines(prepared, containerWidth, lineHeight);
    },

    /**
     * Find the tightest container width that maintains the same line count.
     * This is the "shrink-wrap" from Chenglou's bubbles demo.
     *
     * Uses binary search: test progressively narrower widths via layout()
     * until the line count increases, then use walkLineRanges to get the
     * actual maximum line width.
     *
     * Result: a chat bubble that is exactly as wide as its widest line,
     * with zero wasted horizontal space.
     *
     * @param text - The text to shrink-wrap
     * @param maxWidth - Maximum allowed width (e.g. 80% of chat container)
     * @param lineHeight - Line height in pixels (default: 24)
     * @returns ShrinkWrapResult with tightWidth, height, and lineCount
     */
    shrinkWrap(text: string, maxWidth: number, lineHeight: number = DEFAULT_LINE_HEIGHT): ShrinkWrapResult {
      if (!text) {
        return { tightWidth: 0, height: 0, lineCount: 0 };
      }

      const prepared = getPreparedWithSegments(text);
      const initial = layout(prepared, maxWidth, lineHeight);

      // Binary search for the narrowest width that keeps the same line count
      // This is directly from Chenglou's findTightWrapMetrics in bubbles-shared.ts
      let lo = 1;
      let hi = Math.max(1, Math.ceil(maxWidth));

      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        const midLineCount = layout(prepared, mid, lineHeight).lineCount;
        if (midLineCount <= initial.lineCount) {
          hi = mid;
        } else {
          lo = mid + 1;
        }
      }

      // Now walk the lines at the tight width to get the actual max line width
      let maxLineWidth = 0;
      walkLineRanges(prepared, lo, (line) => {
        if (line.width > maxLineWidth) maxLineWidth = line.width;
      });

      return {
        tightWidth: Math.ceil(maxLineWidth),
        height: initial.height,
        lineCount: initial.lineCount,
      };
    },

    /** The font string this measurer is configured for */
    font,
  };
}

/**
 * Clear pretext's internal cache.
 * Useful for testing or when fonts are dynamically loaded.
 */
export { clearCache as clearMeasurerCache };

/**
 * Set the locale for text segmentation.
 * Delegates to pretext's setLocale() which also clears cache.
 * Useful for i18n apps that need specific locale-aware text segmentation.
 *
 * @param locale - BCP 47 locale string, or undefined for default
 */
export { setLocale };
