import { describe, expect, it } from "vitest";
import squirclePandaPreset from "./panda";
import { CAMEL_VARIANTS } from "./variants";

describe("panda preset shape", () => {
  const preset = squirclePandaPreset();

  it("has the canonical name", () => {
    expect(preset.name).toBe("@klinking/squircle");
  });

  it("registers the squircleSupported condition", () => {
    expect(preset.conditions.extend["squircleSupported"]).toBe(
      "@supports (corner-shape: superellipse(2))",
    );
  });

  it("registers a utility for every CAMEL_VARIANTS entry plus squircleAmount", () => {
    const keys = Object.keys(preset.utilities.extend).sort();
    const expected = [
      ...CAMEL_VARIANTS.map((v) => v.property),
      "squircleAmount",
    ].sort();
    expect(keys).toEqual(expected);
  });

  it("uses Panda's built-in `radii` token category for radius utilities", () => {
    for (const variant of CAMEL_VARIANTS) {
      const u = preset.utilities.extend[variant.property];
      if (!u) throw new Error(`missing utility for ${variant.property}`);
      expect(u.values).toBe("radii");
      expect(u.shorthand).toBe(variant.shorthand);
    }
  });

  it("squircleAmount accepts numeric values via shorthand squircleAmt", () => {
    const u = preset.utilities.extend["squircleAmount"]!;
    expect(u.shorthand).toBe("squircleAmt");
    expect(u.values).toEqual({ type: "number" });
  });
});

describe("panda preset transform output", () => {
  const preset = squirclePandaPreset();
  const radiusToken = "var(--radii-md)"; // Panda passes the resolved CSS variable string

  it("squircleRadius (all corners) emits camelCase keys with @supports block", () => {
    const out = preset.utilities.extend["squircleRadius"]!.transform!(radiusToken, {
      token: () => radiusToken,
      raw: "md",
    });
    expect(out).toMatchInlineSnapshot(`
      {
        "@supports (corner-shape: superellipse(2))": {
          "--squircle-r": "calc(var(--radii-md) * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2)))))",
          "borderRadius": "var(--squircle-r)",
          "cornerShape": "superellipse(var(--squircle-amt, 2))",
        },
        "borderRadius": "var(--radii-md)",
      }
    `);
  });

  it("squircleTopLeftRadius (single corner) inlines calc without --squircle-r", () => {
    const out = preset.utilities.extend["squircleTopLeftRadius"]!.transform!(radiusToken, {
      token: () => radiusToken,
      raw: "md",
    });
    expect(out).toMatchInlineSnapshot(`
      {
        "@supports (corner-shape: superellipse(2))": {
          "borderTopLeftRadius": "calc(var(--radii-md) * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2)))))",
          "cornerShape": "superellipse(var(--squircle-amt, 2))",
        },
        "borderTopLeftRadius": "var(--radii-md)",
      }
    `);
  });

  it("squircleTopRadius (multi-prop side) shares --squircle-r across both corners", () => {
    const out = preset.utilities.extend["squircleTopRadius"]!.transform!(radiusToken, {
      token: () => radiusToken,
      raw: "md",
    });
    expect(out).toMatchInlineSnapshot(`
      {
        "@supports (corner-shape: superellipse(2))": {
          "--squircle-r": "calc(var(--radii-md) * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2)))))",
          "borderTopLeftRadius": "var(--squircle-r)",
          "borderTopRightRadius": "var(--squircle-r)",
          "cornerShape": "superellipse(var(--squircle-amt, 2))",
        },
        "borderTopLeftRadius": "var(--radii-md)",
        "borderTopRightRadius": "var(--radii-md)",
      }
    `);
  });

  it("squircleAmount sets the variable and gates corner-shape", () => {
    const out = preset.utilities.extend["squircleAmount"]!.transform!("3", {
      token: () => "3",
      raw: "3",
    });
    expect(out).toMatchInlineSnapshot(`
      {
        "--squircle-amt": "3",
        "@supports (corner-shape: superellipse(2))": {
          "cornerShape": "superellipse(var(--squircle-amt))",
        },
      }
    `);
  });
});

describe("panda preset options", () => {
  it("custom amtVar lands in every place the default --squircle-amt does", () => {
    const preset = squirclePandaPreset({ amtVar: "--my-amt" });

    // 1. radius transform — @supports calc references the custom var, and
    //    cornerShape uses it as the superellipse argument.
    const radiusOut = preset.utilities.extend["squircleRadius"]!.transform!("1rem", {
      token: () => "1rem",
      raw: "1rem",
    }) as Record<string, unknown>;
    const radiusSupports = radiusOut[
      "@supports (corner-shape: superellipse(2))"
    ] as Record<string, string>;
    expect(radiusSupports["--squircle-r"]).toContain("var(--my-amt, 2)");
    expect(radiusSupports["cornerShape"]).toBe("superellipse(var(--my-amt, 2))");

    // 2. squircleAmount transform — writes the custom var and the @supports
    //    block reads it back.
    const amtOut = preset.utilities.extend["squircleAmount"]!.transform!("3", {
      token: () => "3",
      raw: "3",
    }) as Record<string, unknown>;
    expect(amtOut["--my-amt"]).toBe("3");
    const amtSupports = amtOut[
      "@supports (corner-shape: superellipse(2))"
    ] as Record<string, string>;
    expect(amtSupports["cornerShape"]).toBe("superellipse(var(--my-amt))");

    // 3. The default name does not appear anywhere when overridden.
    const allOutput = JSON.stringify({ radiusOut, amtOut });
    expect(allOutput).not.toContain("--squircle-amt");
  });

  it("custom rVar threads through multi-prop side transforms", () => {
    const preset = squirclePandaPreset({ rVar: "--my-r" });
    const out = preset.utilities.extend["squircleTopRadius"]!.transform!("1rem", {
      token: () => "1rem",
      raw: "1rem",
    }) as Record<string, unknown>;
    const supports = out["@supports (corner-shape: superellipse(2))"] as Record<
      string,
      string
    >;
    expect(supports["--my-r"]).toContain("calc(1rem");
    expect(supports["borderTopLeftRadius"]).toBe("var(--my-r)");
    expect(supports["borderTopRightRadius"]).toBe("var(--my-r)");
    // And the default --squircle-r is gone.
    expect(JSON.stringify(out)).not.toContain("--squircle-r");
  });

  it("amtVar and rVar can both be overridden together", () => {
    const preset = squirclePandaPreset({ amtVar: "--a", rVar: "--r" });
    const out = preset.utilities.extend["squircleRadius"]!.transform!("1rem", {
      token: () => "1rem",
      raw: "1rem",
    }) as Record<string, unknown>;
    const supports = out["@supports (corner-shape: superellipse(2))"] as Record<
      string,
      string
    >;
    expect(supports["--r"]).toContain("var(--a, 2)");
    expect(supports["borderRadius"]).toBe("var(--r)");
    expect(supports["cornerShape"]).toBe("superellipse(var(--a, 2))");
  });
});
