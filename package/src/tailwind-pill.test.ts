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
  PILL_BOX_SHADOW_VAR_NAME,
  PILL_CLIP_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
  PILL_DECORATED_VAR_NAME,
  PILL_DECORATION_VAR_NAME,
  PILL_EASE_SPREAD_VAR_NAME,
  PILL_POLYFILL_ATTRIBUTE,
  PILL_REACH_VAR_NAME,
  PILL_RING_COLOR_VAR_NAME,
  PILL_WORKLET_ATTRIBUTE,
} from "./variants";

const { compilePlugin, compilePluginAll } = createCompiler(import.meta.dirname);
const compilePill = (candidates: string[], block = "") =>
  compilePlugin(candidates, block, "./tailwind-pill.ts");
const compilePillAll = (candidates: string[], block = "") =>
  compilePluginAll(candidates, block, "./tailwind-pill.ts");

const LOADED = `:where(:root[${PILL_WORKLET_ATTRIBUTE}]) &`;

describe("tailwind-pill.ts utilities", () => {
  it("shapes a copy of the background once the worklet has loaded", async () => {
    const css = await compilePill(["squircle-pill"]);
    expect(css).toContain(`${LOADED} {`);
    const before = css.slice(css.indexOf("&::before"));
    expect(before).toContain("background: inherit");
    expect(before).toMatch(/[^-]mask-image: paint\(pill-shape\);/);
    expect(before).toMatch(/-webkit-mask-image: paint\(pill-shape\);/);
    expect(css).toContain("background: paint(pill-decoration)");
  });

  it("never gates on @supports alone", async () => {
    // `@supports (mask-image: paint(pill-shape))` is true for any paint
    // name, loaded or not, so a mask gated on it alone would erase every
    // pill's background the moment the worklet failed to load.
    const css = await compilePill(["squircle-pill"]);
    expect(css).not.toContain("@supports");
  });

  it("hides the element's own background and box shadows, on a doubled selector", async () => {
    // Painted into the stadium `border-radius`, they would show as a hairline
    // just outside the pill. Doubled, so a `bg-*` or `shadow-*` utility,
    // emitted after the pill, cannot bring them back.
    const css = await compilePill(["squircle-pill"]);
    const own = css.slice(
      css.indexOf(
        `:where(:root[${PILL_WORKLET_ATTRIBUTE}], :root[${PILL_POLYFILL_ATTRIBUTE}]) && {`,
      ),
    );
    const block = own.slice(0, own.indexOf("}"));
    expect(block).toContain("background-clip: text");
    expect(block).toContain("box-shadow: none");
  });

  it("leaves masks and clip-paths on the element to Tailwind", async () => {
    // The shape is on the copy of the background, so `mask-*` and
    // `clip-path` utilities apply to the whole pill as they would anywhere.
    const css = await compilePill(["squircle-pill", "mask-b-from-50%"]);
    const pill = css.slice(css.indexOf(".squircle-pill {"), css.indexOf(".mask-b-from-50\\%"));
    // Everything but the pill's own pseudo-elements.
    const element = pill.replace(/&::(?:before|after) \{[^}]*\}/g, "");
    expect(element).not.toMatch(/mask|clip-path/);
  });

  it("draws its decoration on ::after, over a box grown by its reach", async () => {
    // A CSS border would follow the stadium, so the pill draws its own along
    // its outline, outside the room the real border reserves.
    const css = await compilePill(["squircle-pill"]);
    expect(css).toContain("&::after");
    expect(css).toContain(
      `inset: calc(-1 * (var(${PILL_BORDER_WIDTH_VAR_NAME}) + var(${PILL_REACH_VAR_NAME})))`,
    );
    // Only where `tailwind-pill-border` saw a utility that draws something.
    expect(css).toContain(`content: var(${PILL_DECORATED_VAR_NAME}, "")`);
    expect(css).toContain("border-color: transparent");
  });

  it("hands the pseudo-elements the element's values by inheritance alone", async () => {
    // WebKit never restyles a pseudo-element when a non-inheriting property
    // it pulls down with `inherit` changes.
    const css = await compilePill(["squircle-pill"]);
    expect(css).not.toMatch(/--[\w-]+: inherit/);
  });

  it("bridges Tailwind's variables into the pill's own, on the element", async () => {
    // Where a utility exposes a variable, read it rather than asking for a
    // second source of truth. Tailwind registers these as non-inheriting, so
    // they are mapped where they are set and the pseudo-elements inherit the
    // result.
    const css = await compilePill(["squircle-pill"]);
    const own = /:where\(&\) \{([^}]*)\}/.exec(css)?.[1];
    expect(own).toContain(`${PILL_BORDER_STYLE_VAR_NAME}: var(--tw-border-style, solid)`);
    expect(own).toContain(`${PILL_RING_COLOR_VAR_NAME}: var(--tw-ring-color, currentColor)`);
    expect(own).toContain(
      `${PILL_BOX_SHADOW_VAR_NAME}: var(--tw-inset-shadow, 0 0 #0000), var(--tw-inset-ring-shadow, 0 0 #0000), var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow, 0 0 #0000)`,
    );
  });

  it("starts each pill with no decoration of its own, at zero specificity", async () => {
    // Same default colour a real border has, so `border-2` alone draws a
    // visible border, and a value set any other way wins whatever the order;
    // the reset keeps a pill nested in a bordered one from drawing its
    // parent's border.
    const css = await compilePill(["squircle-pill"]);
    const own = /:where\(&\) \{([^}]*)\}/.exec(css)?.[1];
    expect(own).toContain(`${PILL_BORDER_WIDTH_VAR_NAME}: 0px;`);
    expect(own).toContain(`${PILL_BORDER_COLOR_VAR_NAME}: currentColor;`);
    expect(own).toContain(`${PILL_CLIP_VAR_NAME}: initial;`);
    expect(own).toContain(`${PILL_DECORATION_VAR_NAME}: initial;`);
  });

  it("shapes with a clip under the polyfill, on the copy of the background", async () => {
    const css = await compilePill(["squircle-pill"]);
    const branch = css.slice(css.indexOf(`:where(:root[${PILL_POLYFILL_ATTRIBUTE}]) & {`));
    const before = branch.slice(branch.indexOf("&::before"));
    expect(before.slice(0, before.indexOf("}"))).toContain(
      `clip-path: var(${PILL_CLIP_VAR_NAME}, none)`,
    );
    expect(branch).toContain(`background-image: var(${PILL_DECORATION_VAR_NAME}, none)`);
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
