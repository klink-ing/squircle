import { describe, expect, it } from "vitest";
import { extendTailwindMerge } from "tailwind-merge";
import { squircleMergeConfig } from "./tailwind";
import { createCompiler } from "./test-utils";

const twMerge = extendTailwindMerge(squircleMergeConfig);
const { compileCss, compilePlugin } = createCompiler(import.meta.dirname);

describe("squircleMergeConfig", () => {
  describe("squircle vs squircle", () => {
    it("later value wins within the same group", () => {
      expect(twMerge("squircle-md squircle-lg")).toBe("squircle-lg");
      expect(twMerge("squircle-tl-sm squircle-tl-lg")).toBe("squircle-tl-lg");
    });

    it("all-corners cancels earlier side and corner utilities", () => {
      expect(twMerge("squircle-tl-sm squircle-md")).toBe("squircle-md");
      expect(twMerge("squircle-t-lg squircle-md")).toBe("squircle-md");
      expect(twMerge("squircle-tl-full squircle-none")).toBe("squircle-none");
    });

    it("a single corner does not cancel an earlier all-corners utility", () => {
      expect(twMerge("squircle-md squircle-tl-sm")).toBe("squircle-md squircle-tl-sm");
      expect(twMerge("squircle-md squircle-tl-full")).toBe("squircle-md squircle-tl-full");
    });

    it("a side cancels its own two corners", () => {
      expect(twMerge("squircle-tl-sm squircle-t-lg")).toBe("squircle-t-lg");
      expect(twMerge("squircle-tr-sm squircle-t-lg")).toBe("squircle-t-lg");
      expect(twMerge("squircle-ss-sm squircle-s-lg")).toBe("squircle-s-lg");
    });

    it("a side does not cancel an unrelated corner or an all-corners utility", () => {
      expect(twMerge("squircle-bl-sm squircle-t-lg")).toBe("squircle-bl-sm squircle-t-lg");
      expect(twMerge("squircle-md squircle-t-lg")).toBe("squircle-md squircle-t-lg");
    });

    it("a corner does not cancel a side", () => {
      expect(twMerge("squircle-t-lg squircle-tl-sm")).toBe("squircle-t-lg squircle-tl-sm");
    });
  });

  describe("squircle vs rounded", () => {
    it("all-corners utilities cancel each other across families", () => {
      expect(twMerge("rounded-lg squircle-md")).toBe("squircle-md");
      expect(twMerge("squircle-md rounded-lg")).toBe("rounded-lg");
      expect(twMerge("rounded-full squircle-full")).toBe("squircle-full");
    });

    it("all-corners cancels the other family's sides and corners", () => {
      expect(twMerge("rounded-tl-sm squircle-md")).toBe("squircle-md");
      expect(twMerge("rounded-t-lg squircle-md")).toBe("squircle-md");
      expect(twMerge("squircle-tl-sm rounded-lg")).toBe("rounded-lg");
    });

    it("a narrower utility refines the other family's broader one", () => {
      expect(twMerge("squircle-md rounded-tl-sm")).toBe("squircle-md rounded-tl-sm");
      expect(twMerge("rounded-lg squircle-tl-full")).toBe("rounded-lg squircle-tl-full");
    });

    it("a side cancels the other family's matching side and corners", () => {
      expect(twMerge("squircle-tl-sm rounded-t-lg")).toBe("rounded-t-lg");
      expect(twMerge("rounded-tr-sm squircle-t-none")).toBe("squircle-t-none");
    });

    it("corners cancel only the matching corner across families", () => {
      expect(twMerge("rounded-tl-sm squircle-tl-lg")).toBe("squircle-tl-lg");
      expect(twMerge("rounded-t-lg squircle-tl-sm")).toBe("rounded-t-lg squircle-tl-sm");
    });
  });

  describe("squircle-amt is orthogonal to radius classes", () => {
    it("radius utilities never cancel squircle-amt", () => {
      expect(twMerge("squircle-amt-3 squircle-md")).toBe("squircle-amt-3 squircle-md");
      expect(twMerge("squircle-amt-3 rounded-lg")).toBe("squircle-amt-3 rounded-lg");
    });

    it("later squircle-amt wins over earlier squircle-amt", () => {
      expect(twMerge("squircle-amt-2 squircle-amt-3")).toBe("squircle-amt-3");
    });
  });
});

/**
 * Keeping both classes only refines the corner if the narrower utility also
 * wins the cascade — these all have single-class specificity, so it comes down
 * to emission order. Tailwind sorts radius utilities by property breadth
 * (`border-radius` shorthand, then two-corner sides, then single corners) and
 * interleaves `squircle-*` with `rounded-*` in each tier, so the narrower
 * utility lands later regardless of family. These cases pin that down.
 */
describe("cascade order agrees with merge semantics", () => {
  // [broader utility, narrower utility that must win the overlapping corner]
  const pairs: [string, string][] = [
    ["squircle-md", "squircle-t-lg"],
    ["squircle-md", "squircle-tl-sm"],
    ["squircle-md", "squircle-tl-full"],
    ["squircle-md", "squircle-tl-none"],
    ["squircle-t-lg", "squircle-tl-sm"],
    ["squircle-full", "squircle-tl-sm"],
    ["squircle-none", "squircle-tl-full"],
    ["squircle-t-full", "squircle-tl-none"],
    ["squircle-s-md", "squircle-ss-sm"],
    ["squircle-e-full", "squircle-ee-none"],
    ["squircle-md", "rounded-tl-sm"],
    ["rounded-lg", "squircle-tl-full"],
    ["rounded-lg", "squircle-tl-none"],
    ["rounded-full", "squircle-tl-sm"],
    ["rounded-t-lg", "squircle-tl-sm"],
  ];

  function selectorIndex(css: string, className: string): number {
    const index = css.indexOf(`.${className} {`);
    expect(index, `${className} was not emitted`).toBeGreaterThan(-1);
    return index;
  }

  for (const [broad, narrow] of pairs) {
    it(`"${broad} ${narrow}" keeps both, and ${narrow} is emitted last`, async () => {
      expect(twMerge(`${broad} ${narrow}`)).toBe(`${broad} ${narrow}`);

      for (const compile of [compileCss, compilePlugin]) {
        const css = await compile([broad, narrow]);
        expect(selectorIndex(css, narrow)).toBeGreaterThan(selectorIndex(css, broad));
      }
    });
  }
});
