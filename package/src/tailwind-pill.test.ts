/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import { createCompiler } from "./test-utils";
import { FULL_RADIUS } from "./variants";

const { compilePlugin, compilePluginAll } = createCompiler(import.meta.dirname);
const compilePill = (candidates: string[], block = "") =>
  compilePlugin(candidates, block, "./tailwind-pill.ts");
const compilePillAll = (candidates: string[], block = "") =>
  compilePluginAll(candidates, block, "./tailwind-pill.ts");

describe("tailwind-pill.ts utilities", () => {
  it("paints the pill where the worklet is available", async () => {
    const css = await compilePill(["squircle-pill"]);
    expect(css).toContain("@supports (background-image: paint(pill-shape))");
    expect(css).toContain("background-image: paint(pill-shape)");
  });

  describe("fallback without the paint worklet", () => {
    it("is a plain fully-rounded rectangle", async () => {
      const css = await compilePill(["squircle-pill"]);
      expect(css).toContain("@supports not (background-image: paint(pill-shape))");
      // The same radius the `-full` utilities use, matching `rounded-full`.
      expect(css).toContain(`border-radius: ${FULL_RADIUS}`);
    });

    it("never reshapes the corner", async () => {
      // On a pill the cap is the whole shape, so a superellipse changes the
      // silhouette rather than softening a corner — it reads worse than a
      // plain stadium.
      const css = await compilePill(["squircle-pill"]);
      expect(css).not.toContain("corner-shape");
      expect(css).not.toContain("superellipse");
    });

    it("does not require corner-shape support to apply", async () => {
      // Gating on corner-shape left browsers with neither feature square.
      const css = await compilePill(["squircle-pill"]);
      expect(css).not.toContain("@supports (corner-shape");
    });

    it("never falls back to a percentage radius", async () => {
      // `50%` is an ellipse on any non-square element.
      const css = await compilePill(["squircle-pill"]);
      expect(css).not.toContain("border-radius: 50%");
    });
  });

  describe("standing on its own", () => {
    it("emits no declaration that pretends to set an attribute", async () => {
      // A stylesheet cannot set an attribute, so `data-squircle-pill: ;` was
      // inert: it could never make squircle-pill.css's `[data-squircle-pill]`
      // rules match an element that only carries the class.
      const css = await compilePill(["squircle-pill"]);
      expect(css).not.toContain("data-squircle-pill");
    });

    it("registers the properties the worklet reads", async () => {
      // Without this the class alone would leave them unregistered, so they
      // could not be typed or animated.
      const css = await compilePillAll(["squircle-pill"]);
      expect(css).toContain("@property --pill-squircle-amt");
      expect(css).toContain("@property --pill-ease-spread");
      expect(css).toContain("initial-value: 2");
      expect(css).toContain("initial-value: 1");
    });

    it("gives the worklet an area to paint", async () => {
      const css = await compilePill(["squircle-pill"]);
      expect(css).toContain("min-width: 1px");
      expect(css).toContain("min-height: 1px");
    });
  });

  it("honours a custom prefix", async () => {
    const css = await compilePill(["pillbox"], 'prefix: "pillbox";');
    expect(css).toContain(".pillbox");
    expect(css).toContain(`border-radius: ${FULL_RADIUS}`);
  });
});
