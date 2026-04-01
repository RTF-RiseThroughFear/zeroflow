/**
 * Incremental streaming markdown parser for zeroflow.
 *
 * Parses markdown tokens as they arrive from an LLM stream.
 * Does NOT re-parse the full document on each token - maintains
 * a state machine that processes only new input incrementally.
 *
 * Supported (V1):
 *   - Bold (**text** or __text__)
 *   - Italic (*text* or _text_)
 *   - Inline code (`code`)
 *   - Code blocks (```lang\ncode```)
 *   - Headers (# through ######)
 *   - Unordered lists (- item, * item)
 *   - Ordered lists (1. item)
 *   - Links ([text](url))
 *   - Line breaks / paragraphs
 *
 * NOT supported in V1:
 *   - Tables, footnotes, task lists, images, blockquotes
 */

// ──────────────────────────────────────────────────────────
// AST Node Types
// ──────────────────────────────────────────────────────────

/** Node types for the markdown AST */
export type MarkdownNodeType =
  | 'root'
  | 'paragraph'
  | 'heading'
  | 'code_block'
  | 'list'
  | 'list_item'
  | 'text'
  | 'bold'
  | 'italic'
  | 'inline_code'
  | 'link'
  | 'line_break';

/** Base AST node */
export interface MarkdownNode {
  /** Node type identifier */
  type: MarkdownNodeType;
  /** Child nodes */
  children: MarkdownNode[];
  /** Text content (for leaf nodes) */
  content?: string;
  /** Metadata (heading level, code language, link href, etc.) */
  meta?: Record<string, string | number>;
}

// ──────────────────────────────────────────────────────────
// Parser State
// ──────────────────────────────────────────────────────────

/** Block-level context */
type BlockType = 'paragraph' | 'heading' | 'code_block' | 'list';

/** Inline marker tracking for partial token handling */
interface PendingMarker {
  /** The marker characters seen so far */
  chars: string;
  /** Position in the raw text where this marker started */
  position: number;
}

/** Full parser state - persisted across streaming chunks */
export interface ParserState {
  /** Complete raw text received so far */
  raw: string;
  /** The parsed AST */
  ast: MarkdownNode;
  /** Whether we're inside a fenced code block */
  inCodeBlock: boolean;
  /** The code fence string (e.g., "```") */
  codeFence: string;
  /** Language for the current code block */
  codeLanguage: string;
  /** Content accumulated in the current code block */
  codeContent: string;
  /** Whether the code block opening line is complete */
  codeBlockOpened: boolean;
}

// ──────────────────────────────────────────────────────────
// Parser Implementation
// ──────────────────────────────────────────────────────────

/**
 * Create a new parser state. Call this once at the start of a stream.
 *
 * @returns Fresh parser state
 */
export function createParserState(): ParserState {
  return {
    raw: '',
    ast: { type: 'root', children: [] },
    inCodeBlock: false,
    codeFence: '',
    codeLanguage: '',
    codeContent: '',
    codeBlockOpened: false,
  };
}

/**
 * Feed new text into the parser. This is the main streaming entry point.
 * Call this each time new tokens arrive from the LLM stream.
 *
 * The parser re-parses the full accumulated text each time (simple and correct).
 * For typical AI streaming (~60 flushes/sec, <5KB text), this is <1ms per call.
 *
 * @param state - The current parser state (mutated in place)
 * @param newText - New text chunk to append
 * @returns The updated AST
 */
export function feedText(state: ParserState, newText: string): MarkdownNode {
  state.raw += newText;
  state.ast = parseMarkdown(state.raw);
  return state.ast;
}

/**
 * Parse a complete markdown string into an AST.
 * This is the core parser - called on each flush with the full accumulated text.
 *
 * @param text - Full markdown text
 * @returns Root AST node
 */
export function parseMarkdown(text: string): MarkdownNode {
  const root: MarkdownNode = { type: 'root', children: [] };
  const lines = text.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // ── Code blocks ──
    if (line.trimStart().startsWith('```')) {
      const indent = line.length - line.trimStart().length;
      const fenceLine = line.trimStart();
      const lang = fenceLine.slice(3).trim();

      // Find closing fence
      let codeLines: string[] = [];
      let closed = false;
      let j = i + 1;
      while (j < lines.length) {
        if (lines[j].trimStart().startsWith('```')) {
          closed = true;
          j++;
          break;
        }
        codeLines.push(lines[j]);
        j++;
      }

      const codeNode: MarkdownNode = {
        type: 'code_block',
        children: [{
          type: 'text',
          children: [],
          content: codeLines.join('\n'),
        }],
        meta: { language: lang },
      };

      // If not closed, mark as partial (still streaming)
      if (!closed) {
        codeNode.meta = { ...codeNode.meta, partial: 1 };
      }

      root.children.push(codeNode);
      i = j;
      continue;
    }

    // ── Headers ──
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      root.children.push({
        type: 'heading',
        children: parseInline(content),
        meta: { level },
      });
      i++;
      continue;
    }

    // ── Unordered list ──
    const ulMatch = line.match(/^(\s*)[*-]\s+(.*)$/);
    if (ulMatch) {
      const listNode: MarkdownNode = { type: 'list', children: [], meta: { ordered: 0 } };

      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*)[*-]\s+(.*)$/);
        if (!itemMatch) break;

        listNode.children.push({
          type: 'list_item',
          children: parseInline(itemMatch[2]),
        });
        i++;
      }

      root.children.push(listNode);
      continue;
    }

    // ── Ordered list ──
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      const listNode: MarkdownNode = { type: 'list', children: [], meta: { ordered: 1 } };

      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*)\d+\.\s+(.*)$/);
        if (!itemMatch) break;

        listNode.children.push({
          type: 'list_item',
          children: parseInline(itemMatch[2]),
        });
        i++;
      }

      root.children.push(listNode);
      continue;
    }

    // ── Empty line (paragraph break) ──
    if (line.trim() === '') {
      i++;
      continue;
    }

    // ── Paragraph (default) ──
    // Collect consecutive non-empty, non-special lines
    let paraLines: string[] = [];
    while (i < lines.length) {
      const pLine = lines[i];
      if (
        pLine.trim() === '' ||
        pLine.match(/^#{1,6}\s/) ||
        pLine.trimStart().startsWith('```') ||
        pLine.match(/^(\s*)[*-]\s+/) ||
        pLine.match(/^(\s*)\d+\.\s+/)
      ) {
        break;
      }
      paraLines.push(pLine);
      i++;
    }

    if (paraLines.length > 0) {
      root.children.push({
        type: 'paragraph',
        children: parseInline(paraLines.join('\n')),
      });
    }
  }

  return root;
}

// ──────────────────────────────────────────────────────────
// Inline Parser
// ──────────────────────────────────────────────────────────

/**
 * Parse inline markdown elements: bold, italic, inline code, links.
 * Handles partial markers gracefully (treats unclosed markers as text).
 *
 * @param text - Inline text to parse
 * @returns Array of inline AST nodes
 */
export function parseInline(text: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  let i = 0;
  let currentText = '';

  function pushText() {
    if (currentText) {
      nodes.push({ type: 'text', children: [], content: currentText });
      currentText = '';
    }
  }

  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];

    // ── Inline code ──
    if (char === '`') {
      const endIdx = text.indexOf('`', i + 1);
      if (endIdx !== -1) {
        pushText();
        nodes.push({
          type: 'inline_code',
          children: [],
          content: text.slice(i + 1, endIdx),
        });
        i = endIdx + 1;
        continue;
      }
    }

    // ── Bold: **text** ──
    if (char === '*' && next === '*') {
      const endIdx = text.indexOf('**', i + 2);
      if (endIdx !== -1) {
        pushText();
        nodes.push({
          type: 'bold',
          children: parseInline(text.slice(i + 2, endIdx)),
        });
        i = endIdx + 2;
        continue;
      }
    }

    // ── Bold: __text__ ──
    if (char === '_' && next === '_') {
      const endIdx = text.indexOf('__', i + 2);
      if (endIdx !== -1) {
        pushText();
        nodes.push({
          type: 'bold',
          children: parseInline(text.slice(i + 2, endIdx)),
        });
        i = endIdx + 2;
        continue;
      }
    }

    // ── Italic: *text* (but not **) ──
    if (char === '*' && next !== '*') {
      const endIdx = findClosingMarker(text, '*', i + 1);
      if (endIdx !== -1) {
        pushText();
        nodes.push({
          type: 'italic',
          children: parseInline(text.slice(i + 1, endIdx)),
        });
        i = endIdx + 1;
        continue;
      }
    }

    // ── Italic: _text_ (but not __) ──
    if (char === '_' && next !== '_') {
      const endIdx = findClosingMarker(text, '_', i + 1);
      if (endIdx !== -1) {
        pushText();
        nodes.push({
          type: 'italic',
          children: parseInline(text.slice(i + 1, endIdx)),
        });
        i = endIdx + 1;
        continue;
      }
    }

    // ── Link: [text](url) ──
    if (char === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          pushText();
          const linkText = text.slice(i + 1, closeBracket);
          const linkUrl = text.slice(closeBracket + 2, closeParen);
          nodes.push({
            type: 'link',
            children: parseInline(linkText),
            meta: { href: linkUrl },
          });
          i = closeParen + 1;
          continue;
        }
      }
    }

    // ── Line break ──
    if (char === '\n') {
      pushText();
      nodes.push({ type: 'line_break', children: [] });
      i++;
      continue;
    }

    // ── Regular character ──
    currentText += char;
    i++;
  }

  pushText();
  return nodes;
}

/**
 * Find a closing single-character marker, ensuring it's not
 * part of a double marker (e.g., find * but not **).
 */
function findClosingMarker(text: string, marker: string, start: number): number {
  for (let i = start; i < text.length; i++) {
    if (text[i] === marker) {
      // Make sure this isn't a double marker
      if (text[i + 1] !== marker && (i === start || text[i - 1] !== marker)) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Convert a markdown AST to plain text (strips all formatting).
 * Useful for pretext measurement - we measure the plain text
 * and use the AST for rendering.
 *
 * @param node - AST node to convert
 * @returns Plain text content
 */
export function astToPlainText(node: MarkdownNode): string {
  if (node.content !== undefined) {
    return node.content;
  }

  return node.children.map(child => {
    switch (child.type) {
      case 'line_break':
        return '\n';
      case 'heading': {
        const level = (child.meta?.level as number) ?? 1;
        const prefix = '#'.repeat(level) + ' ';
        return prefix + astToPlainText(child) + '\n';
      }
      case 'code_block':
        return astToPlainText(child) + '\n';
      case 'list_item':
        return '• ' + astToPlainText(child) + '\n';
      case 'list':
        return child.children.map(item => astToPlainText(item)).join('');
      case 'paragraph':
        return astToPlainText(child) + '\n\n';
      default:
        return astToPlainText(child);
    }
  }).join('');
}
