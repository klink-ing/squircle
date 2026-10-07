/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import { paintDef } from "./pill-shape.worklet";
import { PILL_AMT_VAR_NAME, PILL_EASE_VAR_NAME, PILL_SIDE_VAR_NAME } from "./variants";

type Point = { x: number; y: number };

const geometry = new (paintDef as unknown as new () => {
  boxOutline(width: number, height: number, props?: unknown): Point[];
  offsetOutline(points: Point[], distance: number): Point[];
})();

const props = (values: Record<string, string | number | undefined>) => ({
  get: (name: string) =>
    values[name] === undefined ? undefined : { toString: () => String(values[name]) },
});

const outline = (width: number, height: number, side?: string, amt?: number, ease?: number) =>
  geometry.boxOutline(
    width,
    height,
    props({ [PILL_SIDE_VAR_NAME]: side, [PILL_AMT_VAR_NAME]: amt, [PILL_EASE_VAR_NAME]: ease }),
  );

const EPS = 1e-6;
const near = (a: number, b: number) => Math.abs(a - b) < EPS;
const has = (points: Point[], x: number, y: number) =>
  points.some((p) => near(p.x, x) && near(p.y, y));

/** Without the repeats where pieces meet, which have no direction. */
const distinct = (points: Point[]): Point[] => {
  const out: Point[] = [];
  for (const p of points) {
    const last = out.at(-1);
    if (!last || !near(last.x, p.x) || !near(last.y, p.y)) out.push(p);
  }
  const first = out[0] as Point;
  const end = out.at(-1) as Point;
  if (out.length > 1 && near(first.x, end.x) && near(first.y, end.y)) out.pop();
  return out;
};

/** Every turn the same way round, so every band and shadow offsets cleanly. */
const isConvex = (points: Point[]): boolean => {
  const ring = distinct(points);
  let sign = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as Point;
    const b = ring[(i + 1) % ring.length] as Point;
    const c = ring[(i + 2) % ring.length] as Point;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-7) continue;
    if (sign !== 0 && Math.sign(cross) !== sign) return false;
    sign = Math.sign(cross);
  }
  return true;
};

const inside = (points: Point[], width: number, height: number) =>
  points.every((p) => p.x > -EPS && p.x < width + EPS && p.y > -EPS && p.y < height + EPS);

describe("pill sides", () => {
  describe("auto", () => {
    it("is today's pill, whether the side is unset, auto or not a side", () => {
      const today = geometry.boxOutline(200, 40);
      expect(outline(200, 40, "auto")).toEqual(today);
      expect(outline(200, 40, "q")).toEqual(today);
      expect(outline(40, 200, "auto")).toEqual(geometry.boxOutline(40, 200));
    });
  });

  describe("one end on a wide box", () => {
    it("caps the left end as today's pill does, and squares the right", () => {
      const left = outline(200, 40, "l");
      expect(has(left, 200, 0)).toBe(true);
      expect(has(left, 200, 40)).toBe(true);
      // Wide enough for the requested easing either way, so the cap is today's.
      const long = outline(400, 40, "l");
      for (const p of geometry.boxOutline(400, 40).filter((p) => p.x < 200)) {
        expect(has(long, p.x, p.y), `${p.x},${p.y}`).toBe(true);
      }
    });

    it("caps the right end, mirrored", () => {
      const left = outline(200, 40, "l");
      const right = outline(200, 40, "r");
      expect(has(right, 0, 0)).toBe(true);
      expect(has(right, 0, 40)).toBe(true);
      for (const p of left) expect(has(right, 200 - p.x, p.y)).toBe(true);
    });

    it("clamps a top cap to the height, a tab whose cap runs the full height", () => {
      const top = outline(200, 40, "t");
      expect(has(top, 0, 40)).toBe(true);
      expect(has(top, 200, 40)).toBe(true);
      // The left edge is used up: the cap only touches it at the bottom corner.
      for (const p of top.filter((p) => p.x < EPS)) expect(p.y).toBeCloseTo(40, 6);
      // So the radius is the height, 40: the top edge starts no nearer the corner.
      const topEdge = top.filter((p) => p.y < EPS).map((p) => p.x);
      expect(Math.min(...topEdge)).toBeGreaterThanOrEqual(40 - EPS);
    });

    it("caps the bottom, mirrored", () => {
      const top = outline(200, 40, "t");
      const bottom = outline(200, 40, "b");
      for (const p of top) expect(has(bottom, p.x, 40 - p.y)).toBe(true);
    });
  });

  describe("one end on a tall box", () => {
    it("caps the top end as today's pill does, and squares the bottom", () => {
      const top = outline(40, 200, "t");
      expect(has(top, 0, 200)).toBe(true);
      expect(has(top, 40, 200)).toBe(true);
      const long = outline(40, 400, "t");
      for (const p of geometry.boxOutline(40, 400).filter((p) => p.y < 200)) {
        expect(has(long, p.x, p.y), `${p.x},${p.y}`).toBe(true);
      }
    });

    it("clamps a left cap to the width", () => {
      const left = outline(40, 200, "l");
      expect(has(left, 40, 0)).toBe(true);
      expect(has(left, 40, 200)).toBe(true);
      // The top edge is used up: the cap only touches it at the square corner.
      for (const p of left.filter((p) => p.y < EPS)) expect(p.x).toBeCloseTo(40, 6);
      const leftEdge = left.filter((p) => p.x < EPS).map((p) => p.y);
      expect(Math.min(...leftEdge)).toBeGreaterThanOrEqual(40 - EPS);
    });
  });

  describe("on a square", () => {
    it("is an arch, not a circle", () => {
      const top = outline(40, 40, "t");
      expect(has(top, 0, 40)).toBe(true);
      expect(has(top, 40, 40)).toBe(true);
      // The two caps meet halfway along the top.
      for (const p of top.filter((p) => p.y < EPS)) expect(p.x).toBeCloseTo(20, 6);
    });
  });

  describe("decorations", () => {
    it("move a square corner out along its miter, keeping it square", () => {
      // Each edge has to move the full distance, so the corner moves √2
      // times it; along the average normal alone, the whole square edge
      // would sit too close and the flat edge before it would slope.
      const out = geometry.offsetOutline(outline(200, 40, "l"), 5);
      expect(has(out, 205, -5)).toBe(true);
      expect(has(out, 205, 45)).toBe(true);
      const inner = geometry.offsetOutline(outline(200, 40, "l"), -2);
      expect(has(inner, 198, 2)).toBe(true);
      expect(has(inner, 198, 38)).toBe(true);
    });

    it("leave a full pill's outline where it was", () => {
      // Smooth everywhere, so the miter is the plain offset there: every
      // point stays its distance from the outline.
      const pill = geometry.boxOutline(240, 60);
      const ring = distinct(pill);
      const distanceTo = (p: Point) => {
        let best = Infinity;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i] as Point;
          const b = ring[(i + 1) % ring.length] as Point;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const t = Math.max(
            0,
            Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
          );
          best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
        }
        return best;
      };
      for (const p of geometry.offsetOutline(pill, 4)) expect(distanceTo(p)).toBeCloseTo(4, 2);
    });
  });

  it("stays convex and inside the box at every side, ratio, amount and ease", () => {
    for (const side of ["t", "r", "b", "l"]) {
      for (const [width, height] of [
        [200, 40],
        [40, 200],
        [40, 40],
        [50, 40],
        [40, 50],
        [41, 80],
      ] as const) {
        for (const amt of [1, 2, 3]) {
          for (const ease of [-2, 0, 2, 6]) {
            const points = outline(width, height, side, amt, ease);
            const label = `${side} ${width}x${height} amt ${amt} ease ${ease}`;
            expect(inside(points, width, height), label).toBe(true);
            expect(isConvex(points), label).toBe(true);
          }
        }
      }
    }
  });
});
