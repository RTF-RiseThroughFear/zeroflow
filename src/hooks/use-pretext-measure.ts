/**
 * usePretextMeasure: Low-level hook for pretext text measurement.
 *
 * Provides direct access to all pretext measurement APIs:
 *   - measure(): fast height + line count (prepare + layout)
 *   - measureLines(): real line objects with text and measured widths
 *   - shrinkWrap(): tightest bubble width via binary search + walkLineRanges
 *
 * For streaming use cases, prefer useStreamLayout instead.
 */

import { useCallback, useRef } from 'react';
import { useZeroflowContext } from '../core/provider';
import type { MeasureResult, ShrinkWrapResult } from '../types';

export interface UsePretextMeasureOptions {
  /** CSS font string for measurement. Must be named font, NOT system-ui. */
  font?: string;
}

/**
 * Hook that provides direct access to pretext's full measurement API.
 * Zero DOM reads. Pure math measurement.
 *
 * @example
 * ```tsx
 * const { measure, shrinkWrap, measureLines } = usePretextMeasure({
 *   font: '16px Inter'
 * });
 *
 * // Fast height-only
 * const { height, lineCount } = measure('Hello world', 400);
 *
 * // Tight bubble sizing
 * const { tightWidth } = shrinkWrap('Hello world', 400);
 *
 * // Real line objects with measured widths
 * const { lines } = measureLines('Hello world', 400);
 * ```
 */
export function usePretextMeasure(options: UsePretextMeasureOptions = {}) {
  const ctx = useZeroflowContext();
  const font = options.font ?? ctx.config.defaultFont;
  const measurerRef = useRef(ctx.getMeasurer(font));

  const measure = useCallback(
    (text: string, containerWidth?: number, lineHeight?: number): MeasureResult => {
      const width = containerWidth ?? ctx.config.defaultWidth;
      return measurerRef.current.measure(text, width, lineHeight);
    },
    [ctx.config.defaultWidth]
  );

  const measureLines = useCallback(
    (text: string, containerWidth?: number, lineHeight?: number) => {
      const width = containerWidth ?? ctx.config.defaultWidth;
      return measurerRef.current.measureLines(text, width, lineHeight);
    },
    [ctx.config.defaultWidth]
  );

  const shrinkWrap = useCallback(
    (text: string, maxWidth?: number, lineHeight?: number): ShrinkWrapResult => {
      const width = maxWidth ?? ctx.config.defaultWidth;
      return measurerRef.current.shrinkWrap(text, width, lineHeight);
    },
    [ctx.config.defaultWidth]
  );

  return { measure, measureLines, shrinkWrap, font };
}
