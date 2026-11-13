import { describe, expect, it } from "vitest";
import squirclePandaPreset from "./panda";
import { resolveCorners, ruleFromObject, type Corner } from "./test-utils";
import { CAMEL_VARIANTS, correctedRadius } from "./variants";

describe("panda preset shape", () => {
  const preset = squirclePandaPreset();

  it("has the canonical name", () => {
    expect(preset.name).toBe("@klinking/squircle");
  });

  it("registers the squircleSupported condition", () => {
    expect(preset.conditions!.extend!["squircleSupported"]).toBe(
      "@supports (corner-shape: superellipse(2))",
    );
  });

  it("registers a utility for every CAMEL_VARIANTS entry plus squircleAmount", () => {
    const keys = Object.keys(preset.utilities!.extend!).sort();
    const expected = [...CAMEL_VARIANTS.map((v) => v.property), "squircleAmount"].sort();
    expect(keys).toEqual(expected);
  });

  it("uses Panda's built-in `radii` token category for radius utilities", () => {
    for (const variant of CAMEL_VARIANTS) {
      const u = preset.utilities!.extend![variant.property];
      if (!u) throw new Error(`missing utility for ${variant.property}`);
      expect(u.values).toBe("radii");
      expect(u.shorthand).toBe(variant.shorthand);
    }
  });

  it("squircleAmount accepts numeric values via shorthand squircleAmt", () => {
    const u = preset.utilities!.extend!["squircleAmount"]!;
    expect(u.shorthand).toBe("squircleAmt");
    expect(u.values).toEqual({ type: "number" });
  });
});

describe("panda preset transform output", () => {
  const preset = squirclePandaPreset();
  const radiusToken = "var(--radii-md)"; // Panda passes the resolved CSS variable string
  const mockToken = Object.assign(() => radiusToken, { raw: () => undefined }) as any;

  it("squircleRadius (all corners) emits camelCase keys with @supports block", () => {
    const out = preset.utilities!.extend!["squircleRadius"]!.transform!(radiusToken, {
      token: mockToken,
      raw: "md",
      utils: { colorMix: () => ({ invalid: true, value: "" }) },
    });
    expect(out).toMatchInlineSnapshot(`
      {
        "@supports (corner-shape: superellipse(2))": {
          "borderRadius": "calc(var(--radii-md) * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2)))))",
          "cornerShape": "superellipse(var(--squircle-amt, 2))",
        },
        "borderRadius": "var(--radii-md)",
      }
    `);
  });

  it("squircleTopLeftRadius (single corner) writes the corrected radius into its property", () => {
    const out = preset.utilities!.extend!["squircleTopLeftRadius"]!.transform!(radiusToken, {
      token: mockToken,
      raw: "md",
      utils: { colorMix: () => ({ invalid: true, value: "" }) },
    });
    expect(out).toMatchInlineSnapshot(`
      {
        "@supports (corner-shape: superellipse(2))": {
          "borderTopLeftRadius": "calc(var(--radii-md) * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2)))))",
          "cornerTopLeftShape": "superellipse(var(--squircle-amt, 2))",
        },
        "borderTopLeftRadius": "var(--radii-md)",
      }
    `);
  });

  it("squircleTopRadius (multi-prop side) writes the corrected radius into both corners", () => {
    const out = preset.utilities!.extend!["squircleTopRadius"]!.transform!(radiusToken, {
      token: mockToken,
      raw: "md",
      utils: { colorMix: () => ({ invalid: true, value: "" }) },
    });
    expect(out).toMatchInlineSnapshot(`
      {
        "@supports (corner-shape: superellipse(2))": {
          "borderTopLeftRadius": "calc(var(--radii-md) * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2)))))",
          "borderTopRightRadius": "calc(var(--radii-md) * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2)))))",
          "cornerTopLeftShape": "superellipse(var(--squircle-amt, 2))",
          "cornerTopRightShape": "superellipse(var(--squircle-amt, 2))",
        },
        "borderTopLeftRadius": "var(--radii-md)",
        "borderTopRightRadius": "var(--radii-md)",
      }
    `);
  });

  it("squircleAmount sets only the variable, applying no shape of its own", () => {
    const out = preset.utilities!.extend!["squircleAmount"]!.transform!("3", {
      token: mockToken,
      raw: "3",
      utils: { colorMix: () => ({ invalid: true, value: "" }) },
    });
    expect(out).toMatchInlineSnapshot(`
      {
        "--squircle-amt": "3",
      }
    `);
  });
});

// Several utilities on one element, applied in order: each corner keeps the
// radius of the utility that set it last.
describe("panda preset: combined utilities each keep their own corners' radius", () => {
  const preset = squirclePandaPreset();
  const mockToken = Object.assign(() => undefined, { raw: () => undefined }) as any;
  const apply = (utilities: [property: string, value: string][]) =>
    utilities.map(([property, value]) =>
      ruleFromObject(
        preset.utilities!.extend![property]!.transform!(value, {
          token: mockToken,
          raw: value,
          utils: { colorMix: () => ({ invalid: true, value: "" }) },
        }) as Record<string, unknown>,
      ),
    );
  const corners = (tl: string, tr: string, br: string, bl: string): Record<Corner, string> => ({
    tl,
    tr,
    br,
    bl,
  });

  const COMBINATIONS: [utilities: [string, string][], radii: Record<Corner, string>][] = [
    [
      [
        ["squircleTopRadius", "24px"],
        ["squircleBottomRadius", "8px"],
      ],
      corners("24px", "24px", "8px", "8px"),
    ],
    [
      [
        ["squircleLeftRadius", "24px"],
        ["squircleRightRadius", "8px"],
      ],
      corners("24px", "8px", "8px", "24px"),
    ],
    [
      [
        ["squircleStartRadius", "24px"],
        ["squircleEndRadius", "8px"],
      ],
      corners("24px", "8px", "8px", "24px"),
    ],
    [
      [
        ["squircleRadius", "8px"],
        ["squircleTopRadius", "24px"],
      ],
      corners("24px", "24px", "8px", "8px"),
    ],
  ];

  for (const [utilities, radii] of COMBINATIONS) {
    const label = utilities.map(([property, value]) => `${property}: ${value}`).join(", ");
    it(`${label} with corner-shape`, () => {
      const corrected = Object.fromEntries(
        Object.entries(radii).map(([corner, radius]) => [corner, correctedRadius(radius)]),
      );
      expect(resolveCorners(apply(utilities), { supported: true })).toEqual(corrected);
    });
    it(`${label} without corner-shape`, () => {
      expect(resolveCorners(apply(utilities), { supported: false })).toEqual(radii);
    });
  }
});

describe("panda preset options", () => {
  const mockToken = Object.assign(() => "1rem", { raw: () => undefined }) as any;
  const mockArgs = (raw: string) => ({
    token: mockToken,
    raw,
    utils: { colorMix: () => ({ invalid: true, value: "" }) },
  });

  it("custom amtVar lands in every place the default --squircle-amt does", () => {
    const preset = squirclePandaPreset({ amtVar: "--my-amt" });

    const radiusOut = preset.utilities!.extend!["squircleRadius"]!.transform!(
      "1rem",
      mockArgs("1rem"),
    ) as Record<string, unknown>;
    const radiusSupports = radiusOut["@supports (corner-shape: superellipse(2))"] as Record<
      string,
      string
    >;
    expect(radiusSupports["borderRadius"]).toContain("var(--my-amt, 2)");
    expect(radiusSupports["cornerShape"]).toBe("superellipse(var(--my-amt, 2))");

    const amtOut = preset.utilities!.extend!["squircleAmount"]!.transform!(
      "3",
      mockArgs("3"),
    ) as Record<string, unknown>;
    expect(amtOut["--my-amt"]).toBe("3");
    // The amount utility contributes no shape, so the variable is all it emits.
    expect(Object.keys(amtOut)).toEqual(["--my-amt"]);

    const allOutput = JSON.stringify({ radiusOut, amtOut });
    expect(allOutput).not.toContain("--squircle-amt");
  });
});
