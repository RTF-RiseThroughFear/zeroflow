/**
 * DragReflowDemo - THE visceral demo.
 *
 * Drag a handle to resize a text container. pretext's layout()
 * is called on EVERY mousemove (~0.05ms), so text reflows
 * instantly with zero DOM measurement. Shows live timing.
 *
 * This is what makes Chenglou's demos feel "impossible":
 *   - Drag handle fires 60+ events/sec
 *   - Each one calls layout(), pure arithmetic
 *   - Container height updates BEFORE the browser paints
 *   - Result: perfectly fluid text reflow with zero jank
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { prepare, layout } from '@chenglou/pretext';

const DEMO_FONT = '16px "Helvetica Neue", Helvetica, Arial, sans-serif';
const LINE_HEIGHT = 24;
const MIN_WIDTH = 120;
const MAX_WIDTH = 700;

const DEMO_TEXT = `Pretext eliminates layout reflow by measuring text with pure mathematics instead of the DOM. The binary search shrink-wrap algorithm finds the tightest bubble width that keeps the same line count. CSS max-width can never achieve this level of precision.

AGI 春天到了. بدأت الرحلة 🚀 The measurement engine is script-aware: CJK characters break per-character, Arabic renders right-to-left, Thai uses dictionary segmentation, and emoji ZWJ sequences stay whole.

Every call to layout() is pure arithmetic: no canvas, no DOM, no getComputedStyle. Just math. That's why dragging this handle feels instant: ~0.05ms per call, 60 calls per second, zero dropped frames.`;

interface LayoutTiming {
  width: number;
  height: number;
  lineCount: number;
  timeMs: number;
}

export function DragReflowDemo() {
  const [containerWidth, setContainerWidth] = useState(420);
  const [isDragging, setIsDragging] = useState(false);
  const [timings, setTimings] = useState<LayoutTiming[]>([]);
  const [currentLayout, setCurrentLayout] = useState({ height: 0, lineCount: 0, timeMs: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);

  // Prepare text once (expensive, cached)
  const prepared = useMemo(() => prepare(DEMO_TEXT, DEMO_FONT), []);

  // Compute layout on every width change (pure math, ~0.05ms)
  useEffect(() => {
    const start = performance.now();
    const result = layout(prepared, containerWidth, LINE_HEIGHT);
    const elapsed = performance.now() - start;

    setCurrentLayout({
      height: result.height,
      lineCount: result.lineCount,
      timeMs: elapsed,
    });

    if (isDragging) {
      setTimings(prev => {
        const next = [...prev, { width: containerWidth, height: result.height, lineCount: result.lineCount, timeMs: elapsed }];
        return next.slice(-60); // keep last 60 frames
      });
    }
  }, [containerWidth, prepared, isDragging]);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setTimings([]);
    document.body.classList.add('is-dragging');
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = containerWidth;
  }, [containerWidth]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartXRef.current;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartWidthRef.current + delta));
      setContainerWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.classList.remove('is-dragging');
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    setTimings([]);
    dragStartXRef.current = e.touches[0]!.clientX;
    dragStartWidthRef.current = containerWidth;
  }, [containerWidth]);

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      const delta = e.touches[0]!.clientX - dragStartXRef.current;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartWidthRef.current + delta));
      setContainerWidth(newWidth);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  const avgTime = timings.length > 0
    ? (timings.reduce((sum, t) => sum + t.timeMs, 0) / timings.length)
    : 0;

  return (
    <section id="drag-reflow" style={{ padding: '80px 0' }}>
      <div className="container">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, marginBottom: 12 }}>
            <span className="gradient-text">Drag to Reflow</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 17, maxWidth: 580, margin: '0 auto' }}>
            Drag the handle to resize. <code style={{ color: 'var(--accent-blue)', fontSize: 14 }}>layout()</code> is
            called on every mouse move: pure arithmetic, zero DOM reads. Text reflows instantly.
          </p>
        </div>

        {/* Live metrics bar */}
        <div style={{
          display: 'flex',
          gap: 24,
          justifyContent: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
        }}>
          <div className="metric-pill">
            <span className="metric-label">width</span>
            <span className="metric-value" style={{ color: 'var(--accent-blue)' }}>{containerWidth}px</span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">height</span>
            <span className="metric-value" style={{ color: 'var(--accent-emerald)' }}>{currentLayout.height}px</span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">lines</span>
            <span className="metric-value" style={{ color: 'var(--accent-purple)' }}>{currentLayout.lineCount}</span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">layout()</span>
            <span className="metric-value" style={{
              color: currentLayout.timeMs < 0.1 ? 'var(--accent-emerald)' : 'var(--accent-orange)',
            }}>
              {currentLayout.timeMs.toFixed(3)}ms
            </span>
          </div>
        </div>

        {/* Drag container */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          minHeight: 400,
        }}>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            {/* Text container */}
            <div
              ref={containerRef}
              style={{
                width: containerWidth,
                height: currentLayout.height + 40, // PRE-CALCULATED by pretext + 20px padding top/bottom
                overflow: 'hidden',
                background: 'var(--bg-card)',
                border: `1px solid ${isDragging ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: 20,
                transition: isDragging ? 'none' : 'border-color 200ms',
                boxShadow: isDragging
                  ? '0 0 30px rgba(59, 130, 246, 0.15), 0 8px 32px rgba(0,0,0,0.3)'
                  : '0 4px 16px rgba(0,0,0,0.2)',
              }}
            >
              <div style={{
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                fontSize: 16,
                lineHeight: `${LINE_HEIGHT}px`,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {DEMO_TEXT}
              </div>
            </div>

            {/* Drag handle */}
            <div
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              style={{
                position: 'absolute',
                right: -16,
                top: 0,
                bottom: 0,
                width: 32,
                cursor: 'col-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
              }}
            >
              <div style={{
                width: 6,
                height: 48,
                borderRadius: 3,
                background: isDragging
                  ? 'var(--accent-blue)'
                  : 'rgba(255, 255, 255, 0.25)',
                transition: isDragging ? 'none' : 'background 200ms',
                boxShadow: isDragging ? '0 0 12px var(--accent-blue)' : 'none',
              }} />
            </div>

            {/* Width indicator lines */}
            {isDragging && (
              <>
                <div style={{
                  position: 'absolute',
                  top: -20,
                  left: 0,
                  right: 0,
                  height: 1,
                  background: 'var(--accent-blue)',
                  opacity: 0.4,
                }} />
                <div style={{
                  position: 'absolute',
                  top: -18,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-blue)',
                  whiteSpace: 'nowrap',
                }}>
                  {containerWidth}px
                </div>
              </>
            )}
          </div>
        </div>

        {/* Timing sparkline */}
        {timings.length > 2 && (
          <div style={{
            marginTop: 32,
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            maxWidth: 600,
            margin: '32px auto 0',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}>
              <p style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}>
                layout() timing per frame:
              </p>
              <p style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-emerald)',
              }}>
                avg: {avgTime.toFixed(3)}ms · {timings.length} frames
              </p>
            </div>
            <div style={{
              display: 'flex',
              gap: 2,
              alignItems: 'flex-end',
              height: 32,
              overflow: 'hidden',
            }}>
              {timings.map((t, i) => {
                const maxTime = Math.max(...timings.map(tt => tt.timeMs), 0.1);
                const h = Math.max(2, (t.timeMs / maxTime) * 32);
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${h}px`,
                      background: t.timeMs < 0.1
                        ? 'var(--accent-emerald)'
                        : t.timeMs < 0.5
                          ? 'var(--accent-blue)'
                          : 'var(--accent-orange)',
                      borderRadius: 1,
                      opacity: 0.6 + (i / timings.length) * 0.4,
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
