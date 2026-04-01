/**
 * TDD: Provider standalone mode caching.
 *
 * Chenglou's README says:
 *   "Do not rerun prepare() for the same text and configs;
 *    that'd defeat its precomputation."
 *
 * Our bug: useZeroflowContext() without a Provider creates a new Map()
 * on every call (provider.tsx line 79). This means each render creates
 * a fresh measurer cache, so prepare() runs on every render.
 *
 * Fix: Extract the standalone fallback logic into a pure function
 * (getStandaloneContext) that uses a module-level cache. Then test it directly.
 *
 * useZeroflowContext() calls useContext (React hook) so we can't test it
 * outside a component. Instead, we test the caching logic that underlies it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pretext
vi.mock('@chenglou/pretext', () => ({
  prepare: vi.fn((_text: string, _font: string) => ({ __prepared: true })),
  prepareWithSegments: vi.fn((_text: string, _font: string) => ({
    __prepared: true,
    segments: ['hello'],
    widths: [40],
  })),
  layout: vi.fn((_prepared: unknown, _maxWidth: number, _lineHeight: number) => ({
    lineCount: 1,
    height: 24,
  })),
  layoutWithLines: vi.fn(),
  walkLineRanges: vi.fn(),
  clearCache: vi.fn(),
}));

import { createMeasurer } from '../core/measure';

describe('standalone mode caching: module-level cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * This test captures the fix requirement:
   * The standalone context (no Provider) must use a module-level cache
   * so that getMeasurer() returns the SAME measurer across calls.
   *
   * Currently, provider.tsx line 79 creates `new Map()` each time
   * useZeroflowContext() is called without a Provider. We need to
   * export a `getStandaloneContext()` function that uses a module-level Map.
   */
  it('getStandaloneContext returns stable cache across calls', async () => {
    // We need to import getStandaloneContext which doesn't exist yet
    // This test will FAIL until we create it
    let getStandaloneContext: (() => { getMeasurer: (font: string) => ReturnType<typeof createMeasurer> }) | undefined;

    try {
      const mod = await import('../core/provider');
      getStandaloneContext = (mod as Record<string, unknown>).getStandaloneContext as typeof getStandaloneContext;
    } catch {
      // Module exists but function doesn't
    }

    // This will fail because getStandaloneContext doesn't exist yet
    expect(getStandaloneContext).toBeDefined();

    if (getStandaloneContext) {
      const ctx1 = getStandaloneContext();
      const ctx2 = getStandaloneContext();

      const measurer1 = ctx1.getMeasurer('16px Inter');
      const measurer2 = ctx2.getMeasurer('16px Inter');

      // Same object reference = cache is working
      expect(measurer1).toBe(measurer2);
    }
  });

  it('createMeasurer returns correct font property', () => {
    const m1 = createMeasurer('16px Inter');
    const m2 = createMeasurer('14px Roboto');

    expect(m1.font).toBe('16px Inter');
    expect(m2.font).toBe('14px Roboto');
    expect(m1).not.toBe(m2);
  });

  it('standalone cache must persist: same font = same measurer', () => {
    // This tests the requirement at the measurer level.
    // When we create a standalone context with a module-level Map,
    // calling getMeasurer('16px Inter') multiple times must return
    // the same object (not create new measurers that re-run prepare()).
    const cache = new Map<string, ReturnType<typeof createMeasurer>>();

    function getMeasurer(font: string) {
      let measurer = cache.get(font);
      if (!measurer) {
        measurer = createMeasurer(font);
        cache.set(font, measurer);
      }
      return measurer;
    }

    const a = getMeasurer('16px Inter');
    const b = getMeasurer('16px Inter');
    const c = getMeasurer('14px Roboto');

    expect(a).toBe(b);           // same font = same object
    expect(a).not.toBe(c);       // different font = different object
  });
});
