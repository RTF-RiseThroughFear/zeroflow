/**
 * StreamMessage: Drop-in component for zero-reflow streaming text.
 *
 * The simplest way to render AI streaming responses without
 * layout jank. Just pass a stream and it handles everything.
 */

import { useRef, useEffect, type CSSProperties } from 'react';
import { useStreamLayout } from '../hooks/use-stream-layout';
import type { StreamMessageProps } from '../types';

/**
 * Zero-reflow streaming message component.
 *
 * Pre-calculates container height using pretext before rendering,
 * eliminating layout shifts during streaming.
 *
 * @example
 * ```tsx
 * <StreamMessage
 *   stream={aiResponse}
 *   className="chat-bubble"
 *   font="16px Inter"
 * />
 * ```
 */
export function StreamMessage(props: StreamMessageProps) {
  const {
    stream,
    className,
    font,
    width,
    markdown = true,
    onComplete,
    onLayout,
    children,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = [width, (_: number) => {}];

  // Auto-detect container width if not provided
  useEffect(() => {
    if (width !== undefined || !containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Only read width once on mount, not on every resize
        // This is the ONE DOM read we allow
        setContainerWidth(entry.contentRect.width);
        observer.disconnect();
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [width]);

  const layout = useStreamLayout({
    stream,
    font,
    width: containerWidth,
    onComplete,
  });

  // Notify parent of layout changes
  useEffect(() => {
    onLayout?.(layout);
  }, [layout, onLayout]);

  // Pre-calculated height: the key to zero reflow
  const containerStyle: CSSProperties = {
    height: layout.height || 'auto',
    overflow: 'hidden',
    transition: layout.isStreaming ? 'height 50ms ease-out' : 'none',
    willChange: layout.isStreaming ? 'height' : 'auto',
  };

  // Custom renderer
  if (children) {
    return (
      <div ref={containerRef} className={className} style={containerStyle}>
        {children(layout)}
      </div>
    );
  }

  // Default renderer
  return (
    <div ref={containerRef} className={className} style={containerStyle}>
      <div
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.5,
        }}
      >
        {layout.text}
        {layout.isStreaming && (
          <span
            className="zeroflow-cursor"
            style={{
              display: 'inline-block',
              width: '2px',
              height: '1.1em',
              backgroundColor: 'currentColor',
              marginLeft: '1px',
              animation: 'zeroflow-blink 1s step-end infinite',
              verticalAlign: 'text-bottom',
            }}
          />
        )}
      </div>
    </div>
  );
}
