import { describe, expect, it } from "vitest";
import { createCompiler, VARIANTS } from "./test-utils";
import { cornerShapeProp } from "./variants";

const { compileCss, compilePlugin } = createCompiler(import.meta.dirname);
const paths = [
  ["css", compileCss],
  ["plugin", compilePlugin],
] as const;

// The declaration form of the shorthand. The `@supports` condition also
// mentions `corner-shape`, so matching the bare property name would always hit.
const SHORTHAND_DECL = "corner-shape: superellipse(var(";

describe("squircle utilities only reshape the corners they own", () => {
  for (const [pathName, compile] of paths) {
    describe(pathName, () => {
      for (const [suffix, props] of Object.entries(VARIANTS)) {
        const className = suffix ? `squircle-${suffix}-md` : "squircle-md";
        const isAllCorners = props[0] === "border-radius";

        it(`${className} uses ${isAllCorners ? "the shorthand" : "per-corner longhands"}`, async () => {
          const css = await compile([className]);
          for (const prop of props) {
            expect(css).toContain(`${cornerShapeProp(prop)}: superellipse(var(--squircle-amt, 2))`);
          }
          if (isAllCorners) {
            expect(css).toContain(SHORTHAND_DECL);
          } else {
            // The shorthand would reshape all four corners, including ones
            // this utility never set a radius on.
            expect(css).not.toContain(SHORTHAND_DECL);
          }
        });
      }

      it("squircle-t-md leaves the bottom corners' shape alone", async () => {
        const css = await compile(["squircle-t-md"]);
        expect(css).not.toContain("corner-bottom");
        expect(css).not.toContain(SHORTHAND_DECL);
      });

      it("squircle-tl-md shapes only the top-left corner", async () => {
        const css = await compile(["squircle-tl-md"]);
        expect(css).toContain("corner-top-left-shape:");
        expect(css).not.toContain("corner-top-right-shape:");
        expect(css).not.toContain("corner-bottom");
      });
    });
  }
});

describe("rounded-* utilities reset the corner shape they own", () => {
  for (const [pathName, compile] of paths) {
    describe(pathName, () => {
      it("rounded-tl-lg resets only the top-left corner", async () => {
        const css = await compile(["rounded-tl-lg"]);
        expect(css).toContain("corner-top-left-shape: round");
        expect(css).not.toContain("corner-top-right-shape: round");
      });

      it("rounded-t-lg resets both top corners", async () => {
        const css = await compile(["rounded-t-lg"]);
        expect(css).toContain("corner-top-left-shape: round");
        expect(css).toContain("corner-top-right-shape: round");
        expect(css).not.toContain("corner-bottom-left-shape: round");
      });

      it("rounded-lg resets all four via the shorthand", async () => {
        const css = await compile(["rounded-lg"]);
        expect(css).toContain("corner-shape: round");
      });

      it("rounded-tl-full resets the corner too", async () => {
        const css = await compile(["rounded-tl-full"]);
        expect(css).toContain("corner-top-left-shape: round");
      });

      it("rounded-tl-none needs no reset (a zero radius has no visible corner)", async () => {
        const css = await compile(["rounded-tl-none"]);
        expect(css).toContain("border-top-left-radius: 0");
        expect(css).not.toContain("corner-top-left-shape: round");
      });

      // Same specificity, so the reset only wins if it is emitted later.
      it("the reset is emitted after the squircle rule it has to override", async () => {
        const css = await compile(["squircle-lg", "rounded-tl-lg"]);
        expect(css.indexOf("corner-top-left-shape: round")).toBeGreaterThan(
          css.indexOf(".squircle-lg {"),
        );
      });
    });
  }

  // Tailwind's own rounded-* accepts `(--var)` refs. The generated CSS matches
  // them with `--value(…, [*])`; the plugin's matchUtilities cannot (adding
  // "any" to its type list disables the utility outright), so that one form
  // keeps its shape on the plugin path.
  it("css path also resets paren-ref values", async () => {
    const css = await compileCss(["rounded-tl-(--my-r)"]);
    expect(css).toContain("corner-top-left-shape: round");
  });
});
