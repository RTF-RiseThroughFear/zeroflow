/**
 * useStreamLayout: The main hook for zero-reflow streaming.
 *
 * Connects a streaming source (ReadableStream, AsyncIterable)
 * to pretext's measurement engine, producing layout results
 * at the target frame rate without any DOM reads.
 *
 * Now uses the FULL pretext API:
 *   - Cached PreparedText (prepare() runs only when text changes)
 *   - layout() for pure-arithmetic height calculation (~0.0002ms)
 *   - shrinkWrap() for tight bubble sizing (binary search + walkLineRanges)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useZeroflowContext } from '../core/provider';
import { createStreamBuffer } from '../core/stream-buffer';
import type { StreamSource, LayoutResult } from '../types';

export interface UseStreamLayoutOptions {
  /** The streaming source */
  stream: StreamSource | null;
  /** CSS font string for measurement. Must be named font, NOT system-ui. */
  font?: string;
  /** Container width in pixels */
  width?: number;
  /** Line height in pixels (default: 24) */
  lineHeight?: number;
  /** Enable shrink-wrap bubble sizing (default: false) */
  shrinkWrap?: boolean;
  /** Callback when streaming completes */
  onComplete?: (text: string) => void;
}

const EMPTY_LAYOUT: LayoutResult = {
  height: 0,
  maxWidth: 0,
  isStreaming: false,
  text: '',
  lineCount: 0,
};

/**
 * Hook that consumes a stream and produces layout results
 * using pretext for measurement. Zero DOM reads.
 *
 * @example
 * ```tsx
 * const layout = useStreamLayout({
 *   stream: myLLMStream,
 *   font: '16px Inter',
 *   width: 500,
 *   shrinkWrap: true,
 * });
 *
 * return (
 *   <div style={{ height: layout.height, width: layout.tightWidth }}>
 *     {layout.text}
 *   </div>
 * );
 * ```
 */
export function useStreamLayout(options: UseStreamLayoutOptions): LayoutResult {
  const { stream, font, width, lineHeight = 24, shrinkWrap = false, onComplete } = options;
  const ctx = useZeroflowContext();

  const resolvedFont = font ?? ctx.config.defaultFont;
  const resolvedWidth = width ?? ctx.config.defaultWidth;

  const [layout, setLayout] = useState<LayoutResult>(EMPTY_LAYOUT);

  const measurerRef = useRef(ctx.getMeasurer(resolvedFont));

  // Compute layout from text using pretext (pure math, ~0.0002ms)
  const computeLayout = useCallback(
    (text: string, streaming: boolean): LayoutResult => {
      if (!text) {
        return { ...EMPTY_LAYOUT, isStreaming: streaming };
      }

      const measurer = measurerRef.current;

      // Fast path: height-only measurement (layout() is pure arithmetic)
      const measurement = measurer.measure(text, resolvedWidth, lineHeight);

      const result: LayoutResult = {
        height: measurement.height,
        maxWidth: resolvedWidth,
        isStreaming: streaming,
        text,
        lineCount: measurement.lineCount,
      };

      // Shrink-wrap: find tightest width via binary search + walkLineRanges
      // Only on complete (not during streaming - too expensive mid-stream)
      if (shrinkWrap && !streaming) {
        const shrunk = measurer.shrinkWrap(text, resolvedWidth, lineHeight);
        result.tightWidth = shrunk.tightWidth;
      }

      return result;
    },
    [resolvedWidth, lineHeight, shrinkWrap]
  );

  // Consume the stream
  useEffect(() => {
    if (!stream) return;

    setLayout(prev => ({ ...prev, isStreaming: true, text: '', height: 0, lineCount: 0 }));

    const buffer = createStreamBuffer({
      maxBuffer: ctx.config.bufferSize,
      targetFps: ctx.config.targetFps,
      onFlush(accumulated) {
        const newLayout = computeLayout(accumulated, true);
        setLayout(newLayout);
      },
      onComplete(fullText) {
        const finalLayout = computeLayout(fullText, false);
        setLayout(finalLayout);
        onComplete?.(fullText);
      },
      onError(err) {
        console.error('[zeroflow] Stream error:', err);
        setLayout(prev => ({ ...prev, isStreaming: false }));
      },
    });

    // Consume the stream source
    (async () => {
      try {
        const source = typeof stream === 'function' ? stream() : stream;

        if (source instanceof ReadableStream) {
          const reader = source.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = typeof value === 'string' ? value : decoder.decode(value);
            buffer.push(text);
          }
        } else {
          // AsyncIterable
          for await (const token of source) {
            buffer.push(token);
          }
        }

        buffer.complete();
      } catch (err) {
        buffer.error(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => {
      buffer.cancel();
    };
  }, [stream, ctx.config.bufferSize, ctx.config.targetFps, computeLayout, onComplete]);

  return layout;
}
