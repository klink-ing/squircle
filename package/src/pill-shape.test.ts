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
  PILL_EASE_SPREAD_VAR_NAME,
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
      "color",
      "--pill-fill",
      PILL_AMT_VAR_NAME,
      PILL_EASE_SPREAD_VAR_NAME,
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

    it("leaves --pill-fill unregistered on purpose", () => {
      // A registered property always resolves to its initial value when unset,
      // which would mean the worklet could never tell "no fill given" from a
      // real one, and the fall back to the element's `color` would never fire.
      expect(registeredProperties(stylesheet)).not.toContain("--pill-fill");
    });

    it("starts the properties where the worklet's own fallbacks do", () => {
      expect(initialValueOf(stylesheet, PILL_AMT_VAR_NAME)).toBe(String(DEFAULT_PILL_AMT));
      expect(initialValueOf(stylesheet, PILL_EASE_SPREAD_VAR_NAME)).toBe(
        String(DEFAULT_PILL_EASE_SPREAD),
      );
    });

    it("assigns no custom property the worklet does not read", () => {
      // Catches leftovers like `--pill-width: 100%` that outlived the paint
      // function that once consumed them.
      const assigned = [...stylesheet.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]);
      for (const name of assigned) {
        expect(customInputs, `${name} is assigned but never read`).toContain(name);
      }
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
