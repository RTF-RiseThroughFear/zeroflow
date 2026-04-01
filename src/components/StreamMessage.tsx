/**
 * StreamMessage: Drop-in component for zero-reflow streaming text.
 *
 * The simplest way to render AI streaming responses without
 * layout jank. Just pass a stream and it handles everything.
 * Supports optional markdown rendering via the incremental parser.
 *
 * Now with shrink-wrap support:
 *   - When shrinkWrap=true, the container width tightens to fit the widest
 *     line after streaming completes, using Chenglou's binary search +
 *     walkLineRanges pattern. Zero wasted horizontal space.
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
 * // Basic usage
 * <StreamMessage
 *   stream={aiResponse}
 *   className="chat-bubble"
 *   font="16px Inter"
 * />
 *
 * // With shrink-wrap (tightest bubble sizing)
 * <StreamMessage
 *   stream={aiResponse}
 *   font="16px Inter"
 *   shrinkWrap
 * />
 * ```
 */
export function StreamMessage(props: StreamMessageProps) {
  const {
    stream,
    className,
    font,
    width,
    lineHeight = 24,
    markdown = true,
    shrinkWrap = false,
    onComplete,
    onLayout,
    children,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(width);

  // Auto-detect container width if not provided (ONE DOM read on mount)
  useEffect(() => {
    if (width !== undefined || !containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
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
    lineHeight,
    shrinkWrap,
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

    parserStateRef.current = createParserState();
    const ast = feedText(parserStateRef.current, layout.text);
    setMarkdownAst(ast);
  }, [layout.text, markdown]);

  // Notify parent of layout changes
  useEffect(() => {
    onLayout?.(layout);
  }, [layout, onLayout]);

  // Container sizing:
  // DURING STREAMING: We render plain text, which matches pretext's measurement
  // exactly. Use explicit height to prevent ANY browser layout recalculation.
  // AFTER STREAMING: Markdown elements (code blocks, lists) may be slightly
  // taller than plain text, so use minHeight as a floor.
  const hasPreCalculatedHeight = layout.height > 0;
  const isCurrentlyStreaming = layout.isStreaming;
  const containerStyle: CSSProperties = {
    ...(hasPreCalculatedHeight
      ? {
          // During streaming: exact height (plain text = exact pretext match)
          // After streaming: let markdown expand beyond if needed
          height: isCurrentlyStreaming ? layout.height : undefined,
          minHeight: layout.height,
          overflow: isCurrentlyStreaming ? 'hidden' : undefined,
          transition: isCurrentlyStreaming ? 'height 50ms ease-out, min-height 50ms ease-out' : 'none',
          willChange: isCurrentlyStreaming ? 'height, min-height' : 'auto',
        }
      : {}),
    // Shrink-wrap: tighten width after streaming completes
    ...(shrinkWrap && layout.tightWidth && !isCurrentlyStreaming
      ? {
          width: layout.tightWidth,
          transition: 'width 200ms ease-out',
        }
      : {}),
  };

  // Custom renderer
  if (children) {
    return (
      <div ref={containerRef} className={className} style={containerStyle}>
        {children(layout)}
      </div>
    );
  }

  // Reset key counter so React can reconcile nodes stably across renders
  nodeKeyCounter = 0;

  // Core rendering decision:
  // DURING STREAMING: Always render plain text (layout.text from pretext).
  //   This is the zero-reflow key: pretext calculates the height,
  //   we set it on the container, and render plain text. NO markdown
  //   AST rebuild, NO DOM churn, NO forced layout recalculation.
  //   The cursor animates smoothly because the DOM structure is stable.
  //
  // AFTER STREAMING: Render rich markdown. The AST is built once at the
  //   end, not on every token. The height is already correct from pretext.
  const shouldRenderMarkdown = markdown && markdownAst && !layout.isStreaming;

  // Default renderer
  return (
    <div ref={containerRef} className={className} style={containerStyle}>
      <div
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: `${lineHeight}px`,
        }}
      >
        {shouldRenderMarkdown ? renderAst(markdownAst) : layout.text}
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


// --------------------------------------------------
// AST to React Elements
// --------------------------------------------------

let nodeKeyCounter = 0;

/** Generate a stable key for React elements. Counter is reset per render cycle. */
function nextKey(): string {
  return `zf-${++nodeKeyCounter}`;
}

// Inject blink keyframe so the cursor works without external CSS
if (typeof document !== 'undefined') {
  const styleId = 'zeroflow-cursor-keyframes';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = '@keyframes zeroflow-blink { 50% { opacity: 0; } }';
    document.head.appendChild(style);
  }
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
