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

/**
 * Largest rate of curvature change over the cap, scaled to be size-independent.
 * This is what reads as a smooth or an abrupt transition.
 */
const curvatureGradient = (ctx: RecordingContext, r: number): number => {
  const j = junctionIndex(ctx);
  const v = ctx.vertices;
  let worst = 0;
  for (let i = 2; i < j; i++) {
    const before = curvature(v[i - 2], v[i - 1], v[i]);
    const after = curvature(v[i - 1], v[i], v[i + 1]);
    const ds = Math.hypot(v[i].x - v[i - 1].x, v[i].y - v[i - 1].y);
    if (ds > 1e-9) worst = Math.max(worst, Math.abs(after - before) / ds);
  }
  return worst * r * r;
};

/**
 * Angle, in degrees, at which the outline arrives at the flat edge. Curvature
 * decaying to zero shows up here as arriving tangent; a cliff arrives steeply.
 * Unlike a curvature sample, this does not depend on where vertices happen to
 * land.
 */
const arrivalAngle = (ctx: RecordingContext): number => {
  const j = junctionIndex(ctx);
  const dx = ctx.vertices[j].x - ctx.vertices[j - 1].x;
  const dy = ctx.vertices[j].y - ctx.vertices[j - 1].y;
  return Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
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

      // It arrives at the flat edge already flattened...
      expect(peak).toBeGreaterThan(0);
      expect(arrivalAngle(paint(WIDTH, HEIGHT))).toBeLessThan(3);
      // ...and curvature sheds at a bounded rate. Measured per unit arc length,
      // so it does not depend on how densely the outline happens to be sampled.
      expect(curvatureGradient(paint(WIDTH, HEIGHT), R)).toBeLessThan(3);
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
      // ...so unlike an eased cap it does not arrive flattened.
      expect(arrivalAngle(paint(WIDTH, HEIGHT, 1))).toBeGreaterThan(
        arrivalAngle(paint(WIDTH, HEIGHT, 3)),
      );
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

    it("keeps curvature continuous at every falloff at or above the clothoid", () => {
      for (const q of [2, 3, 4, 8]) {
        const profile = capCurvature(paint(WIDTH, HEIGHT, 2, q));
        const peak = Math.max(...profile);

        // Starts on the arc at 1 / cap radius, arrives flat, with no cliff.
        expect(peak, `falloff ${q}`).toBeGreaterThan(0);
        expect(arrivalAngle(paint(WIDTH, HEIGHT, 2, q)), `falloff ${q}`).toBeLessThan(3);
        expect(curvatureGradient(paint(WIDTH, HEIGHT, 2, q), R), `falloff ${q}`).toBeLessThan(3);
      }
    });

    it("defaults to the plain clothoid", () => {
      expect(paint(WIDTH, HEIGHT, 2).vertices).toEqual(paint(WIDTH, HEIGHT, 2, 2).vertices);
    });

    it("honours falloffs below the clothoid, corner and all", () => {
      // Below 2 the transition is shorter and arrives ever more steeply, until
      // at 0 it has no length and the arc meets the flat edge at a corner.
      // Ugly, but it renders rather than being silently clamped away.
      const angles = [0, 0.5, 1, 1.5, 2].map((q) => arrivalAngle(paint(WIDTH, HEIGHT, 4, q)));
      for (let i = 1; i < angles.length; i++) {
        expect(angles[i], `falloff step ${i}`).toBeLessThan(angles[i - 1]);
      }
      // A falloff of 0 is a genuine corner, not an easing.
      expect(angles[0]).toBeGreaterThan(30);
    });

    it("stays finite and inside the box at every falloff", () => {
      for (const q of [0, 0.25, 0.5, 1, 1.5, 2, 20]) {
        for (const [w, h] of [
          [600, 60],
          [140, 60],
          [60, 60],
          [60, 600],
        ]) {
          const v = paint(w, h, 4, q).vertices;
          expect(v.length, `falloff ${q} @ ${w}x${h}`).toBeGreaterThan(3);
          for (const p of v) {
            const tag = `falloff ${q} @ ${w}x${h}`;
            expect(Number.isFinite(p.x) && Number.isFinite(p.y), tag).toBe(true);
            expect(p.x, tag).toBeGreaterThanOrEqual(-1e-6);
            expect(p.x, tag).toBeLessThanOrEqual(w + 1e-6);
            expect(p.y, tag).toBeGreaterThanOrEqual(-1e-6);
            expect(p.y, tag).toBeLessThanOrEqual(h + 1e-6);
          }
        }
      }
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

  describe("fitting both controls together", () => {
    // A pill too narrow for the requested easing has to give something up.
    // Surrendering the amount alone drives the curvature rate up like 1 / beta,
    // which is what makes a narrow pill look abruptly cornered.
    const WIDTHS = [600, 300, 240, 180, 140, 110];

    it("holds the curvature rate steady as the pill narrows", () => {
      const rates = WIDTHS.map((w) => curvatureGradient(paint(w, HEIGHT, 4, 6), R));
      const widest = rates[0];
      for (let i = 0; i < rates.length; i++) {
        expect(rates[i], `width ${WIDTHS[i]}`).toBeLessThan(1.3 * widest);
      }
    });

    it("gives up falloff as well as amount", () => {
      // At 180 the requested easing does not fit, so both must come down.
      const roomy = paint(600, HEIGHT, 4, 6);
      const tight = paint(180, HEIGHT, 4, 6);

      const capOf = (ctx: RecordingContext) =>
        circleThrough(ctx.vertices[0], ctx.vertices[3], ctx.vertices[6]);
      const flatEdgeStart = (ctx: RecordingContext) => ctx.vertices[junctionIndex(ctx)].x;

      // The tight pill still eases — it has not collapsed to a stadium...
      expect(flatEdgeStart(tight)).toBeGreaterThan(capOf(tight).r * 1.2);
      // ...and it eases over less room than the roomy one.
      expect(flatEdgeStart(tight)).toBeLessThan(flatEdgeStart(roomy));
    });

    it("keeps more of the amount than backing off the amount alone would", () => {
      // Trading falloff for amount is the whole point: the cap should stay
      // meaningfully eased rather than snapping back to a bare semicircle.
      const tight = paint(140, HEIGHT, 4, 6);
      const profile = capCurvature(tight);
      const peak = Math.max(...profile);

      // A real ramp, not a cliff, at a width where beta-only fitting collapses.
      expect(peak).toBeGreaterThan(0);
      expect(arrivalAngle(tight)).toBeLessThan(3);
      expect(profile.length).toBeGreaterThan(8);
    });

    it("leaves the default falloff alone", () => {
      // With falloff already at the clothoid floor there is nothing to trade,
      // so narrowing may only reduce the amount.
      for (const w of [600, 240, 140, 90]) {
        const ctx = paint(w, HEIGHT, 4, 2);
        for (const p of ctx.vertices) {
          expect(p.x, `width ${w}`).toBeGreaterThanOrEqual(-1e-6);
          expect(p.x, `width ${w}`).toBeLessThanOrEqual(w + 1e-6);
        }
      }
    });

    it("still fits the box while trading the two off", () => {
      for (const [amt, falloff] of [
        [4, 6],
        [3, 8],
        [2, 10],
      ]) {
        for (const [w, h] of [
          [600, 60],
          [140, 60],
          [70, 60],
          [61, 60],
          [60, 60],
          [60, 600],
        ]) {
          for (const p of paint(w, h, amt, falloff).vertices) {
            const tag = `amt ${amt} falloff ${falloff} @ ${w}x${h}`;
            expect(p.x, tag).toBeGreaterThanOrEqual(-1e-6);
            expect(p.x, tag).toBeLessThanOrEqual(w + 1e-6);
            expect(p.y, tag).toBeGreaterThanOrEqual(-1e-6);
            expect(p.y, tag).toBeLessThanOrEqual(h + 1e-6);
          }
        }
      }
    });
  });

  describe("outline sampling", () => {
    it("never lets a chord drift far from the curve", () => {
      // Sagitta of each segment: ds * dphi / 8. Sampling that starves the
      // start of the transition shows up here as a visible facet.
      for (const [w, h, amt, falloff] of [
        [600, 60, 4, 6],
        [240, 60, 4, 6],
        [1200, 200, 4, 6],
        [600, 60, 2, 2],
      ]) {
        const ctx = paint(w, h, amt, falloff);
        const v = ctx.vertices;
        const cap = junctionIndex(ctx);
        for (let i = 1; i < cap; i++) {
          const d1 = { x: v[i].x - v[i - 1].x, y: v[i].y - v[i - 1].y };
          const d2 = { x: v[i + 1].x - v[i].x, y: v[i + 1].y - v[i].y };
          const l1 = Math.hypot(d1.x, d1.y);
          if (l1 < 1e-9 || Math.hypot(d2.x, d2.y) < 1e-9) continue;
          const turn = Math.abs(Math.atan2(d1.x * d2.y - d1.y * d2.x, d1.x * d2.x + d1.y * d2.y));
          expect((l1 * turn) / 8, `${w}x${h} amt ${amt} falloff ${falloff}`).toBeLessThan(0.1);
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
