/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import { renderPillCss } from "./pill-css";
import { paintDef } from "./pill-shape.worklet";
import {
  CSS_NAMESPACE,
  DEFAULT_PILL_AMT,
  DEFAULT_PILL_EASE_SPREAD,
  PILL_AMT_VAR_NAME,
  PILL_ATTRIBUTE,
  PILL_BORDER_COLOR_VAR_NAME,
  PILL_BORDER_STYLE_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
  PILL_EASE_SPREAD_VAR_NAME,
  PILL_STROKE_WIDTH_VAR_NAME,
  PILL_WORKLET_ATTRIBUTE,
} from "./variants";

// The standalone stylesheet is rendered from the same rules the Tailwind
// utility carries, so this is the sheet `dist/squircle-pill.css` ships.
const stylesheet = renderPillCss();

const registeredProperties = (css: string): string[] =>
  [...css.matchAll(/@property\s+(--[\w-]+)/g)].map((m) => m[1]);

const initialValueOf = (css: string, name: string): string | undefined =>
  new RegExp(`@property\\s+${name}\\s*\\{[^}]*initial-value:\\s*([^;]+);`).exec(css)?.[1].trim();

const inputProperties = (paintDef as unknown as { inputProperties: string[] }).inputProperties;
const customInputs = inputProperties.filter((p) => p.startsWith("--"));

type Ctx = {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  paths: number;
  filled: boolean;
  stroked: boolean;
  vertices: { x: number; y: number }[];
};

const paintWith = (props: Record<string, string> | undefined, width = 240, height = 60): Ctx => {
  const ctx: Ctx & Record<string, unknown> = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    paths: 0,
    filled: false,
    stroked: false,
    vertices: [],
    beginPath() {
      ctx.paths++;
    },
    fill() {
      ctx.filled = true;
    },
    stroke() {
      ctx.stroked = true;
    },
    clip() {},
    setLineDash() {},
    closePath() {},
    moveTo: (x: number, y: number) => ctx.vertices.push({ x, y }),
    lineTo: (x: number, y: number) => ctx.vertices.push({ x, y }),
  };
  const lookup = {
    get: (n: string) => (props?.[n] !== undefined ? { toString: () => props[n] } : undefined),
  };
  new (paintDef as unknown as new () => {
    paint(c: unknown, s: { width: number; height: number }, p: unknown): void;
  })().paint(ctx, { width, height }, lookup);
  return ctx;
};

describe("pill-shape worklet contract", () => {
  it("namespaces every property it owns", () => {
    // `--pill-*` is the kind of name a design system is likely to have taken.
    // The prefix is fixed at build time, so the worklet, the plugins and the
    // stylesheet all have to derive it from the same value.
    const prefix = `--${CSS_NAMESPACE}-pill-`;
    for (const name of customInputs) {
      expect(name, `${name} is not namespaced`).toContain(prefix);
    }
    for (const name of registeredProperties(stylesheet)) {
      expect(name, `${name} is not namespaced`).toContain(prefix);
    }
    expect(PILL_ATTRIBUTE).toBe(`data-${CSS_NAMESPACE}-pill`);
    expect(PILL_WORKLET_ATTRIBUTE).toBe(`data-${CSS_NAMESPACE}-pill-worklet`);
  });

  it("reads exactly the properties it needs", () => {
    expect(inputProperties).toEqual([
      PILL_AMT_VAR_NAME,
      PILL_EASE_SPREAD_VAR_NAME,
      PILL_CONTINUITY_VAR_NAME,
      PILL_STROKE_WIDTH_VAR_NAME,
      PILL_BORDER_STYLE_VAR_NAME,
    ]);
  });

  describe("against squircle-pill.css", () => {
    it("registers every shaping property the worklet reads", () => {
      const registered = registeredProperties(stylesheet);
      for (const name of [PILL_AMT_VAR_NAME, PILL_EASE_SPREAD_VAR_NAME, PILL_CONTINUITY_VAR_NAME]) {
        expect(registered, `${name} must be registered`).toContain(name);
      }
    });

    it("registers nothing that is neither read nor fed into something read", () => {
      // Registrations for properties nothing consumes are dead plumbing: they
      // read as configuration but change nothing.
      const referenced = new Set([...stylesheet.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));
      for (const name of registeredProperties(stylesheet)) {
        const consumed = customInputs.includes(name) || referenced.has(name);
        expect(consumed, `${name} is registered but never consumed`).toBe(true);
      }
    });

    it("registers the border properties as non-inheriting lengths and colours", () => {
      // A `<length>` registration is what hands the worklet a px value however
      // the width was written; non-inheriting is what keeps a pill nested in a
      // bordered pill from drawing its parent's ring.
      for (const name of [PILL_BORDER_WIDTH_VAR_NAME, PILL_BORDER_COLOR_VAR_NAME]) {
        const block = new RegExp(`@property\\s+${name}\\s*\\{([^}]*)\\}`).exec(stylesheet)?.[1];
        expect(block, `${name} must be registered`).toBeDefined();
        expect(block).toContain("inherits: false");
      }
      expect(stylesheet).toMatch(
        new RegExp(`@property\\s+${PILL_BORDER_WIDTH_VAR_NAME}\\s*\\{[^}]*syntax: "<length>"`),
      );
      expect(stylesheet).toMatch(
        new RegExp(`@property\\s+${PILL_BORDER_COLOR_VAR_NAME}\\s*\\{[^}]*syntax: "<color>"`),
      );
    });

    it("leaves the stroke width unregistered on purpose", () => {
      // Its presence is what switches the worklet into stroke mode, so it
      // must be absent — not merely zero — on the element itself. Registering
      // it would give the element an initial value. It is fed from the
      // registered width instead, which is what resolves the unit.
      expect(registeredProperties(stylesheet)).not.toContain(PILL_STROKE_WIDTH_VAR_NAME);
      expect(stylesheet).toContain(
        `${PILL_STROKE_WIDTH_VAR_NAME}: var(${PILL_BORDER_WIDTH_VAR_NAME})`,
      );
    });

    it("never paints the shape as a background", () => {
      // Painting it as a background covers whatever background the element
      // already had; masking keeps it and shapes it instead.
      expect(stylesheet).not.toContain("background-image: paint(");
      expect(stylesheet).toContain("mask-image: paint(pill-shape)");
    });

    it("masks only once the worklet is known to have loaded", () => {
      // `@supports (mask-image: paint(pill-shape))` is true for any paint
      // name, loaded or not, so a mask gated on it alone would erase every
      // pill the moment the worklet failed to load.
      expect(stylesheet).not.toContain("@supports");
      const masked = [...stylesheet.matchAll(/^([^\n{]+)\{[^}]*mask-image: paint/gm)].map((m) =>
        m[1].trim(),
      );
      expect(masked.length).toBeGreaterThan(0);
      for (const selector of masked) {
        expect(selector).toContain(`:where(:root[${PILL_WORKLET_ATTRIBUTE}])`);
      }
    });

    it("is a plain stadium on every branch", () => {
      // The whole fallback without the worklet, and what native inset
      // decorations follow with it. Never a percentage: `50%` is an ellipse
      // on any non-square element. Never a superellipse: on a pill the cap
      // is the whole shape, so reshaping it changes the silhouette.
      expect(stylesheet).toMatch(
        new RegExp(
          `^\\[${PILL_ATTRIBUTE}\\] \\{[^}]*border-radius: calc\\(infinity \\* 1px\\)`,
          "m",
        ),
      );
      expect(stylesheet).not.toContain("border-radius: 50%");
      expect(stylesheet).not.toContain("corner-shape");
    });

    it("drives a real border from the pill's own properties", () => {
      // Without the worklet that real border is the pill's border, a stadium
      // ring; with it, its colour is suppressed and its width reserves room
      // for the drawn ring, which grows back out over it.
      expect(stylesheet).toContain(`border-width: var(${PILL_BORDER_WIDTH_VAR_NAME})`);
      expect(stylesheet).toContain(`border-color: var(${PILL_BORDER_COLOR_VAR_NAME})`);
      const loaded = stylesheet.slice(
        stylesheet.indexOf(`:where(:root[${PILL_WORKLET_ATTRIBUTE}])`),
      );
      expect(loaded).toContain("border-color: transparent");
      expect(loaded).toContain(`inset: calc(-1 * var(${PILL_BORDER_WIDTH_VAR_NAME}))`);
    });

    it("hands the ring the element's own values", () => {
      // The registrations are non-inheriting, so without this the ring would
      // be drawn to the default shape while the element is masked to a custom
      // one.
      const ring = stylesheet.slice(stylesheet.indexOf("::after"));
      for (const name of [
        PILL_AMT_VAR_NAME,
        PILL_EASE_SPREAD_VAR_NAME,
        PILL_CONTINUITY_VAR_NAME,
        PILL_BORDER_WIDTH_VAR_NAME,
        PILL_BORDER_COLOR_VAR_NAME,
      ]) {
        expect(ring).toContain(`${name}: inherit`);
      }
    });

    it("defaults the border colour to currentColor at zero specificity", () => {
      // Same default a real border has, and a colour set any other way wins.
      expect(stylesheet).toMatch(
        new RegExp(
          `:where\\(\\[${PILL_ATTRIBUTE}\\]\\) \\{\\s*${PILL_BORDER_COLOR_VAR_NAME}: currentColor;`,
        ),
      );
    });

    it("starts the properties where the worklet's own fallbacks do", () => {
      expect(initialValueOf(stylesheet, PILL_AMT_VAR_NAME)).toBe(String(DEFAULT_PILL_AMT));
      expect(initialValueOf(stylesheet, PILL_EASE_SPREAD_VAR_NAME)).toBe(
        String(DEFAULT_PILL_EASE_SPREAD),
      );
    });

    it("assigns no custom property that nothing consumes", () => {
      // Catches leftovers like `--pill-width: 100%` that outlived the paint
      // function that once consumed them. A property is legitimate if the
      // worklet reads it, or if the sheet itself feeds it into one that is
      // read.
      const assigned = [...stylesheet.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]);
      const referenced = new Set([...stylesheet.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));
      for (const name of assigned) {
        const consumed = customInputs.includes(name) || referenced.has(name);
        expect(consumed, `${name} is assigned but nothing consumes it`).toBe(true);
      }
    });

    it("knows nothing about Tailwind", () => {
      // A plain-CSS consumer sets the pill's own border-style property; a
      // sheet that bridged `--tw-border-style` here would shadow it with a
      // variable that never exists outside Tailwind. That bridge belongs to
      // the Tailwind plugin.
      expect(stylesheet).not.toContain("--tw-");
      expect(stylesheet).toContain(`var(${PILL_BORDER_STYLE_VAR_NAME}, solid)`);
    });
  });

  describe("stroke mode", () => {
    it("fills when the stroke width is absent, whatever the border width", () => {
      // The element carries the border width too; only the ring carries the
      // stroke width, and that presence is the switch.
      const ctx = paintWith({ [PILL_BORDER_WIDTH_VAR_NAME]: "4px" });
      expect(ctx.filled).toBe(true);
      expect(ctx.stroked).toBe(false);
    });

    it("strokes when it is present", () => {
      const ctx = paintWith({ [PILL_STROKE_WIDTH_VAR_NAME]: "4px" });
      expect(ctx.stroked).toBe(true);
      expect(ctx.filled).toBe(false);
      // Doubled: the half outside the outline is clipped away.
      expect(ctx.lineWidth).toBe(8);
    });

    it("draws nothing at all for a ring of zero width", () => {
      // A pill without a border utility has no border — not a full-face one,
      // which is what filling the ring's own shape would give, in its colour.
      for (const width of ["0px", "0", "-2px", "thin"]) {
        const ctx = paintWith({ [PILL_STROKE_WIDTH_VAR_NAME]: width });
        expect(ctx.paths, `width ${width}`).toBe(0);
        expect(ctx.filled, `width ${width}`).toBe(false);
        expect(ctx.stroked, `width ${width}`).toBe(false);
      }
    });

    it("draws nothing for border-style none or hidden", () => {
      for (const style of ["none", "hidden"]) {
        const ctx = paintWith({
          [PILL_STROKE_WIDTH_VAR_NAME]: "3px",
          [PILL_BORDER_STYLE_VAR_NAME]: style,
        });
        expect(ctx.paths, style).toBe(0);
      }
    });
  });

  it("defaults match the shared constants", () => {
    // The worklet is deliberately import-free, so its own fallbacks are
    // duplicated from variants.ts; this is what keeps them from drifting.
    expect(paintWith(undefined).vertices).toEqual(
      paintWith({
        [PILL_AMT_VAR_NAME]: String(DEFAULT_PILL_AMT),
        [PILL_EASE_SPREAD_VAR_NAME]: String(DEFAULT_PILL_EASE_SPREAD),
      }).vertices,
    );
  });
});
