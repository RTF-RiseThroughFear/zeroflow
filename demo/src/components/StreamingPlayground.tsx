/**
 * StreamingPlayground: Chenglou's bubbles demo pattern, in React.
 *
 * What makes this "fire":
 *   1. Multiple chat bubbles, each shrink-wrapped to pixel-perfect width
 *   2. Binary search finds the TIGHTEST width that keeps same line count
 *   3. Drag the slider → ALL bubbles reflow simultaneously like water
 *   4. "Wasted pixels" counter proves CSS wastes space, pretext doesn't
 *   5. Streaming adds new messages with live shrink-wrap
 *
 * Grounded 100% in Chenglou's bubbles-shared.ts:
 *   - findTightWrapMetrics() binary search
 *   - computeBubbleRender() for CSS vs tight width comparison
 *   - walkLineRanges() for maxLineWidth discovery
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { prepareWithSegments, layout, walkLineRanges } from '@chenglou/pretext';
import type { PreparedTextWithSegments } from '@chenglou/pretext';

const FONT = '15px "Helvetica Neue", Helvetica, Arial, sans-serif';
const LINE_HEIGHT = 20;
const PADDING_H = 12;
const PADDING_V = 8;
const BUBBLE_MAX_RATIO = 0.8;
const MIN_CHAT_WIDTH = 220;
const MAX_CHAT_WIDTH = 680;

// Real chat messages — mixed lengths, some short, some multi-line
const CHAT_MESSAGES: { text: string; sender: 'user' | 'ai' }[] = [
  { text: "What makes pretext different from DOM measurement?", sender: 'user' },
  { text: "pretext calculates text layout with pure math — no DOM reads whatsoever. Every call to layout() is arithmetic: ~0.05ms. The browser's getBoundingClientRect triggers forced reflow, which costs 5-30ms and blocks the main thread.", sender: 'ai' },
  { text: "How does the shrink-wrap work?", sender: 'user' },
  { text: "Binary search. We find the tightest width that keeps the same line count. CSS max-width always wastes pixels on the last line because the browser doesn't expose per-line width data. walkLineRanges() gives us exact line widths.", sender: 'ai' },
  { text: "Can it handle CJK and Arabic?", sender: 'user' },
  { text: "Yes. CJK breaks per-character, Arabic renders RTL, Thai uses dictionary segmentation. Emoji ZWJ sequences like 👨‍👩‍👧‍👦 stay whole. The measurement engine is script-aware.", sender: 'ai' },
  { text: "Show me numbers.", sender: 'user' },
  { text: "layout() runs in 0.02-0.08ms. That's ~20,000 calls per second. The browser's reflow? 5-30ms per read. So pretext is 100-1000x faster. And it never blocks. You can call it 60 times per second during a drag and never drop a frame.", sender: 'ai' },
  { text: "Why does this matter for AI chat?", sender: 'user' },
  { text: "Every LLM token triggers a resize. At 100 tokens/sec, that's 100 forced reflows. With pretext, each token just recalculates height — pure math, zero DOM. The container height is set BEFORE the browser paints. Result: zero jank, zero layout shift.", sender: 'ai' },
];

// Streaming messages that appear one by one
const STREAM_MESSAGES: { text: string; sender: 'user' | 'ai' }[] = [
  { text: "What about streaming?", sender: 'user' },
  { text: "Watch this. As each token arrives, pretext recalculates the bubble width. The bubble shrinks and grows to fit the content perfectly, with zero wasted pixels. No other library can do this.", sender: 'ai' },
];

interface BubbleMetrics {
  cssWidth: number;
  tightWidth: number;
  height: number;
  lineCount: number;
  wastedPixels: number;
}

/** 
 * Binary search for tightest wrap width (Chenglou's findTightWrapMetrics).
 * Finds the minimum width that produces the same line count as maxWidth.
 */
function findTightWidth(prepared: PreparedTextWithSegments, maxWidth: number): { tightWidth: number; maxLineWidth: number; lineCount: number; height: number } {
  const initial = layout(prepared, maxWidth, LINE_HEIGHT);
  const targetLineCount = initial.lineCount;
  
  if (targetLineCount <= 1) {
    // Single line: find exact width via walkLineRanges
    let maxLineWidth = 0;
    walkLineRanges(prepared, maxWidth, (line: { width: number }) => {
      if (line.width > maxLineWidth) maxLineWidth = line.width;
    });
    return { tightWidth: Math.ceil(maxLineWidth), maxLineWidth, lineCount: targetLineCount, height: initial.height };
  }

  // Binary search: find minimum width that keeps same line count
  let lo = 1;
  let hi = Math.max(1, Math.ceil(maxWidth));

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const midResult = layout(prepared, mid, LINE_HEIGHT);
    if (midResult.lineCount <= targetLineCount) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }

  // Get metrics at tight width
  let maxLineWidth = 0;
  const lineCount = walkLineRanges(prepared, lo, (line: { width: number }) => {
    if (line.width > maxLineWidth) maxLineWidth = line.width;
  });

  return { tightWidth: Math.ceil(maxLineWidth), maxLineWidth, lineCount, height: lineCount * LINE_HEIGHT };
}

/** Compute bubble metrics for a message at a given chat width */
function computeBubbleMetrics(prepared: PreparedTextWithSegments, chatWidth: number): BubbleMetrics {
  const bubbleMaxWidth = Math.floor(chatWidth * BUBBLE_MAX_RATIO);
  const contentMaxWidth = bubbleMaxWidth - PADDING_H * 2;

  // CSS approach: just use max-width (wastes pixels on last line)
  let cssMaxLineWidth = 0;
  const cssLineCount = walkLineRanges(prepared, contentMaxWidth, (line: { width: number }) => {
    if (line.width > cssMaxLineWidth) cssMaxLineWidth = line.width;
  });
  const cssWidth = Math.min(bubbleMaxWidth, Math.ceil(cssMaxLineWidth) + PADDING_H * 2);
  const cssHeight = cssLineCount * LINE_HEIGHT + PADDING_V * 2;

  // Pretext approach: binary search for tightest width
  const tight = findTightWidth(prepared, contentMaxWidth);
  const tightWidth = Math.min(bubbleMaxWidth, tight.tightWidth + PADDING_H * 2);

  const wastedPixels = Math.max(0, (cssWidth - tightWidth) * cssHeight);

  return { cssWidth, tightWidth, height: cssHeight, lineCount: cssLineCount, wastedPixels };
}

export function StreamingPlayground() {
  const [chatWidth, setChatWidth] = useState(440);
  const [showTight, setShowTight] = useState(true);
  const [streamingIndex, setStreamingIndex] = useState(-1);
  const [streamText, setStreamText] = useState('');
  const isStreamingRef = useRef(false);
  const abortRef = useRef(false);

  // Prepare all static messages
  const preparedMessages = useMemo(() => {
    return CHAT_MESSAGES.map(msg => ({
      ...msg,
      prepared: prepareWithSegments(msg.text, FONT),
    }));
  }, []);

  // Compute all bubble metrics whenever chatWidth changes
  const bubbleMetrics = useMemo(() => {
    return preparedMessages.map(msg => computeBubbleMetrics(msg.prepared, chatWidth));
  }, [preparedMessages, chatWidth]);

  // Streaming message metrics
  const streamBubbleMetrics = useMemo(() => {
    if (streamingIndex < 0 || !streamText) return null;
    const msg = STREAM_MESSAGES[streamingIndex];
    if (!msg) return null;
    const prepared = prepareWithSegments(streamText, FONT);
    return computeBubbleMetrics(prepared, chatWidth);
  }, [streamingIndex, streamText, chatWidth]);

  // Completed stream messages
  const [completedStreams, setCompletedStreams] = useState<{ text: string; sender: 'user' | 'ai'; prepared: PreparedTextWithSegments }[]>([]);

  const completedMetrics = useMemo(() => {
    return completedStreams.map(msg => computeBubbleMetrics(msg.prepared, chatWidth));
  }, [completedStreams, chatWidth]);

  // Total wasted pixels
  const totalWasted = useMemo(() => {
    let total = bubbleMetrics.reduce((sum, m) => sum + m.wastedPixels, 0);
    total += completedMetrics.reduce((sum, m) => sum + m.wastedPixels, 0);
    if (streamBubbleMetrics) total += streamBubbleMetrics.wastedPixels;
    return total;
  }, [bubbleMetrics, completedMetrics, streamBubbleMetrics]);

  // Stream handler
  const startStreaming = useCallback(async () => {
    if (isStreamingRef.current) return;
    isStreamingRef.current = true;
    abortRef.current = false;

    for (let i = 0; i < STREAM_MESSAGES.length; i++) {
      if (abortRef.current) break;
      const msg = STREAM_MESSAGES[i]!;
      setStreamingIndex(i);
      setStreamText('');

      // Stream tokens
      const words = msg.text.split(/(\s+)/);
      for (const word of words) {
        if (abortRef.current) break;
        await new Promise(r => setTimeout(r, 30 + Math.random() * 40));
        setStreamText(prev => prev + word);
      }

      if (!abortRef.current) {
        // Complete this message
        setCompletedStreams(prev => [...prev, {
          text: msg.text,
          sender: msg.sender,
          prepared: prepareWithSegments(msg.text, FONT),
        }]);
      }
    }

    setStreamingIndex(-1);
    setStreamText('');
    isStreamingRef.current = false;
  }, []);

  const resetDemo = useCallback(() => {
    abortRef.current = true;
    isStreamingRef.current = false;
    setStreamingIndex(-1);
    setStreamText('');
    setCompletedStreams([]);
  }, []);

  const bubbleMaxWidth = Math.floor(chatWidth * BUBBLE_MAX_RATIO);

  return (
    <section id="playground" style={{ padding: '80px 0' }}>
      <div className="container">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, marginBottom: 12 }}>
            <span className="gradient-text">Pixel-Perfect Bubbles</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 17, maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
            Drag the slider. Every bubble shrink-wraps to the{' '}
            <em>tightest possible width</em> — binary search finds the minimum that keeps the same line count. 
            CSS can't do this.
          </p>
        </div>

        {/* Width slider (Chenglou pattern) */}
        <div style={{
          maxWidth: 500,
          margin: '0 auto 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <span style={{ 
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
            minWidth: 36,
          }}>
            {MIN_CHAT_WIDTH}
          </span>
          <input
            type="range"
            min={MIN_CHAT_WIDTH}
            max={MAX_CHAT_WIDTH}
            value={chatWidth}
            onChange={e => setChatWidth(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent-blue)' }}
          />
          <span style={{
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent-blue)',
            fontWeight: 700,
            minWidth: 52,
            textAlign: 'right',
          }}>
            {chatWidth}px
          </span>
        </div>

        {/* Controls row */}
        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 28,
          flexWrap: 'wrap',
        }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowTight(prev => !prev)}
            style={{
              fontSize: 13,
              background: showTight ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              borderColor: showTight ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
              color: showTight ? 'var(--accent-emerald)' : '#ef4444',
            }}
          >
            {showTight ? '✓ Pretext Shrink-Wrap' : '✗ CSS max-width'}
          </button>
          {!isStreamingRef.current ? (
            <button className="btn btn-primary" onClick={startStreaming} style={{ fontSize: 13 }}>
              ▶ Stream New Messages
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={resetDemo} style={{ fontSize: 13 }}>
              ■ Reset
            </button>
          )}
        </div>

        {/* Wasted pixels counter */}
        <div style={{
          display: 'flex',
          gap: 20,
          justifyContent: 'center',
          marginBottom: 24,
        }}>
          <div className="metric-pill">
            <span className="metric-label">CSS would waste</span>
            <span className="metric-value" style={{ color: '#ef4444' }}>
              {totalWasted.toLocaleString()}px²
            </span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">pretext wastes</span>
            <span className="metric-value" style={{ color: showTight ? 'var(--accent-emerald)' : '#ef4444' }}>
              {showTight ? '0px²' : `${totalWasted.toLocaleString()}px²`}
            </span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">bubbles</span>
            <span className="metric-value" style={{ color: 'var(--accent-purple)' }}>
              {CHAT_MESSAGES.length + completedStreams.length + (streamingIndex >= 0 ? 1 : 0)}
            </span>
          </div>
        </div>

        {/* Chat container */}
        <div style={{
          width: chatWidth,
          margin: '0 auto',
          padding: '16px 0',
          transition: 'width 0ms',
        }}>
          {/* Static messages */}
          {preparedMessages.map((msg, i) => {
            const metrics = bubbleMetrics[i]!;
            const width = showTight ? metrics.tightWidth : metrics.cssWidth;
            return (
              <ChatBubble
                key={`static-${i}`}
                text={msg.text}
                sender={msg.sender}
                width={width}
                maxWidth={bubbleMaxWidth}
              />
            );
          })}

          {/* Completed stream messages */}
          {completedStreams.map((msg, i) => {
            const metrics = completedMetrics[i]!;
            const width = showTight ? metrics.tightWidth : metrics.cssWidth;
            return (
              <ChatBubble
                key={`stream-done-${i}`}
                text={msg.text}
                sender={msg.sender}
                width={width}
                maxWidth={bubbleMaxWidth}
              />
            );
          })}

          {/* Currently streaming message */}
          {streamingIndex >= 0 && streamText && (
            <ChatBubble
              text={streamText}
              sender={STREAM_MESSAGES[streamingIndex]!.sender}
              width={showTight && streamBubbleMetrics ? streamBubbleMetrics.tightWidth : (streamBubbleMetrics?.cssWidth ?? bubbleMaxWidth)}
              maxWidth={bubbleMaxWidth}
              isStreaming
            />
          )}
        </div>

        {/* Proof cards */}
        <div style={{
          marginTop: 48,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          maxWidth: 700,
          margin: '48px auto 0',
        }}>
          <ProofCard
            icon="🔍"
            title="Binary Search"
            desc="Finds the tightest width keeping same line count. ~10 layout() calls."
          />
          <ProofCard
            icon="💧"
            title="Water Reflow"
            desc="Drag the slider. ALL bubbles reflow simultaneously in one frame."
          />
          <ProofCard
            icon="🎯"
            title="Zero Waste"
            desc="CSS max-width wastes pixels on the last line. Pretext wastes zero."
          />
        </div>
      </div>
    </section>
  );
}

/** Chat bubble with pixel-perfect shrink-wrap */
function ChatBubble({ text, sender, width, maxWidth, isStreaming }: {
  text: string;
  sender: 'user' | 'ai';
  width: number;
  maxWidth: number;
  isStreaming?: boolean;
}) {
  const isUser = sender === 'user';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 6,
    }}>
      <div style={{
        width: Math.min(width, maxWidth),
        maxWidth: maxWidth,
        padding: `${PADDING_V}px ${PADDING_H}px`,
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isUser
          ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
          : 'var(--bg-card)',
        border: isUser ? 'none' : '1px solid var(--border-subtle)',
        fontSize: 15,
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        lineHeight: `${LINE_HEIGHT}px`,
        color: isUser ? '#fff' : 'var(--text-primary)',
        wordBreak: 'break-word',
        transition: 'width 0ms',
        boxShadow: isStreaming
          ? '0 0 12px rgba(16, 185, 129, 0.2)'
          : isUser
            ? '0 2px 8px rgba(59, 130, 246, 0.25)'
            : '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        {text}
        {isStreaming && (
          <span style={{
            display: 'inline-block',
            width: 2,
            height: 16,
            background: 'var(--accent-emerald)',
            marginLeft: 2,
            animation: 'blink 1s step-end infinite',
            verticalAlign: 'text-bottom',
          }} />
        )}
      </div>
    </div>
  );
}

/** Proof card */
function ProofCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      padding: '16px 20px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{title}</h4>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{desc}</p>
    </div>
  );
}
