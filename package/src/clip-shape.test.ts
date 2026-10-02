/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import { type Point, clipShape, clipToConvex } from "./clip-shape";

const area = (ring: Point[]) => {
  let sum = 0;
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length] as Point;
    sum += p.x * q.y - q.x * p.y;
  });
  return Math.abs(sum) / 2;
};
const bounds = (ring: Point[]) => ({
  left: Math.min(...ring.map((p) => p.x)),
  top: Math.min(...ring.map((p) => p.y)),
  right: Math.max(...ring.map((p) => p.x)),
  bottom: Math.max(...ring.map((p) => p.y)),
});
const only = (value: string, width = 200, height = 100) => {
  const shape = clipShape(value, width, height);
  if (!shape) throw new Error(`no shape for ${value}`);
  expect(shape.rings.length).toBe(1);
  return shape.rings[0] as Point[];
};

describe("clipShape", () => {
  it("clips nothing for none, or the border box alone", () => {
    expect(clipShape("none", 200, 100)).toBeNull();
    expect(clipShape("border-box", 200, 100)).toBeNull();
  });

  it("resolves insets, with percentages and calc() against the box", () => {
    expect(bounds(only("inset(10px 20% calc(50% - 40px) 5px)"))).toEqual({
      left: 5,
      top: 10,
      right: 160,
      bottom: 90,
    });
    // sr-only: the insets meet, leaving nothing.
    expect(clipShape("inset(50%)", 200, 100)?.rings).toEqual([]);
  });

  it("rounds inset corners, scaling radii that overlap", () => {
    // Flattened arcs sit just inside the true ones, by at most 0.1px.
    const near = (actual: number, exact: number) =>
      expect(Math.abs(actual - exact) / exact).toBeLessThan(2e-3);
    near(area(only("inset(0px round 20px)")), 200 * 100 - (4 - Math.PI) * 400);
    // 100% radii on a 200 by 100 box overlap; scaled down they make an ellipse.
    near(area(only("inset(0px round 100%)")), Math.PI * 100 * 50);
  });

  it("reads xywh() and rect()", () => {
    expect(bounds(only("xywh(10px 20px 50% 30px)"))).toEqual({
      left: 10,
      top: 20,
      right: 110,
      bottom: 50,
    });
    expect(bounds(only("rect(10px auto 60% 0px)"))).toEqual({
      left: 0,
      top: 10,
      right: 200,
      bottom: 60,
    });
  });

  it("sizes circles and ellipses from lengths and side keywords", () => {
    const circle = bounds(only("circle(30px at 50% 50%)"));
    expect(circle.left).toBeCloseTo(70);
    expect(circle.bottom).toBeCloseTo(80);
    // closest-side from a centre 20px off the left edge.
    expect(bounds(only("circle(at 20px 50%)")).left).toBeCloseTo(0);
    expect(bounds(only("circle(closest-side at left 20px top 50px)")).right).toBeCloseTo(40);
    const ellipse = bounds(only("ellipse(50% 25% at center)"));
    expect(ellipse.right - ellipse.left).toBeCloseTo(200);
    expect(ellipse.bottom - ellipse.top).toBeCloseTo(50);
  });

  it("reads polygons, with their fill rule", () => {
    const shape = clipShape("polygon(evenodd, 0% 0%, 100% 0%, 50px 100%)", 200, 100);
    expect(shape?.rule).toBe("evenodd");
    expect(shape?.rings[0]).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 50, y: 100 },
    ]);
  });

  it("flattens path() lines and curves, one ring per subpath", () => {
    const shape = clipShape('path("M0 0 h100 v50 H0 Z m10 10 q20 0 20 20 t20 20 z")', 200, 100);
    expect(shape?.rings.length).toBe(2);
    expect(bounds(shape?.rings[1] as Point[])).toEqual({
      left: 10,
      top: 10,
      right: 50,
      bottom: 50,
    });
  });

  it("measures from another reference box when given the edges", () => {
    const edges = {
      border: [2, 2, 2, 2] as [number, number, number, number],
      padding: [8, 8, 8, 8] as [number, number, number, number],
      margin: [0, 0, 0, 0] as [number, number, number, number],
    };
    const shape = clipShape("inset(0px) content-box", 200, 100, edges);
    expect(bounds(shape?.rings[0] as Point[])).toEqual({
      left: 10,
      top: 10,
      right: 190,
      bottom: 90,
    });
  });

  it("gives up on what it can't flatten", () => {
    expect(clipShape('url("#mask")', 200, 100)).toBeUndefined();
    expect(clipShape('path("M0 0 A10 10 0 0 1 20 20 Z")', 200, 100)).toBeUndefined();
    expect(clipShape("shape(from 0px 0px, line to 10px 10px)", 200, 100)).toBeUndefined();
    expect(clipShape("padding-box", 200, 100)).toBeUndefined();
  });
});

describe("clipToConvex", () => {
  // Clockwise in screen coordinates, as the pill outline runs.
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it("keeps the part of the subject inside the clip", () => {
    const shifted = square.map((p) => ({ x: p.x + 50, y: p.y + 50 }));
    expect(area(clipToConvex(shifted, square))).toBeCloseTo(2500);
  });

  it("returns a subject inside the clip unchanged, and nothing for one outside", () => {
    const small = square.map((p) => ({ x: p.x / 4 + 10, y: p.y / 4 + 10 }));
    expect(clipToConvex(small, square)).toEqual(small);
    expect(
      clipToConvex(
        square.map((p) => ({ x: p.x + 500, y: p.y })),
        square,
      ),
    ).toEqual([]);
  });
});
