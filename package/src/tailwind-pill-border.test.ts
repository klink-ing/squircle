/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import { createCompiler } from "./test-utils";

const { compilePlugin } = createCompiler(import.meta.dirname);
const compileBorder = (candidates: string[], block = "") =>
  compilePlugin(candidates, block, "./tailwind-pill-border.ts");

describe("tailwind-pill-border.ts", () => {
  describe("extends rather than replaces", () => {
    it("leaves Tailwind's own border-width output intact", async () => {
      const css = await compileBorder(["border-2"]);
      expect(css).toContain("border-width: 2px");
      expect(css).toContain("--pill-border-width: 2px");
    });

    it("leaves Tailwind's own border-color output intact", async () => {
      const css = await compileBorder(["border-red-500"]);
      expect(css).toContain("border-color: var(--color-red-500)");
      expect(css).toContain("--pill-border-color:");
    });

    it("does not disturb utilities it has no values for", async () => {
      // `border-dashed` is a style, and this plugin registers only widths and
      // colours, so it must fall through to Tailwind untouched.
      const css = await compileBorder(["border-dashed"]);
      expect(css).toContain("--tw-border-style: dashed");
      expect(css).not.toContain("--pill-border-width: dashed");
      expect(css).not.toContain("--pill-border-color: dashed");
    });

    it("covers arbitrary values without enumerating them", async () => {
      const css = await compileBorder(["border-[3px]"]);
      expect(css).toContain("--pill-border-width: 3px");
    });
  });

  describe("scoping", () => {
    it("only touches elements that are pills", async () => {
      // A border utility has to keep behaving normally everywhere else.
      const css = await compileBorder(["border-2", "border-red-500"]);
      expect(css).toContain("&:is(.squircle-pill)");
      // The pill vars never appear unscoped.
      for (const line of css.split("\n")) {
        if (line.includes("--pill-border")) {
          expect(css.indexOf("&:is(.squircle-pill)")).toBeLessThan(css.indexOf(line));
        }
      }
    });

    it("suppresses the real border's paint on pills only", async () => {
      // Under the mask a real border is a rectangle clipped to the pill.
      const css = await compileBorder(["border-red-500"]);
      const scoped = css.slice(css.indexOf("&:is(.squircle-pill)"));
      expect(scoped).toContain("border-color: transparent");
    });

    it("honours a custom prefix", async () => {
      const css = await compileBorder(["border-2"], 'prefix: "pillbox";');
      expect(css).toContain("&:is(.pillbox)");
    });
  });
});
