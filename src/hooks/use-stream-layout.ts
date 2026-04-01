/**
 * useStreamLayout: The main hook for zero-reflow streaming.
 *
 * Connects a streaming source (ReadableStream, AsyncIterable)
 * to pretext's measurement engine, producing layout results
 * at the target frame rate without any DOM reads.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useZeroflowContext } from '../core/provider';
import { createStreamBuffer } from '../core/stream-buffer';
import type { StreamSource, LayoutResult, LayoutLine } from '../types';

export interface UseStreamLayoutOptions {
  /** The streaming source */
  stream: StreamSource | null;
  /** CSS font string for measurement */
  font?: string;
  /** Container width in pixels */
  width?: number;
  /** Line height multiplier (default: 1.5) */
  lineHeight?: number;
  /** Callback when streaming completes */
  onComplete?: (text: string) => void;
}

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
 * });
 *
 * return (
 *   <div style={{ height: layout.height }}>
 *     {layout.text}
 *   </div>
 * );
 * ```
 */
export function useStreamLayout(options: UseStreamLayoutOptions): LayoutResult {
  const { stream, font, width, lineHeight = 1.5, onComplete } = options;
  const ctx = useZeroflowContext();

  const resolvedFont = font ?? ctx.config.defaultFont;
  const resolvedWidth = width ?? ctx.config.defaultWidth;

  const [layout, setLayout] = useState<LayoutResult>({
    lines: [],
    height: 0,
    maxWidth: 0,
    isStreaming: false,
    text: '',
  });

  const measurerRef = useRef(ctx.getMeasurer(resolvedFont));
  const bufferRef = useRef<ReturnType<typeof createStreamBuffer> | null>(null);

  // Compute layout from text using pretext (pure math)
  const computeLayout = useCallback(
    (text: string, streaming: boolean): LayoutResult => {
      if (!text) {
        return { lines: [], height: 0, maxWidth: 0, isStreaming: streaming, text: '' };
      }

      const measurement = measurerRef.current.measure(text, resolvedWidth);

      // Build line objects from measurement
      const lineTexts = text.split('\n');
      const lineHeightPx = measurement.height / Math.max(measurement.lineCount, 1);
      const lines: LayoutLine[] = lineTexts.map((lineText, i) => ({
        text: lineText,
        width: resolvedWidth,
        y: i * lineHeightPx * lineHeight,
        height: lineHeightPx * lineHeight,
      }));

      return {
        lines,
        height: measurement.lineCount * lineHeightPx * lineHeight,
        maxWidth: measurement.width,
        isStreaming: streaming,
        text,
      };
    },
    [resolvedWidth, lineHeight]
  );

  // Consume the stream
  useEffect(() => {
    if (!stream) return;

    setLayout(prev => ({ ...prev, isStreaming: true, text: '', lines: [], height: 0 }));

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

    bufferRef.current = buffer;

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
      bufferRef.current = null;
    };
  }, [stream, ctx.config.bufferSize, ctx.config.targetFps, computeLayout, onComplete]);

  return layout;
}
