/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import { paintDef } from "./pill-shape.worklet";

interface Point {
  x: number;
  y: number;
}

/** Records the polyline the worklet emits — that polyline is the shape. */
class RecordingContext {
  fillStyle: unknown = "";
  vertices: Point[] = [];
  closed = false;

  beginPath(): void {}
  fill(): void {}
  moveTo(x: number, y: number): void {
    this.vertices.push({ x, y });
  }
  lineTo(x: number, y: number): void {
    this.vertices.push({ x, y });
  }
  arc(): void {
    throw new Error("the outline must be emitted as a polyline");
  }
  closePath(): void {
    this.closed = true;
  }
}

const props = (amt?: number, falloff?: number) => ({
  get(name: string) {
    if (name === "--pill-squircle-amt" && amt !== undefined) {
      return { toString: () => String(amt) };
    }
    if (name === "--pill-ease-falloff" && falloff !== undefined) {
      return { toString: () => String(falloff) };
    }
    return undefined;
  },
});

const paint = (width: number, height: number, amt?: number, falloff?: number): RecordingContext => {
  const ctx = new RecordingContext();
  const instance = new (paintDef as new () => {
    paint(c: unknown, s: { width: number; height: number }, p: unknown): void;
  })();
  instance.paint(ctx, { width, height }, props(amt, falloff));
  return ctx;
};

/** Circle through three points; used to measure the cap without assuming it. */
const circleThrough = (a: Point, b: Point, c: Point): { x: number; y: number; r: number } => {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const sq = (p: Point) => p.x * p.x + p.y * p.y;
  const x = (sq(a) * (b.y - c.y) + sq(b) * (c.y - a.y) + sq(c) * (a.y - b.y)) / d;
  const y = (sq(a) * (c.x - b.x) + sq(b) * (a.x - c.x) + sq(c) * (b.x - a.x)) / d;
  return { x, y, r: Math.hypot(a.x - x, a.y - y) };
};

/** Menger curvature at b, given its neighbours a and c. */
const curvature = (a: Point, b: Point, c: Point): number => {
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const bc = Math.hypot(c.x - b.x, c.y - b.y);
  const ca = Math.hypot(a.x - c.x, a.y - c.y);
  if (ab === 0 || bc === 0 || ca === 0) return 0;
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return (2 * Math.abs(cross)) / (ab * bc * ca);
};

/** Index of the vertex where the top-left outline meets the flat top edge. */
const junctionIndex = (ctx: RecordingContext): number => {
  let best = 0;
  let longest = 0;
  for (let i = 1; i < ctx.vertices.length; i++) {
    const d = Math.hypot(
      ctx.vertices[i].x - ctx.vertices[i - 1].x,
      ctx.vertices[i].y - ctx.vertices[i - 1].y,
    );
    if (d > longest) {
      longest = d;
      best = i - 1;
    }
  }
  return best;
};

/** Curvature profile over the cap, ending at the flat-edge junction. */
const capCurvature = (ctx: RecordingContext): number[] => {
  const j = junctionIndex(ctx);
  const out: number[] = [];
  for (let i = 1; i < j; i++) {
    out.push(curvature(ctx.vertices[i - 1], ctx.vertices[i], ctx.vertices[i + 1]));
  }
  return out;
};

const WIDTH = 240;
const HEIGHT = 60;
const R = HEIGHT / 2;

describe("pill-shape worklet geometry", () => {
  describe("outline", () => {
    it("fills the box exactly and closes", () => {
      const ctx = paint(WIDTH, HEIGHT);
      const xs = ctx.vertices.map((p) => p.x);
      const ys = ctx.vertices.map((p) => p.y);

      expect(Math.min(...xs)).toBeCloseTo(0, 4);
      expect(Math.max(...xs)).toBeCloseTo(WIDTH, 4);
      expect(Math.min(...ys)).toBeCloseTo(0, 4);
      expect(Math.max(...ys)).toBeCloseTo(HEIGHT, 4);
      expect(ctx.closed).toBe(true);
    });

    it("keeps flat top and bottom edges between the caps", () => {
      const ctx = paint(WIDTH, HEIGHT);
      const j = junctionIndex(ctx);
      const a = ctx.vertices[j];
      const b = ctx.vertices[j + 1];

      expect(a.y).toBeCloseTo(0, 6);
      expect(b.y).toBeCloseTo(0, 6);
      expect(b.x - a.x).toBeGreaterThan(0);
      // Mirrored, so the edge is centred.
      expect(a.x + b.x).toBeCloseTo(WIDTH, 4);
    });
  });

  describe("caps stay round", () => {
    it("keeps a cap radius close to half the height", () => {
      const ctx = paint(WIDTH, HEIGHT);
      // Derive the circle from three arc samples rather than assuming where
      // its centre is — the easing pulls the centre inward.
      const arc = ctx.vertices.slice(0, 13);
      const [a, b, c] = [arc[0], arc[6], arc[12]];
      const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
      const sq = (p: Point) => p.x * p.x + p.y * p.y;
      const centre = {
        x: (sq(a) * (b.y - c.y) + sq(b) * (c.y - a.y) + sq(c) * (a.y - b.y)) / d,
        y: (sq(a) * (c.x - b.x) + sq(b) * (a.x - c.x) + sq(c) * (b.x - a.x)) / d,
      };
      const radii = arc.map((p) => Math.hypot(p.x - centre.x, p.y - centre.y));

      // Every arc sample lies on that one circle...
      for (const radius of radii) expect(radius).toBeCloseTo(radii[0], 4);
      // ...centred on the pill's axis, at a radius near a true semicircle.
      expect(centre.y).toBeCloseTo(R, 4);
      expect(radii[0]).toBeGreaterThan(0.9 * R);
      expect(radii[0]).toBeLessThanOrEqual(R + 1e-9);
    });

    it("holds constant curvature through the arc, unlike a superellipse", () => {
      const profile = capCurvature(paint(WIDTH, HEIGHT));
      const arcPart = profile.slice(0, 10);
      for (const k of arcPart) expect(k).toBeCloseTo(arcPart[0], 3);
      expect(arcPart[0]).toBeGreaterThan(0.9 / R);
    });
  });

  describe("curvature easing (G2)", () => {
    it("ramps curvature to zero instead of dropping it off a cliff", () => {
      const eased = capCurvature(paint(WIDTH, HEIGHT));
      const peak = Math.max(...eased);

      // Last sample before the flat edge is essentially straight...
      expect(eased[eased.length - 1]).toBeLessThan(0.15 * peak);
      // ...and no single step sheds a large share of the curvature.
      let maxDrop = 0;
      for (let i = 1; i < eased.length; i++) {
        maxDrop = Math.max(maxDrop, Math.abs(eased[i] - eased[i - 1]));
      }
      expect(maxDrop).toBeLessThan(0.2 * peak);
    });

    it("falls monotonically once the easing starts", () => {
      const eased = capCurvature(paint(WIDTH, HEIGHT));
      const peak = eased.indexOf(Math.max(...eased));
      for (let i = peak + 2; i < eased.length; i++) {
        expect(eased[i]).toBeLessThanOrEqual(eased[i - 1] + 1e-9);
      }
    });

    it("drops off a cliff at amt = 1, which is the plain stadium", () => {
      const stadium = capCurvature(paint(WIDTH, HEIGHT, 1));
      const peak = Math.max(...stadium);

      // A bare semicircle holds 1 / R right up to the edge.
      expect(peak).toBeCloseTo(1 / R, 3);
      expect(stadium[stadium.length - 1]).toBeCloseTo(1 / R, 3);
    });

    it("eases more softly as the amount rises", () => {
      const softness = [1, 2, 3].map((amt) => {
        const ctx = paint(WIDTH, HEIGHT, amt);
        // Where the flat edge begins: a softer ease starts turning sooner.
        return ctx.vertices[junctionIndex(ctx)].x;
      });
      expect(softness[1]).toBeGreaterThan(softness[0]);
      expect(softness[2]).toBeGreaterThan(softness[1]);
    });
  });

  describe("fitting the easing to the box", () => {
    it("eases harder when the pill is too stubby for the request", () => {
      const roomy = paint(400, 60);
      const stubby = paint(80, 60);
      const easeSpan = (ctx: RecordingContext) => {
        const j = junctionIndex(ctx);
        // Angular span handed to the easing, via where the arc stops.
        return ctx.vertices[j].x;
      };
      expect(easeSpan(stubby)).toBeLessThan(easeSpan(roomy));
    });

    it("renders a perfect square as a plain circle", () => {
      const ctx = paint(100, 100);
      const centre = { x: 50, y: 50 };
      for (const p of ctx.vertices) {
        expect(Math.hypot(p.x - centre.x, p.y - centre.y)).toBeCloseTo(50, 4);
      }
    });

    it("never bulges outside the box, at any amount or ratio", () => {
      for (const amt of [1, 2, 3, 6]) {
        for (const [w, h] of [
          [240, 60],
          [70, 60],
          [60, 60],
          [60, 240],
          [61, 60],
        ]) {
          for (const p of paint(w, h, amt).vertices) {
            expect(p.x, `amt ${amt} @ ${w}x${h}`).toBeGreaterThanOrEqual(-1e-6);
            expect(p.x, `amt ${amt} @ ${w}x${h}`).toBeLessThanOrEqual(w + 1e-6);
            expect(p.y, `amt ${amt} @ ${w}x${h}`).toBeGreaterThanOrEqual(-1e-6);
            expect(p.y, `amt ${amt} @ ${w}x${h}`).toBeLessThanOrEqual(h + 1e-6);
          }
        }
      }
    });
  });

  describe("--pill-ease-falloff", () => {
    const arcOf = (ctx: RecordingContext) =>
      circleThrough(ctx.vertices[0], ctx.vertices[6], ctx.vertices[12]);
    const flatEdgeStart = (ctx: RecordingContext) => ctx.vertices[junctionIndex(ctx)].x;

    it("stretches the transition along the flat edge", () => {
      const reach = [2, 3, 4, 6].map((q) => flatEdgeStart(paint(WIDTH, HEIGHT, 2, q)));
      for (let i = 1; i < reach.length; i++) {
        expect(reach[i]).toBeGreaterThan(reach[i - 1]);
      }
    });

    it("leaves the cap arc alone while doing so", () => {
      // The whole point: a longer transition must not eat into the circle.
      const caps = [2, 3, 4, 6].map((q) => arcOf(paint(WIDTH, HEIGHT, 2, q)));
      for (const cap of caps) {
        expect(cap.y).toBeCloseTo(R, 4);
        // Radius barely moves, and stays close to a true semicircle...
        expect(cap.r).toBeGreaterThan(0.9 * R);
      }
      expect(Math.abs(caps[caps.length - 1].r - caps[0].r)).toBeLessThan(0.05 * R);
    });

    it("reaches further than a high amount while keeping rounder ends", () => {
      // The motivating case: amt 3 buys reach by spending the arc; a high
      // falloff buys the same reach and keeps the arc.
      const spendy = paint(WIDTH, HEIGHT, 3, 2);
      const thrifty = paint(WIDTH, HEIGHT, 1.5, 6);

      expect(flatEdgeStart(thrifty)).toBeGreaterThan(0.9 * flatEdgeStart(spendy));
      expect(arcOf(thrifty).r).toBeGreaterThan(arcOf(spendy).r);
    });

    it("keeps curvature continuous at every falloff", () => {
      for (const q of [2, 3, 4, 8]) {
        const profile = capCurvature(paint(WIDTH, HEIGHT, 2, q));
        const peak = Math.max(...profile);

        // Starts on the arc at 1 / cap radius, ends flat, with no cliff.
        expect(profile[profile.length - 1], `falloff ${q}`).toBeLessThan(0.15 * peak);
        let maxDrop = 0;
        for (let i = 1; i < profile.length; i++) {
          maxDrop = Math.max(maxDrop, Math.abs(profile[i] - profile[i - 1]));
        }
        expect(maxDrop, `falloff ${q}`).toBeLessThan(0.25 * peak);
      }
    });

    it("defaults to the plain clothoid, and clamps below it", () => {
      const implicit = paint(WIDTH, HEIGHT, 2);
      expect(implicit.vertices).toEqual(paint(WIDTH, HEIGHT, 2, 2).vertices);
      // Below 2 the curvature derivative diverges at the flat edge, so the
      // clothoid is the floor.
      expect(paint(WIDTH, HEIGHT, 2, 1.2).vertices).toEqual(implicit.vertices);
    });

    it("still fits the box, and still collapses a square to a circle", () => {
      for (const q of [2, 4, 8]) {
        for (const [w, h] of [
          [240, 60],
          [70, 60],
          [60, 240],
        ]) {
          for (const p of paint(w, h, 3, q).vertices) {
            expect(p.x, `falloff ${q} @ ${w}x${h}`).toBeGreaterThanOrEqual(-1e-6);
            expect(p.x, `falloff ${q} @ ${w}x${h}`).toBeLessThanOrEqual(w + 1e-6);
            expect(p.y, `falloff ${q} @ ${w}x${h}`).toBeGreaterThanOrEqual(-1e-6);
            expect(p.y, `falloff ${q} @ ${w}x${h}`).toBeLessThanOrEqual(h + 1e-6);
          }
        }
        for (const p of paint(100, 100, 3, q).vertices) {
          expect(Math.hypot(p.x - 50, p.y - 50), `falloff ${q}`).toBeCloseTo(50, 4);
        }
      }
    });
  });

  describe("vertical pills", () => {
    it("caps the short axis and keeps flat sides", () => {
      const ctx = paint(60, 240);
      const xs = ctx.vertices.map((p) => p.x);
      const ys = ctx.vertices.map((p) => p.y);

      expect(Math.min(...xs)).toBeCloseTo(0, 4);
      expect(Math.max(...xs)).toBeCloseTo(60, 4);
      expect(Math.min(...ys)).toBeCloseTo(0, 4);
      expect(Math.max(...ys)).toBeCloseTo(240, 4);

      const j = junctionIndex(ctx);
      expect(Math.abs(ctx.vertices[j].x - ctx.vertices[j + 1].x)).toBeLessThan(1e-6);
    });
  });
});
