/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import { paintDef } from "./pill-shape.worklet";
import {
  PILL_ARC_SETBACK_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
  PILL_EDGE_SETBACK_VAR_NAME,
  PILL_MAX_RADIUS_VAR_NAME,
} from "./variants";

type Point = { x: number; y: number };
type Continuity = 2 | 3;

const geometry = new (paintDef as unknown as new () => {
  resolveSetbacks(props?: unknown): { beta: number; exponent: number };
  resolveMaxRadius(props?: unknown): number;
  junctionRatio(beta: number, q: number, continuity: Continuity): number;
  roundnessExponent(beta: number, q: number, continuity: Continuity): number;
  fitEasing(
    r: number,
    half: number,
    beta: number,
    exponent: number,
    continuity: Continuity,
  ): { beta: number; exponent: number };
  capAt(r: number, beta: number, q: number, continuity: Continuity): (phi: number) => Point;
  cornerCurve(
    longRoom: number,
    shortRoom: number,
    maxRadius: number,
    angle: number,
    exponent: number,
    continuity?: Continuity,
  ): { key: string; at: (phi: number) => Point } | null;
  fittedQuadrant(
    long: number,
    short: number,
    angle: number,
    exponent: number,
    continuity?: Continuity,
  ): Point[];
  corner(
    longRoom: number,
    shortRoom: number,
    maxRadius: number,
    angle: number,
    exponent: number,
    continuity?: Continuity,
  ): Point[];
})();

const props = (values: Record<string, string | number | undefined>) => ({
  get: (name: string) =>
    values[name] === undefined ? undefined : { toString: () => String(values[name]) },
});

const DEG45 = Math.PI / 4;

const request = (arc?: string, edge?: number, continuity?: Continuity) => {
  const { beta, exponent } = geometry.resolveSetbacks(
    props({
      [PILL_ARC_SETBACK_VAR_NAME]: arc,
      [PILL_EDGE_SETBACK_VAR_NAME]: edge,
      [PILL_CONTINUITY_VAR_NAME]: continuity,
    }),
  );
  return { beta, exponent, continuity: continuity ?? 3 };
};
const DEFAULTS = request();

const corner = (
  longRoom: number,
  shortRoom: number,
  maxRadius: number,
  easing: { beta: number; exponent: number; continuity: Continuity } = DEFAULTS,
) =>
  geometry.corner(longRoom, shortRoom, maxRadius, easing.beta, easing.exponent, easing.continuity);

/**
 * The curve itself, finely: the emitted vertices are as far apart as
 * `MAX_SAGITTA` allows, too coarse to compare shapes to within a hundredth of
 * a pixel, or to read curvature from.
 */
const FINE = 4096;
const finely = (at: (phi: number) => Point) =>
  Array.from({ length: FINE + 1 }, (_, i) => at((Math.PI / 2) * (i / FINE)));
const curve = (
  longRoom: number,
  shortRoom: number,
  maxRadius: number,
  easing: { beta: number; exponent: number; continuity: Continuity } = DEFAULTS,
) =>
  finely(
    geometry.cornerCurve(
      longRoom,
      shortRoom,
      maxRadius,
      easing.beta,
      easing.exponent,
      easing.continuity,
    )!.at,
  );
/** The cap a corner at its limit is, finely. */
const capCurve = (longRoom: number, r: number, easing = DEFAULTS) => {
  const fitted = geometry.fitEasing(r, longRoom, easing.beta, easing.exponent, easing.continuity);
  return finely(geometry.capAt(r, fitted.beta, fitted.exponent, easing.continuity));
};

/** Where the flat edge starts with room to spare, for a cap of half-height `r`. */
const reach = (r: number, easing = DEFAULTS) =>
  r * geometry.junctionRatio(easing.beta, easing.exponent, easing.continuity);

/** How far in from the box corner it reaches along the diagonal. */
const roundness = (points: Point[]) => Math.min(...points.map((p) => (p.x + p.y) / Math.SQRT2));

const toSegment = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t =
    length2 > 0 ? Math.min(Math.max(((p.x - a.x) * dx + (p.y - a.y) * dy) / length2, 0), 1) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
const toPolyline = (p: Point, line: Point[]) => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++)
    best = Math.min(best, toSegment(p, line[i]!, line[i + 1]!));
  return best;
};
/** The furthest either polyline's vertices get from the other. */
const apart = (a: Point[], b: Point[]) =>
  Math.max(...a.map((p) => toPolyline(p, b)), ...b.map((p) => toPolyline(p, a)));

/** Turn over length at each interior vertex, along the polyline. */
const curvatures = (points: Point[]) => {
  const out: number[] = [];
  for (let i = 1; i + 1 < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const turn = Math.abs(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x));
    out.push(turn / ((Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - b.x, c.y - b.y)) / 2));
  }
  return out;
};

/** Every turn the same way round. */
const isConvex = (points: Point[]) => {
  let sign = 0;
  for (let i = 0; i + 2 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const c = points[i + 2]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) continue;
    if (sign !== 0 && Math.sign(cross) !== sign) return false;
    sign = Math.sign(cross);
  }
  return true;
};

describe("pill max radius", () => {
  describe("resolveMaxRadius", () => {
    const max = (value?: string) =>
      geometry.resolveMaxRadius(props({ [PILL_MAX_RADIUS_VAR_NAME]: value }));

    it("reads px, with no limit where there isn't a number", () => {
      expect(max("26px")).toBe(26);
      expect(max("3.35544e+07px")).toBe(33554400);
      expect(max("")).toBe(Infinity);
      expect(max("foo")).toBe(Infinity);
      expect(max()).toBe(Infinity);
      expect(geometry.resolveMaxRadius()).toBe(Infinity);
      expect(max("-4px")).toBe(0);
    });
  });

  describe("corner", () => {
    it("is today's quadrant below the limit", () => {
      for (const shortRoom of [20, 26]) {
        for (const maxRadius of [Infinity, 26, 3.35544e7]) {
          expect(corner(200, shortRoom, maxRadius)).toBe(
            geometry.fittedQuadrant(
              400,
              2 * shortRoom,
              DEFAULTS.beta,
              DEFAULTS.exponent,
              DEFAULTS.continuity,
            ),
          );
        }
      }
    });

    it("solves the roundness exponent", () => {
      const n = (easing: { beta: number; exponent: number; continuity: Continuity }) =>
        geometry.roundnessExponent(easing.beta, easing.exponent, easing.continuity);
      expect(DEFAULTS.beta).toBe(DEG45);
      expect(n(DEFAULTS)).toBeCloseTo(3.51, 1);
      const thirty = n(request("30deg", 0.6035));
      expect(thirty).toBeGreaterThan(3.25);
      expect(thirty).toBeLessThan(3.4);
      expect(n(request(undefined, undefined, 2))).toBeGreaterThanOrEqual(2.25);
      // Unfloored, this request solves to about 2.12.
      expect(n(request("45deg", 0.05))).toBe(3.25);
    });

    it("keeps the flat edge and the roundness while it grows", () => {
      const m = 26;
      const J = reach(m);
      expect(J / m).toBeCloseTo(1.697, 2);
      const cap = roundness(corner(200, 26, m));
      for (const shortRoom of [26.5, 30, 35, 40, 44, 60]) {
        const points = corner(200, shortRoom, m);
        expect(Math.abs(points.at(-1)!.x - J)).toBeLessThan(1e-6);
        expect(points.at(-1)!.y).toBe(0);
        expect(points[0]!.x).toBe(0);
        expect(Math.abs(points[0]!.y - Math.min(shortRoom, J))).toBeLessThan(1e-6);
        expect(Math.abs(roundness(points) - cap)).toBeLessThan(0.01 * m);
      }
    });

    it("converges on the cap at the limit", () => {
      const cap = capCurve(200, 26);
      // The cap `capAt` traces is the one `quadrant` draws.
      for (const p of corner(200, 26, 26)) expect(toPolyline(p, cap)).toBeLessThan(1e-3);
      expect(apart(curve(200, 26.001, 26), cap)).toBeLessThan(0.01);
      // Its vertices, emitted as `quadrant`'s are, lie on it.
      const fine = curve(200, 26.001, 26);
      for (const p of corner(200, 26.001, 26)) expect(toPolyline(p, fine)).toBeLessThan(1e-3);
    });

    it("ends on a symmetric superellipse", () => {
      const points = corner(200, 60, 26);
      const S = reach(26);
      const n = geometry.roundnessExponent(DEFAULTS.beta, DEFAULTS.exponent, 3);
      for (const p of points) {
        expect(toPolyline({ x: p.y, y: p.x }, points)).toBeLessThan(0.05);
        expect(
          Math.abs(Math.max((S - p.x) / S, 0) ** n + Math.max((S - p.y) / S, 0) ** n - 1),
        ).toBeLessThan(1e-3);
      }
    });

    it("stays smooth", () => {
      const m = 26;
      for (const continuity of [3, 2] as const) {
        const easing = request(undefined, undefined, continuity);
        for (const shortRoom of [30, 40, 60]) {
          const k = curvatures(curve(200, shortRoom, m, easing));
          const most = Math.max(...k);
          for (let i = 0; i + 1 < k.length; i++) {
            expect(Math.abs(k[i + 1]! - k[i]!)).toBeLessThan(0.15 * most);
          }
          expect(k.at(-1)!).toBeLessThan(0.05 / m);
        }
      }
    });

    it("draws rounded rectangles without easing", () => {
      const points = corner(200, 60, 26, request("0deg", 0));
      for (const p of points) {
        expect(Math.abs(Math.hypot(p.x - 26, p.y - 26) - 26)).toBeLessThan(1e-6);
      }
    });

    it("draws a rectangle at zero", () => {
      expect(corner(200, 60, 0)).toEqual([{ x: 0, y: 0 }]);
      for (const p of corner(200, 60, 1e-9)) {
        expect(Number.isNaN(p.x) || Number.isNaN(p.y)).toBe(false);
      }
    });

    it("fits boxes constrained both ways", () => {
      const points = corner(30, 30, 26);
      expect(points.every((p) => p.x >= -1e-9 && p.x <= 30 + 1e-9)).toBe(true);
      expect(points.every((p) => p.y >= -1e-9 && p.y <= 30 + 1e-9)).toBe(true);
      expect(isConvex(points)).toBe(true);
      expect(apart(curve(30, 26.001, 26), capCurve(30, 26))).toBeLessThan(0.01);
    });
  });
});
