import type { ReactNode } from 'react';

// Re-export pretext's native types so consumers don't need to import pretext directly
export type {
  LayoutLine as PretextLayoutLine,
  LayoutCursor,
  LayoutLineRange,
  PreparedText,
  PreparedTextWithSegments,
} from '@chenglou/pretext';

/** Configuration for the Zeroflow provider */
export interface ZeroflowConfig {
  /** Default font for text measurement. Must be a named font, NOT system-ui.
   *  Example: '16px Inter' */
  defaultFont?: string;
  /** Default container width in pixels */
  defaultWidth?: number;
  /** Maximum tokens to buffer before flushing (default: 8) */
  bufferSize?: number;
  /** Target frame rate for rendering updates (default: 60) */
  targetFps?: number;
}

/** A streaming source: ReadableStream, AsyncIterable, or callback */
export type StreamSource =
  | ReadableStream<string>
  | AsyncIterable<string>
  | (() => AsyncIterable<string>);

/** Result of a pretext layout calculation */
export interface LayoutResult {
  /** Total height in pixels (from pretext) */
  height: number;
  /** Number of wrapped lines */
  lineCount: number;
  /** Maximum width used in pixels */
  maxWidth: number;
  /** Whether the stream is still active */
  isStreaming: boolean;
  /** Current raw text content */
  text: string;
  /** Tight width for shrink-wrapped bubble sizing (from pretext walkLineRanges) */
  tightWidth?: number;
}

/** Result of a text measurement (height + line count) */
export interface MeasureResult {
  /** Width of the container */
  width: number;
  /** Height of the text (from pretext layout()) */
  height: number;
  /** Number of lines (from pretext layout()) */
  lineCount: number;
}

/** Result of shrink-wrap calculation (binary search + walkLineRanges) */
export interface ShrinkWrapResult {
  /** Tightest width that maintains the same line count */
  tightWidth: number;
  /** Total height at this line count */
  height: number;
  /** Number of lines */
  lineCount: number;
}

/** Props for the StreamMessage component */
export interface StreamMessageProps {
  /** The streaming source (ReadableStream, AsyncIterable, or factory) */
  stream: StreamSource;
  /** CSS class name for the message container */
  className?: string;
  /** Font specification for measurement. Must be named font, NOT system-ui.
   *  Example: '16px Inter' */
  font?: string;
  /** Container width in pixels (auto-detected if not provided) */
  width?: number;
  /** Enable markdown rendering (default: true) */
  markdown?: boolean;
  /** Enable shrink-wrap sizing (default: false).
   *  Uses pretext walkLineRanges + binary search to find the
   *  tightest bubble width. Like Chenglou's bubbles demo. */
  shrinkWrap?: boolean;
  /** Callback when streaming completes */
  onComplete?: (text: string) => void;
  /** Callback on each layout update */
  onLayout?: (layout: LayoutResult) => void;
  /** Custom renderer for the text content */
  children?: (layout: LayoutResult) => ReactNode;
}
