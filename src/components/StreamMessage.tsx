/**
 * StreamMessage: Drop-in component for zero-reflow streaming text.
 *
 * The simplest way to render AI streaming responses without
 * layout jank. Just pass a stream and it handles everything.
 * Supports optional markdown rendering via the incremental parser.
 *
 * When markdown is enabled, the component uses auto height since
 * markdown elements (headings, code blocks, lists) have variable
 * sizing that pretext plain-text measurement cannot predict.
 * When markdown is disabled, it uses pretext's pre-calculated
 * height for true zero-reflow rendering.
 */

import { useRef, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useStreamLayout } from '../hooks/use-stream-layout';
import { createParserState, feedText, type MarkdownNode } from '../core/markdown';
import type { StreamMessageProps, LayoutResult } from '../types';

/**
 * Zero-reflow streaming message component.
 *
 * Pre-calculates container height using pretext before rendering,
 * eliminating layout shifts during streaming.
 *
 * @example
 * ```tsx
 * <StreamMessage
 *   stream={aiResponse}
 *   className="chat-bubble"
 *   font="16px Inter"
 * />
 * ```
 */
export function StreamMessage(props: StreamMessageProps) {
  const {
    stream,
    className,
    font,
    width,
    markdown = true,
    onComplete,
    onLayout,
    children,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(width);

  // Auto-detect container width if not provided
  useEffect(() => {
    if (width !== undefined || !containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Only read width once on mount, not on every resize
        // This is the ONE DOM read we allow
        setContainerWidth(entry.contentRect.width);
        observer.disconnect();
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [width]);

  const layout = useStreamLayout({
    stream,
    font,
    width: containerWidth,
    onComplete,
  });

  // Track markdown AST for rendering
  const [markdownAst, setMarkdownAst] = useState<MarkdownNode | null>(null);
  const parserStateRef = useRef(createParserState());
  const prevTextRef = useRef('');

  // Update markdown AST when layout text changes
  useEffect(() => {
    if (!markdown || !layout.text || layout.text === prevTextRef.current) return;
    prevTextRef.current = layout.text;

    // Re-create parser state and feed full text
    // (parser re-parses full text each time - simple and correct)
    parserStateRef.current = createParserState();
    const ast = feedText(parserStateRef.current, layout.text);
    setMarkdownAst(ast);
  }, [layout.text, markdown]);

  // Notify parent of layout changes
  useEffect(() => {
    onLayout?.(layout);
  }, [layout, onLayout]);

  // Pre-calculated height for plain text (true zero reflow).
  // For markdown mode, we use auto height because markdown elements
  // (headings, code blocks, lists) have variable sizing that pretext
  // plain-text measurement cannot predict accurately.
  const usePreCalculatedHeight = !markdown && layout.height > 0;
  const containerStyle: CSSProperties = usePreCalculatedHeight
    ? {
        height: layout.height,
        overflow: 'hidden',
        transition: layout.isStreaming ? 'height 50ms ease-out' : 'none',
        willChange: layout.isStreaming ? 'height' : 'auto',
      }
    : {
        minHeight: layout.height || undefined,
      };

  // Custom renderer
  if (children) {
    return (
      <div ref={containerRef} className={className} style={containerStyle}>
        {children(layout)}
      </div>
    );
  }

  // Default renderer
  return (
    <div ref={containerRef} className={className} style={containerStyle}>
      <div
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.5,
        }}
      >
        {markdown && markdownAst ? renderAst(markdownAst) : layout.text}
        {layout.isStreaming && (
          <span
            className="zeroflow-cursor"
            style={{
              display: 'inline-block',
              width: '2px',
              height: '1.1em',
              backgroundColor: 'currentColor',
              marginLeft: '1px',
              animation: 'zeroflow-blink 1s step-end infinite',
              verticalAlign: 'text-bottom',
            }}
          />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// AST → React Elements
// ──────────────────────────────────────────────────

let nodeKeyCounter = 0;

/** Generate a unique key for React elements */
function nextKey(): string {
  return `zf-${++nodeKeyCounter}`;
}

/**
 * Render a markdown AST node tree to React elements.
 *
 * @param node - AST node to render
 * @returns React element tree
 */
function renderAst(node: MarkdownNode): ReactNode {
  switch (node.type) {
    case 'root':
      return node.children.map(child => renderAst(child));

    case 'paragraph':
      return (
        <p key={nextKey()} style={{ margin: '0 0 0.75em 0' }}>
          {node.children.map(child => renderAst(child))}
        </p>
      );

    case 'heading': {
      const level = (node.meta?.level as number) ?? 1;
      const Tag = `h${Math.min(level, 6)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      const sizes: Record<number, string> = {
        1: '1.75em', 2: '1.5em', 3: '1.25em', 4: '1.1em', 5: '1em', 6: '0.9em',
      };
      return (
        <Tag
          key={nextKey()}
          style={{
            fontSize: sizes[level] ?? '1em',
            fontWeight: 700,
            margin: '0.5em 0 0.25em 0',
            lineHeight: 1.3,
          }}
        >
          {node.children.map(child => renderAst(child))}
        </Tag>
      );
    }

    case 'code_block': {
      const lang = node.meta?.language as string | undefined;
      return (
        <pre
          key={nextKey()}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: '6px',
            padding: '0.75em 1em',
            margin: '0.5em 0',
            overflow: 'auto',
            fontSize: '0.875em',
            lineHeight: 1.5,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          <code data-language={lang}>
            {node.children.map(child => renderAst(child))}
          </code>
        </pre>
      );
    }

    case 'list': {
      const ordered = node.meta?.ordered === 1;
      const Tag = ordered ? 'ol' : 'ul';
      return (
        <Tag
          key={nextKey()}
          style={{
            margin: '0.5em 0',
            paddingLeft: '1.5em',
          }}
        >
          {node.children.map(child => renderAst(child))}
        </Tag>
      );
    }

    case 'list_item':
      return (
        <li key={nextKey()} style={{ margin: '0.25em 0' }}>
          {node.children.map(child => renderAst(child))}
        </li>
      );

    case 'bold':
      return (
        <strong key={nextKey()}>
          {node.children.map(child => renderAst(child))}
        </strong>
      );

    case 'italic':
      return (
        <em key={nextKey()}>
          {node.children.map(child => renderAst(child))}
        </em>
      );

    case 'inline_code':
      return (
        <code
          key={nextKey()}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '3px',
            padding: '0.15em 0.35em',
            fontSize: '0.875em',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {node.content}
        </code>
      );

    case 'link':
      return (
        <a
          key={nextKey()}
          href={node.meta?.href as string}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#3b82f6',
            textDecoration: 'underline',
          }}
        >
          {node.children.map(child => renderAst(child))}
        </a>
      );

    case 'line_break':
      return <br key={nextKey()} />;

    case 'text':
      return node.content ?? '';

    default:
      return node.content ?? '';
  }
}
