/**
 * zeroflow demo app.
 *
 * Landing page with:
 * 1. Hero section (gradient, metrics, install command)
 * 2. Side-by-side streaming comparison (THE viral demo)
 * 3. Code examples
 * 4. Footer
 */

import { useRef } from 'react';
import { Hero } from './components/Hero';
import { SideBySide } from './components/SideBySide';
import { CodeExamples } from './components/CodeExamples';

export default function App() {
  const demoRef = useRef<HTMLDivElement>(null);

  const scrollToDemo = () => {
    demoRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Nav */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(6, 6, 10, 0.8)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: '-0.03em',
          }}>
            <span className="gradient-text">zeroflow</span>
          </span>
          <span style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(59, 130, 246, 0.15)',
            color: 'var(--accent-blue)',
            fontWeight: 600,
          }}>
            v0.1.0
          </span>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <a href="#demo" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>Demo</a>
          <a href="#examples" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>Examples</a>
          <a
            href="https://github.com/RTF-RiseThroughFear/zeroflow"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}
          >
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/zeroflow"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 13,
              padding: '6px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
            }}
          >
            npm ↗
          </a>
        </div>
      </nav>

      {/* Sections */}
      <Hero onStartDemo={scrollToDemo} />

      <div ref={demoRef}>
        <SideBySide />
      </div>

      <CodeExamples />

      {/* Footer */}
      <footer style={{
        padding: '48px 24px',
        textAlign: 'center',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 24, fontWeight: 800 }}>
            <span className="gradient-text">zeroflow</span>
          </span>
        </div>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 16 }}>
          Zero reflow. 120fps streaming. Drop-in React component for AI chat interfaces.
        </p>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', fontSize: 14 }}>
          <a href="https://github.com/RTF-RiseThroughFear/zeroflow" style={{ color: 'var(--text-secondary)' }}>
            GitHub
          </a>
          <a href="https://www.npmjs.com/package/zeroflow" style={{ color: 'var(--text-secondary)' }}>
            npm
          </a>
          <a href="https://pretext.wiki" style={{ color: 'var(--text-secondary)' }}>
            pretext
          </a>
        </div>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 24 }}>
          MIT License · Built by{' '}
          <a href="https://github.com/RisingThroughFear" style={{ color: 'var(--text-secondary)' }}>
            David Bisong
          </a>
        </p>
      </footer>
    </div>
  );
}
