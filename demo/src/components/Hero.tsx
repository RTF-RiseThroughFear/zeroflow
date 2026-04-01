/**
 * Hero: Stunning landing section with animated gradient text,
 * key metrics, and installation command.
 */

import { useState, useEffect } from 'react';

const HERO_WORDS = ['Zero Reflow.', '120fps Streaming.', 'Pure Math Layout.', 'Zero Jank.'];

export function Hero({ onStartDemo }: { onStartDemo: () => void }) {
  const [wordIndex, setWordIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex(prev => (prev + 1) % HERO_WORDS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText('npm install zeroflow');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section style={{ padding: '120px 0 80px', textAlign: 'center' }}>
      <div className="container">
        {/* Badge */}
        <div className="animate-in" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 16px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--gradient-subtle)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--accent-blue)',
          marginBottom: 32,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-emerald)', boxShadow: '0 0 8px var(--accent-emerald)' }} />
          Powered by @chenglou/pretext
        </div>

        {/* Main heading */}
        <h1 className="animate-in animate-delay-1" style={{
          fontSize: 'clamp(3rem, 8vw, 5.5rem)',
          fontWeight: 900,
          lineHeight: 1.05,
          letterSpacing: '-0.04em',
          marginBottom: 8,
        }}>
          <span className="gradient-text">zeroflow</span>
        </h1>

        {/* Rotating subtitle */}
        <div className="animate-in animate-delay-2" style={{
          fontSize: 'clamp(1.4rem, 4vw, 2.2rem)',
          fontWeight: 700,
          height: '3rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}>
          <span key={wordIndex} style={{
            animation: 'fade-in 0.4s ease',
            color: 'var(--text-primary)',
          }}>
            {HERO_WORDS[wordIndex]}
          </span>
        </div>

        {/* Description */}
        <p className="animate-in animate-delay-3" style={{
          fontSize: 18,
          maxWidth: 600,
          margin: '0 auto 40px',
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
        }}>
          Drop-in React component for AI chat interfaces. Every token renders
          without a single DOM reflow. Powered by pure-math text measurement.
        </p>

        {/* Metrics */}
        <div className="animate-in animate-delay-3" style={{
          display: 'flex',
          gap: 16,
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: 40,
        }}>
          <div className="metric-badge">
            <span className="value gradient-text">0</span>
            <span className="label">Reflows</span>
          </div>
          <div className="metric-badge">
            <span className="value gradient-text">~0.05ms</span>
            <span className="label">Layout Time</span>
          </div>
          <div className="metric-badge">
            <span className="value gradient-text">120fps</span>
            <span className="label">Streaming</span>
          </div>
          <div className="metric-badge">
            <span className="value gradient-text">5KB</span>
            <span className="label">Gzipped</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="animate-in animate-delay-4" style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: 48,
        }}>
          <button className="btn btn-primary" onClick={onStartDemo}>
            ▶ See the Demo
          </button>
          <a
            className="btn btn-secondary"
            href="https://github.com/RTF-RiseThroughFear/zeroflow"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub →
          </a>
        </div>

        {/* Install command */}
        <div className="animate-in animate-delay-4 code-block" style={{
          maxWidth: 400,
          margin: '0 auto',
          textAlign: 'left',
        }}>
          <code style={{ color: 'var(--accent-emerald)' }}>$</code>{' '}
          <code>npm install zeroflow</code>
          <button className="copy-btn" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </section>
  );
}
