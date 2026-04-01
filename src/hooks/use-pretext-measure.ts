/**
 * usePretextMeasure: Low-level hook for pretext text measurement.
 *
 * Provides direct access to pretext's measurement engine.
 * For most use cases, prefer useStreamLayout instead.
 */

import { useCallback, useRef } from 'react';
import { useZeroflowContext } from '../core/provider';
import type { MeasureResult } from '../types';

export interface UsePretextMeasureOptions {
  /** CSS font string for measurement */
  font?: string;
}

/**
 * Hook that provides a measure function powered by pretext.
 * Zero DOM reads. Pure math measurement.
 *
 * @example
 * ```tsx
 * const { measure } = usePretextMeasure({ font: '16px Inter' });
 * const result = measure('Hello world', 400);
 * console.log(result.height, result.lineCount);
 * ```
 */
export function usePretextMeasure(options: UsePretextMeasureOptions = {}) {
  const ctx = useZeroflowContext();
  const font = options.font ?? ctx.config.defaultFont;
  const measurerRef = useRef(ctx.getMeasurer(font));

  const measure = useCallback(
    (text: string, containerWidth?: number): MeasureResult => {
      const width = containerWidth ?? ctx.config.defaultWidth;
      return measurerRef.current.measure(text, width);
    },
    [ctx.config.defaultWidth]
  );

  return { measure };
}
