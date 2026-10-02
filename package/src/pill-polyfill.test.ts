/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import { pillMaskImage, pillOutlinePath, pillRingMaskImage } from "./pill-polyfill";
import { paintDef } from "./pill-shape.worklet";
import { PILL_AMT_VAR_NAME, PILL_CONTINUITY_VAR_NAME, PILL_EASE_SPREAD_VAR_NAME } from "./variants";

const points = (d: string) =>
  [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));

/** The vertices the worklet itself would draw for the same box and settings. */
const workletVertices = (width: number, height: number, values: Record<string, string> = {}) => {
  const vertices: { x: number; y: number }[] = [];
  const ctx = {
    fillStyle: "",
    beginPath() {},
    fill() {},
    closePath() {},
    moveTo: (x: number, y: number) => vertices.push({ x, y }),
    lineTo: (x: number, y: number) => vertices.push({ x, y }),
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

const decode = (url: string) =>
  decodeURIComponent(url.slice('url("data:image/svg+xml,'.length, -2));

describe("pill polyfill", () => {
  describe("outline", () => {
    it("traces exactly the outline the worklet draws", () => {
      for (const [w, h] of [
        [240, 60],
        [70, 60],
        [60, 240],
        [60, 60],
      ]) {
        const fromPath = points(pillOutlinePath(w, h));
        const fromWorklet = workletVertices(w, h);
        expect(fromPath.length, `${w}x${h}`).toBe(fromWorklet.length);
        for (let i = 0; i < fromPath.length; i++) {
          expect(fromPath[i].x).toBeCloseTo(fromWorklet[i].x, 2);
          expect(fromPath[i].y).toBeCloseTo(fromWorklet[i].y, 2);
        }
      }
    });

    it("honours the shape properties the worklet reads", () => {
      const values = {
        [PILL_AMT_VAR_NAME]: "3",
        [PILL_EASE_SPREAD_VAR_NAME]: "4",
        [PILL_CONTINUITY_VAR_NAME]: "3",
      };
      const fromPath = points(pillOutlinePath(240, 60, { amt: "3", spread: "4", continuity: "3" }));
      const fromWorklet = workletVertices(240, 60, values);
      expect(fromPath.length).toBe(fromWorklet.length);
      expect(fromPath.at(10)?.x).toBeCloseTo(fromWorklet[10].x, 2);
      // ...and differs from the default shape.
      expect(pillOutlinePath(240, 60, { amt: "3", spread: "4", continuity: "3" })).not.toBe(
        pillOutlinePath(240, 60),
      );
    });

    it("is closed, and empty for a box with no area", () => {
      expect(pillOutlinePath(240, 60)).toMatch(/^M.*Z$/);
      expect(pillOutlinePath(0, 60)).toBe("");
    });
  });

  describe("masks", () => {
    it("fills the outline in a box of the element's own size", () => {
      const svg = decode(pillMaskImage(240, 60));
      expect(svg).toContain('viewBox="0 0 240 60"');
      expect(svg).toContain('preserveAspectRatio="none"');
      expect(svg).toContain(`<path d="${pillOutlinePath(240, 60)}"/>`);
    });

    it("strokes a band of the border width inside the outline", () => {
      const svg = decode(pillRingMaskImage(240, 60, 3, "solid") as string);
      // Doubled and clipped, as the worklet does it.
      expect(svg).toContain('stroke-width="6"');
      expect(svg).toContain('clip-path="url(#c)"');
      expect(svg).not.toContain("stroke-dasharray");
    });

    it("dashes the band the way the worklet does", () => {
      expect(decode(pillRingMaskImage(240, 60, 2, "dashed") as string)).toContain(
        'stroke-dasharray="6 4"',
      );
      expect(decode(pillRingMaskImage(240, 60, 2, "dotted") as string)).toContain(
        'stroke-dasharray="2 4"',
      );
    });

    it("draws no ring without a width, or for none and hidden", () => {
      expect(pillRingMaskImage(240, 60, 0, "solid")).toBeNull();
      expect(pillRingMaskImage(240, 60, 3, "none")).toBeNull();
      expect(pillRingMaskImage(240, 60, 3, " hidden ")).toBeNull();
    });
  });
});
