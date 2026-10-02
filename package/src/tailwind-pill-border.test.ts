/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import { shadowReach } from "./tailwind-pill-border";
import { createCompiler } from "./test-utils";
import {
  PILL_BORDER_COLOR_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_DECORATED_VAR_NAME,
  PILL_INSET_RING_WIDTH_VAR_NAME,
  PILL_OUTLINE_COLOR_VAR_NAME,
  PILL_OUTLINE_OFFSET_VAR_NAME,
  PILL_OUTLINE_WIDTH_VAR_NAME,
  PILL_POLYFILL_ATTRIBUTE,
  PILL_RING_WIDTH_VAR_NAME,
  PILL_SHADOW_REACH_VAR_NAME,
  PILL_WORKLET_ATTRIBUTE,
} from "./variants";

const { compilePlugin } = createCompiler(import.meta.dirname);
const compileBorder = (candidates: string[], block = "") =>
  compilePlugin(candidates, block, "./tailwind-pill-border.ts");

const LOADED = `:where(:root[${PILL_WORKLET_ATTRIBUTE}], :root[${PILL_POLYFILL_ATTRIBUTE}]) &:is(.squircle-pill)`;

describe("tailwind-pill-border.ts", () => {
  describe("extends rather than replaces", () => {
    it("leaves Tailwind's own border-width output intact", async () => {
      const css = await compileBorder(["border-2"]);
      expect(css).toContain("border-width: 2px");
      expect(css).toContain(`${PILL_BORDER_WIDTH_VAR_NAME}: 2px`);
    });

    it("leaves Tailwind's own border-color output intact", async () => {
      const css = await compileBorder(["border-red-500"]);
      expect(css).toContain("border-color: var(--color-red-500)");
      expect(css).toContain(`${PILL_BORDER_COLOR_VAR_NAME}:`);
    });

    it("does not disturb utilities it has no values for", async () => {
      // `border-dashed` is a style, and this plugin registers only widths and
      // colours, so it must fall through to Tailwind untouched.
      const css = await compileBorder(["border-dashed"]);
      expect(css).toContain("--tw-border-style: dashed");
      expect(css).not.toContain(`${PILL_BORDER_WIDTH_VAR_NAME}: dashed`);
      expect(css).not.toContain(`${PILL_BORDER_COLOR_VAR_NAME}: dashed`);
    });

    it("covers arbitrary values without enumerating them", async () => {
      const css = await compileBorder(["border-[3px]"]);
      expect(css).toContain(`${PILL_BORDER_WIDTH_VAR_NAME}: 3px`);
    });

    it("passes a length through in its own unit", async () => {
      // The pill registers its width as a `<length>`, so the browser is what
      // resolves this to px before the worklet sees it.
      const css = await compileBorder(["border-[0.25rem]"]);
      expect(css).toContain(`${PILL_BORDER_WIDTH_VAR_NAME}: 0.25rem`);
    });

    it("never takes a paren reference for a width", async () => {
      // Tailwind resolves `border-(--x)` as a colour. Registered as a width
      // as well, the worklet would be handed a colour to parse as a length.
      const css = await compileBorder(["border-(--x)"]);
      expect(css).toContain("border-color: var(--x)");
      expect(css).not.toContain(PILL_BORDER_WIDTH_VAR_NAME);
    });
  });

  describe("scoping", () => {
    it("only touches elements that are pills", async () => {
      // A border utility has to keep behaving normally everywhere else.
      const css = await compileBorder(["border-2", "border-red-500"]);
      expect(css).toContain("&:is(.squircle-pill)");
      // The pill vars never appear unscoped.
      for (const line of css.split("\n")) {
        if (
          line.includes(PILL_BORDER_WIDTH_VAR_NAME) ||
          line.includes(PILL_BORDER_COLOR_VAR_NAME)
        ) {
          expect(css.indexOf("&:is(.squircle-pill)")).toBeLessThan(css.indexOf(line));
        }
      }
    });

    it("suppresses the real border's paint only once the worklet or polyfill draws", async () => {
      // Without the worklet the real border is the pill's border, a stadium
      // ring on the fallback shape, and has to keep painting.
      const css = await compileBorder(["border-red-500"]);
      expect(css).toContain(`${LOADED} {\n      border-color: transparent;`);
      const suppressions = [...css.matchAll(/border-color: transparent/g)].length;
      const gated = [
        ...css.matchAll(
          new RegExp(
            `:where\\(:root\\[${PILL_WORKLET_ATTRIBUTE}\\], :root\\[${PILL_POLYFILL_ATTRIBUTE}\\]\\)`,
            "g",
          ),
        ),
      ].length;
      expect(suppressions).toBe(gated);
    });

    it("suppresses it for a width as well as a colour", async () => {
      // `border-2` alone is a visible border — Tailwind's default colour is
      // currentColor — so a width alone must suppress the real one too, or it
      // paints a stadium ring around the drawn one.
      const css = await compileBorder(["border-2"]);
      expect(css).toContain(`${LOADED} {\n      border-color: transparent;`);
    });

    it("honours a custom prefix", async () => {
      const css = await compileBorder(["border-2"], 'prefix: "pillbox";');
      expect(css).toContain("&:is(.pillbox)");
      // The gate is the namespaced attribute, not the class, so it stays.
      expect(css).not.toContain(".squircle-pill");
    });
  });

  describe("outlines and rings", () => {
    const ruleFor = (css: string, selector: string) => {
      const start = css.lastIndexOf(`${selector} {\n    &:is(.squircle-pill)`);
      return start === -1 ? "" : css.slice(start, css.indexOf("\n  }\n", start));
    };

    it("mirrors outline width, colour and offset onto pills, negative offsets included", async () => {
      const css = await compileBorder([
        "outline",
        "outline-2",
        "outline-3",
        "outline-white",
        "outline-offset-4",
        "-outline-offset-2",
      ]);
      expect(ruleFor(css, ".outline")).toContain(`${PILL_OUTLINE_WIDTH_VAR_NAME}: 1px`);
      expect(ruleFor(css, ".outline-2")).toContain(`${PILL_OUTLINE_WIDTH_VAR_NAME}: 2px`);
      expect(ruleFor(css, ".outline-3")).toContain(`${PILL_OUTLINE_WIDTH_VAR_NAME}: 3px`);
      expect(ruleFor(css, ".outline-white")).toContain(`${PILL_OUTLINE_COLOR_VAR_NAME}:`);
      expect(ruleFor(css, ".outline-offset-4")).toContain(`${PILL_OUTLINE_OFFSET_VAR_NAME}: 4px`);
      expect(css).toContain(`${PILL_OUTLINE_OFFSET_VAR_NAME}: calc(2px * -1)`);
      // Tailwind's own outline is still emitted, for everything that isn't a pill.
      expect(css).toContain("outline-width: 2px");
    });

    it("keeps the native outline from painting on pills only while the pill draws one", async () => {
      const css = await compileBorder(["outline-2", "outline-offset-4"]);
      const width = ruleFor(css, ".outline-2");
      expect(width).toContain(`${LOADED} {\n      outline-color: transparent;`);
      // An offset alone paints nothing to suppress.
      expect(ruleFor(css, ".outline-offset-4")).not.toContain("outline-color");
    });

    it("mirrors ring and inset ring widths, with v4's 1px for a bare ring", async () => {
      const css = await compileBorder(["ring", "ring-2", "ring-[3px]", "inset-ring-2"]);
      expect(ruleFor(css, ".ring")).toContain(`${PILL_RING_WIDTH_VAR_NAME}: 1px`);
      expect(ruleFor(css, ".ring-2")).toContain(`${PILL_RING_WIDTH_VAR_NAME}: 2px`);
      expect(css).toContain(`${PILL_RING_WIDTH_VAR_NAME}: 3px`);
      expect(ruleFor(css, ".inset-ring-2")).toContain(`${PILL_INSET_RING_WIDTH_VAR_NAME}: 2px`);
    });

    it("empties the native ring shadows on pills, leaving other shadows alone", async () => {
      const css = await compileBorder(["ring-2", "inset-ring-2", "shadow-lg"]);
      const ring = ruleFor(css, ".ring-2");
      expect(ring).toContain("--tw-ring-shadow: 0 0 #0000");
      expect(ring).toContain("--tw-ring-offset-shadow: 0 0 #0000");
      expect(ring).not.toContain("--tw-shadow:");
      expect(ruleFor(css, ".inset-ring-2")).toContain("--tw-inset-ring-shadow: 0 0 #0000");
    });

    it("follows variants, so focus rings are drawn along the pill too", async () => {
      const css = await compileBorder(["focus-visible:ring-2"]);
      expect(css).toMatch(
        new RegExp(
          `&:focus-visible \\{\\s*&:is\\(\\.squircle-pill\\) \\{\\s*${PILL_RING_WIDTH_VAR_NAME}: 2px`,
        ),
      );
    });

    it("leaves ring colours to Tailwind's variables, which the pill reads", async () => {
      const css = await compileBorder(["ring-white", "ring-offset-2"]);
      expect(css).toContain("--tw-ring-color:");
      expect(css).not.toContain(`${PILL_RING_WIDTH_VAR_NAME}: white`);
    });
  });

  describe("shadows", () => {
    it("tells the decoration how far a shadow reaches, and gives the pill one", async () => {
      const css = await compileBorder(["shadow-lg", "shadow-none", "shadow-[0_0_0_3px_red]"]);
      // 0 10px 15px -3px, 0 4px 6px -4px: 10 + 15 - 3.
      expect(css).toMatch(
        new RegExp(
          `\\.shadow-lg \\{\\s*&:is\\(\\.squircle-pill\\) \\{\\s*${PILL_SHADOW_REACH_VAR_NAME}: 22px;\\s*${PILL_DECORATED_VAR_NAME}: "";`,
        ),
      );
      expect(css).toMatch(
        new RegExp(
          `\\.shadow-none \\{\\s*&:is\\(\\.squircle-pill\\) \\{\\s*${PILL_SHADOW_REACH_VAR_NAME}: 0px`,
        ),
      );
      expect(css).toContain(`${PILL_SHADOW_REACH_VAR_NAME}: 3px`);
      // Tailwind's own shadow is untouched: the pill reads its variables.
      expect(css).toContain("--tw-shadow:");
    });

    it("leaves shadow colours alone", async () => {
      const css = await compileBorder(["shadow-black/60"]);
      expect(css).not.toContain(PILL_SHADOW_REACH_VAR_NAME);
    });

    it("gives only decorated pills an ::after", async () => {
      const css = await compileBorder(["border-2", "outline-2", "ring-2", "inset-ring-2"]);
      expect(css).toContain(`.squircle-pill {\n    ${PILL_DECORATED_VAR_NAME}: none;`);
      expect([...css.matchAll(new RegExp(`${PILL_DECORATED_VAR_NAME}: ""`, "g"))]).toHaveLength(4);
      // A colour alone draws nothing.
      expect(await compileBorder(["border-red-500"])).not.toContain(
        `${PILL_DECORATED_VAR_NAME}: ""`,
      );
    });
  });

  it("measures shadow reach from offset, blur and spread, ignoring inset ones", () => {
    expect(shadowReach("0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)")).toBe(4);
    expect(shadowReach("-8px 2px 4px 2px red")).toBe(14);
    expect(shadowReach("inset 0 2px 4px black")).toBe(0);
    expect(shadowReach("0 0 0 0.25rem var(--c, rgb(0 0 0))")).toBe(4);
    expect(shadowReach("0 0 #0000")).toBe(0);
  });
});
