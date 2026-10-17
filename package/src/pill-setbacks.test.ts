import { describe, expect, it, vi } from "vitest";
import { paintDef } from "./pill-shape.worklet";
import { pillOutlinePoints } from "./pill-polyfill";
import {
  PILL_ARC_SETBACK_VAR_NAME,
  PILL_EDGE_SETBACK_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
} from "./variants";

const props = (arc: string, edge: number, continuity: number) => ({
  get(name: string) {
    const value = {
      [PILL_ARC_SETBACK_VAR_NAME]: arc,
      [PILL_EDGE_SETBACK_VAR_NAME]: String(edge),
      [PILL_CONTINUITY_VAR_NAME]: String(continuity),
    }[name];
    return value === undefined ? undefined : { toString: () => value };
  },
});

// Measure the circle through the first three emitted cap vertices, rather
// than using the solver's own radius to verify the requested distance.
function capRadius(points: { x: number; y: number }[]) {
  const [a, b, c] = points as [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ];
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const sq = (p: typeof a) => p.x * p.x + p.y * p.y;
  return (sq(a) * (b.y - c.y) + sq(b) * (c.y - a.y) + sq(c) * (a.y - b.y)) / d;
}

describe("pill geometric setbacks", () => {
  for (const continuity of [2, 3]) {
    it(`places both requested endpoints in G${continuity}`, () => {
      const worklet = new paintDef();
      for (const [degrees, edge] of [
        [15, 0.3],
        [15, 2],
        [30, 0.6],
        [30, 1],
        [30, 2],
        [60, 1],
        [60, 3],
      ]) {
        const outline = worklet.boxOutline(1000, 60, props(`${degrees}deg`, edge!, continuity));
        const radius = capRadius(outline);
        const start = Math.min(...outline.filter((p) => Math.abs(p.y) < 1e-8).map((p) => p.x));
        expect((start - radius) / 30, `${degrees}°, ${edge}r`).toBeCloseTo(edge!, 6);
        const beta = (degrees! * Math.PI) / 180;
        const join = { x: radius * (1 - Math.sin(beta)), y: 30 - radius * Math.cos(beta) };
        expect(outline.some((p) => Math.hypot(p.x - join.x, p.y - join.y) < 1e-6)).toBe(true);
      }
    });

    it(`fits extreme requests and sizes in G${continuity}`, () => {
      const worklet = new paintDef();
      for (const arc of [0, 1, 30, 89, 10000])
        for (const edge of [-1, 0, 0.001, 1, 4, 1e12]) {
          for (const [width, height] of [
            [600, 60],
            [61, 60],
            [60, 60],
            [60, 600],
            [1, 1],
          ]) {
            const outline = worklet.boxOutline(
              width!,
              height!,
              props(`${arc}deg`, edge, continuity),
            );
            for (const point of outline) {
              expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
              expect(point.x).toBeGreaterThanOrEqual(-1e-6);
              expect(point.x).toBeLessThanOrEqual(width! + 1e-6);
              expect(point.y).toBeGreaterThanOrEqual(-1e-6);
              expect(point.y).toBeLessThanOrEqual(height! + 1e-6);
            }
          }
        }
    });
  }

  it("accepts CSS angle units and keeps worklet/polyfill geometry identical", () => {
    const worklet = new paintDef();
    const expected = worklet.boxOutline(240, 60, props("30deg", 1, 3));
    for (const arc of ["30deg", `${Math.PI / 6}rad`, `${100 / 3}grad`, `${1 / 12}turn`]) {
      const points = pillOutlinePoints(240, 60, {
        arcSetback: arc,
        edgeSetback: "1",
        continuity: "3",
      });
      // The polyfill removes repeated quadrant endpoints, so compare membership.
      for (const point of points)
        expect(expected.some((p) => Math.hypot(p.x - point.x, p.y - point.y) < 1e-6)).toBe(true);
    }
  });

  it("uses a stadium when either setback is zero and preserves G3 at constrained joins", () => {
    const worklet = new paintDef();
    for (const input of [props("0deg", 1, 3), props("30deg", 0, 3)]) {
      for (const p of worklet.boxOutline(60, 60, input))
        expect(Math.hypot(p.x - 30, p.y - 30)).toBeCloseTo(30, 6);
      expect(worklet.resolveSetbacks(input).beta).toBe(0);
    }
    const requested = worklet.resolveSetbacks(props("60deg", 0.01, 3));
    expect(requested.beta).toBeLessThan(Math.PI / 3);
    expect(requested.exponent).toBeGreaterThan(2);
    const fitted = worklet.fitEasing(30, 30.1, requested.beta, requested.exponent, 3);
    expect(fitted.exponent).toBeGreaterThan(2);
  });

  it("caches the inverse solve across elements and sizes", () => {
    const worklet = new paintDef();
    const input = props("22.345deg", 1.2345, 3);
    worklet.resolveSetbacks(input);
    const integration = vi.spyOn(worklet, "fresnel");
    worklet.resolveSetbacks(input);
    worklet.resolveAngle(input);
    worklet.resolveExponent(input);
    expect(integration).not.toHaveBeenCalled();
  });
});
