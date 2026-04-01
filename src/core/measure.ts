/**
 * Core text measurement engine wrapping @chenglou/pretext.
 *
 * This module provides the bridge between pretext's prepare/layout
 * API and zeroflow's streaming architecture. All text measurement
 * happens through canvas math. Zero DOM reads. Zero reflow.
 *
 * pretext API (actual signatures):
 *   prepare(text, font) → PreparedText
 *   layout(prepared, maxWidth, lineHeight) → { lineCount, height }
 */

import { prepare, layout } from '@chenglou/pretext';
import type { MeasureResult } from '../types';

/** Default line height in pixels when not specified */
const DEFAULT_LINE_HEIGHT = 24;

/**
 * Creates a text measurer for a specific font configuration.
 * Uses pretext's prepare() + layout() for pure-math text measurement.
 *
 * Note: pretext's prepare() takes both text AND font. It cannot be cached
 * per-font alone. Each call to measure() calls prepare() + layout().
 * pretext has its own internal caching via clearCache().
 *
 * @param font - CSS font string, e.g. '16px Inter'
 * @returns Measurer object with measure() and cleanup()
 */
export function createMeasurer(font: string) {
  return {
    /**
     * Measure text dimensions without touching the DOM.
     * Calls pretext prepare() + layout() which is pure arithmetic.
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

      const prepared = prepare(text, font);
      const result = layout(prepared, containerWidth, lineHeight);

      return {
        width: containerWidth,
        height: result.height,
        lineCount: result.lineCount,
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
export { clearCache as clearMeasurerCache } from '@chenglou/pretext';
