/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { paintDef } from "./pill-shape.worklet";
import {
  DEFAULT_PILL_AMT,
  DEFAULT_PILL_EASE_SPREAD,
  PILL_AMT_VAR_NAME,
  PILL_BORDER_STYLE_VAR_NAME,
  PILL_EASE_SPREAD_VAR_NAME,
  PILL_STROKE_WIDTH_VAR_NAME,
} from "./variants";

const stylesheet = readFileSync(join(import.meta.dirname, "squircle-pill.css"), "utf-8");

const registeredProperties = (css: string): string[] =>
  [...css.matchAll(/@property\s+(--[\w-]+)/g)].map((m) => m[1]);

const initialValueOf = (css: string, name: string): string | undefined =>
  new RegExp(`@property\\s+${name}\\s*\\{[^}]*initial-value:\\s*([^;]+);`).exec(css)?.[1].trim();

const inputProperties = (paintDef as unknown as { inputProperties: string[] }).inputProperties;
const customInputs = inputProperties.filter((p) => p.startsWith("--"));

describe("pill-shape worklet contract", () => {
  it("reads exactly the properties it needs", () => {
    expect(inputProperties).toEqual([
      PILL_AMT_VAR_NAME,
      PILL_EASE_SPREAD_VAR_NAME,
      PILL_STROKE_WIDTH_VAR_NAME,
      PILL_BORDER_STYLE_VAR_NAME,
    ]);
  });

  describe("against squircle-pill.css", () => {
    it("registers every shaping property the worklet reads", () => {
      const registered = registeredProperties(stylesheet);
      for (const name of [PILL_AMT_VAR_NAME, PILL_EASE_SPREAD_VAR_NAME]) {
        expect(registered, `${name} must be registered`).toContain(name);
      }
    });

    it("registers nothing the worklet does not read", () => {
      // Registrations for properties the paint function ignores are dead
      // plumbing: they read as configuration but change nothing.
      for (const name of registeredProperties(stylesheet)) {
        expect(customInputs, `${name} is registered but never read`).toContain(name);
      }
    });

    it("leaves the stroke width unregistered on purpose", () => {
      // The ring sets it inline on ::after. Registering it with an initial
      // value of 0 would be harmless, but registering it as inherited would
      // make every nested pill draw its parent's border.
      expect(registeredProperties(stylesheet)).not.toContain(PILL_STROKE_WIDTH_VAR_NAME);
    });

    it("never paints the shape as a background", () => {
      // Painting it as a background covers whatever background the element
      // already had; masking keeps it and shapes it instead.
      expect(stylesheet).not.toContain("background-image: paint(");
      expect(stylesheet).toContain("mask-image: paint(pill-shape)");
    });

    it("starts the properties where the worklet's own fallbacks do", () => {
      expect(initialValueOf(stylesheet, PILL_AMT_VAR_NAME)).toBe(String(DEFAULT_PILL_AMT));
      expect(initialValueOf(stylesheet, PILL_EASE_SPREAD_VAR_NAME)).toBe(
        String(DEFAULT_PILL_EASE_SPREAD),
      );
    });

    it("assigns no custom property that nothing consumes", () => {
      // Catches leftovers like `--pill-width: 100%` that outlived the paint
      // function that once consumed them. A property is legitimate if the
      // worklet reads it, or if the sheet itself feeds it into one that is
      // read — which is how a framework's variable is bridged across.
      const assigned = [...stylesheet.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]);
      const referenced = new Set([...stylesheet.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));
      for (const name of assigned) {
        const consumed = customInputs.includes(name) || referenced.has(name);
        expect(consumed, `${name} is assigned but nothing consumes it`).toBe(true);
      }
    });

    it("bridges Tailwind's border style variable into the pill's own", () => {
      // Where a utility exposes a variable, read it rather than asking for a
      // second source of truth. Tailwind registers --tw-border-style as
      // non-inheriting, so the explicit `inherit` is load-bearing.
      expect(stylesheet).toContain("--tw-border-style: inherit");
      expect(stylesheet).toContain(`${PILL_BORDER_STYLE_VAR_NAME}: var(--tw-border-style`);
    });
  });

  it("defaults match the shared constants", () => {
    // The worklet is deliberately import-free, so its own fallbacks are
    // duplicated from variants.ts; this is what keeps them from drifting.
    const paintWith = (props: Record<string, string> | undefined) => {
      const vertices: { x: number; y: number }[] = [];
      const ctx = {
        fillStyle: "",
        beginPath() {},
        fill() {},
        closePath() {},
        moveTo: (x: number, y: number) => vertices.push({ x, y }),
        lineTo: (x: number, y: number) => vertices.push({ x, y }),
      };
      const lookup = {
        get: (n: string) => (props?.[n] ? { toString: () => props[n] } : undefined),
      };
      new (paintDef as unknown as new () => {
        paint(c: unknown, s: { width: number; height: number }, p: unknown): void;
      })().paint(ctx, { width: 240, height: 60 }, lookup);
      return vertices;
    };

    expect(paintWith(undefined)).toEqual(
      paintWith({
        [PILL_AMT_VAR_NAME]: String(DEFAULT_PILL_AMT),
        [PILL_EASE_SPREAD_VAR_NAME]: String(DEFAULT_PILL_EASE_SPREAD),
      }),
    );
  });
});
