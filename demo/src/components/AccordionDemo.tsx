/**
 * AccordionDemo - Predictive Height Accordion.
 *
 * Ported from Chenglou's accordion.ts:
 *   https://github.com/chenglou/pretext/blob/main/pages/demos/accordion.ts
 *
 * The impossible thing this shows:
 *   CSS `height: auto` doesn't animate smoothly.
 *   Pretext predicts the EXACT pixel height before expand/collapse.
 *   Result: CSS `transition: height 300ms` with a real numeric target.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { prepare, layout } from '@chenglou/pretext';
import type { PreparedText } from '@chenglou/pretext';

// ── Accordion Data ──

const ACCORDION_ITEMS = [
  {
    id: 'streaming',
    title: 'How does zero-reflow streaming work?',
    text: 'Every token from the LLM stream goes through pretext\'s layout() function, which uses pure arithmetic on cached widths, no DOM reads. The container height is pre-calculated before React even renders, so the browser never needs to figure out the layout itself. Result: zero forced reflows, zero jank, 120fps streaming.',
  },
  {
    id: 'shrinkwrap',
    title: 'What is binary search shrink-wrap?',
    text: 'CSS gives chat bubbles a max-width, but the bubble is always wider than it needs to be. Pretext\'s shrink-wrap algorithm does a binary search: test progressively narrower widths via layout() until the line count increases. Then walkLineRanges() gets the actual maximum line width. The result is a bubble that is exactly as wide as its widest line. Zero wasted horizontal space. This is impossible with CSS alone.',
  },
  {
    id: 'i18n',
    title: 'Does it handle CJK, Arabic, and emoji?',
    text: 'Yes. Intl.Segmenter handles CJK per-character breaking, Thai dictionary-based breaks, Arabic RTL bidirectional text, and emoji ZWJ sequences. Punctuation merging matches CSS behavior ("better." as one unit). AGI 春天到了. بدأت الرحلة 🚀 all measured accurately with pure math.',
  },
  {
    id: 'prepare',
    title: 'Why is prepare() called only once?',
    text: 'prepare() does the expensive work: text segmentation, canvas width measurement, emoji correction. It returns a PreparedText handle that caches all segment widths. layout() then uses these cached widths for pure arithmetic, 0.0002ms per call. This separation is what makes resize-driven relayout cheap and coordination-free. Never re-run prepare() for the same text.',
  },
];

const ACCORDION_FONT = '15px "Helvetica Neue", Helvetica, Arial, sans-serif';
const ACCORDION_LINE_HEIGHT = 24;
const INNER_PADDING_Y = 24; // top + bottom padding of the inner container

export function AccordionDemo() {
  const [openId, setOpenId] = useState<string | null>('streaming');
  const [contentWidth, setContentWidth] = useState(600);
  const contentRef = useRef<HTMLDivElement>(null);

  // Prepare all texts once
  const preparedItems = useMemo<{ id: string; prepared: PreparedText }[]>(
    () => ACCORDION_ITEMS.map((item) => ({
      id: item.id,
      prepared: prepare(item.text, ACCORDION_FONT),
    })),
    [],
  );

  // Measure content width from DOM (only acceptable DOM read, on mount/resize)
  useEffect(() => {
    const measure = () => {
      if (contentRef.current) {
        const w = contentRef.current.getBoundingClientRect().width;
        if (w > 0) setContentWidth(w - 40); // subtract horizontal padding
      }
    };
    measure();
    window.addEventListener('resize', measure);
    // Wait for fonts to load
    document.fonts.ready.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Compute predicted heights using pretext layout(), pure arithmetic
  const panelHeights = useMemo(() => {
    return preparedItems.map((item) => {
      const result = layout(item.prepared, contentWidth, ACCORDION_LINE_HEIGHT);
      return {
        height: Math.ceil(result.height + INNER_PADDING_Y),
        lineCount: result.lineCount,
        rawHeight: Math.round(result.height),
      };
    });
  }, [preparedItems, contentWidth]);

  const handleToggle = useCallback((id: string) => {
    setOpenId((current) => (current === id ? null : id));
  }, []);

  return (
    <section id="accordion" style={{ padding: '80px 0' }}>
      <div className="container">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, marginBottom: 12 }}>
            <span className="gradient-text">Predictive Accordion</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 17, maxWidth: 560, margin: '0 auto' }}>
            CSS can't animate <code style={{ color: 'var(--accent-orange)', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4, fontSize: 14 }}>height: auto</code>.
            Pretext predicts the exact pixel height <em>before</em> expanding.
          </p>
        </div>

        {/* Accordion */}
        <div ref={contentRef} className="accordion-list" style={{
          maxWidth: 700,
          margin: '0 auto',
        }}>
          {ACCORDION_ITEMS.map((item, index) => {
            const expanded = openId === item.id;
            const metrics = panelHeights[index];
            const panelHeight = expanded && metrics ? metrics.height : 0;

            return (
              <div
                key={item.id}
                className={`accordion-item ${expanded ? 'accordion-item--open' : ''}`}
              >
                {/* Toggle button */}
                <button
                  className="accordion-toggle"
                  onClick={() => handleToggle(item.id)}
                  aria-expanded={expanded}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <span className="accordion-glyph" style={{
                      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 300ms ease',
                      fontSize: 12,
                      color: expanded ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                    }}>
                      ▶
                    </span>
                    <span className="accordion-title">{item.title}</span>
                  </div>
                  {/* Measurement metadata: the pretext magic */}
                  {metrics && (
                    <span className="accordion-meta" style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: expanded ? 'var(--accent-emerald)' : 'var(--text-tertiary)',
                      transition: 'color 300ms ease',
                      whiteSpace: 'nowrap',
                    }}>
                      {metrics.lineCount} lines · {metrics.rawHeight}px
                    </span>
                  )}
                </button>

                {/* Body: height animated to pretext-predicted value */}
                <div
                  className="accordion-body"
                  style={{
                    height: panelHeight,
                    transition: 'height 300ms ease',
                    overflow: 'hidden',
                  }}
                >
                  <div className="accordion-inner" style={{ padding: '12px 20px' }}>
                    <p className="accordion-copy" style={{
                      fontSize: 15,
                      lineHeight: `${ACCORDION_LINE_HEIGHT}px`,
                      color: 'var(--text-secondary)',
                      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                    }}>
                      {item.text}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
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
            <code style={{ color: 'var(--accent-blue)', fontSize: 13 }}>prepare()</code> is called once.
            <code style={{ color: 'var(--accent-blue)', fontSize: 13 }}> layout()</code> computes exact
            height with pure arithmetic (~0.0002ms). CSS
            <code style={{ color: 'var(--accent-blue)', fontSize: 13 }}> transition: height 300ms</code> animates
            to the predicted value. No
            <code style={{ color: 'var(--accent-orange)', fontSize: 13 }}> height: auto</code> hack.
          </p>
        </div>
      </div>
    </section>
  );
}
