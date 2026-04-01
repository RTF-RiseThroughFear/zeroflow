# AGENTS.md: zeroflow

## What this is

zeroflow is an open-source React library for zero-reflow AI streaming text rendering, powered by @chenglou/pretext.

It solves the #1 performance problem in AI chat interfaces: every token insertion triggers DOM reflow. zeroflow uses pretext to measure text layout with pure math (~0.05ms) instead of asking the DOM, eliminating all layout shifts during streaming.

## Hard rules

1. NO DOM reads in the hot path. All text measurement goes through pretext. The only acceptable DOM read is an initial container width measurement on mount.
2. TypeScript strict mode. No `any` types.
3. React 18+ compatibility. Works with React 19.
4. Zero runtime dependencies beyond @chenglou/pretext and React (peer dep).
5. Every exported function and component has JSDoc documentation.
6. MIT license.

## Architecture

```
LLM stream -> StreamBuffer (batches tokens at target FPS)
          -> pretext.prepare() (cached per font, runs once)
          -> pretext.layout() (pure math, ~0.05ms per call)
          -> React state update with pre-calculated height
          -> DOM render into pre-sized container -> ZERO REFLOW
```

### Core modules

| File | Purpose |
|------|---------|
| `src/core/measure.ts` | Wraps pretext prepare/layout. Caches per font. |
| `src/core/stream-buffer.ts` | Batches tokens, flushes at target FPS via RAF |
| `src/core/provider.tsx` | React context for shared config and measurer cache |
| `src/hooks/use-stream-layout.ts` | Main hook: stream + pretext = layout result |
| `src/hooks/use-pretext-measure.ts` | Low-level measurement hook |
| `src/components/StreamMessage.tsx` | Drop-in streaming message component |
| `src/types.ts` | All TypeScript type definitions |

## Tech stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript (strict) |
| Framework | React 18+ |
| Build | tsup (ESM + CJS) |
| Test | Vitest |
| Core dependency | @chenglou/pretext |

## What to build next

1. Incremental markdown parser (bold, italic, code, headers, links, lists)
2. VirtualChatList component (virtualized list with height prediction)
3. ShrinkBubble component (pixel-perfect chat bubble sizing)
4. Demo site (Vite, side-by-side comparison, interactive playground)
5. Vercel AI SDK integration (useChat compatibility)
6. Performance benchmarks (automated, run in CI)

## Key design decisions

- pretext's prepare() is called once per font and cached. layout() is called on every token batch. This separation is what makes it fast.
- StreamBuffer uses requestAnimationFrame to batch token flushes at 60fps. This prevents React reconciliation from being the bottleneck.
- The StreamMessage component sets a pre-calculated `height` style on the container via pretext measurement. This is what eliminates reflow: the browser never needs to calculate layout because we already told it the exact height.
- Works without a Provider for simple use cases (standalone mode with defaults).
