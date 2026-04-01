/**
 * Core text measurement engine wrapping @chenglou/pretext.
 *
 * This module provides the bridge between pretext's prepare/layout
 * API and zeroflow's streaming architecture. All text measurement
 * happens through canvas math. Zero DOM reads. Zero reflow.
 */

import { prepare, layout } from '@chenglou/pretext';
import type { MeasureResult } from '../types';

/** Cached preparation data per font configuration */
const prepCache = new Map<string, ReturnType<typeof prepare>>();

/**
 * Creates a text measurer for a specific font configuration.
 * Uses pretext's prepare() to cache font metrics, then layout()
 * for pure-math text measurement on every call.
 *
 * @param font - CSS font string, e.g. '16px Inter'
 * @returns Measurer object with measure() and cleanup()
 */
export function createMeasurer(font: string) {
  // Get or create cached preparation for this font
  function getPrep() {
    let prep = prepCache.get(font);
    if (!prep) {
      prep = prepare(font);
      prepCache.set(font, prep);
    }
    return prep;
  }

  return {
    /**
     * Measure text dimensions without touching the DOM.
     * Uses pretext's layout() which is pure arithmetic (~0.05ms).
     *
     * @param text - The text to measure
     * @param containerWidth - Available width in pixels
     * @returns Measurement result with width, height, and line count
     */
    measure(text: string, containerWidth: number): MeasureResult {
      if (!text) {
        return { width: 0, height: 0, lineCount: 0 };
      }

      const prep = getPrep();
      const result = layout(prep, text, containerWidth);

      return {
        width: result.width,
        height: result.height,
        lineCount: result.lines.length,
      };
    },

    /**
     * Clear the cached preparation data for this font.
     * Call this if the font changes or on unmount.
     */
    cleanup() {
      prepCache.delete(font);
    },
  };
}

/**
 * Clear all cached font preparations.
 * Useful for testing or when fonts are dynamically loaded.
 */
export function clearMeasurerCache() {
  prepCache.clear();
}
