# zeroflow

> Zero reflow. 120fps streaming. Drop-in React component for AI chat interfaces.

Powered by [@chenglou/pretext](https://github.com/chenglou/pretext).

## The problem

Every AI chat app janks on streaming. Every token insertion triggers DOM reflow. At 100+ tokens/second, that means 100+ forced layout recalculations per second. Your UI stutters, scrolling jumps, and the experience feels cheap.

## The solution

zeroflow uses pretext to measure text layout with pure math instead of asking the DOM. Zero reflow. Zero layout shifts. Butter-smooth 120fps streaming, no matter how fast tokens arrive.

```tsx
import { StreamMessage } from 'zeroflow';

<StreamMessage stream={aiStream} />
```

## Features

- **Zero-reflow streaming** — pretext measures text without touching the DOM
- **Incremental markdown** — parses as tokens arrive, no full-document re-parsing
- **Height prediction** — knows container height before rendering (virtual scroll never flickers)
- **Shrink-wrapped bubbles** — pixel-perfect chat bubble sizing
- **Editorial layout** — magazine-style text flow around arbitrary polygon obstacles
- **Universal streaming** — works with Vercel AI SDK, OpenAI, or any ReadableStream
- **5KB core** — pretext is 5KB gzipped with zero dependencies

## Install

```bash
npm install zeroflow
```

## Quick start

```tsx
import { StreamMessage, ZeroflowProvider } from 'zeroflow';

function Chat() {
  return (
    <ZeroflowProvider>
      <StreamMessage
        stream={yourAIStream}
        className="chat-bubble"
        markdown
      />
    </ZeroflowProvider>
  );
}
```

## How it works

```
LLM stream -> token buffer -> pretext.layout() (pure math, ~0.05ms)
           -> pre-sized container -> React render -> zero reflow
```

Standard approach: 847 forced reflows per message. zeroflow: **0**.

## Demos

Run the demo site locally:

```bash
cd demo && npm install && npm run dev
```

| Demo | Route | What it shows |
|------|-------|---------------|
| **Dragon** | `/#dragon` | Mouse-following text reflow + click-to-rotate polygon obstacles |
| **Drag Reflow** | `/#drag-reflow` | Drag-to-resize container with live text reflow |
| **Shrink Wrap** | `/#shrink-wrap` | Pixel-perfect chat bubble sizing |
| **Streaming Chat** | `/#streaming` | AI streaming with 0-reflow vs standard comparison |
| **Playground** | `/#playground` | Interactive playground with font/speed controls |
| **Accordion** | `/#accordion` | Collapsible sections with height prediction |

## Project status

- ✅ Core engine (measure, stream-buffer, provider)
- ✅ Incremental markdown parser
- ✅ StreamMessage component
- ✅ Polygon geometry engine
- ✅ 132 tests passing
- ✅ Full demo site with 8 demos
- 🔜 Vercel AI SDK adapter
- 🔜 VirtualChatList component
- 🔜 npm publish
- 🔜 Performance benchmarks

## License

MIT
