# zeroflow: Complete build plan

## What zeroflow is

zeroflow is a zero-reflow streaming text renderer for AI chat interfaces, powered by @chenglou/pretext.

It solves the #1 performance problem in AI chat UIs: every token insertion triggers DOM reflow. At 100+ tokens/second, that means 100+ forced layout recalculations per second. The UI stutters, scrolling jumps, and the experience feels cheap.

zeroflow uses pretext to measure text layout with pure math (~0.05ms) instead of asking the DOM. Zero reflow. Zero layout shifts. 120fps streaming.

## Why this matters (market context)

- @chenglou/pretext launched March 2026, got 14K+ GitHub stars in 3 days
- The pretext ecosystem is EMPTY. Zero libraries built on top of it.
- Every AI chat app (ChatGPT, Claude, Cursor, Windsurf) suffers from streaming jank
- Existing libraries (assistant-ui 50K+ monthly npm downloads, shadcn/ai) all use DOM rendering
- NOBODY is combining pretext with AI streaming. This is first-mover territory.
- The demo (side-by-side perf comparison) sells itself visually on social media

## Architecture

```
LLM stream -> StreamBuffer (batches tokens at target FPS via RAF)
          -> pretext.prepare() (cached per font, runs once)
          -> pretext.layout() (pure math, ~0.05ms per call)
          -> React state update with pre-calculated height
          -> DOM render into pre-sized container -> ZERO REFLOW
```

### How pretext works (critical context for the agent)

pretext has a two-phase API:
1. `prepare(font)` - Takes a CSS font string, creates a hidden canvas, measures character widths. Called ONCE per font and cached. This is the "expensive" part (~5ms).
2. `layout(prepared, text, containerWidth)` - Takes the cached preparation and does pure arithmetic to calculate line breaks, text height, text width. This is the "fast" part (~0.05ms). No DOM reads. No reflow.

The key insight: prepare() reads the DOM once. layout() never does. So during streaming, we call layout() hundreds of times per second with zero performance cost.

### How StreamBuffer works

LLM tokens arrive at irregular intervals (could be 1 per 10ms or 10 per 1ms). We do NOT want to re-render React for every single token. Instead:
1. Tokens are pushed into a string buffer
2. A requestAnimationFrame loop flushes the buffer at the target FPS (default: 60)
3. On flush, we run pretext.layout() to get the new height, then update React state
4. React renders once per frame with the pre-calculated height

This means: at most 60 React renders per second, each with the correct pre-calculated height from pretext. Zero reflow.

## Current state (what exists)

The scaffold is complete with these files:

| File | Status | What it does |
|------|--------|--------------|
| `src/core/measure.ts` | Done | Wraps pretext prepare/layout with font-level caching |
| `src/core/stream-buffer.ts` | Done | RAF-based token batching |
| `src/core/provider.tsx` | Done | React context for shared config |
| `src/hooks/use-stream-layout.ts` | Done | Main hook: stream + pretext = layout result |
| `src/hooks/use-pretext-measure.ts` | Done | Low-level measurement hook |
| `src/components/StreamMessage.tsx` | Done | Drop-in streaming message component |
| `src/types.ts` | Done | All TypeScript types |
| `src/index.ts` | Done | Public API exports |
| `package.json` | Done | npm config, tsup build, vitest |
| `tsconfig.json` | Done | TypeScript strict |
| `tsup.config.ts` | Done | ESM + CJS + DTS build |

## Build roadmap (in order)

### Phase 1: Make it work (Day 1)

#### 1.1 Install dependencies and verify build
```bash
npm install
npm run build
npm run typecheck
```
Fix any issues with @chenglou/pretext import. The package exports may need adjustment.

#### 1.2 Write core tests
Test files needed:
- `src/__tests__/measure.test.ts` - Test createMeasurer with mock canvas
- `src/__tests__/stream-buffer.test.ts` - Test token batching and flush timing
- `src/__tests__/use-stream-layout.test.tsx` - Test hook with mock stream

Note: pretext needs a canvas context. In tests, mock `CanvasRenderingContext2D.measureText()`.

#### 1.3 Build the incremental markdown parser
File: `src/core/markdown.ts`

This is the most critical new code. It must:
- Parse markdown tokens as they arrive (NOT re-parse the full document)
- Support: bold, italic, inline code, code blocks, headers (h1-h6), links, unordered lists, ordered lists
- NOT support in V1: tables, footnotes, task lists, images, blockquotes
- Return an AST that maps to React elements
- Handle partial tokens (e.g., token arrives as "**bol" then next token is "d**")

Key design: Maintain a state machine that tracks:
- Current open spans (bold, italic, code)
- Current block type (paragraph, header, code block, list)
- Pending partial markers ("*" could be start of bold or just an asterisk)

#### 1.4 Integrate markdown into StreamMessage
Update `StreamMessage.tsx` to:
- Accept `markdown` prop (default: true)
- When true, pipe text through the incremental parser
- Render parsed AST as React elements with appropriate styles
- When false, render raw text (current behavior)

### Phase 2: Demo site (Day 1-2)

#### 2.1 Scaffold with Vite
```bash
cd demo
npx -y create-vite@latest ./ --template react-ts
```

#### 2.2 Build the side-by-side comparison page
This is THE viral demo. Two columns:
- Left: Standard react-markdown rendering (DOM-based, shows jank)
- Right: zeroflow rendering (pretext-based, butter smooth)
- Both stream the SAME mock LLM response simultaneously
- Show live FPS counter on each side
- Show reflow counter (using PerformanceObserver)
- "Start streaming" button triggers both simultaneously

The mock LLM stream should:
- Emit tokens at realistic speed (50-150ms intervals, variable)
- Include markdown: headers, bold, code blocks, lists
- Be long enough to show the performance difference (500+ tokens)

#### 2.3 Build the interactive playground
- Text input where users can type/paste text
- Live preview showing zeroflow rendering
- Controls: font size, container width, streaming speed
- Performance metrics: layout time, render time, reflow count

#### 2.4 Landing page design
This needs to be STUNNING. Not a basic docs page. Think:
- Dark mode by default
- Gradient hero with animated text streaming effect
- Key metrics: "0 reflows" "~0.05ms layout" "5KB gzipped"
- Installation command with copy button
- Code examples with syntax highlighting
- Link to GitHub, npm, playground

Color palette suggestion:
- Background: near-black (#0a0a0b)
- Accent: electric blue (#3b82f6) to emerald (#10b981) gradient
- Text: white/gray scale
- Code blocks: dark with subtle border

### Phase 3: Polish and ship (Day 2)

#### 3.1 Vercel AI SDK integration
Create a helper that converts `useChat()` response stream to zeroflow's StreamSource type.

```tsx
import { useChat } from 'ai/react';
import { StreamMessage } from 'zeroflow';
import { toZeroflowStream } from 'zeroflow/adapters/vercel-ai';

function Chat() {
  const { messages } = useChat();
  return messages.map(m => 
    <StreamMessage key={m.id} stream={toZeroflowStream(m)} />
  );
}
```

#### 3.2 Performance benchmarks
Create `bench/` directory with:
- Automated benchmark that streams 1000 tokens and measures:
  - Total forced reflows (should be 0)
  - Average frame time
  - Peak memory usage
  - Layout calculation time per token
- Compare against react-markdown (baseline)
- Output results as JSON for CI

#### 3.3 Documentation site
Update the demo site to include:
- Getting started guide
- API reference (auto-generated from JSDoc)
- Examples with live code
- Performance comparison data

#### 3.4 npm publish
```bash
npm run build
npm publish
```

#### 3.5 Deploy demo site
Deploy to Vercel (free tier) or GitHub Pages:
```bash
cd demo
npm run build
# Deploy dist/ to Vercel
```

### Phase 4: Post-launch growth

#### 4.1 Twitter/X thread
Structure:
1. Hook: Side-by-side GIF showing jank vs smooth
2. The problem: "Every AI chat app reflows on every token"
3. The solution: "pretext measures text with math, not DOM"
4. The numbers: "847 reflows vs 0. 23ms frames vs 0.4ms."
5. Install: `npm install zeroflow`
6. Tag @_chenglou (pretext creator)

#### 4.2 Additional components (post V1)
- `VirtualChatList` - Virtualized message list with height prediction
- `ShrinkBubble` - Pixel-perfect chat bubble sizing
- `EditorialLayout` - Magazine-style multi-column text layout
- Web Worker mode - Move pretext measurement off main thread

## Technical constraints

1. pretext needs `CanvasRenderingContext2D`. This means:
   - Client-side only. No SSR rendering (use placeholder on server, hydrate on client)
   - Tests need canvas mock (jsdom doesn't have real canvas)
2. Font loading: pretext measures based on the current font. If the font hasn't loaded yet, measurements will be wrong. Handle `document.fonts.ready` or re-measure after font swap.
3. Bundle size budget: zeroflow + pretext should be under 10KB gzipped total. No heavy dependencies.
4. React 18+ only (uses hooks, no class components).

## Files that need to be created

```
src/
  core/
    markdown.ts          # NEW: Incremental markdown parser
  __tests__/
    measure.test.ts      # NEW: Measurer tests
    stream-buffer.test.ts # NEW: Buffer tests  
    markdown.test.ts     # NEW: Parser tests
    StreamMessage.test.tsx # NEW: Component tests
demo/
  index.html             # NEW: Demo entry
  src/
    main.tsx             # NEW: Demo app entry
    App.tsx              # NEW: Demo app
    styles.css           # NEW: Demo styles
    components/
      SideBySide.tsx     # NEW: THE viral comparison demo
      Playground.tsx     # NEW: Interactive playground
      Hero.tsx           # NEW: Landing page hero
      CodeExample.tsx    # NEW: Syntax-highlighted code blocks
  vite.config.ts         # NEW: Demo build config
  package.json           # NEW: Demo dependencies
bench/
  stream-benchmark.ts    # NEW: Automated benchmarks
```

## Cost: $0

- GitHub: Free (public repo)
- npm: Free (publishing is free)
- Demo site: Vercel free tier (hobby plan, no credit card needed)
- No database, no auth, no backend, no API keys
- No paid dependencies
