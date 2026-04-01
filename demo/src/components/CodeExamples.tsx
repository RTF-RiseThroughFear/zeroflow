/**
 * CodeExample: Syntax-highlighted code blocks with copy button.
 * Shows how to use zeroflow in your project.
 */

import { useState } from 'react';

const EXAMPLES = [
  {
    title: 'Basic Usage',
    language: 'tsx',
    code: `import { StreamMessage } from 'zeroflow';

function Chat({ stream }) {
  return (
    <StreamMessage
      stream={stream}
      font="16px Inter"
      className="chat-bubble"
    />
  );
}`,
  },
  {
    title: 'With Hooks',
    language: 'tsx',
    code: `import { useStreamLayout } from 'zeroflow';

function Message({ stream }) {
  const layout = useStreamLayout({
    stream,
    font: '16px Inter',
    width: 500,
  });

  return (
    <div style={{ height: layout.height }}>
      {layout.text}
      {layout.isStreaming && <Cursor />}
    </div>
  );
}`,
  },
  {
    title: 'Vercel AI SDK',
    language: 'tsx',
    code: `import { useChat } from 'ai/react';
import { StreamMessage } from 'zeroflow';

function Chat() {
  const { messages } = useChat();
  
  return messages.map(m => (
    <StreamMessage
      key={m.id}
      stream={m.content}
      markdown={true}
    />
  ));
}`,
  },
];

export function CodeExamples() {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(EXAMPLES[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="examples" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, marginBottom: 12 }}>
            <span className="gradient-text">Drop-in Simple</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 18, maxWidth: 500, margin: '0 auto' }}>
            Three lines to zero reflow. Works with any streaming source.
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 4,
          justifyContent: 'center',
          marginBottom: 24,
        }}>
          {EXAMPLES.map((ex, i) => (
            <button
              key={ex.title}
              onClick={() => setActiveTab(i)}
              style={{
                padding: '8px 20px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: activeTab === i ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: activeTab === i ? 'var(--accent-blue)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              {ex.title}
            </button>
          ))}
        </div>

        {/* Code block */}
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div className="code-block" style={{ position: 'relative' }}>
            <div style={{
              display: 'flex',
              gap: 6,
              marginBottom: 12,
              opacity: 0.4,
            }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
            </div>
            <pre style={{ margin: 0, lineHeight: 1.6 }}>
              <code>{highlightCode(EXAMPLES[activeTab].code)}</code>
            </pre>
            <button className="copy-btn" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Basic syntax highlighting — no external dependency */
function highlightCode(code: string): React.ReactNode {
  // Simple keyword highlighting
  const lines = code.split('\n');
  return lines.map((line, i) => (
    <span key={i}>
      {highlightLine(line)}
      {i < lines.length - 1 ? '\n' : ''}
    </span>
  ));
}

function highlightLine(line: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  // Keywords
  const keywords = /\b(import|export|from|function|return|const|let|var|async|await|default|type)\b/g;
  // Strings
  const strings = /('[^']*'|"[^"]*"|`[^`]*`)/g;
  // JSX tags
  const jsxTags = /(<\/?[A-Z]\w*|<\/?[a-z][\w.-]*)/g;
  // Comments
  const comments = /(\/\/.*$)/g;

  // Simple approach: highlight the full line
  const tokens = remaining.split(/(\b(?:import|export|from|function|return|const|let|var|async|await|default|type)\b|'[^']*'|"[^"]*"|`[^`]*`|<\/?[A-Z]\w*)/);

  return tokens.map((token, idx) => {
    if (/^(import|export|from|function|return|const|let|var|async|await|default|type)$/.test(token)) {
      return <span key={idx} style={{ color: 'var(--accent-purple)' }}>{token}</span>;
    }
    if (/^['"`]/.test(token)) {
      return <span key={idx} style={{ color: 'var(--accent-emerald)' }}>{token}</span>;
    }
    if (/^<\/?[A-Z]/.test(token)) {
      return <span key={idx} style={{ color: 'var(--accent-blue)' }}>{token}</span>;
    }
    return token;
  });
}
