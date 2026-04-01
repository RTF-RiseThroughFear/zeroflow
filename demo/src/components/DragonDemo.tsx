/**
 * DragonDemo — Chenglou-faithful interactive text layout.
 *
 * Architecture (directly from dynamic-layout.ts):
 * 1. Full viewport page, two-column magazine spread
 * 2. Mouse-following circular obstacle (text parts around cursor like water)
 * 3. Two polygon obstacles (SVG shapes) that can be clicked to rotate
 * 4. layoutColumn() → carveTextLineSlots() → layoutNextLine() pipeline
 * 5. syncPool() → direct element.style mutations via RAF
 * 6. ZERO React state in the hot path
 */

import { useEffect, useRef } from 'react';
import {
  prepareWithSegments,
  layoutNextLine,
  type LayoutCursor,
  type PreparedTextWithSegments,
} from '@chenglou/pretext';
import {
  carveTextLineSlots,
  getCircleInterval,
  getPolygonIntervalForBand,
  isPointInPolygon,
  transformWrapPoints,
  type Circle,
  type Interval,
  type Point,
  type Rect,
} from '../../../src/geometry';

// ---------------------------------------------------------------------------
// Constants (tuned to Chenglou's values)
// ---------------------------------------------------------------------------

const BODY_FONT = '20px "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif';
const BODY_LINE_HEIGHT = 32;
const HEADLINE_FONT_FAMILY = '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif';
const HEADLINE_TEXT = 'SITUATIONAL AWARENESS: THE DECADE AHEAD';
const CREDIT_TEXT = 'Leopold Aschenbrenner';
const CREDIT_FONT = '12px "Helvetica Neue", Helvetica, Arial, sans-serif';
const CREDIT_LINE_HEIGHT = 16;
const NARROW_BREAKPOINT = 760;
const MOUSE_OBSTACLE_RADIUS = 80;
const MIN_SLOT_WIDTH = 24;

const BODY_TEXT = `You can see the future first in San Francisco. Over the past year, the talk of the town has shifted from $10 billion compute clusters to $100 billion clusters to trillion-dollar clusters. Every six months another zero is added to the boardroom plans. Behind the scenes, there's a fierce scramble to secure every power contract still available for the rest of the decade, every voltage transformer that can possibly be procured. American big business is gearing up to pour trillions of dollars into a long-unseen mobilization of American industrial might. By the end of the decade, American electricity production will have grown tens of percent; from the shale fields of Pennsylvania to the solar farms of Nevada, hundreds of millions of GPUs will hum. The AGI race has begun. We are building machines that can think and reason. By 2025 and 2026, these machines will outpace college graduates. By the end of the decade, they will be smarter than you or I; we will have superintelligence, in the true sense of the word. Along the way, national security forces not seen in half a century will be unleashed, and before long, The Project will be on. If we're lucky, we'll be in an all-out race with the CCP; if we're unlucky, an all-out war. Everyone is now talking about AI, but few have the faintest glimmer of what is about to hit them. Nvidia analysts still think 2024 might be close to the peak. Mainstream pundits are stuck on the willful blindness of "it's just predicting the next word". They see only hype and business-as-usual; at most they entertain another internet-scale technological change. Before long, the world will wake up. But right now, there are perhaps a few hundred people, most of them in San Francisco and the AI labs, that have situational awareness. Through whatever peculiar forces of fate, I have found myself amongst them. A few years ago, these people were derided as crazy—but they trusted the trendlines, which allowed them to correctly predict the AI advances of the past few years. Whether these people are also right about the next few years remains to be seen. But these are very smart people—the smartest people I have ever met—and they are the ones building this technology. Perhaps they will be an odd footnote in history, or perhaps they will go down in history like Szilard and Oppenheimer and Teller. If they are seeing the future even close to correctly, we are in for a wild ride. Let me tell you what we see. We have machines now that we can basically talk to like humans. It's a remarkable testament to the human capacity to adjust that this seems normal, that we've become inured to the pace of progress. But it's worth stepping back and looking at the progress of just the last few years. GPT-2, circa 2019, was like a preschooler. GPT-3, circa 2020, was like an elementary schooler. GPT-4, circa 2023, was like a smart high schooler. The pace of deep learning progress in the last decade has simply been extraordinary. A mere decade ago it was revolutionary for a deep learning system to identify simple images. Today, we keep trying to come up with novel, ever harder tests, and yet each new benchmark is quickly cracked. It used to take decades to crack widely-used benchmarks; now it feels like mere months. We're literally running out of benchmarks. Over and over again, year after year, skeptics have claimed "deep learning won't be able to do X" and have been quickly proven wrong. If there's one lesson we've learned from the past decade of AI, it's that you should never bet against deep learning.`;

// ---------------------------------------------------------------------------
// Hardcoded polygon hulls (star + hexagon shapes)
// These are normalized 0-1 coordinates like getWrapHull() would produce.
// ---------------------------------------------------------------------------

/** 8-pointed star, normalized to [0,1] */
const STAR_HULL: Point[] = (() => {
  const pts: Point[] = [];
  const spikes = 8;
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const r = i % 2 === 0 ? 0.5 : 0.22;
    pts.push({ x: 0.5 + r * Math.cos(angle), y: 0.5 + r * Math.sin(angle) });
  }
  return pts;
})();

/** Hexagon, normalized to [0,1] */
const HEX_HULL: Point[] = (() => {
  const pts: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 6;
    pts.push({ x: 0.5 + 0.48 * Math.cos(angle), y: 0.5 + 0.48 * Math.sin(angle) });
  }
  return pts;
})();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PositionedLine = {
  x: number;
  y: number;
  width: number;
  text: string;
  className: string;
};

type SpinState = {
  from: number;
  to: number;
  start: number;
  duration: number;
};

type LogoState = {
  angle: number;
  spin: SpinState | null;
};

type BandObstacle =
  | { kind: 'polygon'; points: Point[]; horizontalPadding: number; verticalPadding: number }
  | { kind: 'circle'; circle: Circle; padding: number };

// ---------------------------------------------------------------------------
// Layout engine (Chenglou's layoutColumn pattern)
// ---------------------------------------------------------------------------

function getObstacleIntervals(obstacle: BandObstacle, bandTop: number, bandBottom: number): Interval[] {
  switch (obstacle.kind) {
    case 'polygon': {
      const interval = getPolygonIntervalForBand(
        obstacle.points,
        bandTop,
        bandBottom,
        obstacle.horizontalPadding,
        obstacle.verticalPadding,
      );
      return interval === null ? [] : [interval];
    }
    case 'circle': {
      const interval = getCircleInterval(obstacle.circle, bandTop, bandBottom, obstacle.padding);
      return interval === null ? [] : [interval];
    }
  }
}

function layoutColumn(
  prepared: PreparedTextWithSegments,
  startCursor: LayoutCursor,
  region: Rect,
  lineHeight: number,
  obstacles: BandObstacle[],
  side: 'left' | 'right',
  className: string,
): { lines: PositionedLine[]; cursor: LayoutCursor } {
  let cursor: LayoutCursor = startCursor;
  let lineTop = region.y;
  const lines: PositionedLine[] = [];

  while (true) {
    if (lineTop + lineHeight > region.y + region.height) break;

    const bandTop = lineTop;
    const bandBottom = lineTop + lineHeight;
    const blocked: Interval[] = [];
    for (let i = 0; i < obstacles.length; i++) {
      const intervals = getObstacleIntervals(obstacles[i]!, bandTop, bandBottom);
      for (let j = 0; j < intervals.length; j++) {
        blocked.push(intervals[j]!);
      }
    }

    const slots = carveTextLineSlots(
      { left: region.x, right: region.x + region.width },
      blocked,
      MIN_SLOT_WIDTH,
    );

    if (slots.length === 0) {
      lineTop += lineHeight;
      continue;
    }

    // Pick widest slot, break ties by side preference (Chenglou's pattern)
    let slot = slots[0]!;
    for (let i = 1; i < slots.length; i++) {
      const candidate = slots[i]!;
      const bestWidth = slot.right - slot.left;
      const candidateWidth = candidate.right - candidate.left;
      if (candidateWidth > bestWidth) {
        slot = candidate;
        continue;
      }
      if (candidateWidth < bestWidth) continue;
      if (side === 'left') {
        if (candidate.left > slot.left) slot = candidate;
      } else {
        if (candidate.left < slot.left) slot = candidate;
      }
    }

    const width = slot.right - slot.left;
    const line = layoutNextLine(prepared, cursor, width);
    if (line === null) break;

    lines.push({
      x: Math.round(slot.left),
      y: Math.round(lineTop),
      width: line.width,
      text: line.text,
      className,
    });

    cursor = line.end;
    lineTop += lineHeight;
  }

  return { lines, cursor };
}

// ---------------------------------------------------------------------------
// DOM pool (Chenglou's syncPool pattern)
// ---------------------------------------------------------------------------

function syncPool(pool: HTMLSpanElement[], length: number, parent: HTMLElement): void {
  while (pool.length < length) {
    const el = document.createElement('span');
    pool.push(el);
    parent.appendChild(el);
  }
  while (pool.length > length) {
    const el = pool.pop()!;
    el.remove();
  }
}

// ---------------------------------------------------------------------------
// Spin animation (Chenglou's ease function)
// ---------------------------------------------------------------------------

function easeSpin(t: number): number {
  const oneMinusT = 1 - t;
  return 1 - oneMinusT * oneMinusT * oneMinusT;
}

function updateLogoSpin(logo: LogoState, now: number): boolean {
  if (logo.spin === null) return false;
  const progress = Math.min(1, (now - logo.spin.start) / logo.spin.duration);
  logo.angle = logo.spin.from + (logo.spin.to - logo.spin.from) * easeSpin(progress);
  if (progress >= 1) {
    logo.angle = logo.spin.to;
    logo.spin = null;
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Headline font fitting (Chenglou's binary search)
// ---------------------------------------------------------------------------

const preparedCache = new Map<string, PreparedTextWithSegments>();

function getPrepared(text: string, font: string): PreparedTextWithSegments {
  const key = `${font}::${text}`;
  const cached = preparedCache.get(key);
  if (cached !== undefined) return cached;
  const prepared = prepareWithSegments(text, font);
  preparedCache.set(key, prepared);
  return prepared;
}

function headlineBreaksInsideWord(prepared: PreparedTextWithSegments, maxWidth: number): boolean {
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
  let broke = false;
  while (true) {
    const line = layoutNextLine(prepared, cursor, maxWidth);
    if (line === null) break;
    if (line.end.graphemeIndex !== 0) broke = true;
    cursor = line.end;
  }
  return broke;
}

function fitHeadlineFontSize(headlineWidth: number, pageWidth: number): number {
  let low = Math.ceil(Math.max(22, pageWidth * 0.026));
  let high = Math.floor(Math.min(94, Math.max(55, pageWidth * 0.055)));
  let best = low;

  while (low <= high) {
    const size = Math.floor((low + high) / 2);
    const font = `700 ${size}px ${HEADLINE_FONT_FAMILY}`;
    const headlinePrepared = getPrepared(HEADLINE_TEXT, font);
    if (!headlineBreaksInsideWord(headlinePrepared, headlineWidth)) {
      best = size;
      low = size + 1;
    } else {
      high = size - 1;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DragonDemo() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = containerRef.current;
    if (!page) return;

    // ---- Mutable state (no React) ----
    const stage = document.createElement('div');
    stage.className = 'dragon-stage';
    page.appendChild(stage);

    const headlineEl = document.createElement('h1');
    headlineEl.className = 'dragon-headline';
    stage.appendChild(headlineEl);

    const creditEl = document.createElement('p');
    creditEl.className = 'dragon-credit';
    creditEl.textContent = CREDIT_TEXT;
    stage.appendChild(creditEl);

    const metricsEl = document.createElement('span');
    metricsEl.className = 'dragon-metrics';
    page.appendChild(metricsEl);

    const hintEl = document.createElement('p');
    hintEl.className = 'dragon-hint';
    hintEl.textContent = 'Move your mouse. Click the shapes. Resize the window. Every line laid out in JS — zero reflows.';
    page.appendChild(hintEl);

    // Create SVG shape elements
    const shape1El = document.createElement('div');
    shape1El.className = 'dragon-shape dragon-shape--1';
    stage.appendChild(shape1El);

    const shape2El = document.createElement('div');
    shape2El.className = 'dragon-shape dragon-shape--2';
    stage.appendChild(shape2El);

    // Mouse cursor indicator
    const cursorEl = document.createElement('div');
    cursorEl.className = 'dragon-cursor';
    page.appendChild(cursorEl);

    const headlinePool: HTMLSpanElement[] = [];
    const bodyPool: HTMLSpanElement[] = [];

    const pointer = { x: -Infinity, y: -Infinity };
    let scheduled = false;
    let hoveredShape: 1 | 2 | null = null;

    const logoStates: [LogoState, LogoState] = [
      { angle: 0, spin: null },
      { angle: 0, spin: null },
    ];

    const events: {
      mousemove: MouseEvent | null;
      click: MouseEvent | null;
      blur: boolean;
    } = { mousemove: null, click: null, blur: false };

    // ---- Prepare text ----
    const preparedBody = getPrepared(BODY_TEXT, BODY_FONT);

    // ---- Layout functions ----
    function buildLayout(pageWidth: number, pageHeight: number) {
      const isNarrow = pageWidth < NARROW_BREAKPOINT;
      const gutter = isNarrow
        ? Math.round(Math.max(18, Math.min(28, pageWidth * 0.06)))
        : Math.round(Math.max(52, pageWidth * 0.048));
      const centerGap = isNarrow ? 0 : Math.round(Math.max(28, pageWidth * 0.025));
      const columnWidth = isNarrow
        ? Math.round(Math.min(pageWidth - gutter * 2, 430))
        : Math.round((pageWidth - gutter * 2 - centerGap) / 2);
      const headlineTop = isNarrow ? 28 : Math.round(Math.max(42, pageWidth * 0.04, 72));
      const headlineWidth = isNarrow
        ? pageWidth - gutter * 2
        : Math.round(Math.min(pageWidth - gutter * 2, Math.max(columnWidth, pageWidth * 0.5)));
      const headlineFontSize = fitHeadlineFontSize(headlineWidth, pageWidth);
      const headlineLineHeight = Math.round(headlineFontSize * 0.92);
      const headlineFont = `700 ${headlineFontSize}px ${HEADLINE_FONT_FAMILY}`;

      // Shape positions
      const shape1Size = isNarrow
        ? Math.round(Math.min(138, pageWidth * 0.34))
        : Math.round(Math.min(400, pageHeight * 0.43));
      const shape2Size = isNarrow
        ? Math.round(Math.min(92, pageWidth * 0.23, pageHeight * 0.11))
        : Math.round(Math.max(276, Math.min(500, pageWidth * 0.355, pageHeight * 0.45)));

      const shape1Rect: Rect = {
        x: gutter - Math.round(shape1Size * 0.3),
        y: pageHeight - gutter - shape1Size + Math.round(shape1Size * 0.2),
        width: shape1Size,
        height: shape1Size,
      };

      const shape2Rect: Rect = {
        x: pageWidth - Math.round(shape2Size * 0.69),
        y: -Math.round(shape2Size * 0.22),
        width: shape2Size,
        height: shape2Size,
      };

      return {
        isNarrow, gutter, centerGap, columnWidth,
        headlineTop, headlineWidth, headlineFont, headlineLineHeight,
        shape1Rect, shape2Rect, pageWidth, pageHeight,
      };
    }

    function commitFrame(now: number): boolean {
      const t0 = performance.now();
      const pageWidth = document.documentElement.clientWidth;
      const pageHeight = document.documentElement.clientHeight;

      const animating1 = updateLogoSpin(logoStates[0]!, now);
      const animating2 = updateLogoSpin(logoStates[1]!, now);
      const animating = animating1 || animating2;

      const layout = buildLayout(pageWidth, pageHeight);

      // Transform polygon hulls to screen coords with rotation
      const shape1Points = transformWrapPoints(STAR_HULL, layout.shape1Rect, logoStates[0]!.angle);
      const shape2Points = transformWrapPoints(HEX_HULL, layout.shape2Rect, logoStates[1]!.angle);

      const shape1Obstacle: BandObstacle = {
        kind: 'polygon',
        points: shape1Points,
        horizontalPadding: Math.round(BODY_LINE_HEIGHT * 0.82),
        verticalPadding: Math.round(BODY_LINE_HEIGHT * 0.26),
      };
      const shape2Obstacle: BandObstacle = {
        kind: 'polygon',
        points: shape2Points,
        horizontalPadding: Math.round(BODY_LINE_HEIGHT * 0.28),
        verticalPadding: Math.round(BODY_LINE_HEIGHT * 0.12),
      };

      // Mouse-following obstacle
      const mouseObstacle: BandObstacle = {
        kind: 'circle',
        circle: { cx: pointer.x, cy: pointer.y, radius: MOUSE_OBSTACLE_RADIUS },
        padding: Math.round(BODY_LINE_HEIGHT * 0.4),
      };

      // Build full obstacle list
      const allObstacles: BandObstacle[] = [shape1Obstacle, shape2Obstacle];
      if (Number.isFinite(pointer.x) && Number.isFinite(pointer.y)) {
        allObstacles.push(mouseObstacle);
      }

      // ---- Headline ----
      const headlinePrepared = getPrepared(HEADLINE_TEXT, layout.headlineFont);
      const headlineRegion: Rect = {
        x: layout.gutter,
        y: layout.headlineTop,
        width: layout.headlineWidth,
        height: layout.pageHeight - layout.headlineTop - layout.gutter,
      };
      const headlineResult = layoutColumn(
        headlinePrepared,
        { segmentIndex: 0, graphemeIndex: 0 },
        headlineRegion,
        layout.headlineLineHeight,
        [shape1Obstacle],
        'left',
        'dragon-headline-line',
      );

      // ---- Credit ----
      const headlineBottom = headlineResult.lines.length === 0
        ? headlineRegion.y
        : Math.max(...headlineResult.lines.map(l => l.y + layout.headlineLineHeight));
      const creditGap = Math.round(Math.max(14, BODY_LINE_HEIGHT * 0.6));
      const creditTop = headlineBottom + creditGap;
      const copyGap = Math.round(Math.max(20, BODY_LINE_HEIGHT * 0.9));
      const copyTop = creditTop + CREDIT_LINE_HEIGHT + copyGap;

      // ---- Body columns ----
      let bodyLines: PositionedLine[];

      if (layout.isNarrow) {
        const bodyRegion: Rect = {
          x: Math.round((pageWidth - layout.columnWidth) / 2),
          y: copyTop,
          width: layout.columnWidth,
          height: Math.max(0, pageHeight - copyTop - layout.gutter),
        };
        const result = layoutColumn(
          preparedBody,
          { segmentIndex: 0, graphemeIndex: 0 },
          bodyRegion,
          BODY_LINE_HEIGHT,
          allObstacles,
          'left',
          'dragon-line dragon-line--left',
        );
        bodyLines = result.lines;
      } else {
        // Two-column layout (Chenglou's pattern)
        const leftRegion: Rect = {
          x: layout.gutter,
          y: copyTop,
          width: layout.columnWidth,
          height: pageHeight - copyTop - layout.gutter,
        };
        const rightRegion: Rect = {
          x: layout.gutter + layout.columnWidth + layout.centerGap,
          y: headlineRegion.y,
          width: layout.columnWidth,
          height: pageHeight - headlineRegion.y - layout.gutter,
        };

        // Headline rects as obstacles for right column
        const headlineRects = headlineResult.lines.map(line => ({
          x: line.x,
          y: line.y,
          width: Math.ceil(line.width),
          height: layout.headlineLineHeight,
        }));
        const titleObstacle: BandObstacle = {
          kind: 'polygon',
          points: headlineRects.flatMap(r => [
            { x: r.x, y: r.y },
            { x: r.x + r.width, y: r.y },
            { x: r.x + r.width, y: r.y + r.height },
            { x: r.x, y: r.y + r.height },
          ]),
          horizontalPadding: Math.round(BODY_LINE_HEIGHT * 0.95),
          verticalPadding: Math.round(BODY_LINE_HEIGHT * 0.3),
        };

        const leftResult = layoutColumn(
          preparedBody,
          { segmentIndex: 0, graphemeIndex: 0 },
          leftRegion,
          BODY_LINE_HEIGHT,
          allObstacles,
          'left',
          'dragon-line dragon-line--left',
        );
        const rightResult = layoutColumn(
          preparedBody,
          leftResult.cursor,
          rightRegion,
          BODY_LINE_HEIGHT,
          [...allObstacles, titleObstacle],
          'right',
          'dragon-line dragon-line--right',
        );
        bodyLines = [...leftResult.lines, ...rightResult.lines];
      }

      // ---- Project to DOM ----
      // Headline
      syncPool(headlinePool, headlineResult.lines.length, headlineEl);
      for (let i = 0; i < headlineResult.lines.length; i++) {
        const line = headlineResult.lines[i]!;
        const el = headlinePool[i]!;
        el.textContent = line.text;
        el.className = 'dragon-headline-line';
        el.style.left = `${line.x}px`;
        el.style.top = `${line.y}px`;
        el.style.font = layout.headlineFont;
        el.style.lineHeight = `${layout.headlineLineHeight}px`;
      }

      // Credit
      creditEl.style.left = `${layout.gutter + 4}px`;
      creditEl.style.top = `${creditTop}px`;

      // Body
      syncPool(bodyPool, bodyLines.length, stage);
      for (let i = 0; i < bodyLines.length; i++) {
        const line = bodyLines[i]!;
        const el = bodyPool[i]!;
        el.className = line.className;
        el.textContent = line.text;
        el.style.left = `${line.x}px`;
        el.style.top = `${line.y}px`;
        el.style.font = BODY_FONT;
        el.style.lineHeight = `${BODY_LINE_HEIGHT}px`;
      }

      // Shape positions
      shape1El.style.left = `${layout.shape1Rect.x}px`;
      shape1El.style.top = `${layout.shape1Rect.y}px`;
      shape1El.style.width = `${layout.shape1Rect.width}px`;
      shape1El.style.height = `${layout.shape1Rect.height}px`;
      shape1El.style.transform = `rotate(${logoStates[0]!.angle}rad)`;

      shape2El.style.left = `${layout.shape2Rect.x}px`;
      shape2El.style.top = `${layout.shape2Rect.y}px`;
      shape2El.style.width = `${layout.shape2Rect.width}px`;
      shape2El.style.height = `${layout.shape2Rect.height}px`;
      shape2El.style.transform = `rotate(${logoStates[1]!.angle}rad)`;

      // Mouse cursor indicator
      if (Number.isFinite(pointer.x) && Number.isFinite(pointer.y)) {
        cursorEl.style.display = 'block';
        cursorEl.style.left = `${pointer.x - MOUSE_OBSTACLE_RADIUS}px`;
        cursorEl.style.top = `${pointer.y - MOUSE_OBSTACLE_RADIUS}px`;
      } else {
        cursorEl.style.display = 'none';
      }

      // Cursor style
      page.style.cursor = hoveredShape !== null ? 'pointer' : '';

      // Metrics
      const dt = performance.now() - t0;
      metricsEl.textContent = `Layout: ${dt.toFixed(2)}ms · ${headlineResult.lines.length + bodyLines.length} lines`;

      return animating;
    }

    // ---- Render loop ----
    function render(now: number): boolean {
      // Process events
      if (events.click !== null) {
        pointer.x = events.click.clientX;
        pointer.y = events.click.clientY;
      }
      if (events.mousemove !== null) {
        pointer.x = events.mousemove.clientX;
        pointer.y = events.mousemove.clientY;
      }
      if (events.blur) {
        pointer.x = -Infinity;
        pointer.y = -Infinity;
      }

      // Hit test for shape hover/click
      const layout = buildLayout(
        document.documentElement.clientWidth,
        document.documentElement.clientHeight,
      );
      const shape1Screen = transformWrapPoints(STAR_HULL, layout.shape1Rect, logoStates[0]!.angle);
      const shape2Screen = transformWrapPoints(HEX_HULL, layout.shape2Rect, logoStates[1]!.angle);

      const nextHovered =
        events.blur
          ? null
          : isPointInPolygon(shape1Screen, pointer.x, pointer.y)
            ? 1 as const
            : isPointInPolygon(shape2Screen, pointer.x, pointer.y)
              ? 2 as const
              : null;
      hoveredShape = nextHovered;

      // Click to rotate
      if (events.click !== null) {
        if (isPointInPolygon(shape1Screen, pointer.x, pointer.y)) {
          const logo = logoStates[0]!;
          logo.spin = {
            from: logo.angle,
            to: logo.angle + Math.PI,
            start: now,
            duration: 900,
          };
        } else if (isPointInPolygon(shape2Screen, pointer.x, pointer.y)) {
          const logo = logoStates[1]!;
          logo.spin = {
            from: logo.angle,
            to: logo.angle - Math.PI,
            start: now,
            duration: 900,
          };
        }
      }

      events.mousemove = null;
      events.click = null;
      events.blur = false;

      return commitFrame(now);
    }

    function scheduleRender(): void {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function renderAndSchedule(now) {
        scheduled = false;
        if (render(now)) scheduleRender();
      });
    }

    // ---- Event listeners ----
    const handleResize = () => scheduleRender();
    const handleMouseMove = (e: MouseEvent) => {
      events.mousemove = e;
      scheduleRender();
    };
    const handleClick = (e: MouseEvent) => {
      events.click = e;
      scheduleRender();
    };
    const handleBlur = () => {
      events.blur = true;
      scheduleRender();
    };
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      events.mousemove = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      e.preventDefault();
      scheduleRender();
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    // Initial render
    commitFrame(performance.now());

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleClick);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('touchmove', handleTouchMove);

      headlinePool.forEach(el => el.remove());
      bodyPool.forEach(el => el.remove());
      stage.remove();
      metricsEl.remove();
      hintEl.remove();
      cursorEl.remove();
    };
  }, []);

  return (
    <section
      id="dragon"
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        background: '#f6f0e6',
        color: '#11100d',
        userSelect: 'text',
        isolation: 'isolate',
      }}
    >
      {/* Atmosphere gradients */}
      <div
        style={{
          position: 'absolute',
          inset: '-10%',
          pointerEvents: 'none',
          zIndex: 0,
          background: `
            radial-gradient(62% 54% at 16% 82%, rgba(45, 88, 128, 0.16), transparent 69%),
            radial-gradient(44% 34% at 28% 64%, rgba(57, 78, 124, 0.07), transparent 76%)
          `,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '-10%',
          pointerEvents: 'none',
          zIndex: 0,
          background: `
            radial-gradient(58% 48% at 86% 16%, rgba(217, 119, 87, 0.18), transparent 70%),
            linear-gradient(135deg, rgba(217, 119, 87, 0.055) 0%, rgba(217, 119, 87, 0.02) 24%, transparent 42%, rgba(45, 88, 128, 0.045) 100%)
          `,
        }}
      />

      {/* CSS for dynamically-created elements */}
      <style>{`
        .dragon-stage {
          position: relative;
          height: 100%;
          z-index: 1;
        }
        .dragon-headline {
          position: absolute;
          margin: 0;
          font: inherit;
          user-select: text;
          z-index: 1;
        }
        .dragon-headline-line {
          position: absolute;
          white-space: pre;
          color: #11100d;
          cursor: text;
          user-select: text;
          letter-spacing: -0.02em;
          z-index: 1;
        }
        .dragon-credit {
          position: absolute;
          margin: 0;
          font: 12px/16px "Helvetica Neue", Helvetica, Arial, sans-serif;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          white-space: nowrap;
          color: rgba(17, 16, 13, 0.58);
          user-select: text;
          cursor: text;
          z-index: 1;
        }
        .dragon-line {
          position: absolute;
          white-space: pre;
          color: #11100d;
          font-weight: 450;
          letter-spacing: 0.002em;
          user-select: text;
          cursor: text;
          transition: color 120ms ease;
          z-index: 1;
        }
        .dragon-line:hover {
          color: #d97757;
        }
        .dragon-shape {
          position: absolute;
          pointer-events: none;
          transform-origin: center center;
          z-index: 3;
        }
        .dragon-shape--1 {
          background:
            radial-gradient(circle at 40% 35%,
              rgba(45, 88, 128, 0.22),
              rgba(45, 88, 128, 0.06));
          clip-path: polygon(
            50% 0%, 65% 25%, 100% 25%, 75% 45%,
            85% 75%, 50% 58%, 15% 75%, 25% 45%,
            0% 25%, 35% 25%
          );
          filter: drop-shadow(0 26px 34px rgba(16, 16, 12, 0.14));
        }
        .dragon-shape--2 {
          background:
            radial-gradient(circle at 40% 35%,
              rgba(217, 119, 87, 0.22),
              rgba(217, 119, 87, 0.06));
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          filter: drop-shadow(0 24px 32px rgba(140, 86, 52, 0.18));
        }
        .dragon-cursor {
          position: absolute;
          width: ${MOUSE_OBSTACLE_RADIUS * 2}px;
          height: ${MOUSE_OBSTACLE_RADIUS * 2}px;
          border-radius: 50%;
          border: 1.5px solid rgba(17, 16, 13, 0.08);
          background: radial-gradient(circle, rgba(17, 16, 13, 0.03), transparent 70%);
          pointer-events: none;
          z-index: 2;
          display: none;
          transition: opacity 200ms ease;
        }
        .dragon-metrics {
          position: absolute;
          bottom: 16px;
          right: 16px;
          padding: 6px 12px;
          border-radius: 6px;
          background: rgba(17, 16, 13, 0.08);
          color: #4f463b;
          font: 500 11px/1.2 "SF Mono", "Fira Code", "Fira Mono", monospace;
          letter-spacing: 0.02em;
          user-select: none;
          pointer-events: none;
          z-index: 20;
        }
        .dragon-hint {
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          margin: 0;
          padding: 10px 16px 11px;
          border-radius: 999px;
          background: rgba(17, 16, 13, 0.94);
          color: rgba(246, 240, 230, 0.96);
          font: 500 12px/1.2 "Helvetica Neue", Helvetica, Arial, sans-serif;
          letter-spacing: 0.015em;
          white-space: nowrap;
          user-select: none;
          pointer-events: none;
          z-index: 20;
          box-shadow: 0 14px 32px rgba(17, 16, 13, 0.16);
        }
      `}</style>
    </section>
  );
}
