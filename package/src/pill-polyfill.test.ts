/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import {
  pillClipPath,
  pillDecorationImage,
  pillOutlinePath,
  pillOutlinePoints,
  pillRingClipPath,
} from "./pill-polyfill";
import { paintDef } from "./pill-shape.worklet";
import {
  PILL_AMT_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
  PILL_EASE_SPREAD_VAR_NAME,
  PILL_INSET_RING_COLOR_VAR_NAME,
  PILL_INSET_RING_WIDTH_VAR_NAME,
  PILL_OUTLINE_COLOR_VAR_NAME,
  PILL_OUTLINE_OFFSET_VAR_NAME,
  PILL_OUTLINE_STYLE_VAR_NAME,
  PILL_OUTLINE_WIDTH_VAR_NAME,
  PILL_RING_COLOR_VAR_NAME,
  PILL_RING_OFFSET_COLOR_VAR_NAME,
  PILL_RING_OFFSET_WIDTH_VAR_NAME,
  PILL_RING_WIDTH_VAR_NAME,
} from "./variants";

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
  // Up to the first fill: what the mask leaves open around the pill comes after.
  let filled = false;
  const push = (x: number, y: number) => {
    const last = vertices.at(-1);
    if (filled) return;
    if (!last || Math.abs(last.x - x) > 1e-6 || Math.abs(last.y - y) > 1e-6)
      vertices.push({ x, y });
  };
  const ctx = {
    fillStyle: "",
    beginPath() {},
    fill() {
      filled = true;
    },
    closePath() {},
    rect() {},
    arc() {},
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
    /** Whether `clip` covers `p`, by the even-odd rule its path is drawn with. */
    const covers = (clip: string | null, p: Point) => {
      if (clip === null) return true;
      if (clip === "inset(50%)") return false;
      let crossings = 0;
      for (const ring of parse(pathData(clip))) {
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i] as Point;
          const b = ring[(i + 1) % ring.length] as Point;
          if (a.y > p.y !== b.y > p.y && p.x < a.x + ((p.y - a.y) * (b.x - a.x)) / (b.y - a.y)) {
            crossings++;
          }
        }
      }
      return crossings % 2 === 1;
    };

    /**
     * A point between the pill and the stadium, where the gap between them is
     * widest: the background paints there, so the clip has to hide it.
     */
    const sliver = (width: number, height: number) => {
      const r = height / 2;
      const outline = pillOutlinePoints(width, height);
      let best = { x: 0, y: 0, gap: 0 };
      for (let x = 1; x < r; x += 0.25) {
        const stadiumTop = r - Math.sqrt(r * r - (r - x) ** 2);
        // The pill's top edge at x, interpolated between its points.
        let pillTop = Number.POSITIVE_INFINITY;
        for (let i = 0; i < outline.length; i++) {
          const a = outline[i] as Point;
          const b = outline[(i + 1) % outline.length] as Point;
          if (a.y < r && b.y < r && (a.x - x) * (b.x - x) <= 0 && a.x !== b.x) {
            pillTop = Math.min(pillTop, a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x));
          }
        }
        if (pillTop - stadiumTop > best.gap)
          best = { x, y: (stadiumTop + pillTop) / 2, gap: pillTop - stadiumTop };
      }
      expect(best.gap).toBeGreaterThan(0.5);
      return { x: best.x, y: best.y };
    };

    it("is the pill inside the stadium, and everything else", () => {
      const clip = pillClipPath(240, 60);
      expect(clip).toMatch(/^path\(evenodd, "/);
      expect(covers(clip, { x: 120, y: 30 })).toBe(true);
      // Between the pill and the stadium, where the background would show.
      expect(covers(clip, sliver(240, 60))).toBe(false);
      // The box's corners, outside the stadium, where only what is drawn
      // around the pill paints.
      expect(covers(clip, { x: 1, y: 1 })).toBe(true);
      expect(covers(clip, { x: 239, y: 59 })).toBe(true);
      // Outside the box, where outlines, rings and shadows paint.
      for (const p of [
        { x: -4, y: 30 },
        { x: 120, y: -40 },
        { x: 300, y: 90 },
      ]) {
        expect(covers(clip, p), `${p.x},${p.y}`).toBe(true);
      }
    });

    it("opens the gap under a ring, which covers the background there", () => {
      const ringed = pillClipPath(240, 60, {}, undefined, {
        [PILL_RING_WIDTH_VAR_NAME]: "2px",
        [PILL_RING_COLOR_VAR_NAME]: "white",
      });
      expect(covers(ringed, sliver(240, 60))).toBe(true);
      expect(covers(ringed, { x: 120, y: 30 })).toBe(true);
      expect(covers(ringed, { x: 1, y: 1 })).toBe(true);
    });

    it("is just the pill where nothing paints outside the stadium", () => {
      const plain = pillClipPath(240, 60, {}, undefined, {}, false);
      expect(plain).toBe(`path("${pillOutlinePath(240, 60)}")`);
      expect(covers(plain, { x: 1, y: 1 })).toBe(false);
      // A decoration needs room all the same.
      const ringed = pillClipPath(
        240,
        60,
        {},
        undefined,
        { [PILL_RING_WIDTH_VAR_NAME]: "2px", [PILL_RING_COLOR_VAR_NAME]: "white" },
        false,
      );
      expect(covers(ringed, { x: 1, y: 1 })).toBe(true);
      // And an own clip is still kept.
      const half = pillClipPath(240, 60, {}, { value: "inset(0px 50% 0px 0px)" }, {}, false);
      expect(covers(half, { x: 60, y: 30 })).toBe(true);
      expect(covers(half, { x: 180, y: 30 })).toBe(false);
    });

    it("is not needed for a square, whose stadium is already its circle", () => {
      expect(pillClipPath(48, 48)).toBeNull();
      expect(pillClipPath(48, 47)).not.toBeNull();
    });

    it("is the pill as it is where the element clips nothing of its own", () => {
      expect(pillClipPath(240, 60, {}, { value: "none" })).toBe(pillClipPath(240, 60));
    });

    it("keeps the element's own clip, cut to the outline, outside the box too", () => {
      // The left half of the box: the outline's left half, and nothing
      // outside the box, which the own clip doesn't reach.
      const half = pillClipPath(240, 60, {}, { value: "inset(0px 50% 0px 0px)" });
      expect(covers(half, { x: 60, y: 30 })).toBe(true);
      expect(covers(half, { x: 180, y: 30 })).toBe(false);
      expect(covers(half, sliver(240, 60))).toBe(false);
      expect(covers(half, { x: 1, y: 1 })).toBe(true);
      expect(covers(half, { x: -4, y: 30 })).toBe(false);
      // A clip reaching past the box keeps what's outside it there.
      const wide = pillClipPath(240, 60, {}, { value: "inset(-20px)" });
      expect(covers(wide, { x: -10, y: 30 })).toBe(true);
      expect(covers(wide, { x: -30, y: 30 })).toBe(false);
      expect(covers(wide, sliver(240, 60))).toBe(false);
      // And a square keeps it too, cut to its circle.
      const corner = pillClipPath(48, 48, {}, { value: "polygon(0px 0px, 48px 0px, 0px 48px)" });
      expect(covers(corner, { x: 16, y: 16 })).toBe(true);
      // Outside the circle, where only what's drawn around the pill paints.
      expect(covers(corner, { x: 2, y: 2 })).toBe(true);
      expect(covers(corner, { x: 32, y: 32 })).toBe(false);
    });

    it("cuts a tall pill's own clip to its outline too", () => {
      const clip = pillClipPath(60, 240, {}, { value: "polygon(0px 0px, 100% 0px, 0px 100%)" });
      expect(covers(clip, { x: 15, y: 60 })).toBe(true);
      expect(covers(clip, { x: 45, y: 200 })).toBe(false);
    });

    it("clips everything for sr-only, and keeps an even-odd hole", () => {
      expect(pillClipPath(240, 60, {}, { value: "inset(50%)" })).toBe("inset(50%)");
      const ring = pillClipPath(
        240,
        60,
        {},
        {
          value: 'path(evenodd, "M0 0H240V60H0Z M100 20H140V40H100Z")',
        },
      );
      expect(covers(ring, { x: 60, y: 30 })).toBe(true);
      expect(covers(ring, { x: 120, y: 30 })).toBe(false);
    });

    it("leaves a clip it can't flatten to stand on its own", () => {
      expect(pillClipPath(240, 60, {}, { value: 'url("#shape")' })).toBeNull();
    });
  });

  describe("decoration image", () => {
    const decorate = (values: Record<string, string>, width = 240, height = 60) =>
      pillDecorationImage(width, height, values);
    const svg = (image: string | null) =>
      decodeURIComponent(/^url\("data:image\/svg\+xml,(.*)"\)$/.exec(image ?? "")?.[1] ?? "");

    it("draws nothing without an outline or a ring", () => {
      expect(decorate({})).toBeNull();
      expect(decorate({ [PILL_OUTLINE_COLOR_VAR_NAME]: "red" })).toBeNull();
    });

    it("strokes an outline beyond its offset, on a canvas grown to reach it", () => {
      const drawing = svg(
        decorate({
          [PILL_OUTLINE_WIDTH_VAR_NAME]: "2px",
          [PILL_OUTLINE_OFFSET_VAR_NAME]: "4px",
          [PILL_OUTLINE_COLOR_VAR_NAME]: "rgb(255, 0, 0)",
        }),
      );
      // 4px of offset and 2px of outline on each side.
      expect(drawing).toContain('width="252" height="72"');
      expect(drawing).toContain('stroke-width="2"');
      expect(drawing).toContain("stroke:rgb(255, 0, 0)");
      // Centred 5px out from the outline, which itself sits 6px in.
      const [band] = parse(/ d="([^"]*)"/.exec(drawing)?.[1] ?? "") as [Point[]];
      const outline = pillOutlinePoints(240, 60).map((p) => ({ x: p.x + 6, y: p.y + 6 }));
      for (const p of band) expect(distanceTo(p, outline)).toBeCloseTo(5, 1);
    });

    it("dashes a dashed outline and skips one with no style", () => {
      const outline = {
        [PILL_OUTLINE_WIDTH_VAR_NAME]: "2px",
        [PILL_OUTLINE_COLOR_VAR_NAME]: "red",
      };
      expect(svg(decorate({ ...outline, [PILL_OUTLINE_STYLE_VAR_NAME]: "dashed" }))).toContain(
        'stroke-dasharray="6 4"',
      );
      expect(decorate({ ...outline, [PILL_OUTLINE_STYLE_VAR_NAME]: "none" })).toBeNull();
    });

    it("lays a ring beyond its offset band, and an inset ring inside the border", () => {
      const drawing = svg(
        decorate({
          [PILL_BORDER_WIDTH_VAR_NAME]: "1px",
          [PILL_RING_WIDTH_VAR_NAME]: "2px",
          [PILL_RING_COLOR_VAR_NAME]: "blue",
          [PILL_RING_OFFSET_WIDTH_VAR_NAME]: "3px",
          [PILL_RING_OFFSET_COLOR_VAR_NAME]: "white",
          [PILL_INSET_RING_WIDTH_VAR_NAME]: "2px",
          [PILL_INSET_RING_COLOR_VAR_NAME]: "green",
        }),
      );
      expect(drawing).toContain('width="250" height="70"');
      // Bottom first: the inset ring, the offset band, the ring.
      const strokes = [...drawing.matchAll(/stroke:(\w+)/g)].map((m) => m[1]);
      expect(strokes).toEqual(["green", "white", "blue"]);
      const outline = pillOutlinePoints(240, 60).map((p) => ({ x: p.x + 5, y: p.y + 5 }));
      const [inner, offset, ring] = [...drawing.matchAll(/ d="([^"]*)"/g)].map(
        (m) => (parse(m[1] as string)[0] as Point[])[0] as Point,
      ) as [Point, Point, Point];
      expect(distanceTo(inner, outline)).toBeCloseTo(2, 1);
      expect(distanceTo(offset, outline)).toBeCloseTo(1.5, 1);
      expect(distanceTo(ring, outline)).toBeCloseTo(4, 1);
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
