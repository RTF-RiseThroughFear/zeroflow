// zeroflow - Zero reflow streaming text renderer
// Powered by @chenglou/pretext

// Core
export { ZeroflowProvider, useZeroflowContext } from './core/provider';
export { createMeasurer, clearMeasurerCache } from './core/measure';
export { createStreamBuffer } from './core/stream-buffer';
export {
  parseMarkdown,
  parseInline,
  createParserState,
  feedText,
  astToPlainText,
} from './core/markdown';

// Hooks
export { useStreamLayout } from './hooks/use-stream-layout';
export { usePretextMeasure } from './hooks/use-pretext-measure';

// Components
export { StreamMessage } from './components/StreamMessage';

// Types
export type {
  ZeroflowConfig,
  StreamSource,
  LayoutResult,
  MeasureResult,
  StreamMessageProps,
} from './types';

export type {
  MarkdownNode,
  MarkdownNodeType,
  ParserState,
} from './core/markdown';
