/**
 * SideBySide: THE viral comparison demo.
 *
 * Two streaming panels side-by-side:
 *   Left:  Standard react-markdown (DOM-based, shows jank)
 *   Right: zeroflow (pretext-based, butter smooth)
 *
 * Both stream the SAME mock LLM response simultaneously
 * with live FPS counters and per-panel height-change counters.
 */

import { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StreamMessage } from 'zeroflow';
import { createMockStream, SAMPLE_RESPONSE } from '../mock-stream';
import { useFpsCounter, useHeightChangeCounter } from '../hooks';
import type { StreamSource } from 'zeroflow';

export function SideBySide() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [standardText, setStandardText] = useState('');
  const [zeroflowStream, setZeroflowStream] = useState<StreamSource | null>(null);
  const abortRef = useRef(false);

  const standardFps = useFpsCounter();
  const zeroflowFps = useFpsCounter();
  const standardReflows = useHeightChangeCounter();
  const zeroflowReflows = useHeightChangeCounter();

  const startStreaming = useCallback(async () => {
    if (isStreaming) return;

    // Reset
    abortRef.current = false;
    setStandardText('');
    setIsStreaming(true);

    // Start FPS and reflow tracking
    standardFps.start();
    zeroflowFps.start();
    standardReflows.start();
    zeroflowReflows.start();

    // Create zeroflow stream (AsyncIterable)
    setZeroflowStream(createMockStream(SAMPLE_RESPONSE, undefined, 20));

    // Simultaneously stream to standard react-markdown
    const stream = createMockStream(SAMPLE_RESPONSE, undefined, 20);
    for await (const token of stream) {
      if (abortRef.current) break;
      setStandardText(prev => prev + token);
    }

    // Stop tracking after a short delay
    setTimeout(() => {
      standardFps.stop();
      zeroflowFps.stop();
      standardReflows.stop();
      zeroflowReflows.stop();
      setIsStreaming(false);
    }, 500);
  }, [isStreaming]);

  const stopStreaming = useCallback(() => {
    abortRef.current = true;
    standardFps.stop();
    zeroflowFps.stop();
    standardReflows.stop();
    zeroflowReflows.stop();
    setZeroflowStream(null);
    setIsStreaming(false);
  }, []);

  const resetDemo = useCallback(() => {
    stopStreaming();
    setStandardText('');
    setZeroflowStream(null);
    standardFps.reset();
    zeroflowFps.reset();
    standardReflows.reset();
    zeroflowReflows.reset();
  }, [stopStreaming]);

  const getFpsClass = (fps: number) => {
    if (fps >= 55) return 'fps-good';
    if (fps >= 30) return 'fps-warn';
    return 'fps-bad';
  };

  return (
    <section id="demo">
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, marginBottom: 12 }}>
            <span className="gradient-text">See the Difference</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 18, maxWidth: 500, margin: '0 auto' }}>
            Same content. Same stream speed. Radically different performance.
          </p>
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
          marginBottom: 32,
        }}>
          {!isStreaming ? (
            <button className="btn btn-primary" onClick={startStreaming}>
              &#9654; Start Streaming
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={stopStreaming}>
              &#9632; Stop
            </button>
          )}
          <button className="btn btn-secondary" onClick={resetDemo}>
            &#8634; Reset
          </button>
        </div>

        {/* Side-by-side panels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 20,
        }}>
          {/* Standard react-markdown (DOM) */}
          <div className="stream-panel" style={{
            borderColor: standardText ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)',
          }}>
            <div className="stream-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isStreaming ? 'var(--accent-red)' : 'var(--text-tertiary)',
                  boxShadow: isStreaming ? '0 0 8px var(--accent-red)' : 'none',
                }} />
                <h3>react-markdown <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(DOM)</span></h3>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className={`fps-counter ${getFpsClass(standardFps.fps)}`}>
                  {standardFps.fps || '-'} FPS
                </span>
                <span className="reflow-counter" style={{
                  color: standardReflows.count > 0 ? 'var(--accent-red)' : 'var(--text-tertiary)',
                }}>
                  {standardReflows.count} reflows
                </span>
              </div>
            </div>
            <div className="stream-panel-body" ref={standardReflows.setElement}>
              {standardText ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{standardText}</ReactMarkdown>
              ) : (
                <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                  Press "Start Streaming" to begin...
                </p>
              )}
            </div>
          </div>

          {/* zeroflow (pretext) */}
          <div className="stream-panel" style={{
            borderColor: zeroflowStream ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)',
          }}>
            <div className="stream-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isStreaming ? 'var(--accent-emerald)' : 'var(--text-tertiary)',
                  boxShadow: isStreaming ? '0 0 8px var(--accent-emerald)' : 'none',
                }} />
                <h3>zeroflow <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(pretext)</span></h3>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className={`fps-counter ${getFpsClass(zeroflowFps.fps)}`}>
                  {zeroflowFps.fps || '-'} FPS
                </span>
                <span className="reflow-counter" style={{
                  color: zeroflowReflows.count > 0 ? 'var(--accent-orange)' : 'var(--accent-emerald)',
                }}>
                  {zeroflowReflows.count} reflows
                </span>
              </div>
            </div>
            <div className="stream-panel-body" ref={zeroflowReflows.setElement}>
              {zeroflowStream ? (
                <StreamMessage
                  stream={zeroflowStream}
                  font="15px Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"
                  lineHeight={24}
                  markdown={true}
                />
              ) : (
                <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                  Press "Start Streaming" to begin...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Performance summary */}
        {!isStreaming && (standardFps.fps > 0 || zeroflowFps.fps > 0) && (
          <div style={{
            marginTop: 32,
            padding: '20px 24px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--gradient-subtle)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Performance Summary
            </p>
            <div style={{ display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>react-markdown: </span>
                <span style={{ color: 'var(--accent-red)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {standardFps.fps} FPS
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}> / {standardReflows.count} reflows</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>zeroflow: </span>
                <span style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {zeroflowFps.fps} FPS
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}> / {zeroflowReflows.count} reflows</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
