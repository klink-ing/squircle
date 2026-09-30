/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import { createCompiler } from "./test-utils";
import {
  PILL_BORDER_COLOR_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_WORKLET_ATTRIBUTE,
} from "./variants";

const { compilePlugin } = createCompiler(import.meta.dirname);
const compileBorder = (candidates: string[], block = "") =>
  compilePlugin(candidates, block, "./tailwind-pill-border.ts");

const LOADED = `:where(:root[${PILL_WORKLET_ATTRIBUTE}]) &:is(.squircle-pill)`;

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

    it("suppresses the real border's paint only once the worklet has loaded", async () => {
      // Without the worklet the real border is the pill's border, a stadium
      // ring on the fallback shape, and has to keep painting.
      const css = await compileBorder(["border-red-500"]);
      expect(css).toContain(`${LOADED} {\n      border-color: transparent;`);
      const suppressions = [...css.matchAll(/border-color: transparent/g)].length;
      const gated = [
        ...css.matchAll(new RegExp(`:where\\(:root\\[${PILL_WORKLET_ATTRIBUTE}\\]\\)`, "g")),
      ].length;
      expect(suppressions).toBe(gated);
    });

    it("suppresses it for a width as well as a colour", async () => {
      // `border-2` alone is a visible border — Tailwind's default colour is
      // currentColor — so a width alone must suppress the real one too, or it
      // paints under the mask as a stadium ring while the drawn ring sits on
      // top of it.
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
});
