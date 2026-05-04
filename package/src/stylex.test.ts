import { transformSync } from "@babel/core";
import stylexPlugin from "@stylexjs/babel-plugin";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Real-StyleX-compiler integration tests for `squircle.stylex.ts`.
 *
 * The package's source is fed through `@stylexjs/babel-plugin` to confirm:
 *   1. The `stylex.create(...)` literal compiles (no static-analysis errors).
 *   2. The emitted CSS contains the expected `@supports` block, `border-*-radius`
 *      properties, and `corner-shape: var(...)` for each variant.
 *   3. Dynamic styles work — the runtime substitutes `radius` and `amt` via
 *      CSS custom properties.
 *
 * If a future StyleX release breaks the dynamic-style pattern, these tests
 * will catch it before it reaches consumers.
 */

interface Meta {
  stylex?: Array<[string, { ltr: string; rtl?: string | null }, number]>;
}

function compileFromSource(source: string, filename: string) {
  const result = transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    presets: [["@babel/preset-typescript", { allowDeclareFields: true }]],
    plugins: [
      [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        (stylexPlugin as any).default ?? stylexPlugin,
        {
          dev: false,
          unstable_moduleResolution: {
            type: "commonJS",
            rootDir: import.meta.dirname,
          },
        },
      ],
    ],
  });
  if (!result) throw new Error("babel returned null");
  const meta = (result.metadata ?? {}) as Meta;
  return {
    rules: meta.stylex ?? [],
    code: result.code ?? "",
  };
}

const MODULE_PATH = `${import.meta.dirname}/stylex.ts`;
const MODULE_SOURCE = readFileSync(MODULE_PATH, "utf8");

describe("stylex", () => {
  const compiled = compileFromSource(MODULE_SOURCE, MODULE_PATH);
  const css = compiled.rules.map((r) => r[1].ltr).join("\n");

  it("compiles cleanly through the StyleX babel plugin", () => {
    expect(compiled.rules.length).toBeGreaterThan(0);
    expect(compiled.code).toContain("export const squircle");
  });

  it("emits @supports-gated rules for the all-corners variant", () => {
    expect(css).toContain("@supports (corner-shape: superellipse(2))");
    // border-radius shorthand and cornerShape both appear.
    expect(css).toMatch(/border-radius:var\(--/);
    expect(css).toMatch(/corner-shape:var\(--/);
  });

  it("emits per-side properties for the top variant", () => {
    expect(css).toMatch(/border-top-left-radius:var\(--/);
    expect(css).toMatch(/border-top-right-radius:var\(--/);
  });

  it("emits per-side properties for the right/bottom/left variants", () => {
    expect(css).toMatch(/border-bottom-right-radius:var\(--/);
    expect(css).toMatch(/border-bottom-left-radius:var\(--/);
  });

  it("emits logical-side properties for start/end variants", () => {
    expect(css).toMatch(/border-start-start-radius:var\(--/);
    expect(css).toMatch(/border-start-end-radius:var\(--/);
    expect(css).toMatch(/border-end-start-radius:var\(--/);
    expect(css).toMatch(/border-end-end-radius:var\(--/);
  });

  it("emits a runtime that injects --x-* custom properties from each variant's args", () => {
    // The babel plugin lowers `(radius, amt) => ({...})` to a runtime that
    // returns `[classObj, varObj]`. Every variant should emit a function.
    expect(compiled.code).toMatch(/all:\s*\(radius/);
    expect(compiled.code).toMatch(/topLeft:\s*\(radius/);
    expect(compiled.code).toMatch(/endEnd:\s*\(radius/);
    // Variables get unique --x-* names.
    expect(compiled.code).toMatch(/"--x-/);
  });

  it("inlines the corrected-radius calc into the @supports branch", () => {
    // The dynamic-style runtime should set a CSS var to the calc expression
    // built from the radius and amt arguments.
    expect(compiled.code).toContain("calc(");
    expect(compiled.code).toContain("(1 - pow(2, -0.5))");
    expect(compiled.code).toContain("pow(2, -1 *");
  });

  it("defaults amt to the literal exponent 2 when omitted", () => {
    // Each variant function emits `${amt ?? 2}` inside its template literals.
    expect(compiled.code).toMatch(/amt\s*\?\?\s*2/);
    // And does not bake in a `var(--squircle-amt, …)` fallback at runtime.
    expect(compiled.code).not.toContain("var(--squircle-amt");
  });

  it("emits all 15 variants", () => {
    const variantNames = [
      "all",
      "top",
      "right",
      "bottom",
      "left",
      "start",
      "end",
      "topLeft",
      "topRight",
      "bottomRight",
      "bottomLeft",
      "startStart",
      "startEnd",
      "endStart",
      "endEnd",
    ];
    for (const name of variantNames) {
      expect(compiled.code, `variant '${name}' should be present`).toMatch(
        new RegExp(`${name}:\\s*\\(radius`),
      );
    }
  });
});
