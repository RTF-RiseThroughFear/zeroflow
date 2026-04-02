# zeroflow Development Log

> Last updated: 2026-04-02

## Project Status: Core Complete, Pre-Launch

### What's Done

| Component | Status | Notes |
|-----------|--------|-------|
| Core engine (`measure.ts`, `stream-buffer.ts`, `provider.tsx`) | ✅ Done | Font-level caching, RAF batching, React context |
| Incremental markdown parser (`markdown.ts`) | ✅ Done | Bold, italic, code, headers, links, lists. Streaming-safe. |
| Hooks (`use-stream-layout.ts`, `use-pretext-measure.ts`) | ✅ Done | Main API surface |
| StreamMessage component | ✅ Done | Drop-in component with markdown support |
| Polygon geometry engine (`geometry.ts`) | ✅ Done | Ported from Chenglou's `wrap-geometry.ts` |
| Test suite | ✅ 132/132 | 9 test files covering all modules |
| Demo site (Vite) | ✅ Done | 8 demo components, full landing page |
| Dragon demo (editorial layout) | ✅ Done | Faithful port of Chenglou's `dynamic-layout.ts` |

### What's NOT Done Yet

| Component | Priority | Notes |
|-----------|----------|-------|
| VirtualChatList | High | Virtualized message list with pretext height prediction |
| ShrinkBubble library component | Medium | Demo exists, needs library export |
| Vercel AI SDK adapter | High | `toZeroflowStream()` for `useChat()` |
| Performance benchmarks | Medium | Automated CI benchmarks |
| npm publish | High | Package ready, needs publish |
| Vercel deploy (demo site) | High | Demo site needs hosting |
| EditorialLayout component | Low | Library-level Dragon demo abstraction |

---

## Architecture Deep-Dive

### Core Pipeline
```
LLM tokens → StreamBuffer (RAF batching at 60fps)
           → pretext.prepare() (cached per font, ~5ms first call)
           → pretext.layout() (pure math, ~0.05ms per call)
           → React state update with pre-calculated height
           → DOM renders into pre-sized container → ZERO REFLOW
```

### Why This Works
The key insight from pretext is **two-phase measurement**:
1. `prepare(font)` — Reads DOM once (hidden canvas), measures char widths. Cached forever.
2. `layout(prepared, text, width)` — Pure arithmetic. No DOM. ~0.05ms.

During streaming, we call `layout()` hundreds of times/second with zero perf cost.

### StreamBuffer Design
- Tokens arrive irregularly (1 per 10ms or 10 per 1ms)
- Buffer accumulates tokens, RAF loop flushes at target FPS
- On flush: run `pretext.layout()` → get height → update React state
- Result: max 60 React renders/second, each with correct pre-calculated height

---

## pretext API Reference (v0.0.4)

### Two-Phase API
```typescript
prepare(font: string): Prepared
prepareWithSegments(segments: Segment[]): Prepared
```

### Layout Functions (Pure Math)
```typescript
layout(prepared, text, containerWidth): LayoutResult
// Returns: { height, lineCount, textWidth }

layoutNextLine(prepared, text, startOffset, width, lineHeight): LineResult
// Returns: { endOffset, width } — used for column/obstacle layout

layoutWithLines(prepared, text, containerWidth): LinesResult
// Returns: full line-by-line breakdown

shrinkWrap(prepared, text, maxWidth): ShrinkResult
// Returns: optimal width for pixel-perfect containers

walkLineRanges(prepared, text, containerWidth, callback): void
// Iterates line ranges without allocating
```

### Utilities
```typescript
setLocale(locale: string): void
```

---

## Dragon Demo: How Chenglou's Dynamic Layout Works

### Architecture (ported from `dynamic-layout.ts`)
The Dragon demo bypasses React entirely in the hot path. All layout + DOM mutations happen in a single RAF callback.

```
mousemove → update obstacle position
         → layoutColumn() for each column
         → carveTextLineSlots() finds gaps around obstacles
         → layoutNextLine() fills widest gap
         → syncPool() grows/shrinks DOM <p> elements
         → direct element.style mutations
         → zero React reconciliation
```

### Key Functions Ported
1. **`layoutColumn()`** — Iterates y-bands, carves text slots around obstacles, calls `layoutNextLine()`
2. **`syncPool()`** — Manages a stable pool of DOM `<p>` elements (no churn)
3. **`commitFrame()`** — The RAF hot path: layout math + DOM writes in one frame

### Interaction Model
- **Mouse-following**: Cursor creates circular obstacle, text parts around it like water
- **Click-to-rotate**: Polygon shapes (star, hexagon) rotate 180° on click with ease-out
- **Line hover**: Lines highlight with accent color on hover

### Polygon Geometry (`src/geometry.ts`)
Ported from Chenglou's `wrap-geometry.ts`:
- `getPolygonXsAtY()` — Scanline: x-intersections at a y coordinate
- `isPointInPolygon()` — Winding-number hit test
- `getPolygonIntervalForBand()` — Horizontal blocked envelope for obstacle avoidance
- `transformWrapPoints()` — Normalized hull coords (0-1) → screen space with rotation

### Performance
- Layout time: 1.6–5ms per frame
- Target: 120fps (8.3ms budget)
- Consistently hits target on modern hardware

---

## Critical Design Decisions & Lessons Learned

### 1. DOM vs Canvas for Text Rendering
**Decision**: Pure DOM with absolute positioning (same as Chenglou).
**Why**: Canvas can't do text selection, accessibility, or link clicks. DOM with pretext math gives the best of both worlds — DOM for rendering, math for measurement.

### 2. React Bypass in Hot Path
**Decision**: Dragon demo writes directly to `element.style` in RAF, never touches React state.
**Why**: React reconciliation is ~2-5ms per render. At 120fps (8.3ms budget), that's 25-60% of the frame. Direct DOM writes are ~0.1ms.

### 3. syncPool() Pattern
**Decision**: Maintain a pool of DOM elements, grow/shrink as needed.
**Why**: Creating/destroying DOM elements is expensive. Reusing from a pool prevents garbage collection pauses and layout thrashing.

### 4. lineHeight Must Be Absolute px
**Decision**: CSS `line-height` must be in px (e.g., `24px`), matching what pretext receives.
**Why**: If CSS uses relative line-height (`1.5`) and pretext uses absolute (`24`), they disagree → height prediction breaks → reflow returns. Tests enforce this invariant.

### 5. Standalone Mode (No Provider)
**Decision**: Library works without wrapping in `<ZeroflowProvider>`.
**Why**: Simple use cases shouldn't require boilerplate. Module-level cache handles singleton pattern.

---

## File Inventory

### Library (`src/`)
```
src/
├── core/
│   ├── measure.ts          # pretext prepare/layout wrapper with font cache
│   ├── stream-buffer.ts    # RAF-based token batching
│   ├── provider.tsx        # React context for shared config
│   └── markdown.ts         # Incremental streaming markdown parser
├── hooks/
│   ├── use-stream-layout.ts    # Main hook: stream + pretext = layout
│   └── use-pretext-measure.ts  # Low-level measurement hook
├── components/
│   └── StreamMessage.tsx   # Drop-in streaming component
├── geometry.ts             # Polygon geometry for obstacle layout
├── types.ts                # All TypeScript types
├── index.ts                # Public API exports
└── __tests__/
    ├── geometry.test.ts
    ├── markdown.test.ts
    ├── measure.test.ts
    ├── stream-buffer.test.ts
    ├── pretext-api-completeness.test.ts
    ├── pretext-layout-contract.test.ts
    ├── streaming-height-contract.test.ts
    ├── lineheight-sync.test.ts
    ├── provider-standalone.test.ts
    └── setup.ts
```

### Demo (`demo/src/`)
```
demo/src/
├── App.tsx                 # Route switch (hash-based)
├── main.tsx                # Entry point
├── index.css               # Global styles
├── mock-stream.ts          # Simulated LLM token stream
├── hooks.ts                # Demo-specific hooks
├── utils/
│   └── bubble-metrics.ts   # Shrink-wrap measurement utils
└── components/
    ├── DragonDemo.tsx       # Flagship: editorial polygon layout
    ├── DragReflowDemo.tsx   # Drag-to-resize reflow
    ├── ShrinkWrapDemo.tsx   # Pixel-perfect bubbles
    ├── StreamingChatDemo.tsx # Chat with 0-reflow comparison
    ├── StreamingPlayground.tsx # Interactive playground
    ├── AccordionDemo.tsx    # Height-predicted accordions
    ├── Hero.tsx             # Landing page hero
    ├── SideBySide.tsx       # Performance comparison
    └── CodeExamples.tsx     # API usage examples
```

---

## How to Resume Development

### Quick Start
```bash
cd zeroflow
npm install
npm test           # 132 tests, all pass
npm run demo       # Vite dev server at http://localhost:5176
```

### Demo Routes
- `/#dragon` — Dragon demo (mouse-following + polygon obstacles)
- `/#drag-reflow` — Drag-to-resize container
- `/#shrink-wrap` — Pixel-perfect chat bubbles
- `/#streaming` — AI streaming comparison
- `/#accordion` — Height-predicted accordions
- `/#playground` — Interactive playground
- `/#code` — API examples
- `/` — Landing page (hero + demos)

### Running Tests
```bash
npm test                    # All 132 tests
npx vitest run --reporter=verbose  # Verbose output
npx tsc --noEmit            # Type checking
```

### Building
```bash
npm run build    # tsup → dist/ (ESM + CJS + DTS)
```
