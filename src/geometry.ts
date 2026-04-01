/**
 * Geometry utilities for obstacle-aware text layout.
 *
 * Port of Chenglou's wrap-geometry.ts pattern:
 * - carveTextLineSlots: Carve available text slots from a horizontal band after subtracting blocked intervals
 * - getCircleInterval: Compute the horizontal interval blocked by a circle in a given line band
 * - getRectInterval: Compute the horizontal interval blocked by a rectangle in a given line band
 *
 * @module geometry
 */

/** A horizontal interval [left, right). */
export type Interval = {
  left: number;
  right: number;
};

/** A 2D point. */
export type Point = {
  x: number;
  y: number;
};

/** An axis-aligned rectangle. */
export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** A circular obstacle. */
export type Circle = {
  cx: number;
  cy: number;
  radius: number;
};

/**
 * Given one allowed horizontal interval (base) and a set of blocked intervals,
 * carve out the remaining usable text slots for one text line band.
 *
 * Port of Chenglou's carveTextLineSlots from wrap-geometry.ts.
 *
 * Example:
 * - base:    80..420
 * - blocked: 200..310
 * - result:  80..200, 310..420
 *
 * Discards slivers narrower than minSlotWidth (default 24px).
 *
 * @param base - The full available horizontal interval
 * @param blocked - Intervals that are blocked by obstacles
 * @param minSlotWidth - Minimum width for a usable slot (default 24)
 * @returns Array of usable intervals
 */
export function carveTextLineSlots(
  base: Interval,
  blocked: Interval[],
  minSlotWidth: number = 24,
): Interval[] {
  let slots: Interval[] = [base];

  for (let blockedIndex = 0; blockedIndex < blocked.length; blockedIndex++) {
    const interval = blocked[blockedIndex]!;
    const next: Interval[] = [];
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
      const slot = slots[slotIndex]!;
      // No overlap — keep slot as-is
      if (interval.right <= slot.left || interval.left >= slot.right) {
        next.push(slot);
        continue;
      }
      // Left remainder
      if (interval.left > slot.left) {
        next.push({ left: slot.left, right: interval.left });
      }
      // Right remainder
      if (interval.right < slot.right) {
        next.push({ left: interval.right, right: slot.right });
      }
    }
    slots = next;
  }

  return slots.filter(slot => slot.right - slot.left >= minSlotWidth);
}

/**
 * Compute the horizontal interval blocked by a circle in a given line band.
 *
 * Uses circle-band intersection: for a circle at (cx, cy) with radius r,
 * the x-extent at a given y is: cx ± sqrt(r² - (y - cy)²).
 * We scan the band [bandTop, bandBottom] and take the union of x-extents.
 *
 * @param circle - The circular obstacle
 * @param bandTop - Top of the line band
 * @param bandBottom - Bottom of the line band
 * @param padding - Extra padding around the obstacle
 * @returns The blocked interval, or null if the circle doesn't intersect this band
 */
export function getCircleInterval(
  circle: Circle,
  bandTop: number,
  bandBottom: number,
  padding: number = 0,
): Interval | null {
  const r = circle.radius + padding;
  const top = bandTop - padding;
  const bottom = bandBottom + padding;

  // No intersection if band is entirely above or below the circle
  if (bottom < circle.cy - r || top > circle.cy + r) {
    return null;
  }

  // Find the widest x-range across the band
  // Sample at top, bottom, and center of band (and circle center if in range)
  let minX = Infinity;
  let maxX = -Infinity;

  const sampleYs: number[] = [top, bottom, (top + bottom) / 2];
  // Also sample at circle center if it's within the band
  if (circle.cy >= top && circle.cy <= bottom) {
    sampleYs.push(circle.cy);
  }

  for (const y of sampleYs) {
    const dy = y - circle.cy;
    const discriminant = r * r - dy * dy;
    if (discriminant < 0) continue;
    const dx = Math.sqrt(discriminant);
    const xLeft = circle.cx - dx;
    const xRight = circle.cx + dx;
    if (xLeft < minX) minX = xLeft;
    if (xRight > maxX) maxX = xRight;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
  return { left: minX, right: maxX };
}

/**
 * Compute the horizontal interval blocked by a rectangle in a given line band.
 *
 * @param rect - The rectangular obstacle
 * @param bandTop - Top of the line band
 * @param bandBottom - Bottom of the line band
 * @param padding - Extra padding around the obstacle
 * @returns The blocked interval, or null if the rect doesn't intersect this band
 */
export function getRectInterval(
  rect: Rect,
  bandTop: number,
  bandBottom: number,
  padding: number = 0,
): Interval | null {
  const top = rect.y - padding;
  const bottom = rect.y + rect.height + padding;

  // No intersection
  if (bandBottom <= top || bandTop >= bottom) {
    return null;
  }

  return {
    left: rect.x - padding,
    right: rect.x + rect.width + padding,
  };
}

// ---------------------------------------------------------------------------
// Polygon geometry (ported from Chenglou's wrap-geometry.ts)
// ---------------------------------------------------------------------------

/**
 * Find the x-coordinates where horizontal line y intersects the polygon edges.
 *
 * Port of Chenglou's getPolygonXsAtY from wrap-geometry.ts:285-300.
 * Returns sorted array of x-intersections (like a scanline).
 * For a convex polygon, this gives exactly 2 values (left and right edges).
 *
 * @param points - Polygon vertices
 * @param y - The y-coordinate of the horizontal scanline
 * @returns Sorted array of x-coordinates where edges cross y
 */
export function getPolygonXsAtY(points: Point[], y: number): number[] {
  const xs: number[] = [];
  let a = points[points.length - 1];
  if (!a) return xs;

  for (let index = 0; index < points.length; index++) {
    const b = points[index]!;
    if ((a.y <= y && y < b.y) || (b.y <= y && y < a.y)) {
      xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    a = b;
  }

  xs.sort((a, b) => a - b);
  return xs;
}

/**
 * Test whether a point (x, y) lies inside a polygon.
 *
 * Port of Chenglou's isPointInPolygon from wrap-geometry.ts:60-71.
 * Uses the ray-casting algorithm (odd-even rule).
 *
 * @param points - Polygon vertices
 * @param x - Point x-coordinate
 * @param y - Point y-coordinate
 * @returns true if the point is inside the polygon
 */
export function isPointInPolygon(points: Point[], x: number, y: number): boolean {
  let inside = false;
  for (let index = 0, prev = points.length - 1; index < points.length; prev = index++) {
    const a = points[index]!;
    const b = points[prev]!;
    const intersects =
      ((a.y > y) !== (b.y > y)) &&
      (x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x);
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Compute the horizontal interval blocked by a polygon in a given line band.
 *
 * Port of Chenglou's getPolygonIntervalForBand from wrap-geometry.ts:73-100.
 * Scans the band at integer y steps, collects all x-intersections, and
 * returns the overall [left, right] envelope plus horizontal padding.
 *
 * @param points - Polygon vertices
 * @param bandTop - Top of the line band
 * @param bandBottom - Bottom of the line band
 * @param horizontalPadding - Extra horizontal padding around the polygon
 * @param verticalPadding - Extra vertical padding to extend the detection range
 * @returns The blocked interval, or null if the polygon doesn't intersect this band
 */
export function getPolygonIntervalForBand(
  points: Point[],
  bandTop: number,
  bandBottom: number,
  horizontalPadding: number,
  verticalPadding: number,
): Interval | null {
  const sampleTop = bandTop - verticalPadding;
  const sampleBottom = bandBottom + verticalPadding;
  const startY = Math.floor(sampleTop);
  const endY = Math.ceil(sampleBottom);

  let left = Infinity;
  let right = -Infinity;

  for (let y = startY; y <= endY; y++) {
    const xs = getPolygonXsAtY(points, y + 0.5);
    for (let index = 0; index + 1 < xs.length; index += 2) {
      const runLeft = xs[index]!;
      const runRight = xs[index + 1]!;
      if (runLeft < left) left = runLeft;
      if (runRight > right) right = runRight;
    }
  }

  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return { left: left - horizontalPadding, right: right + horizontalPadding };
}

/**
 * Map normalized hull coordinates (0-1 range) to screen coordinates
 * within a bounding rect, optionally rotated around the rect's center.
 *
 * Port of Chenglou's transformWrapPoints from wrap-geometry.ts:37-58.
 *
 * @param points - Normalized polygon vertices (x,y in 0-1 range)
 * @param rect - The screen bounding rect to map into
 * @param angle - Rotation angle in radians (0 = no rotation)
 * @returns Transformed polygon vertices in screen coordinates
 */
export function transformWrapPoints(points: Point[], rect: Rect, angle: number): Point[] {
  if (angle === 0) {
    return points.map(point => ({
      x: rect.x + point.x * rect.width,
      y: rect.y + point.y * rect.height,
    }));
  }

  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return points.map(point => {
    const localX = (point.x - 0.5) * rect.width;
    const localY = (point.y - 0.5) * rect.height;
    return {
      x: centerX + localX * cos - localY * sin,
      y: centerY + localX * sin + localY * cos,
    };
  });
}

