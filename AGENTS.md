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

### Core modules (library)

| File | Purpose |
|------|---------|
| `src/core/measure.ts` | Wraps pretext prepare/layout. Caches per font. |
| `src/core/stream-buffer.ts` | Batches tokens, flushes at target FPS via RAF |
| `src/core/provider.tsx` | React context for shared config and measurer cache |
| `src/core/markdown.ts` | Incremental streaming markdown parser (bold, italic, code, headers, links, lists) |
| `src/hooks/use-stream-layout.ts` | Main hook: stream + pretext = layout result |
| `src/hooks/use-pretext-measure.ts` | Low-level measurement hook |
| `src/components/StreamMessage.tsx` | Drop-in streaming message component |
| `src/geometry.ts` | Polygon geometry: obstacle avoidance, hit testing, hull transforms |
| `src/types.ts` | All TypeScript type definitions |

### Demo site modules

| File | Purpose |
|------|---------|
| `demo/src/components/DragonDemo.tsx` | Flagship: Mouse-following text reflow + click-to-rotate polygons |
| `demo/src/components/DragReflowDemo.tsx` | Drag-to-resize container width with live reflow |
| `demo/src/components/ShrinkWrapDemo.tsx` | Pixel-perfect chat bubble sizing demo |
| `demo/src/components/StreamingChatDemo.tsx` | AI chat streaming with 0-reflow vs standard comparison |
| `demo/src/components/StreamingPlayground.tsx` | Interactive playground with font/speed controls |
| `demo/src/components/AccordionDemo.tsx` | Collapsible sections with pretext height prediction |
| `demo/src/components/Hero.tsx` | Landing page hero section |
| `demo/src/components/SideBySide.tsx` | Side-by-side perf comparison (0 reflows vs standard) |

### Test suites (132 tests, all passing)

| File | Tests | Purpose |
|------|-------|---------|
| `src/__tests__/geometry.test.ts` | 20+ | Polygon geometry: scanline, hit-test, interval, transform |
| `src/__tests__/markdown.test.ts` | 20+ | Incremental parser: inline styles, streaming, AST |
| `src/__tests__/measure.test.ts` | 10+ | Measurer with mock canvas |
| `src/__tests__/stream-buffer.test.ts` | 10+ | Token batching and flush timing |
| `src/__tests__/pretext-api-completeness.test.ts` | ~20 | Ensures all pretext API functions are accessible |
| `src/__tests__/pretext-layout-contract.test.ts` | ~20 | Validates pretext layout math contracts |
| `src/__tests__/streaming-height-contract.test.ts` | 4 | Height = lineCount * lineHeight invariant |
| `src/__tests__/lineheight-sync.test.ts` | 5 | CSS and pretext lineHeight must agree |
| `src/__tests__/provider-standalone.test.ts` | 3 | Module-level cache stability |

## Tech stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript (strict) |
| Framework | React 18+ |
| Build | tsup (ESM + CJS) |
| Test | Vitest (132 tests) |
| Demo | Vite |
| Core dependency | @chenglou/pretext v0.0.4 |

## What to build next

1. Incremental markdown parser (bold, italic, code, headers, links, lists) — DONE
2. VirtualChatList component (virtualized list with height prediction)
3. ShrinkBubble component (pixel-perfect chat bubble sizing) — DEMO DONE, library component TODO
4. Demo site (Vite, side-by-side comparison, interactive playground) — DONE
5. Dragon demo (Chenglou-style magazine layout with polygon obstacles) — DONE
6. Vercel AI SDK integration (useChat compatibility)
7. Performance benchmarks (automated, run in CI)
8. npm publish + Vercel deploy

## Key design decisions

- pretext's prepare() is called once per font and cached. layout() is called on every token batch. This separation is what makes it fast.
- StreamBuffer uses requestAnimationFrame to batch token flushes at 60fps. This prevents React reconciliation from being the bottleneck.
- The StreamMessage component sets a pre-calculated `height` style on the container via pretext measurement. This is what eliminates reflow: the browser never needs to calculate layout because we already told it the exact height.
- Works without a Provider for simple use cases (standalone mode with defaults).
- Dragon demo bypasses React entirely in the hot path — all layout calculations and DOM mutations happen in a single RAF callback via direct `element.style` writes and a `syncPool()` DOM management pattern.

## Critical lessons from Chenglou's pretext source

### pretext API (v0.0.4)
```typescript
// Two-phase: prepare once, layout many times
prepare(font: string): Prepared
prepareWithSegments(segments: Segment[]): Prepared

// Pure math layout — this is the core
layout(prepared: Prepared, text: string, containerWidth: number): LayoutResult
layoutNextLine(prepared: Prepared, text: string, startOffset: number, width: number, lineHeight: number): LineResult
layoutWithLines(prepared: Prepared, text: string, containerWidth: number): LinesResult

// Utilities
shrinkWrap(prepared: Prepared, text: string, maxWidth: number): ShrinkResult
walkLineRanges(prepared: Prepared, text: string, containerWidth: number, callback: Function): void
setLocale(locale: string): void
```

### How Chenglou's dynamic-layout.ts actually works
1. **No canvas rendering** — Pure DOM with absolute positioning
2. **layoutColumn()** iterates through y-bands, calls `carveTextLineSlots()` to find gaps around obstacles, then `layoutNextLine()` to fill the widest gap
3. **syncPool()** manages a stable set of DOM `<p>` elements, growing/shrinking the pool to match the current line count (prevents DOM churn)
4. **commitFrame()** is the RAF hot path — runs all layout math + DOM style mutations in one frame
5. **Text "parts" like water** — Mouse position creates a circular obstacle, text routes around it in real-time at 120fps
6. **Click-to-rotate** — Polygon shapes rotate 180° on click with ease-out animation, text reflows around the rotated hull

### Polygon geometry (ported from wrap-geometry.ts)
- `getPolygonXsAtY()` — Scanline: find x-intersections of polygon edges at a given y
- `isPointInPolygon()` — Winding-number hit test
- `getPolygonIntervalForBand()` — Horizontal blocked envelope across a line band
- `transformWrapPoints()` — Map normalized hull coords (0-1) to screen space with rotation
