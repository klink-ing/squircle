/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import {
  pillClipPath,
  pillDecoration,
  pillDecorationImage,
  pillOutlinePath,
  pillOutlinePoints,
} from "./pill-polyfill";
import { paintDef } from "./pill-shape.worklet";
import {
  PILL_AMT_VAR_NAME,
  PILL_BORDER_COLOR_VAR_NAME,
  PILL_BORDER_STYLE_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_BOX_SHADOW_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
  PILL_EASE_VAR_NAME,
  PILL_INSET_RING_COLOR_VAR_NAME,
  PILL_INSET_RING_WIDTH_VAR_NAME,
  PILL_OUTLINE_COLOR_VAR_NAME,
  PILL_OUTLINE_OFFSET_VAR_NAME,
  PILL_OUTLINE_STYLE_VAR_NAME,
  PILL_OUTLINE_WIDTH_VAR_NAME,
  PILL_REACH_VAR_NAME,
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
      const shape = { amt: "3", ease: "4", continuity: "2" };
      const ours = pillOutlinePoints(240, 60, shape);
      const theirs = workletVertices(240, 60, {
        [PILL_AMT_VAR_NAME]: "3",
        [PILL_EASE_VAR_NAME]: "4",
        [PILL_CONTINUITY_VAR_NAME]: "2",
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

  describe("background clip", () => {
    it("is the pill's outline, in the coordinates of its box", () => {
      expect(pillClipPath(240, 60)).toBe(`path("${pillOutlinePath(240, 60)}")`);
      const shape = { amt: "3" };
      expect(pillClipPath(240, 60, shape)).toBe(`path("${pillOutlinePath(240, 60, shape)}")`);
    });

    it("is not needed for a square, whose stadium is already its circle", () => {
      expect(pillClipPath(48, 48)).toBeNull();
      expect(pillClipPath(48, 47)).not.toBeNull();
      expect(pillClipPath(0, 60)).toBeNull();
    });
  });

  describe("decoration image", () => {
    const decorate = (values: Record<string, string>, width = 240, height = 60) =>
      pillDecorationImage(width, height, values);
    const svg = (image: string | null) =>
      decodeURIComponent(/^url\("data:image\/svg\+xml,(.*)"\)$/.exec(image ?? "")?.[1] ?? "");
    const strokes = (drawing: string) =>
      [...drawing.matchAll(/<path d="([^"]*)" fill="none"[^>]*style="stroke:([^"]*)"/g)].map(
        (m) => ({ points: parse(m[1] as string)[0] as Point[], color: m[2] as string }),
      );

    it("draws nothing without a border, outline, ring or shadow", () => {
      expect(decorate({})).toBeNull();
      expect(decorate({ [PILL_OUTLINE_COLOR_VAR_NAME]: "red" })).toBeNull();
      expect(decorate({ [PILL_BOX_SHADOW_VAR_NAME]: "0 0 #0000" })).toBeNull();
    });

    it("strokes the border as a band its width wide, just inside the outline", () => {
      const drawing = svg(
        decorate({ [PILL_BORDER_WIDTH_VAR_NAME]: "3px", [PILL_BORDER_COLOR_VAR_NAME]: "red" }),
      );
      // Nothing reaches outside the box.
      expect(drawing).toContain('width="240" height="60"');
      expect(drawing).toContain('stroke-width="3"');
      const [border] = strokes(drawing);
      expect(border?.color).toBe("red");
      const outline = pillOutlinePoints(240, 60);
      for (const p of border?.points ?? []) expect(distanceTo(p, outline)).toBeCloseTo(1.5, 1);
      for (const p of border?.points ?? []) {
        expect(p.x).toBeGreaterThan(1.4);
        expect(p.y).toBeGreaterThan(1.4);
      }
    });

    it("insets a tall pill's border inwards too, though its outline runs the other way", () => {
      const [border] = strokes(
        svg(
          decorate(
            { [PILL_BORDER_WIDTH_VAR_NAME]: "3px", [PILL_BORDER_COLOR_VAR_NAME]: "red" },
            60,
            240,
          ),
        ),
      );
      for (const p of border?.points ?? []) {
        expect(p.x).toBeGreaterThan(1.4);
        expect(p.y).toBeGreaterThan(1.4);
      }
    });

    it("rings a square too, though its background needs no clip", () => {
      expect(
        decorate(
          { [PILL_BORDER_WIDTH_VAR_NAME]: "2px", [PILL_BORDER_COLOR_VAR_NAME]: "red" },
          48,
          48,
        ),
      ).not.toBeNull();
    });

    it("dashes and dots the way the worklet does, and skips none and hidden", () => {
      const border = { [PILL_BORDER_WIDTH_VAR_NAME]: "2px", [PILL_BORDER_COLOR_VAR_NAME]: "red" };
      expect(svg(decorate({ ...border, [PILL_BORDER_STYLE_VAR_NAME]: "dashed" }))).toContain(
        'stroke-dasharray="6 4"',
      );
      expect(svg(decorate({ ...border, [PILL_BORDER_STYLE_VAR_NAME]: "dotted" }))).toContain(
        'stroke-dasharray="2 4"',
      );
      expect(decorate({ ...border, [PILL_BORDER_STYLE_VAR_NAME]: "none" })).toBeNull();
      expect(decorate({ ...border, [PILL_BORDER_STYLE_VAR_NAME]: " hidden " })).toBeNull();
    });

    it("strokes an outline beyond its offset, on a canvas grown by the reach", () => {
      const drawing = svg(
        decorate({
          [PILL_REACH_VAR_NAME]: "6px",
          [PILL_OUTLINE_WIDTH_VAR_NAME]: "2px",
          [PILL_OUTLINE_OFFSET_VAR_NAME]: "4px",
          [PILL_OUTLINE_COLOR_VAR_NAME]: "rgb(255, 0, 0)",
        }),
      );
      // 4px of offset and 2px of outline on each side.
      expect(drawing).toContain('width="252" height="72"');
      expect(drawing).toContain('stroke-width="2"');
      // Centred 5px out from the outline, which itself sits 6px in.
      const [band] = strokes(drawing);
      expect(band?.color).toBe("rgb(255, 0, 0)");
      const outline = pillOutlinePoints(240, 60).map((p) => ({ x: p.x + 6, y: p.y + 6 }));
      for (const p of band?.points ?? []) expect(distanceTo(p, outline)).toBeCloseTo(5, 1);
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

    it("lays the border, an inset ring inside it, and a ring beyond its offset band", () => {
      const drawing = svg(
        decorate({
          [PILL_REACH_VAR_NAME]: "5px",
          [PILL_BORDER_WIDTH_VAR_NAME]: "1px",
          [PILL_BORDER_COLOR_VAR_NAME]: "black",
          [PILL_RING_WIDTH_VAR_NAME]: "2px",
          [PILL_RING_COLOR_VAR_NAME]: "blue",
          [PILL_RING_OFFSET_WIDTH_VAR_NAME]: "3px",
          [PILL_RING_OFFSET_COLOR_VAR_NAME]: "white",
          [PILL_INSET_RING_WIDTH_VAR_NAME]: "2px",
          [PILL_INSET_RING_COLOR_VAR_NAME]: "green",
        }),
      );
      expect(drawing).toContain('width="250" height="70"');
      // Bottom first: the border, the inset ring, the offset band, the ring.
      const drawn = strokes(drawing);
      expect(drawn.map((s) => s.color)).toEqual(["black", "green", "white", "blue"]);
      const outline = pillOutlinePoints(240, 60).map((p) => ({ x: p.x + 5, y: p.y + 5 }));
      const [border, inner, offset, ring] = drawn.map((s) => s.points[0] as Point) as [
        Point,
        Point,
        Point,
        Point,
      ];
      expect(distanceTo(border, outline)).toBeCloseTo(0.5, 1);
      expect(distanceTo(inner, outline)).toBeCloseTo(2, 1);
      expect(distanceTo(offset, outline)).toBeCloseTo(1.5, 1);
      expect(distanceTo(ring, outline)).toBeCloseTo(4, 1);
    });

    it("casts outer shadows outside the outline only, blurred as CSS blurs them", () => {
      const drawing = svg(
        decorate({
          [PILL_REACH_VAR_NAME]: "20px",
          [PILL_BOX_SHADOW_VAR_NAME]:
            "inset 0 2px 4px red, 0 0 0 2px blue, 0 4px 8px -2px rgb(0 0 0 / 0.6)",
        }),
      );
      expect(drawing).toContain('width="280" height="100"');
      // The box with the outline cut out of it.
      expect(drawing).toMatch(/<clipPath id="o"><path clip-rule="evenodd" d="M0 0H280V100H0Z/);
      // Last first; the inset one is left to the copy of the background.
      const fills = [...drawing.matchAll(/style="fill:([^"]*)"/g)].map((m) => m[1]);
      expect(fills).toEqual(["rgb(0 0 0 / 0.6)", "blue"]);
      expect(drawing).not.toContain("red");
      // A standard deviation of half the blur radius, and none for a hard one.
      expect(drawing).toContain('<feGaussianBlur stdDeviation="4"/>');
      expect([...drawing.matchAll(/<filter /g)]).toHaveLength(1);
      // Spread and offset: the hard ring grown 2px, the soft one shrunk 2px
      // and dropped 4px.
      const shadows = [...drawing.matchAll(/<path d="([^"]*)"[^>]*style="fill:/g)].map(
        (m) => parse(m[1] as string)[0] as Point[],
      );
      const top = (points: Point[]) => Math.min(...points.map((p) => p.y));
      expect(top(shadows[0] as Point[])).toBeCloseTo(20 + 2 + 4, 1);
      expect(top(shadows[1] as Point[])).toBeCloseTo(20 - 2, 1);
    });
  });

  describe("single band", () => {
    const border = { [PILL_BORDER_WIDTH_VAR_NAME]: "3px", [PILL_BORDER_COLOR_VAR_NAME]: "red" };
    const pathData = (clip: string) => /"([^"]*)"/.exec(clip)?.[1] ?? "";

    it("is its colour through a clip, rather than an image", () => {
      const drawing = pillDecoration(240, 60, border);
      expect(drawing?.image).toBe("linear-gradient(red, red)");
      expect(drawing?.clip).toMatch(/^path\(evenodd, "/);
    });

    it("clips to a band exactly the border wide, inside the outline", () => {
      const clip = pillDecoration(240, 60, border)?.clip as string;
      const [outer, inner] = parse(pathData(clip)) as [Point[], Point[]];
      expect(outer.length).toBe(inner.length);
      const outline = pillOutlinePoints(240, 60);
      for (const p of outer) expect(distanceTo(p, outline)).toBeCloseTo(0, 1);
      for (const p of inner) {
        expect(distanceTo(p, outline)).toBeCloseTo(3, 1);
        expect(p.x).toBeGreaterThan(2.9);
        expect(p.y).toBeGreaterThan(2.9);
      }
    });

    it("insets a tall pill's band inwards too, though its outline runs the other way", () => {
      const clip = pillDecoration(60, 240, border)?.clip as string;
      const [, inner] = parse(pathData(clip)) as [Point[], Point[]];
      for (const p of inner) {
        expect(p.x).toBeGreaterThan(2.9);
        expect(p.y).toBeGreaterThan(2.9);
      }
    });

    it("lies on the decoration's grown box, for an outline beyond its offset", () => {
      const clip = pillDecoration(240, 60, {
        [PILL_REACH_VAR_NAME]: "6px",
        [PILL_OUTLINE_WIDTH_VAR_NAME]: "2px",
        [PILL_OUTLINE_OFFSET_VAR_NAME]: "4px",
        [PILL_OUTLINE_COLOR_VAR_NAME]: "white",
      })?.clip as string;
      const outline = pillOutlinePoints(240, 60).map((p) => ({ x: p.x + 6, y: p.y + 6 }));
      const [outer, inner] = parse(pathData(clip)) as [Point[], Point[]];
      for (const p of outer) expect(distanceTo(p, outline)).toBeCloseTo(6, 1);
      for (const p of inner) expect(distanceTo(p, outline)).toBeCloseTo(4, 1);
    });

    it("cuts dashes and dots along the band the way the worklet dashes", () => {
      const dashes = (style: string) =>
        parse(
          pathData(
            pillDecoration(240, 60, {
              [PILL_BORDER_WIDTH_VAR_NAME]: "2px",
              [PILL_BORDER_COLOR_VAR_NAME]: "red",
              [PILL_BORDER_STYLE_VAR_NAME]: style,
            })?.clip as string,
          ),
        ).length;
      // Measured along the centre line, 1px inside the outline: a convex
      // curve moved in by 1 is shorter by 2π.
      const outline = pillOutlinePoints(240, 60);
      const perimeter = outline.reduce((sum, p, i) => {
        const q = outline[(i + 1) % outline.length] as Point;
        return sum + Math.hypot(q.x - p.x, q.y - p.y);
      }, 0);
      const centre = perimeter - 2 * Math.PI;
      // Width 2: dashes are 6 on, 4 off; dots 2 on, 4 off.
      expect(dashes("dashed")).toBe(Math.ceil(centre / 10));
      expect(dashes("dotted")).toBe(Math.ceil(centre / 6));
    });

    it("leaves more than one band, or any shadow, to the image", () => {
      const both = pillDecoration(240, 60, {
        ...border,
        [PILL_RING_WIDTH_VAR_NAME]: "2px",
        [PILL_RING_COLOR_VAR_NAME]: "blue",
      });
      expect(both?.clip).toBeNull();
      expect(both?.image).toMatch(/^url\("data:image\/svg\+xml,/);
      const shadowed = pillDecoration(240, 60, {
        ...border,
        [PILL_REACH_VAR_NAME]: "10px",
        [PILL_BOX_SHADOW_VAR_NAME]: "0 2px 4px black",
      });
      expect(shadowed?.clip).toBeNull();
      expect(pillDecoration(240, 60, {})).toBeNull();
    });
  });
});
