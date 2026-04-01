/**
 * ShrinkWrapDemo - the showstopper.
 *
 * Side-by-side comparison: CSS max-width vs Pretext shrink-wrap.
 * Interactive slider to adjust chat width. Live wasted pixels counter.
 *
 * Directly ported from Chenglou's bubbles demo:
 *   https://github.com/chenglou/pretext/blob/main/pages/demos/bubbles.ts
 *
 * The core insight visible to the user:
 *   CSS: "11,944 wasted px²"  vs  Pretext: "0 wasted px²"
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  prepareBubbleTexts,
  computeBubbleRender,
  formatPixelCount,
  getMaxChatWidth,
  type PreparedBubble,
} from '../utils/bubble-metrics';

// ── Chat Messages ──

const CHAT_MESSAGES = [
  { sender: 'user', text: 'Can you explain how pretext eliminates layout reflow during AI streaming?' },
  { sender: 'assistant', text: 'Sure! The key is a two-phase architecture: prepare() segments text and measures widths via Canvas (expensive, but cached). Then layout() does pure arithmetic on cached widths, no DOM reads, ~0.0002ms per call.' },
  { sender: 'user', text: 'What about chat bubble widths? CSS max-width always leaves wasted space.' },
  { sender: 'assistant', text: 'Exactly the problem. CSS gives you max-width: 80%, but the bubble is wider than its longest line.' },
  { sender: 'assistant', text: 'Pretext solves this with binary search shrink-wrap: find the narrowest width that keeps the same line count. The result? Pixel-perfect bubbles with zero wasted horizontal space.' },
  { sender: 'user', text: 'AGI 春天到了. بدأت الرحلة 🚀 mixed scripts work too?' },
  { sender: 'assistant', text: 'Yes. Intl.Segmenter handles CJK per-character breaking, Arabic RTL, Thai dictionary breaks, and emoji ZWJ sequences. The measurement is script-aware out of the box.' },
];

const BUBBLE_FONT = '15px "Helvetica Neue", Helvetica, Arial, sans-serif';
const BUBBLE_LINE_HEIGHT = 22;
const MIN_CHAT_WIDTH = 280;

export function ShrinkWrapDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chatWidth, setChatWidth] = useState(480);
  const [maxSlider, setMaxSlider] = useState(800);

  // Prepare all bubble texts once (expensive, cached)
  const preparedBubbles = useMemo<PreparedBubble[]>(
    () => prepareBubbleTexts(CHAT_MESSAGES.map((m) => m.text), BUBBLE_FONT),
    [],
  );

  // Track viewport for slider max
  useEffect(() => {
    const update = () => {
      const maxW = getMaxChatWidth(MIN_CHAT_WIDTH, document.documentElement.clientWidth);
      setMaxSlider(maxW);
      setChatWidth((w) => Math.min(w, maxW));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Compute render state (layout() is pure arithmetic, ~0.0002ms per bubble)
  const cssRenderState = useMemo(() => {
    return computeBubbleRender(preparedBubbles, chatWidth, BUBBLE_LINE_HEIGHT);
  }, [preparedBubbles, chatWidth]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setChatWidth(Number.parseInt(e.target.value, 10));
  }, []);

  return (
    <section id="shrink-wrap" style={{ padding: '80px 0' }}>
      <div className="container">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, marginBottom: 12 }}>
            <span className="gradient-text">Shrink-Wrap Showdown</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 17, maxWidth: 560, margin: '0 auto' }}>
            CSS <code style={{ color: 'var(--accent-orange)', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4, fontSize: 14 }}>max-width</code> wastes space.
            Pretext finds the <em>tightest</em> width that keeps the same line count.
          </p>
        </div>

        {/* Slider */}
        <div className="slider-control" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          maxWidth: 600,
          margin: '0 auto 40px',
          padding: '16px 24px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontWeight: 600 }}>
            Chat Width
          </label>
          <input
            type="range"
            min={MIN_CHAT_WIDTH}
            max={maxSlider}
            value={chatWidth}
            onChange={handleSliderChange}
            style={{ flex: 1, accentColor: 'var(--accent-blue)' }}
          />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--accent-blue)',
            minWidth: 60,
            textAlign: 'right',
          }}>
            {chatWidth}px
          </span>
        </div>

        {/* Side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* CSS Column */}
          <div>
            <div className="demo-column-header" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 16, padding: '10px 16px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)',
            }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent-red)' }}>
                CSS max-width
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                color: 'var(--accent-red)',
              }}>
                {formatPixelCount(cssRenderState.totalWastedPixels)} wasted
              </span>
            </div>
            <div ref={containerRef} className="chat-column" style={{ maxWidth: chatWidth }}>
              {CHAT_MESSAGES.map((msg, i) => (
                <div
                  key={i}
                  className={`bubble bubble-${msg.sender}`}
                  style={{
                    maxWidth: cssRenderState.bubbleMaxWidth,
                    // CSS only: no explicit width control
                  }}
                >
                  <div className="bubble-text">{msg.text}</div>
                  {cssRenderState.widths[i] && cssRenderState.widths[i].wastedPixels > 0 && (
                    <div className="bubble-waste" style={{ color: 'var(--accent-red)' }}>
                      +{Math.round(cssRenderState.widths[i].wastedPixels)}px² waste
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pretext Column */}
          <div>
            <div className="demo-column-header" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 16, padding: '10px 16px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.15)',
            }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent-emerald)' }}>
                Pretext shrink-wrap
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                color: 'var(--accent-emerald)',
              }}>
                0px² wasted
              </span>
            </div>
            <div className="chat-column" style={{ maxWidth: chatWidth }}>
              {CHAT_MESSAGES.map((msg, i) => (
                <div
                  key={i}
                  className={`bubble bubble-${msg.sender} bubble-tight`}
                  style={{
                    // Pretext-controlled width: exactly the widest line
                    width: cssRenderState.widths[i] ? cssRenderState.widths[i].tightWidth : undefined,
                    maxWidth: cssRenderState.bubbleMaxWidth,
                  }}
                >
                  <div className="bubble-text">{msg.text}</div>
                  <div className="bubble-waste" style={{ color: 'var(--accent-emerald)' }}>
                    ✓ pixel-perfect
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Explanation */}
        <div style={{
          marginTop: 40,
          padding: '20px 24px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--gradient-subtle)',
          border: '1px solid rgba(59, 130, 246, 0.12)',
          maxWidth: 700,
          margin: '40px auto 0',
        }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, textAlign: 'center' }}>
            <strong style={{ color: 'var(--text-primary)' }}>How it works:</strong>{' '}
            Pretext's binary search finds the narrowest width that keeps the same line count.
            <code style={{ color: 'var(--accent-blue)', fontSize: 13 }}> walkLineRanges() </code>
            gets the actual max line width. Pure math, zero DOM reads.
            Drag the slider to see both columns adapt live.
          </p>
        </div>
      </div>
    </section>
  );
}
