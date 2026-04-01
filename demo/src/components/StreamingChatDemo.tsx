/**
 * StreamingChatDemo - Live shrink-wrap during AI streaming.
 *
 * The unique demo that NO other library can show:
 *   - Tokens stream in from a mock LLM
 *   - pretext re-measures on every token batch
 *   - Bubble width tightens frame-by-frame
 *   - Zero forced reflows
 *
 * Shows the AI use case that justifies this entire library.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  prepare,
  layout,
  prepareWithSegments,
  walkLineRanges,
} from '@chenglou/pretext';

// ── Config ──

const BUBBLE_FONT = '15px "Helvetica Neue", Helvetica, Arial, sans-serif';
const LINE_HEIGHT = 22;
const MAX_BUBBLE_WIDTH = 400;
const STREAM_DELAY_MS = 35;

// ── Streaming Messages ──

const STREAM_MESSAGES = [
  'Pretext eliminates layout reflow by measuring text with pure mathematics instead of the DOM.',
  'The binary search shrink-wrap algorithm finds the tightest bubble width that keeps the same line count. CSS max-width can never achieve this level of precision.',
  'Streaming updates are batched at 60fps via requestAnimationFrame. Each batch calls layout(), pure arithmetic at ~0.0002ms per call.',
  'AGI 春天到了. بدأت الرحلة 🚀 The measurement is script-aware: CJK per-character breaks, Arabic RTL, Thai dictionary segmentation, emoji ZWJ sequences.',
];

type ChatBubble = {
  id: number;
  text: string;
  sender: 'user' | 'assistant';
  isStreaming: boolean;
  tightWidth: number;
  lineCount: number;
};

/**
 * Compute the tight width for text at a given max bubble width.
 */
function computeTightWidth(text: string, maxWidth: number): { tightWidth: number; lineCount: number } {
  if (!text.trim()) return { tightWidth: 0, lineCount: 0 };

  const prepared = prepare(text, BUBBLE_FONT);
  const preparedSeg = prepareWithSegments(text, BUBBLE_FONT);
  const result = layout(prepared, maxWidth, LINE_HEIGHT);

  // Binary search for narrowest width keeping same lineCount
  let lo = 1;
  let hi = Math.max(1, Math.ceil(maxWidth));
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (layout(prepared, mid, LINE_HEIGHT).lineCount <= result.lineCount) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }

  // Walk lines at tight width to get actual max line width
  let maxLineWidth = 0;
  walkLineRanges(preparedSeg, lo, (line) => {
    if (line.width > maxLineWidth) maxLineWidth = line.width;
  });

  return {
    tightWidth: Math.ceil(maxLineWidth),
    lineCount: result.lineCount,
  };
}

export function StreamingChatDemo() {
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentMsgIndex, setCurrentMsgIndex] = useState(0);
  const [widthLog, setWidthLog] = useState<number[]>([]);
  const abortRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll within chat container (NOT the page)
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [bubbles]);

  const streamNextMessage = useCallback(async () => {
    if (currentMsgIndex >= STREAM_MESSAGES.length) return;

    const msgText = STREAM_MESSAGES[currentMsgIndex]!;
    const bubbleId = Date.now();
    abortRef.current = false;

    // Add user prompt
    const userBubble: ChatBubble = {
      id: bubbleId - 1,
      text: `Tell me about ${['reflow elimination', 'shrink-wrap', 'streaming', 'i18n support'][currentMsgIndex]}`,
      sender: 'user',
      isStreaming: false,
      ...computeTightWidth(
        `Tell me about ${['reflow elimination', 'shrink-wrap', 'streaming', 'i18n support'][currentMsgIndex]}`,
        MAX_BUBBLE_WIDTH,
      ),
    };

    setBubbles((prev) => [...prev, userBubble]);

    // Wait a bit then start assistant stream
    await new Promise((r) => setTimeout(r, 400));
    if (abortRef.current) return;

    const asstBubble: ChatBubble = {
      id: bubbleId,
      text: '',
      sender: 'assistant',
      isStreaming: true,
      tightWidth: 0,
      lineCount: 0,
    };
    setBubbles((prev) => [...prev, asstBubble]);

    // Stream tokens
    const widths: number[] = [];
    let currentText = '';

    for (let i = 0; i < msgText.length; i += 3 + Math.floor(Math.random() * 5)) {
      if (abortRef.current) break;

      currentText = msgText.slice(0, i + 3 + Math.floor(Math.random() * 5));
      if (currentText.length > msgText.length) currentText = msgText;

      const metrics = computeTightWidth(currentText, MAX_BUBBLE_WIDTH);
      widths.push(metrics.tightWidth);

      setBubbles((prev) =>
        prev.map((b) =>
          b.id === bubbleId
            ? { ...b, text: currentText, tightWidth: metrics.tightWidth, lineCount: metrics.lineCount }
            : b,
        ),
      );

      await new Promise((r) => setTimeout(r, STREAM_DELAY_MS));
    }

    // Finalize
    const finalMetrics = computeTightWidth(msgText, MAX_BUBBLE_WIDTH);
    setBubbles((prev) =>
      prev.map((b) =>
        b.id === bubbleId
          ? { ...b, text: msgText, isStreaming: false, ...finalMetrics }
          : b,
      ),
    );
    setWidthLog(widths);
    setCurrentMsgIndex((i) => i + 1);
  }, [currentMsgIndex]);

  const handleStart = useCallback(async () => {
    setIsRunning(true);
    await streamNextMessage();
    setIsRunning(false);
  }, [streamNextMessage]);

  const handleReset = useCallback(() => {
    abortRef.current = true;
    setBubbles([]);
    setCurrentMsgIndex(0);
    setWidthLog([]);
    setIsRunning(false);
  }, []);

  return (
    <section id="streaming-chat" style={{ padding: '80px 0' }}>
      <div className="container">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, marginBottom: 12 }}>
            <span className="gradient-text">Live Streaming Chat</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 17, maxWidth: 560, margin: '0 auto' }}>
            Watch bubble width tighten in real-time as tokens stream in.
            Every frame uses <code style={{ color: 'var(--accent-blue)', fontSize: 14 }}>layout()</code>. Pure math, zero DOM reads.
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 32 }}>
          <button
            className="btn btn-primary"
            onClick={handleStart}
            disabled={isRunning || currentMsgIndex >= STREAM_MESSAGES.length}
          >
            {currentMsgIndex === 0 ? '▶ Start Chat' : `▶ Message ${currentMsgIndex + 1}/${STREAM_MESSAGES.length}`}
          </button>
          <button className="btn btn-secondary" onClick={handleReset}>
            ↻ Reset
          </button>
        </div>

        {/* Chat Container */}
        <div style={{
          maxWidth: 520,
          margin: '0 auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          minHeight: 300,
          maxHeight: 500,
          overflowY: 'auto',
          padding: 20,
        }} ref={chatContainerRef}>
          {bubbles.length === 0 && (
            <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', fontStyle: 'italic', padding: 40 }}>
              Press "Start Chat" to see live shrink-wrap streaming...
            </p>
          )}

          {bubbles.map((bubble) => (
            <div
              key={bubble.id}
              style={{
                display: 'flex',
                justifyContent: bubble.sender === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 12,
              }}
            >
              <div
                className={`stream-bubble stream-bubble-${bubble.sender}`}
                style={{
                  width: bubble.tightWidth > 0 ? bubble.tightWidth + 24 : undefined, // +padding
                  maxWidth: MAX_BUBBLE_WIDTH,
                  transition: 'width 60ms ease-out',
                }}
              >
                <div style={{
                  fontSize: 15,
                  lineHeight: `${LINE_HEIGHT}px`,
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                }}>
                  {bubble.text}
                  {bubble.isStreaming && (
                    <span className="stream-cursor" style={{
                      display: 'inline-block',
                      width: 2,
                      height: 16,
                      background: 'var(--accent-blue)',
                      marginLeft: 2,
                      animation: 'zeroflow-blink 0.8s step-end infinite',
                    }} />
                  )}
                </div>
                {/* Live metrics */}
                {bubble.sender === 'assistant' && bubble.tightWidth > 0 && (
                  <div style={{
                    marginTop: 6,
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: bubble.isStreaming ? 'var(--accent-blue)' : 'var(--accent-emerald)',
                    opacity: 0.8,
                  }}>
                    w: {bubble.tightWidth}px · {bubble.lineCount} lines
                    {bubble.isStreaming && ' ⚡'}
                  </div>
                )}
              </div>
            </div>
          ))}

        </div>

        {/* Width convergence log */}
        {widthLog.length > 0 && (
          <div style={{
            marginTop: 24,
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            maxWidth: 520,
            margin: '24px auto 0',
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Width convergence (last message):
            </p>
            <div style={{
              display: 'flex',
              gap: 4,
              alignItems: 'flex-end',
              height: 40,
              overflow: 'hidden',
            }}>
              {widthLog.slice(-50).map((w, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${Math.max(4, (w / MAX_BUBBLE_WIDTH) * 40)}px`,
                    background: `linear-gradient(to top, var(--accent-blue), var(--accent-emerald))`,
                    borderRadius: 1,
                    opacity: 0.6 + (i / 50) * 0.4,
                  }}
                />
              ))}
            </div>
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginTop: 6 }}>
              {widthLog[0]}px → {widthLog[widthLog.length - 1]}px ({widthLog.length} frames)
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
