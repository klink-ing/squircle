import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { correctedRadius } from "./variants";

const distPath = join(import.meta.dirname, "..", "dist", "tailwind", "radius.css");

describe("squircle-radius.css ships", () => {
  it("is copied into dist during build", () => {
    expect(existsSync(distPath)).toBe(true);
  });
});

describe("@function squircle-radius() body", () => {
  const css = existsSync(distPath) ? readFileSync(distPath, "utf-8") : "";

  it("declares the @function with the documented signature", () => {
    expect(css).toContain("@function squircle-radius(--radius, --squircle-amt)");
  });

  it("uses the same correction formula as the utilities", () => {
    const strip = (s: string) => s.replace(/\s+/g, "");
    const expected = correctedRadius("var(--radius)", "var(--squircle-amt)");
    expect(strip(css)).toContain(strip(expected));
  });
});
