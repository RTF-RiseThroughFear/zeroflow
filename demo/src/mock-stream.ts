/**
 * Mock LLM stream for the demo.
 *
 * Simulates realistic AI token streaming with variable delays
 * and rich markdown content. Used by both the standard (react-markdown)
 * and zeroflow sides of the comparison.
 */

/** Sample markdown response — rich enough to show formatting differences */
const SAMPLE_RESPONSE = `# Understanding Zero-Reflow Rendering

When building AI chat interfaces, **streaming text** is the most critical UX challenge. Every token insertion triggers a DOM reflow — the browser must recalculate layout for the *entire page*.

## The Problem

At **100+ tokens per second**, that means:

1. 100+ forced layout recalculations per second
2. Frame drops below 60fps
3. Scroll position jumping unpredictably
4. The entire UI feeling \`laggy\` and \`unresponsive\`

This happens because the browser must:

- Measure the new text width
- Calculate line breaks
- Determine container height
- Reflow all downstream elements
- Repaint the affected regions

## The Solution: pretext

\`\`\`typescript
import { prepare, layout } from '@chenglou/pretext';

// One-time preparation (cached per font)
const prepared = prepare(text, '16px Inter');

// Pure math — no DOM reads (~0.05ms)
const { height, lineCount } = layout(prepared, 600, 24);
\`\`\`

The key insight: **measure text with math, not the DOM**. The \`prepare()\` function analyzes character widths once. Then \`layout()\` does pure arithmetic to calculate line breaks and height.

## Results

With zeroflow:

- **0** forced reflows during streaming
- **~0.05ms** per layout calculation
- **120fps** smooth rendering
- **5KB** gzipped bundle size

Compare that to standard react-markdown:

- **100+** reflows per second
- **2-5ms** per DOM measurement
- **30-45fps** with visible jank
- **50KB+** bundle with dependencies

## Getting Started

\`\`\`bash
npm install zeroflow
\`\`\`

\`\`\`tsx
import { StreamMessage } from 'zeroflow';

function Chat({ stream }) {
  return (
    <StreamMessage
      stream={stream}
      font="16px Inter"
      className="chat-bubble"
    />
  );
}
\`\`\`

That's it. **Zero config. Zero reflow. Zero jank.**`;

/**
 * Create a mock stream that emits tokens at realistic LLM speed.
 *
 * @param text - The full text to stream
 * @param tokenSize - Characters per token (default: 3-8 random)
 * @param baseDelay - Base delay between tokens in ms (default: 20)
 * @returns An async iterable of string tokens
 */
export function createMockStream(
  text: string = SAMPLE_RESPONSE,
  tokenSize?: number,
  baseDelay: number = 20,
): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      let i = 0;
      while (i < text.length) {
        const size = tokenSize ?? (3 + Math.floor(Math.random() * 6));
        const token = text.slice(i, i + size);
        i += size;

        // Variable delay simulating real LLM behavior
        const jitter = Math.random() * baseDelay;
        await new Promise(r => setTimeout(r, baseDelay + jitter));

        yield token;
      }
    },
  };
}

/**
 * Create a ReadableStream version of the mock stream.
 * Used by the react-markdown comparison side.
 */
export function createMockReadableStream(
  text: string = SAMPLE_RESPONSE,
  baseDelay: number = 20,
): ReadableStream<string> {
  let i = 0;

  return new ReadableStream<string>({
    async pull(controller) {
      if (i >= text.length) {
        controller.close();
        return;
      }

      const size = 3 + Math.floor(Math.random() * 6);
      const token = text.slice(i, i + size);
      i += size;

      const jitter = Math.random() * baseDelay;
      await new Promise(r => setTimeout(r, baseDelay + jitter));

      controller.enqueue(token);
    },
  });
}

export { SAMPLE_RESPONSE };
