/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import {
  pillClipPath,
  pillOutlinePath,
  pillOutlinePoints,
  pillRingClipPath,
} from "./pill-polyfill";
import { paintDef } from "./pill-shape.worklet";
import { PILL_AMT_VAR_NAME, PILL_CONTINUITY_VAR_NAME, PILL_EASE_SPREAD_VAR_NAME } from "./variants";

type Point = { x: number; y: number };

const parse = (d: string): Point[][] =>
  d
    .split("Z")
    .filter((sub) => sub.includes("M"))
    .map((sub) =>
      [...sub.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({
        x: Number(m[1]),
        y: Number(m[2]),
      })),
    );

const pathData = (clip: string) => /"([^"]*)"/.exec(clip)?.[1] ?? "";

/** The vertices the worklet itself draws, without the repeats where quadrants meet. */
const workletVertices = (width: number, height: number, values: Record<string, string> = {}) => {
  const vertices: Point[] = [];
  const push = (x: number, y: number) => {
    const last = vertices.at(-1);
    if (!last || Math.abs(last.x - x) > 1e-6 || Math.abs(last.y - y) > 1e-6)
      vertices.push({ x, y });
  };
  const ctx = {
    fillStyle: "",
    beginPath() {},
    fill() {},
    closePath() {},
    moveTo: push,
    lineTo: push,
  };
  new (paintDef as unknown as new () => {
    paint(c: unknown, s: { width: number; height: number }, p: unknown): void;
  })().paint(
    ctx,
    { width, height },
    {
      get: (n: string) => (values[n] ? { toString: () => values[n] } : undefined),
    },
  );
  return vertices;
};

/** Distance from `p` to the nearest segment of the closed polyline `ring`. */
const distanceTo = (p: Point, ring: Point[]) => {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as Point;
    const b = ring[(i + 1) % ring.length] as Point;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
    );
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
};

describe("pill polyfill", () => {
  describe("outline", () => {
    it("traces exactly the outline the worklet draws", () => {
      for (const [w, h] of [
        [240, 60],
        [70, 60],
        [60, 240],
        [60, 60],
      ] as const) {
        const ours = pillOutlinePoints(w, h);
        const theirs = workletVertices(w, h);
        // The worklet closes its path by returning to the first point; ours
        // leaves the close to the path's `Z`.
        if (theirs.length === ours.length + 1) theirs.pop();
        expect(ours.length, `${w}x${h}`).toBe(theirs.length);
        ours.forEach((p, i) => {
          expect(p.x).toBeCloseTo((theirs[i] as Point).x, 6);
          expect(p.y).toBeCloseTo((theirs[i] as Point).y, 6);
        });
      }
    });

    it("honours the shape properties the worklet reads", () => {
      const shape = { amt: "3", spread: "4", continuity: "3" };
      const ours = pillOutlinePoints(240, 60, shape);
      const theirs = workletVertices(240, 60, {
        [PILL_AMT_VAR_NAME]: "3",
        [PILL_EASE_SPREAD_VAR_NAME]: "4",
        [PILL_CONTINUITY_VAR_NAME]: "3",
      });
      expect(ours[10]?.x).toBeCloseTo((theirs[10] as Point).x, 6);
      expect(ours[10]?.y).toBeCloseTo((theirs[10] as Point).y, 6);
      expect(pillOutlinePath(240, 60, shape)).not.toBe(pillOutlinePath(240, 60));
    });

    it("is one closed path, and empty for a box with no area", () => {
      expect(pillOutlinePath(240, 60)).toMatch(/^M[^Z]*Z$/);
      expect(pillOutlinePath(0, 60)).toBe("");
    });
  });

  describe("element clip", () => {
    it("is the outline, as a path() clip", () => {
      expect(pillClipPath(240, 60)).toBe(`path("${pillOutlinePath(240, 60)}")`);
    });

    it("is not needed for a square, whose stadium is already its circle", () => {
      expect(pillClipPath(48, 48)).toBeNull();
      expect(pillClipPath(48, 47)).not.toBeNull();
    });

    it("is the pill as it is where the element clips nothing of its own", () => {
      expect(pillClipPath(240, 60, {}, { value: "none" })).toBe(pillClipPath(240, 60));
    });

    it("keeps the element's own clip, cut to the outline", () => {
      const outline = pillOutlinePoints(240, 60);
      // A clip over the left half: what's left is the outline's left half.
      const [half] = parse(
        pathData(pillClipPath(240, 60, {}, { value: "inset(0px 50% 0px 0px)" }) as string),
      ) as [Point[]];
      for (const p of half) {
        expect(p.x).toBeLessThanOrEqual(120 + 1e-6);
        expect(distanceTo(p, outline) < 0.01 || Math.abs(p.x - 120) < 0.01).toBe(true);
      }
      // And a square keeps it too, cut to its circle.
      const [corner] = parse(
        pathData(
          pillClipPath(48, 48, {}, { value: "polygon(0px 0px, 48px 0px, 0px 48px)" }) as string,
        ),
      ) as [Point[]];
      for (const p of corner) expect(Math.hypot(p.x - 24, p.y - 24)).toBeLessThanOrEqual(24 + 0.01);
    });

    it("cuts a tall pill's own clip to its outline too", () => {
      const clip = pillClipPath(60, 240, {}, { value: "polygon(0px 0px, 100% 0px, 0px 100%)" });
      const [cut] = parse(pathData(clip as string)) as [Point[]];
      expect(cut.length).toBeGreaterThan(3);
    });

    it("clips everything for sr-only, and keeps the fill rule", () => {
      expect(pillClipPath(240, 60, {}, { value: "inset(50%)" })).toBe("inset(50%)");
      expect(
        pillClipPath(240, 60, {}, { value: "polygon(evenodd, 0px 0px, 240px 0px, 0px 60px)" }),
      ).toMatch(/^path\(evenodd, "/);
    });

    it("leaves a clip it can't flatten to stand on its own", () => {
      expect(pillClipPath(240, 60, {}, { value: 'url("#shape")' })).toBeNull();
    });
  });

  describe("ring clip", () => {
    it("is a band exactly the border width wide, inside the outline", () => {
      const clip = pillRingClipPath(240, 60, 3, "solid") as string;
      expect(clip.startsWith('path(evenodd, "')).toBe(true);
      const [outer, inner] = parse(pathData(clip)) as [Point[], Point[]];
      expect(outer.length).toBe(inner.length);
      for (const p of inner) expect(distanceTo(p, outer)).toBeCloseTo(3, 1);
      // Inside the box, so inside the outline it was inset from.
      for (const p of inner) {
        expect(p.x).toBeGreaterThan(2.9);
        expect(p.x).toBeLessThan(240 - 2.9);
        expect(p.y).toBeGreaterThan(2.9);
        expect(p.y).toBeLessThan(60 - 2.9);
      }
    });

    it("insets a tall pill's band inwards too, though its outline runs the other way", () => {
      const clip = pillRingClipPath(60, 240, 3, "solid") as string;
      const [outer, inner] = parse(pathData(clip)) as [Point[], Point[]];
      for (const p of inner) {
        expect(distanceTo(p, outer)).toBeCloseTo(3, 1);
        expect(p.x).toBeGreaterThan(2.9);
        expect(p.y).toBeGreaterThan(2.9);
      }
    });

    it("rings a square too, though it needs no element clip", () => {
      expect(pillRingClipPath(48, 48, 2, "solid")).not.toBeNull();
    });

    it("cuts dashes and dots along the outline the way the worklet dashes", () => {
      const outline = pillOutlinePoints(240, 60);
      const length = outline.reduce((sum, p, i) => {
        const q = outline[(i + 1) % outline.length] as Point;
        return sum + Math.hypot(q.x - p.x, q.y - p.y);
      }, 0);
      // Width 2: dashes are 6 on, 4 off; dots 2 on, 4 off.
      const dashes = parse(pathData(pillRingClipPath(240, 60, 2, "dashed") as string));
      expect(dashes.length).toBe(Math.ceil(length / 10));
      const dots = parse(pathData(pillRingClipPath(240, 60, 2, "dotted") as string));
      expect(dots.length).toBe(Math.ceil(length / 6));
    });

    it("draws nothing without a width, or for none and hidden", () => {
      expect(pillRingClipPath(240, 60, 0, "solid")).toBeNull();
      expect(pillRingClipPath(240, 60, 3, "none")).toBeNull();
      expect(pillRingClipPath(240, 60, 3, " hidden ")).toBeNull();
    });
  });
});
