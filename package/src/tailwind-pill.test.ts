/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import { createCompiler } from "./test-utils";
import {
  FULL_RADIUS,
  PILL_AMT_VAR_NAME,
  PILL_BORDER_COLOR_VAR_NAME,
  PILL_BORDER_STYLE_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
  PILL_EASE_SPREAD_VAR_NAME,
  PILL_POLYFILL_ATTRIBUTE,
  PILL_STROKE_WIDTH_VAR_NAME,
  PILL_WORKLET_ATTRIBUTE,
} from "./variants";

const { compilePlugin, compilePluginAll } = createCompiler(import.meta.dirname);
const compilePill = (candidates: string[], block = "") =>
  compilePlugin(candidates, block, "./tailwind-pill.ts");
const compilePillAll = (candidates: string[], block = "") =>
  compilePluginAll(candidates, block, "./tailwind-pill.ts");

const LOADED = `:where(:root[${PILL_WORKLET_ATTRIBUTE}]) &`;

describe("tailwind-pill.ts utilities", () => {
  it("masks the element to the pill once the worklet has loaded", async () => {
    const css = await compilePill(["squircle-pill"]);
    expect(css).toContain(`${LOADED} {`);
    expect(css).toContain("mask-image: paint(pill-shape)");
    expect(css).toContain("-webkit-mask-image: paint(pill-shape)");
  });

  it("never gates on @supports alone", async () => {
    // `@supports (mask-image: paint(pill-shape))` is true for any paint
    // name, loaded or not, so a mask gated on it alone would erase every
    // pill the moment the worklet failed to load.
    const css = await compilePill(["squircle-pill"]);
    expect(css).not.toContain("@supports");
  });

  it("never paints the shape as a background", async () => {
    // A painted background covers whatever background the element already had.
    // Masking keeps the element's own background — colour, gradient, image —
    // and shapes that instead.
    const css = await compilePill(["squircle-pill"]);
    expect(css).not.toContain("background-image: paint(");
  });

  it("draws a border the shape can actually follow", async () => {
    // A CSS border would be a stadium ring clipped to the pill, so the
    // worklet strokes one on ::after instead, grown back out over the room
    // the real border reserves.
    const css = await compilePill(["squircle-pill"]);
    expect(css).toContain("&::after");
    expect(css).toContain(`${PILL_STROKE_WIDTH_VAR_NAME}: var(${PILL_BORDER_WIDTH_VAR_NAME})`);
    expect(css).toContain(`inset: calc(-1 * var(${PILL_BORDER_WIDTH_VAR_NAME}))`);
    expect(css).toContain(`background: var(${PILL_BORDER_COLOR_VAR_NAME})`);
    expect(css).toContain("border-color: transparent");
  });

  it("hands the ring the element's own values", async () => {
    // The registrations are non-inheriting, so without this the ring would
    // be drawn to the default shape while the element is masked to a custom
    // one.
    const css = await compilePill(["squircle-pill"]);
    const ring = css.slice(css.indexOf("&::after"));
    for (const name of [
      PILL_AMT_VAR_NAME,
      PILL_EASE_SPREAD_VAR_NAME,
      PILL_CONTINUITY_VAR_NAME,
      PILL_BORDER_WIDTH_VAR_NAME,
      PILL_BORDER_COLOR_VAR_NAME,
    ]) {
      expect(ring).toContain(`${name}: inherit`);
    }
  });

  it("bridges Tailwind's border style variable into the pill's own", async () => {
    // Where a utility exposes a variable, read it rather than asking for a
    // second source of truth. Tailwind registers --tw-border-style as
    // non-inheriting, so the explicit `inherit` is load-bearing.
    const css = await compilePill(["squircle-pill"]);
    expect(css).toContain("--tw-border-style: inherit");
    expect(css).toContain(`${PILL_BORDER_STYLE_VAR_NAME}: var(--tw-border-style, solid)`);
  });

  it("defaults the border colour to currentColor at zero specificity", async () => {
    // Same default a real border has, so `border-2` alone draws a visible
    // ring; and a colour set any other way wins whatever the order.
    const css = await compilePill(["squircle-pill"]);
    expect(css).toMatch(
      new RegExp(`:where\\(&\\) \\{\\s*${PILL_BORDER_COLOR_VAR_NAME}: currentColor;`),
    );
  });

  describe("combined with Tailwind's mask utilities", () => {
    it("lists Tailwind's mask layers after its own shape, intersected", async () => {
      // `mask-b-from-50%` and friends fill these three layers; listing them
      // keeps the pill shape when one is used, and the fallbacks keep the
      // mask valid where Tailwind never registered them.
      const css = await compilePill(["squircle-pill"]);
      expect(css).toContain(
        "mask-image: paint(pill-shape), var(--tw-mask-linear, linear-gradient(#fff, #fff)), var(--tw-mask-radial, linear-gradient(#fff, #fff)), var(--tw-mask-conic, linear-gradient(#fff, #fff))",
      );
      expect(css).toContain("mask-composite: intersect");
      expect(css).toContain("-webkit-mask-composite: source-in");
    });

    it("sets the shape on a doubled selector, so a mask utility cannot replace it", async () => {
      // Tailwind emits its mask utilities after the pill, at single-class
      // specificity; equal specificity would let the later one win outright.
      const css = await compilePill(["squircle-pill", "mask-b-from-50%"]);
      const shape = css.indexOf("mask-image: paint(pill-shape), var(--tw-mask-linear");
      expect(
        css.lastIndexOf(`:where(:root[${PILL_WORKLET_ATTRIBUTE}]) && {`, shape),
      ).toBeGreaterThan(-1);
      expect(css.indexOf(".mask-b-from-50\\%")).toBeGreaterThan(shape);
    });

    it("shapes with a clip under the polyfill, leaving mask-image to Tailwind", async () => {
      const css = await compilePill(["squircle-pill"]);
      const branch = css.slice(css.indexOf(`:where(:root[${PILL_POLYFILL_ATTRIBUTE}]) && {`));
      expect(branch).toContain("clip-path: var(");
      expect(branch.slice(0, branch.indexOf("}"))).not.toContain("mask-image");
    });
  });

  describe("the stadium underneath", () => {
    it("is a plain fully-rounded rectangle on every branch", async () => {
      // The whole fallback without the worklet — the same radius the `-full`
      // utilities use, matching `rounded-full` — and, with it, the shape
      // native inset decorations follow before the mask trims them.
      const css = await compilePill(["squircle-pill"]);
      expect(css).toMatch(
        new RegExp(
          `\\.squircle-pill \\{\\s*border-radius: ${FULL_RADIUS.replace(/[()*]/g, "\\$&")}`,
        ),
      );
    });

    it("never reshapes the corner", async () => {
      // On a pill the cap is the whole shape, so a superellipse changes the
      // silhouette rather than softening a corner — it reads worse than a
      // plain stadium.
      const css = await compilePill(["squircle-pill"]);
      expect(css).not.toContain("corner-shape");
      expect(css).not.toContain("superellipse");
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
      expect(css).not.toContain("data-squircle-pill:");
    });

    it("registers the properties the pill reads", async () => {
      // Without this the class alone would leave them unregistered, so they
      // could not be typed, animated, or resolved to px for the worklet.
      const css = await compilePillAll(["squircle-pill"]);
      for (const name of [
        PILL_AMT_VAR_NAME,
        PILL_EASE_SPREAD_VAR_NAME,
        PILL_CONTINUITY_VAR_NAME,
        PILL_BORDER_WIDTH_VAR_NAME,
        PILL_BORDER_COLOR_VAR_NAME,
      ]) {
        expect(css).toContain(`@property ${name}`);
      }
      expect(css).toContain("initial-value: 2");
      expect(css).toContain("initial-value: 1");
      expect(css).toContain("initial-value: 0px");
    });

    it("gives the worklet an area to paint", async () => {
      const css = await compilePill(["squircle-pill"]);
      expect(css).toContain("min-width: 1px");
      expect(css).toContain("min-height: 1px");
    });
  });

  describe("one shape, two knobs", () => {
    it("has no size or side variants", async () => {
      // A pill's caps are derived from its own size, and a mask has no
      // per-side meaning, so there is nothing for such a variant to set. The
      // border plugin scopes to `.squircle-pill` alone, so a copy under
      // another name would also silently lose its border.
      const css = await compilePill([
        "squircle-pill-t",
        "squircle-pill-tl",
        "squircle-pill-ss",
        "squircle-pill-md",
        "squircle-pill-full",
      ]);
      expect(css).toBe("");
    });

    it("sets the amount, bare or arbitrary, and nothing else", async () => {
      const css = await compilePill(["squircle-pill-amt-3", "squircle-pill-amt-[2.5]"]);
      expect(css).toContain(`${PILL_AMT_VAR_NAME}: 3`);
      expect(css).toContain(`${PILL_AMT_VAR_NAME}: 2.5`);
      expect(css).not.toContain("mask-image");
    });

    it("sets the spread, bare or arbitrary, and nothing else", async () => {
      const css = await compilePill(["squircle-pill-spread-4", "squircle-pill-spread-[0.5]"]);
      expect(css).toContain(`${PILL_EASE_SPREAD_VAR_NAME}: 4`);
      expect(css).toContain(`${PILL_EASE_SPREAD_VAR_NAME}: 0.5`);
      expect(css).not.toContain("mask-image");
    });

    it("switches continuity with -g2 and -g3, and nothing else", async () => {
      const css = await compilePill(["squircle-pill-g2", "squircle-pill-g3"]);
      expect(css).toContain(`${PILL_CONTINUITY_VAR_NAME}: 2`);
      expect(css).toContain(`${PILL_CONTINUITY_VAR_NAME}: 3`);
      expect(css).not.toContain("mask-image");
    });

    it("rejects values that are not numbers", async () => {
      for (const candidate of [
        "squircle-pill-amt-[1em]",
        "squircle-pill-amt-foo",
        "squircle-pill-amt-(--my-amt)",
        "squircle-pill-spread-[1px]",
      ]) {
        expect(await compilePill([candidate]), candidate).toBe("");
      }
    });
  });

  it("honours a custom prefix", async () => {
    const css = await compilePill(["pillbox", "pillbox-amt-3"], 'prefix: "pillbox";');
    expect(css).toContain(".pillbox");
    expect(css).toContain(`border-radius: ${FULL_RADIUS}`);
    expect(css).toContain(`${PILL_AMT_VAR_NAME}: 3`);
  });
});
