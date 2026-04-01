import type { ReactNode } from 'react';

/** Configuration for the Zeroflow provider */
export interface ZeroflowConfig {
  /** Default font for text measurement. Example: '16px Inter' */
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
  /** Calculated lines of text */
  lines: LayoutLine[];
  /** Total height in pixels */
  height: number;
  /** Maximum width used in pixels */
  maxWidth: number;
  /** Whether the stream is still active */
  isStreaming: boolean;
  /** Current raw text content */
  text: string;
}

/** A single line from layout calculation */
export interface LayoutLine {
  /** Text content of this line */
  text: string;
  /** Width of this line in pixels */
  width: number;
  /** Y position of this line */
  y: number;
  /** Height of this line */
  height: number;
}

/** Result of a text measurement */
export interface MeasureResult {
  /** Width of the text */
  width: number;
  /** Height of the text */
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
  /** Font specification for measurement. Example: '16px Inter' */
  font?: string;
  /** Container width in pixels (auto-detected if not provided) */
  width?: number;
  /** Enable markdown rendering (default: true) */
  markdown?: boolean;
  /** Callback when streaming completes */
  onComplete?: (text: string) => void;
  /** Callback on each layout update */
  onLayout?: (layout: LayoutResult) => void;
  /** Custom renderer for the text content */
  children?: (layout: LayoutResult) => ReactNode;
}
