import { describe, expect, it } from "vitest";
import { createCompiler, VARIANTS } from "./test-utils";
import { cornerShapeProp } from "./variants";

const { compileCss } = createCompiler(import.meta.dirname);

describe("squircle.css utilities", () => {
  it("squircle-amt-* sets only --squircle-amt, applying no shape of its own", async () => {
    const css = await compileCss(["squircle-amt-2"]);
    expect(css).toContain("--squircle-amt: 2");
    expect(css).not.toContain("corner-shape:");
  });

  for (const [suffix, props] of Object.entries(VARIANTS)) {
    const className = suffix ? `squircle-${suffix}-md` : "squircle-md";

    it(`${className} sets fallback radius properties`, async () => {
      const css = await compileCss([className]);
      for (const prop of props) {
        expect(css).toContain(prop);
      }
    });

    it(`${className} applies corrected radius in @supports block`, async () => {
      const css = await compileCss([className]);
      expect(css).toContain("@supports (corner-shape: superellipse(2))");
      // Only the corners this variant sets a radius on get reshaped, so the
      // all-corners utility uses the shorthand and the rest use longhands.
      for (const prop of props) {
        expect(css).toContain(`${cornerShapeProp(prop)}: superellipse(var(--squircle-amt, 2))`);
      }
      expect(css).toContain("pow(2, -0.5)");
    });

    const usesIntermediateVar = props.length > 1 || suffix === "";
    if (usesIntermediateVar) {
      it(`${className} uses --squircle-r intermediate variable`, async () => {
        const css = await compileCss([className]);
        expect(css).toContain("--squircle-r:");
        for (const prop of props) {
          expect(css).toContain(`${prop}: var(--squircle-r)`);
        }
      });
    } else {
      it(`${className} inlines calc directly`, async () => {
        const css = await compileCss([className]);
        expect(css).not.toContain("--squircle-r:");
        expect(css).toContain(`${props[0]}: calc(`);
      });
    }

    it(`${className} snapshot`, async () => {
      const css = await compileCss([className]);
      expect(css).toMatchSnapshot();
    });
  }

  describe("static none/full utilities (matching rounded-none/rounded-full)", () => {
    it("squircle-full uses calc(infinity * 1px) uncorrected, with corner-shape", async () => {
      const css = await compileCss(["squircle-full"]);
      expect(css).toContain("border-radius: calc(infinity * 1px)");
      expect(css).toContain("corner-shape: superellipse(var(--squircle-amt, 2))");
      // Correcting an infinite radius is a no-op, so no correction is emitted.
      expect(css).not.toContain("pow(");
      expect(css).not.toContain("--squircle-r");
    });

    it("squircle-t-full applies the full radius to side variants", async () => {
      const css = await compileCss(["squircle-t-full"]);
      expect(css).toContain("border-top-left-radius: calc(infinity * 1px)");
      expect(css).toContain("border-top-right-radius: calc(infinity * 1px)");
    });

    it("squircle-none is plain zero radius with no correction", async () => {
      const css = await compileCss(["squircle-none"]);
      expect(css).toContain("border-radius: 0");
      expect(css).not.toContain("@supports");
      expect(css).not.toContain("corner-shape");
    });

    it("squircle-tl-none zeroes a single corner", async () => {
      const css = await compileCss(["squircle-tl-none"]);
      expect(css).toContain("border-top-left-radius: 0");
      expect(css).not.toContain("@supports");
    });
  });

  describe("arbitrary and invalid values", () => {
    it("squircle-[1rem] emits literal length in fallback and calc", async () => {
      const css = await compileCss(["squircle-[1rem]"]);
      expect(css).toContain("border-radius: 1rem");
      expect(css).toContain("calc(1rem *");
    });

    it("squircle-(--my-radius) reads a CSS variable in fallback and calc", async () => {
      const css = await compileCss(["squircle-(--my-radius)"]);
      expect(css).toContain("border-radius: var(--my-radius)");
      expect(css).toContain("calc(var(--my-radius) *");
    });

    it("squircle-[var(--my-radius)] reads a CSS variable in fallback and calc", async () => {
      const css = await compileCss(["squircle-[var(--my-radius)]"]);
      expect(css).toContain("border-radius: var(--my-radius)");
      expect(css).toContain("calc(var(--my-radius) *");
    });

    // Tailwind can't tell a variable from any other untyped arbitrary value,
    // so, like rounded-*, other arbitrary values pass through unchecked.
    it("squircle-[50%] passes through unchecked, as rounded-[50%] does", async () => {
      const css = await compileCss(["squircle-[50%]"]);
      expect(css).toContain("border-radius: 50%");
    });

    // A bare value must still be a theme key, so a typo in one produces no
    // class. Threading a variable through a theme key relies on this.
    it("squircle-lgg is rejected (not a theme key)", async () => {
      const css = await compileCss(["squircle-lgg"]);
      expect(css).not.toContain(".squircle-");
    });

    for (const [suffix, props] of Object.entries(VARIANTS)) {
      if (!suffix) continue;
      const className = `squircle-${suffix}-[8px]`;
      it(`${className} emits literal length on ${props.join(", ")}`, async () => {
        const css = await compileCss([className]);
        for (const prop of props) {
          expect(css).toContain(`${prop}: 8px`);
        }
        expect(css).toContain("calc(8px *");
      });
    }

    it("squircle-amt-[4.5] accepts arbitrary bare number", async () => {
      const css = await compileCss(["squircle-amt-[4.5]"]);
      expect(css).toContain("--squircle-amt: 4.5");
      expect(css).not.toContain("corner-shape:");
    });

    it("squircle-amt-(--my-amt) reads a CSS variable", async () => {
      const css = await compileCss(["squircle-amt-(--my-amt)"]);
      expect(css).toContain("--squircle-amt: var(--my-amt)");
    });

    it("squircle-amt-[1em] passes through unchecked, like other arbitrary values", async () => {
      const css = await compileCss(["squircle-amt-[1em]"]);
      expect(css).toContain("--squircle-amt: 1em");
    });

    it("squircle-amt-foo is rejected (not a number or theme key)", async () => {
      const css = await compileCss(["squircle-amt-foo"]);
      expect(css).not.toContain("squircle-amt-");
    });
  });
});
