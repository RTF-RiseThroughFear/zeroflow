/**
 * Tests for core/markdown.ts
 *
 * Tests the incremental markdown parser: block-level parsing,
 * inline parsing, streaming behavior, and partial token handling.
 */

import { describe, it, expect } from 'vitest';
import {
  parseMarkdown,
  parseInline,
  createParserState,
  feedText,
  astToPlainText,
  type MarkdownNode,
} from '../core/markdown';

// ──────────────────────────────────────────────────
// Helper: extract text content from AST
// ──────────────────────────────────────────────────

function getTextContent(node: MarkdownNode): string {
  if (node.content !== undefined) return node.content;
  return node.children.map(getTextContent).join('');
}

function findByType(node: MarkdownNode, type: string): MarkdownNode[] {
  const results: MarkdownNode[] = [];
  if (node.type === type) results.push(node);
  for (const child of node.children) {
    results.push(...findByType(child, type));
  }
  return results;
}

// ──────────────────────────────────────────────────
// Block-level parsing
// ──────────────────────────────────────────────────

describe('parseMarkdown — blocks', () => {
  it('parses plain text as a paragraph', () => {
    const ast = parseMarkdown('Hello world');
    expect(ast.type).toBe('root');
    expect(ast.children).toHaveLength(1);
    expect(ast.children[0].type).toBe('paragraph');
    expect(getTextContent(ast.children[0])).toBe('Hello world');
  });

  it('parses headers (h1 through h6)', () => {
    const ast = parseMarkdown('# Heading 1\n## Heading 2\n### Heading 3');
    const headings = ast.children.filter(c => c.type === 'heading');
    expect(headings).toHaveLength(3);
    expect(headings[0].meta?.level).toBe(1);
    expect(headings[1].meta?.level).toBe(2);
    expect(headings[2].meta?.level).toBe(3);
    expect(getTextContent(headings[0])).toBe('Heading 1');
  });

  it('parses fenced code blocks', () => {
    const ast = parseMarkdown('```javascript\nconsole.log("hi");\n```');
    const codeBlocks = findByType(ast, 'code_block');
    expect(codeBlocks).toHaveLength(1);
    expect(codeBlocks[0].meta?.language).toBe('javascript');
    expect(getTextContent(codeBlocks[0])).toBe('console.log("hi");');
  });

  it('handles unclosed code blocks (streaming partial)', () => {
    const ast = parseMarkdown('```python\ndef foo():\n  pass');
    const codeBlocks = findByType(ast, 'code_block');
    expect(codeBlocks).toHaveLength(1);
    expect(codeBlocks[0].meta?.partial).toBe(1);
    expect(getTextContent(codeBlocks[0])).toContain('def foo()');
  });

  it('parses unordered lists with -', () => {
    const ast = parseMarkdown('- Item 1\n- Item 2\n- Item 3');
    const lists = findByType(ast, 'list');
    expect(lists).toHaveLength(1);
    expect(lists[0].meta?.ordered).toBe(0);
    expect(lists[0].children).toHaveLength(3);
    expect(getTextContent(lists[0].children[0])).toBe('Item 1');
  });

  it('parses unordered lists with *', () => {
    const ast = parseMarkdown('* Alpha\n* Beta');
    const lists = findByType(ast, 'list');
    expect(lists).toHaveLength(1);
    expect(lists[0].children).toHaveLength(2);
  });

  it('parses ordered lists', () => {
    const ast = parseMarkdown('1. First\n2. Second\n3. Third');
    const lists = findByType(ast, 'list');
    expect(lists).toHaveLength(1);
    expect(lists[0].meta?.ordered).toBe(1);
    expect(lists[0].children).toHaveLength(3);
  });

  it('handles mixed block types', () => {
    const md = '# Title\n\nSome text here.\n\n- Item A\n- Item B\n\n```\ncode\n```';
    const ast = parseMarkdown(md);

    const types = ast.children.map(c => c.type);
    expect(types).toContain('heading');
    expect(types).toContain('paragraph');
    expect(types).toContain('list');
    expect(types).toContain('code_block');
  });

  it('separates paragraphs by blank lines', () => {
    const ast = parseMarkdown('First paragraph.\n\nSecond paragraph.');
    const paragraphs = ast.children.filter(c => c.type === 'paragraph');
    expect(paragraphs).toHaveLength(2);
  });

  it('handles empty input', () => {
    const ast = parseMarkdown('');
    expect(ast.type).toBe('root');
    expect(ast.children).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────
// Inline parsing
// ──────────────────────────────────────────────────

describe('parseInline', () => {
  it('parses plain text', () => {
    const nodes = parseInline('Hello world');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('text');
    expect(nodes[0].content).toBe('Hello world');
  });

  it('parses bold with **', () => {
    const nodes = parseInline('This is **bold** text');
    expect(nodes).toHaveLength(3);
    expect(nodes[0].content).toBe('This is ');
    expect(nodes[1].type).toBe('bold');
    expect(getTextContent(nodes[1])).toBe('bold');
    expect(nodes[2].content).toBe(' text');
  });

  it('parses bold with __', () => {
    const nodes = parseInline('This is __bold__ text');
    const boldNodes = nodes.filter(n => n.type === 'bold');
    expect(boldNodes).toHaveLength(1);
    expect(getTextContent(boldNodes[0])).toBe('bold');
  });

  it('parses italic with *', () => {
    const nodes = parseInline('This is *italic* text');
    const italicNodes = nodes.filter(n => n.type === 'italic');
    expect(italicNodes).toHaveLength(1);
    expect(getTextContent(italicNodes[0])).toBe('italic');
  });

  it('parses italic with _', () => {
    const nodes = parseInline('This is _italic_ text');
    const italicNodes = nodes.filter(n => n.type === 'italic');
    expect(italicNodes).toHaveLength(1);
    expect(getTextContent(italicNodes[0])).toBe('italic');
  });

  it('parses inline code', () => {
    const nodes = parseInline('Use `console.log()` here');
    const codeNodes = nodes.filter(n => n.type === 'inline_code');
    expect(codeNodes).toHaveLength(1);
    expect(codeNodes[0].content).toBe('console.log()');
  });

  it('parses links', () => {
    const nodes = parseInline('Visit [Google](https://google.com) now');
    const linkNodes = nodes.filter(n => n.type === 'link');
    expect(linkNodes).toHaveLength(1);
    expect(linkNodes[0].meta?.href).toBe('https://google.com');
    expect(getTextContent(linkNodes[0])).toBe('Google');
  });

  it('handles nested bold inside italic', () => {
    // Note: nested formatting is recursive
    const nodes = parseInline('*some **bold** inside*');
    const italicNodes = nodes.filter(n => n.type === 'italic');
    expect(italicNodes).toHaveLength(1);
    const boldInside = findByType(italicNodes[0], 'bold');
    expect(boldInside).toHaveLength(1);
  });

  it('treats unclosed markers as plain text', () => {
    const nodes = parseInline('This is **unclosed bold');
    // Should fall through to text since ** is never closed
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('text');
    expect(nodes[0].content).toBe('This is **unclosed bold');
  });

  it('handles multiple inline styles', () => {
    const nodes = parseInline('**bold** and *italic* and `code`');
    const types = nodes.map(n => n.type);
    expect(types).toContain('bold');
    expect(types).toContain('italic');
    expect(types).toContain('inline_code');
  });
});

// ──────────────────────────────────────────────────
// Streaming (incremental feeding)
// ──────────────────────────────────────────────────

describe('feedText — streaming', () => {
  it('builds AST incrementally', () => {
    const state = createParserState();

    feedText(state, '# Hello');
    expect(state.ast.children).toHaveLength(1);
    expect(state.ast.children[0].type).toBe('heading');

    feedText(state, '\n\nSome text');
    expect(state.ast.children.length).toBeGreaterThanOrEqual(2);
  });

  it('handles partial bold tokens across chunks', () => {
    const state = createParserState();

    // First chunk: opening ** without closing
    feedText(state, 'This is **bol');
    // unclosed bold = plain text
    const textNodes1 = findByType(state.ast, 'text');
    expect(textNodes1.length).toBeGreaterThan(0);

    // Second chunk: closing **
    feedText(state, 'd** text');
    // Now bold should be recognized
    const boldNodes = findByType(state.ast, 'bold');
    expect(boldNodes).toHaveLength(1);
    expect(getTextContent(boldNodes[0])).toBe('bold');
  });

  it('handles partial code block tokens', () => {
    const state = createParserState();

    feedText(state, '```python\ndef foo():');
    const codeBlocks1 = findByType(state.ast, 'code_block');
    expect(codeBlocks1).toHaveLength(1);
    expect(codeBlocks1[0].meta?.partial).toBe(1);

    feedText(state, '\n  pass\n```');
    const codeBlocks2 = findByType(state.ast, 'code_block');
    expect(codeBlocks2).toHaveLength(1);
    // No longer partial — closed
    expect(codeBlocks2[0].meta?.partial).toBeUndefined();
  });

  it('accumulates raw text correctly', () => {
    const state = createParserState();
    feedText(state, 'Hello ');
    feedText(state, 'world');
    expect(state.raw).toBe('Hello world');
  });
});

// ──────────────────────────────────────────────────
// AST to plain text
// ──────────────────────────────────────────────────

describe('astToPlainText', () => {
  it('converts a simple paragraph', () => {
    const ast = parseMarkdown('Hello world');
    const text = astToPlainText(ast);
    expect(text).toContain('Hello world');
  });

  it('strips inline formatting', () => {
    const ast = parseMarkdown('This is **bold** and *italic*');
    const text = astToPlainText(ast);
    expect(text).toContain('bold');
    expect(text).toContain('italic');
    expect(text).not.toContain('**');
    expect(text).not.toContain('*italic*');
  });

  it('preserves heading prefixes', () => {
    const ast = parseMarkdown('## Title');
    const text = astToPlainText(ast);
    expect(text).toContain('## Title');
  });
});
