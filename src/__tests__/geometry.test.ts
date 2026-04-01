/**
 * Tests for geometry utilities.
 *
 * Verifies the core obstacle-avoidance geometry that powers the Dragon demo.
 * Based on Chenglou's wrap-geometry.ts patterns.
 */
import { describe, it, expect } from 'vitest';
import {
  carveTextLineSlots,
  getCircleInterval,
  getRectInterval,
  getPolygonXsAtY,
  isPointInPolygon,
  getPolygonIntervalForBand,
  transformWrapPoints,
  type Interval,
  type Circle,
  type Rect,
  type Point,
} from '../geometry';

describe('carveTextLineSlots', () => {
  it('returns full base when no obstacles block', () => {
    const base: Interval = { left: 0, right: 600 };
    const result = carveTextLineSlots(base, []);
    expect(result).toEqual([{ left: 0, right: 600 }]);
  });

  it('carves a single obstacle in the middle', () => {
    const base: Interval = { left: 0, right: 600 };
    const blocked: Interval[] = [{ left: 200, right: 400 }];
    const result = carveTextLineSlots(base, blocked);
    expect(result).toEqual([
      { left: 0, right: 200 },
      { left: 400, right: 600 },
    ]);
  });

  it('handles obstacle that covers entire left side', () => {
    const base: Interval = { left: 0, right: 600 };
    const blocked: Interval[] = [{ left: -50, right: 300 }];
    const result = carveTextLineSlots(base, blocked);
    expect(result).toEqual([{ left: 300, right: 600 }]);
  });

  it('handles obstacle that covers entire right side', () => {
    const base: Interval = { left: 0, right: 600 };
    const blocked: Interval[] = [{ left: 400, right: 700 }];
    const result = carveTextLineSlots(base, blocked);
    expect(result).toEqual([{ left: 0, right: 400 }]);
  });

  it('handles obstacle covering entire base → no slots', () => {
    const base: Interval = { left: 0, right: 600 };
    const blocked: Interval[] = [{ left: -100, right: 700 }];
    const result = carveTextLineSlots(base, blocked);
    expect(result).toEqual([]);
  });

  it('filters out slots narrower than minSlotWidth', () => {
    const base: Interval = { left: 0, right: 600 };
    // Leave a 10px gap on the left (below default minSlotWidth=24)
    const blocked: Interval[] = [{ left: 10, right: 500 }];
    const result = carveTextLineSlots(base, blocked);
    // 0..10 is only 10px → filtered out
    // 500..600 is 100px → kept
    expect(result).toEqual([{ left: 500, right: 600 }]);
  });

  it('handles two non-overlapping obstacles', () => {
    const base: Interval = { left: 0, right: 800 };
    const blocked: Interval[] = [
      { left: 100, right: 200 },
      { left: 500, right: 600 },
    ];
    const result = carveTextLineSlots(base, blocked);
    expect(result).toEqual([
      { left: 0, right: 100 },
      { left: 200, right: 500 },
      { left: 600, right: 800 },
    ]);
  });

  it('handles overlapping obstacles (merged implicitly)', () => {
    const base: Interval = { left: 0, right: 600 };
    const blocked: Interval[] = [
      { left: 100, right: 350 },
      { left: 250, right: 500 },
    ];
    const result = carveTextLineSlots(base, blocked);
    expect(result).toEqual([
      { left: 0, right: 100 },
      { left: 500, right: 600 },
    ]);
  });

  it('allows custom minSlotWidth', () => {
    const base: Interval = { left: 0, right: 600 };
    const blocked: Interval[] = [{ left: 40, right: 500 }];
    // Default: 0..40 is filtered (< 24). With minSlotWidth=30, 40px gap passes
    const result = carveTextLineSlots(base, blocked, 30);
    expect(result).toEqual([
      { left: 0, right: 40 },
      { left: 500, right: 600 },
    ]);
  });
});

describe('getCircleInterval', () => {
  const circle: Circle = { cx: 300, cy: 200, radius: 50 };

  it('returns null when band is above circle', () => {
    const result = getCircleInterval(circle, 0, 20);
    expect(result).toBeNull();
  });

  it('returns null when band is below circle', () => {
    const result = getCircleInterval(circle, 300, 320);
    expect(result).toBeNull();
  });

  it('returns widest interval when band passes through circle center', () => {
    // Band from 190 to 210 passes through center (cy=200)
    const result = getCircleInterval(circle, 190, 210);
    expect(result).not.toBeNull();
    // At cy=200, the full diameter applies: 300±50 = [250, 350]
    expect(result!.left).toBe(250);
    expect(result!.right).toBe(350);
  });

  it('returns narrower interval at circle edges', () => {
    // Band near the top of circle (cy=200, r=50, so top is at 150)
    const result = getCircleInterval(circle, 155, 165);
    expect(result).not.toBeNull();
    // Interval should be narrower than full diameter
    expect(result!.right - result!.left).toBeLessThan(100);
    // Should be centered on cx=300
    const center = (result!.left + result!.right) / 2;
    expect(center).toBeCloseTo(300, 0);
  });

  it('handles padding', () => {
    const result = getCircleInterval(circle, 190, 210, 10);
    expect(result).not.toBeNull();
    // With padding=10, effective radius is 60
    // At cy=200, interval is 300±60 = [240, 360]
    expect(result!.left).toBe(240);
    expect(result!.right).toBe(360);
  });

  it('detects intersection with padding even when band is outside bare radius', () => {
    // Band at y=252-254 is outside circle (cy=200, r=50, bottom=250)
    // But with padding=10, effective bottom = 260
    const result = getCircleInterval(circle, 252, 254, 10);
    expect(result).not.toBeNull();
  });
});

describe('getRectInterval', () => {
  const rect: Rect = { x: 200, y: 100, width: 200, height: 150 };

  it('returns null when band is above rect', () => {
    const result = getRectInterval(rect, 0, 50);
    expect(result).toBeNull();
  });

  it('returns null when band is below rect', () => {
    const result = getRectInterval(rect, 300, 350);
    expect(result).toBeNull();
  });

  it('returns null when band exactly touches top', () => {
    // bandBottom = rect.y, no overlap
    const result = getRectInterval(rect, 80, 100);
    expect(result).toBeNull();
  });

  it('returns interval when band overlaps rect', () => {
    const result = getRectInterval(rect, 150, 180);
    expect(result).not.toBeNull();
    expect(result!.left).toBe(200);
    expect(result!.right).toBe(400);
  });

  it('handles padding', () => {
    const result = getRectInterval(rect, 150, 180, 20);
    expect(result).not.toBeNull();
    expect(result!.left).toBe(180); // 200 - 20
    expect(result!.right).toBe(420); // 400 + 20
  });

  it('detects intersection with padding when band is outside bare rect', () => {
    // Band at 260-270 is above rect bottom (250) without padding
    // But with padding=20, effective bottom = 270
    const result = getRectInterval(rect, 260, 270, 20);
    expect(result).not.toBeNull();
  });
});

// =========================================================================
// Polygon geometry (ported from Chenglou's wrap-geometry.ts)
// =========================================================================

// A simple unit square polygon for testing
const unitSquare: Point[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

// A diamond/rhombus (rotated square) centered at (50,50)
const diamond: Point[] = [
  { x: 50, y: 0 },
  { x: 100, y: 50 },
  { x: 50, y: 100 },
  { x: 0, y: 50 },
];

describe('getPolygonXsAtY', () => {
  it('returns x intersections at y=50 for a square', () => {
    const xs = getPolygonXsAtY(unitSquare, 50);
    expect(xs).toHaveLength(2);
    expect(xs[0]).toBeCloseTo(0);
    expect(xs[1]).toBeCloseTo(100);
  });

  it('returns x intersections at y=50 for a diamond', () => {
    const xs = getPolygonXsAtY(diamond, 50);
    expect(xs).toHaveLength(2);
    expect(xs[0]).toBeCloseTo(0);
    expect(xs[1]).toBeCloseTo(100);
  });

  it('returns narrower intersections at y=25 for a diamond', () => {
    const xs = getPolygonXsAtY(diamond, 25);
    expect(xs).toHaveLength(2);
    // At y=25, diamond goes from x=25 to x=75
    expect(xs[0]).toBeCloseTo(25);
    expect(xs[1]).toBeCloseTo(75);
  });

  it('returns empty for y outside polygon', () => {
    const xs = getPolygonXsAtY(unitSquare, 150);
    expect(xs).toHaveLength(0);
  });

  it('returns empty for empty polygon', () => {
    const xs = getPolygonXsAtY([], 50);
    expect(xs).toHaveLength(0);
  });
});

describe('isPointInPolygon', () => {
  it('detects point inside square', () => {
    expect(isPointInPolygon(unitSquare, 50, 50)).toBe(true);
  });

  it('detects point outside square', () => {
    expect(isPointInPolygon(unitSquare, 150, 50)).toBe(false);
  });

  it('detects point inside diamond', () => {
    expect(isPointInPolygon(diamond, 50, 50)).toBe(true);
  });

  it('detects point outside diamond corner', () => {
    // (10, 10) is inside the square but outside the diamond
    expect(isPointInPolygon(diamond, 10, 10)).toBe(false);
  });

  it('returns false for empty polygon', () => {
    expect(isPointInPolygon([], 50, 50)).toBe(false);
  });
});

describe('getPolygonIntervalForBand', () => {
  it('returns null when band is above polygon', () => {
    const result = getPolygonIntervalForBand(unitSquare, -50, -30, 0, 0);
    expect(result).toBeNull();
  });

  it('returns null when band is below polygon', () => {
    const result = getPolygonIntervalForBand(unitSquare, 150, 180, 0, 0);
    expect(result).toBeNull();
  });

  it('returns full width interval for square at y=40..60', () => {
    const result = getPolygonIntervalForBand(unitSquare, 40, 60, 0, 0);
    expect(result).not.toBeNull();
    expect(result!.left).toBeCloseTo(0, 0);
    expect(result!.right).toBeCloseTo(100, 0);
  });

  it('returns narrower interval for diamond at y=20..30', () => {
    const result = getPolygonIntervalForBand(diamond, 20, 30, 0, 0);
    expect(result).not.toBeNull();
    // Diamond at y=20..30 is narrower than full width
    expect(result!.right - result!.left).toBeLessThan(80);
    // Should be centered around x=50
    const center = (result!.left + result!.right) / 2;
    expect(center).toBeCloseTo(50, 0);
  });

  it('applies horizontal padding', () => {
    const result = getPolygonIntervalForBand(unitSquare, 40, 60, 20, 0);
    expect(result).not.toBeNull();
    expect(result!.left).toBeCloseTo(-20, 0);
    expect(result!.right).toBeCloseTo(120, 0);
  });

  it('applies vertical padding to extend detection range', () => {
    // Band at y=105..110 is outside square (0..100) without padding
    // With verticalPadding=15, effective check extends to y=90..125
    const result = getPolygonIntervalForBand(unitSquare, 105, 110, 0, 15);
    expect(result).not.toBeNull();
  });

  it('returns null for empty polygon', () => {
    const result = getPolygonIntervalForBand([], 40, 60, 0, 0);
    expect(result).toBeNull();
  });
});

describe('transformWrapPoints', () => {
  // Normalized hull coords (0-1 range, as getWrapHull outputs)
  const normalizedSquare: Point[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  it('maps normalized coords to screen rect without rotation', () => {
    const rect: Rect = { x: 100, y: 200, width: 300, height: 400 };
    const result = transformWrapPoints(normalizedSquare, rect, 0);
    expect(result[0]).toEqual({ x: 100, y: 200 });
    expect(result[1]).toEqual({ x: 400, y: 200 });
    expect(result[2]).toEqual({ x: 400, y: 600 });
    expect(result[3]).toEqual({ x: 100, y: 600 });
  });

  it('rotates 90 degrees around rect center', () => {
    const rect: Rect = { x: 0, y: 0, width: 100, height: 100 };
    const result = transformWrapPoints(normalizedSquare, rect, Math.PI / 2);
    // After 90° rotation around center (50,50):
    // (0,0) → local(-50,-50) → rotated(50,-50) → screen(100,0) ≈ (100,0)
    expect(result[0]!.x).toBeCloseTo(100, 0);
    expect(result[0]!.y).toBeCloseTo(0, 0);
  });

  it('returns same number of points as input', () => {
    const rect: Rect = { x: 0, y: 0, width: 100, height: 100 };
    const result = transformWrapPoints(normalizedSquare, rect, 1.5);
    expect(result).toHaveLength(normalizedSquare.length);
  });
});

