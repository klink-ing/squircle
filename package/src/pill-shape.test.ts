/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import { renderPillCss } from "./pill-css";
import { decorationDef, paintDef } from "./pill-shape.worklet";
import {
  CSS_NAMESPACE,
  DEFAULT_PILL_AMT,
  DEFAULT_PILL_CONTINUITY,
  DEFAULT_PILL_EASE,
  PILL_AMT_VAR_NAME,
  PILL_ATTRIBUTE,
  PILL_BACKGROUND_INSET_VAR_NAME,
  PILL_BORDER_COLOR_VAR_NAME,
  PILL_BORDER_STYLE_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_BOX_SHADOW_VAR_NAME,
  PILL_CLIP_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
  PILL_DECORATION_CLIP_VAR_NAME,
  PILL_DECORATION_VAR_NAME,
  PILL_EASE_VAR_NAME,
  PILL_INSET_RING_COLOR_VAR_NAME,
  PILL_INSET_RING_WIDTH_VAR_NAME,
  PILL_OUTLINE_COLOR_VAR_NAME,
  PILL_OUTLINE_OFFSET_VAR_NAME,
  PILL_OUTLINE_STYLE_VAR_NAME,
  PILL_OUTLINE_WIDTH_VAR_NAME,
  PILL_POLYFILL_ATTRIBUTE,
  PILL_REACH_VAR_NAME,
  PILL_RING_COLOR_VAR_NAME,
  PILL_RING_OFFSET_COLOR_VAR_NAME,
  PILL_RING_OFFSET_WIDTH_VAR_NAME,
  PILL_RING_WIDTH_VAR_NAME,
  PILL_SHADOW_REACH_VAR_NAME,
  PILL_SIDE_VAR_NAME,
  PILL_WORKLET_ATTRIBUTE,
} from "./variants";

// The standalone stylesheet is rendered from the same rules the Tailwind
// utility carries, so this is the sheet `dist/squircle-pill.css` ships.
const stylesheet = renderPillCss();

const registeredProperties = (css: string): string[] =>
  [...css.matchAll(/@property\s+(--[\w-]+)/g)].map((m) => m[1]);

const registration = (css: string, name: string): string | undefined =>
  new RegExp(`@property\\s+${name}\\s*\\{([^}]*)\\}`).exec(css)?.[1];

const initialValueOf = (css: string, name: string): string | undefined =>
  new RegExp(`@property\\s+${name}\\s*\\{[^}]*initial-value:\\s*([^;]+);`).exec(css)?.[1].trim();

/** The declarations of the first rule whose selector is exactly `selector`. */
const ruleBody = (css: string, selector: string): string | undefined => {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) return undefined;
  const open = css.indexOf("{", start);
  return css.slice(open + 1, css.indexOf("}", open));
};

const inputProperties = (paintDef as unknown as { inputProperties: string[] }).inputProperties;
const decorationInputs = (decorationDef as unknown as { inputProperties: string[] })
  .inputProperties;
// What either paint reads: the shape's or the decoration's.
const customInputs = [...inputProperties, ...decorationInputs].filter((p) => p.startsWith("--"));

const SHAPE = `[${PILL_ATTRIBUTE}]`;
const WORKLET = `:where(:root[${PILL_WORKLET_ATTRIBUTE}]) ${SHAPE}`;
const POLYFILL = `:where(:root[${PILL_POLYFILL_ATTRIBUTE}]) ${SHAPE}`;

type Point = { x: number; y: number };
type Drawn = {
  /** Every path traced, in order, with what was done with it. */
  paths: { points: Point[]; op?: "fill" | "stroke" | "clip"; rule?: string }[];
  strokes: { color: string; width: number; dash: number[]; join: string; points: Point[] }[];
  shadows: { color: string; blur: number; x: number; y: number; points: Point[] }[];
};

type Painter = new () => {
  paint(c: unknown, s: { width: number; height: number }, p: unknown): void;
};

/** Paints with a canvas that records what it was asked to draw. */
const record = (
  def: unknown,
  props: Record<string, string> | undefined,
  width = 240,
  height = 60,
): Drawn => {
  const drawn: Drawn = { paths: [], strokes: [], shadows: [] };
  let current: Point[] = [];
  let dash: number[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineJoin: "",
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    save() {},
    restore() {},
    beginPath() {
      current = [];
      drawn.paths.push({ points: current });
    },
    moveTo: (x: number, y: number) => current.push({ x, y }),
    lineTo: (x: number, y: number) => current.push({ x, y }),
    rect: (x: number, y: number, w: number, h: number) =>
      current.push({ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }),
    closePath() {},
    setLineDash(d: number[]) {
      dash = d;
    },
    fill() {
      drawn.paths[drawn.paths.length - 1].op = "fill";
      if (ctx.shadowColor) {
        drawn.shadows.push({
          color: ctx.shadowColor,
          blur: ctx.shadowBlur,
          // Where the shadow lands: the shape is drawn off the canvas and its
          // shadow thrown back.
          x: ctx.shadowOffsetX,
          y: ctx.shadowOffsetY,
          points: current.map((p) => ({ x: p.x + ctx.shadowOffsetX, y: p.y + ctx.shadowOffsetY })),
        });
      }
    },
    stroke() {
      drawn.paths[drawn.paths.length - 1].op = "stroke";
      drawn.strokes.push({
        color: ctx.strokeStyle,
        width: ctx.lineWidth,
        dash,
        join: ctx.lineJoin,
        points: current,
      });
    },
    clip(rule?: string) {
      const path = drawn.paths[drawn.paths.length - 1];
      path.op = "clip";
      path.rule = rule;
    },
  };
  const lookup = {
    get: (n: string) => (props?.[n] !== undefined ? { toString: () => props[n] } : undefined),
  };
  new (def as Painter)().paint(ctx, { width, height }, lookup);
  return drawn;
};

const bounds = (points: Point[]) => ({
  left: Math.min(...points.map((p) => p.x)),
  right: Math.max(...points.map((p) => p.x)),
  top: Math.min(...points.map((p) => p.y)),
  bottom: Math.max(...points.map((p) => p.y)),
});

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

  it("reads exactly the properties it needs, and no more", () => {
    // Every input is gathered for every pill on every resize, so the shape —
    // painted for every pill — reads only what shapes it.
    expect(inputProperties).toEqual([
      PILL_AMT_VAR_NAME,
      PILL_EASE_VAR_NAME,
      PILL_CONTINUITY_VAR_NAME,
      PILL_SIDE_VAR_NAME,
      PILL_BACKGROUND_INSET_VAR_NAME,
    ]);
    expect(decorationInputs).toEqual([
      PILL_AMT_VAR_NAME,
      PILL_EASE_VAR_NAME,
      PILL_CONTINUITY_VAR_NAME,
      PILL_SIDE_VAR_NAME,
      PILL_REACH_VAR_NAME,
      PILL_BORDER_WIDTH_VAR_NAME,
      PILL_BORDER_COLOR_VAR_NAME,
      PILL_BORDER_STYLE_VAR_NAME,
      PILL_OUTLINE_WIDTH_VAR_NAME,
      PILL_OUTLINE_OFFSET_VAR_NAME,
      PILL_OUTLINE_COLOR_VAR_NAME,
      PILL_OUTLINE_STYLE_VAR_NAME,
      PILL_RING_WIDTH_VAR_NAME,
      PILL_RING_COLOR_VAR_NAME,
      PILL_RING_OFFSET_WIDTH_VAR_NAME,
      PILL_RING_OFFSET_COLOR_VAR_NAME,
      PILL_INSET_RING_WIDTH_VAR_NAME,
      PILL_INSET_RING_COLOR_VAR_NAME,
      PILL_BOX_SHADOW_VAR_NAME,
      // What `currentColor` stands for.
      "color",
    ]);
  });

  describe("against squircle-pill.css", () => {
    it("registers every shaping property the worklet reads", () => {
      const registered = registeredProperties(stylesheet);
      for (const name of [
        PILL_AMT_VAR_NAME,
        PILL_EASE_VAR_NAME,
        PILL_CONTINUITY_VAR_NAME,
        PILL_SIDE_VAR_NAME,
      ]) {
        expect(registered, `${name} must be registered`).toContain(name);
      }
    });

    it("caps one end from the attribute's value", () => {
      for (const [value, side] of [
        ["t", "t"],
        ["r", "r"],
        ["b", "b"],
        ["l", "l"],
        ["s", "l"],
        ["e", "r"],
      ]) {
        const rule = new RegExp(
          `\\[${PILL_ATTRIBUTE}="${value}"\\] \\{[^}]*${PILL_SIDE_VAR_NAME}: ${side};`,
        );
        expect(stylesheet, value).toMatch(rule);
      }
      expect(stylesheet).toMatch(
        new RegExp(`\\[${PILL_ATTRIBUTE}="s"\\]:dir\\(rtl\\) \\{[^}]*${PILL_SIDE_VAR_NAME}: r;`),
      );
      // No axis values: they could only draw the automatic pill.
      expect(stylesheet).not.toContain(`[${PILL_ATTRIBUTE}="x"]`);
      expect(stylesheet).not.toContain(`[${PILL_ATTRIBUTE}="y"]`);
    });

    it("starts a bare pill at auto, at zero specificity", () => {
      expect(stylesheet).toMatch(
        new RegExp(`:where\\(\\[${PILL_ATTRIBUTE}\\]\\) \\{[^}]*${PILL_SIDE_VAR_NAME}: auto;`),
      );
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

    it("registers everything the pseudo-elements read as inheriting", () => {
      // WebKit never restyles a pseudo-element when a non-inheriting property
      // it pulls down with `inherit` changes, so a border fed that way goes
      // stale in Safari: a hover colour never shows, nor the polyfill's clip.
      for (const name of registeredProperties(stylesheet)) {
        expect(registration(stylesheet, name), name).toContain("inherits: true");
      }
      expect(stylesheet).not.toMatch(/--[\w-]+: inherit;/);
      // A `<length>` registration is what hands the worklet a px value however
      // the width was written.
      for (const name of [PILL_BORDER_WIDTH_VAR_NAME, PILL_REACH_VAR_NAME]) {
        expect(registration(stylesheet, name), name).toContain('syntax: "<length>"');
      }
      expect(registration(stylesheet, PILL_BORDER_COLOR_VAR_NAME)).toContain('syntax: "<color>"');
    });

    it("never masks or clips the element itself", () => {
      // A mask or clip on the element is the user's: Tailwind's `mask-*` and
      // `clip-path` utilities apply as they would anywhere, and a drop shadow
      // follows the pill-shaped copy of the background on its own.
      for (const selector of [SHAPE, WORKLET, POLYFILL]) {
        const body = ruleBody(stylesheet, selector) ?? "";
        expect(body, selector).not.toMatch(/mask|clip-path/);
      }
    });

    it("hides the element's own background and shadows, so no stadium shows past the pill", () => {
      // The stadium `border-radius` sits a few pixels outside the pill near
      // the caps: a background painted into it is the hairline between the
      // pill and its shadow. Important, so neither a utility nor an inline
      // `background` shorthand, which resets the clip, can bring it back.
      const body = ruleBody(
        stylesheet,
        `:where(:root[${PILL_WORKLET_ATTRIBUTE}], :root[${PILL_POLYFILL_ATTRIBUTE}]) ${SHAPE}`,
      );
      expect(body).toContain("background-clip: text !important;");
      expect(body).toContain("-webkit-background-clip: text !important;");
      expect(body).toContain("box-shadow: none !important;");
    });

    it("paints a copy of the background under the content, shaped to the pill", () => {
      const before = ruleBody(stylesheet, `${WORKLET}::before`) ?? "";
      expect(before).toContain("background: inherit;");
      // After the shorthand, which would otherwise inherit the element's
      // `text` clip.
      expect(before.indexOf("background-clip: border-box")).toBeGreaterThan(
        before.indexOf("background: inherit"),
      );
      expect(before).toContain("z-index: -1;");
      expect(before).toContain(`box-shadow: var(${PILL_BOX_SHADOW_VAR_NAME}, none);`);
      expect(before).toContain("mask-image: paint(pill-shape);");
      expect(before).toContain("mask-size: 100% 100%;");
      // Covering the border box, which the background is positioned against.
      expect(before).toContain(`inset: calc(-1 * var(${PILL_BORDER_WIDTH_VAR_NAME}));`);
      // `isolation` keeps it above the element's own stacking context's
      // background and below its content.
      expect(ruleBody(stylesheet, WORKLET)).toContain("isolation: isolate;");
    });

    it("shapes only once the worklet is known to have loaded", () => {
      // `@supports (mask-image: paint(pill-shape))` is true for any paint
      // name, loaded or not, so a mask gated on it alone would erase every
      // pill's background the moment the worklet failed to load.
      expect(stylesheet).not.toContain("@supports");
      const painted = [...stylesheet.matchAll(/^([^\n{]+)\{[^}]*paint\(/gm)].map((m) =>
        m[1].trim(),
      );
      expect(painted.length).toBe(2);
      for (const selector of painted) {
        expect(selector).toContain(`:where(:root[${PILL_WORKLET_ATTRIBUTE}])`);
      }
    });

    it("takes the polyfill's shape and drawing only where the polyfill runs", () => {
      // Until they are computed, the copy of the background shows as a
      // stadium (`none`) and nothing is drawn around it.
      expect(ruleBody(stylesheet, `${POLYFILL}::before`)).toContain(
        `clip-path: var(${PILL_CLIP_VAR_NAME}, none);`,
      );
      const after = ruleBody(stylesheet, `${POLYFILL}::after`);
      expect(after).toContain(`background-image: var(${PILL_DECORATION_VAR_NAME}, none);`);
      // A single band is its colour through a clip.
      expect(after).toContain(`clip-path: var(${PILL_DECORATION_CLIP_VAR_NAME}, none);`);
      // Clips, not masks, for the shape: a mask image is decoded and
      // rasterised per resize.
      expect(stylesheet).not.toContain("mask-image: var(");
    });

    it("is a plain stadium on every branch", () => {
      // The whole fallback without the worklet, and what a focus ring the
      // pill doesn't draw follows with it. Never a percentage: `50%` is an
      // ellipse on any non-square element. Never a superellipse: on a pill
      // the cap is the whole shape, so reshaping it changes the silhouette.
      // On the attribute itself: the sheet is in no layer, so at zero
      // specificity a plain `button { border-radius: 6px }` would beat it.
      // The side rules match the same specificity and come later, so they
      // still win.
      expect(ruleBody(stylesheet, SHAPE)).toContain("border-radius: calc(infinity * 1px);");
      expect(stylesheet.indexOf(`\n[${PILL_ATTRIBUTE}="t"] {`)).toBeGreaterThan(
        stylesheet.indexOf(`\n${SHAPE} {`),
      );
      expect(stylesheet).not.toContain("border-radius: 50%");
      expect(stylesheet).not.toContain("corner-shape");
    });

    it("drives a real border from the pill's own properties, and draws its own over it", () => {
      // Without the worklet that real border is the pill's border, a stadium
      // ring; with it, its colour is suppressed and its width reserves room
      // for the drawn one, on a box grown by how far the decoration reaches.
      const shape = ruleBody(stylesheet, SHAPE);
      expect(shape).toContain(`border-width: var(${PILL_BORDER_WIDTH_VAR_NAME});`);
      expect(shape).toContain(`border-color: var(${PILL_BORDER_COLOR_VAR_NAME});`);
      expect(ruleBody(stylesheet, WORKLET)).toContain("border-color: transparent;");
      const after = ruleBody(stylesheet, `${WORKLET}::after`);
      expect(after).toContain(
        `inset: calc(-1 * (var(${PILL_BORDER_WIDTH_VAR_NAME}) + var(${PILL_REACH_VAR_NAME})));`,
      );
      expect(after).toContain("background: paint(pill-decoration);");
    });

    it("hands the pseudo-elements nothing custom by an explicit inherit", () => {
      for (const pseudo of ["::before", "::after"]) {
        for (const branch of [WORKLET, POLYFILL]) {
          expect(ruleBody(stylesheet, `${branch}${pseudo}`)).not.toMatch(/--[\w-]+: inherit/);
        }
      }
    });

    it("starts each pill with no decoration of its own, at zero specificity", () => {
      // Same default colours a real border has, and a value set any other way
      // wins; the reset keeps a pill nested in a decorated one from drawing
      // its parent's border, rings and shadows.
      const block = ruleBody(stylesheet, `:where(${SHAPE})`);
      expect(block).toContain(`${PILL_BORDER_WIDTH_VAR_NAME}: 0px;`);
      expect(block).toContain(`${PILL_BORDER_COLOR_VAR_NAME}: currentColor;`);
      expect(block).toContain(`${PILL_OUTLINE_WIDTH_VAR_NAME}: 0px;`);
      expect(block).toContain(`${PILL_RING_WIDTH_VAR_NAME}: 0px;`);
      expect(block).toContain(`${PILL_INSET_RING_WIDTH_VAR_NAME}: 0px;`);
      expect(block).toContain(`${PILL_SHADOW_REACH_VAR_NAME}: 0px;`);
      expect(block).toContain(`${PILL_BOX_SHADOW_VAR_NAME}: none;`);
      expect(block).toContain(`${PILL_CLIP_VAR_NAME}: initial;`);
      expect(block).toContain(`${PILL_DECORATION_VAR_NAME}: initial;`);
      expect(block).toContain(`${PILL_DECORATION_CLIP_VAR_NAME}: initial;`);
    });

    it("reaches as far as the outline, the ring or a shadow does", () => {
      const block = ruleBody(stylesheet, `:where(${SHAPE})`);
      expect(block).toContain(
        `${PILL_REACH_VAR_NAME}: max(0px, var(${PILL_OUTLINE_OFFSET_VAR_NAME}) + var(${PILL_OUTLINE_WIDTH_VAR_NAME}), var(${PILL_RING_OFFSET_WIDTH_VAR_NAME}) + var(${PILL_RING_WIDTH_VAR_NAME}), var(${PILL_SHADOW_REACH_VAR_NAME}));`,
      );
    });

    it("starts the properties where the worklet's own fallbacks do", () => {
      expect(initialValueOf(stylesheet, PILL_AMT_VAR_NAME)).toBe(String(DEFAULT_PILL_AMT));
      expect(initialValueOf(stylesheet, PILL_EASE_VAR_NAME)).toBe(String(DEFAULT_PILL_EASE));
      expect(initialValueOf(stylesheet, PILL_CONTINUITY_VAR_NAME)).toBe(
        String(DEFAULT_PILL_CONTINUITY),
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

  describe("the shape", () => {
    it("fills the pill and nothing else, whatever decoration is set", () => {
      const drawn = record(paintDef, {
        [PILL_BORDER_WIDTH_VAR_NAME]: "4px",
        [PILL_RING_WIDTH_VAR_NAME]: "2px",
        [PILL_BOX_SHADOW_VAR_NAME]: "0 4px 8px black",
      });
      expect(drawn.paths).toHaveLength(1);
      expect(drawn.paths[0].op).toBe("fill");
      expect(drawn.strokes).toEqual([]);
      const b = bounds(drawn.paths[0].points);
      expect(b.left).toBeCloseTo(0, 9);
      expect(b.right).toBeCloseTo(240, 9);
      expect(b.top).toBeCloseTo(0, 9);
      expect(b.bottom).toBeCloseTo(60, 9);
    });

    it("pulls in by the background inset, to clear a border's anti-aliased edge", () => {
      const drawn = record(paintDef, { [PILL_BACKGROUND_INSET_VAR_NAME]: "0.5px" });
      const b = bounds(drawn.paths[0].points);
      expect(b.left).toBeCloseTo(0.5, 5);
      expect(b.top).toBeCloseTo(0.5, 5);
      expect(b.right).toBeCloseTo(239.5, 5);
      expect(b.bottom).toBeCloseTo(59.5, 5);
    });

    it("works the background inset out from the border and inset ring", () => {
      expect(ruleBody(stylesheet, `:where(${SHAPE})`)).toContain(
        `${PILL_BACKGROUND_INSET_VAR_NAME}: min(0.5px, var(${PILL_BORDER_WIDTH_VAR_NAME}) + var(${PILL_INSET_RING_WIDTH_VAR_NAME}));`,
      );
      expect(registration(stylesheet, PILL_BACKGROUND_INSET_VAR_NAME)).toContain(
        'syntax: "<length>"',
      );
    });

    it("draws nothing on an empty box", () => {
      expect(record(paintDef, undefined, 0, 60).paths).toEqual([]);
    });
  });

  describe("the decoration", () => {
    it("draws nothing at all without a border, ring, outline or shadow", () => {
      expect(record(decorationDef, {}).paths).toEqual([]);
      // Nor for widths that resolve to nothing, or colours that can't show.
      expect(
        record(decorationDef, {
          [PILL_BORDER_WIDTH_VAR_NAME]: "0px",
          [PILL_BORDER_COLOR_VAR_NAME]: "red",
          [PILL_RING_WIDTH_VAR_NAME]: "2px",
          [PILL_RING_COLOR_VAR_NAME]: "transparent",
          [PILL_BOX_SHADOW_VAR_NAME]: "0 0 #0000, 0 4px 8px rgb(0 0 0 / 0)",
        }).paths,
      ).toEqual([]);
    });

    it("joins its bands with miters, so a side pill's square corners stay square", () => {
      const drawn = record(decorationDef, {
        [PILL_BORDER_WIDTH_VAR_NAME]: "4px",
        [PILL_BORDER_COLOR_VAR_NAME]: "red",
        [PILL_SIDE_VAR_NAME]: "l",
      });
      expect(drawn.strokes.length).toBeGreaterThan(0);
      for (const stroke of drawn.strokes) expect(stroke.join).toBe("miter");
    });

    it("draws nothing for border-style none or hidden", () => {
      for (const style of ["none", "hidden"]) {
        const drawn = record(decorationDef, {
          [PILL_BORDER_WIDTH_VAR_NAME]: "3px",
          [PILL_BORDER_COLOR_VAR_NAME]: "red",
          [PILL_BORDER_STYLE_VAR_NAME]: style,
        });
        expect(drawn.paths, style).toEqual([]);
      }
    });

    it("strokes the border as a band exactly its width wide, just inside the outline", () => {
      const drawn = record(decorationDef, {
        [PILL_BORDER_WIDTH_VAR_NAME]: "4px",
        [PILL_BORDER_COLOR_VAR_NAME]: "red",
      });
      expect(drawn.strokes).toHaveLength(1);
      const [border] = drawn.strokes;
      expect(border.color).toBe("red");
      expect(border.width).toBe(4);
      expect(border.dash).toEqual([]);
      // Centred 2px inside the outline.
      const b = bounds(border.points);
      expect(b.left).toBeCloseTo(2, 5);
      expect(b.top).toBeCloseTo(2, 5);
      expect(b.right).toBeCloseTo(238, 5);
      expect(b.bottom).toBeCloseTo(58, 5);
    });

    it("draws currentColor in the element's colour", () => {
      // A registered colour keeps `currentcolor` as its computed value, which
      // a canvas would otherwise draw black, or not at all.
      const drawn = record(decorationDef, {
        color: "rgb(1, 2, 3)",
        [PILL_REACH_VAR_NAME]: "20px",
        [PILL_BORDER_WIDTH_VAR_NAME]: "2px",
        [PILL_BORDER_COLOR_VAR_NAME]: "currentcolor",
        [PILL_RING_WIDTH_VAR_NAME]: "2px",
        [PILL_RING_COLOR_VAR_NAME]: "color-mix(in srgb, currentColor 50%, transparent)",
        [PILL_BOX_SHADOW_VAR_NAME]: "0 4px 8px",
      });
      expect(drawn.strokes.map((s) => s.color)).toEqual([
        "rgb(1, 2, 3)",
        "color-mix(in srgb, rgb(1, 2, 3) 50%, transparent)",
      ]);
      expect(drawn.shadows.map((s) => s.color)).toEqual(["rgb(1, 2, 3)"]);
    });

    it("dashes and dots the border the way a real border does", () => {
      const dash = (style: string) =>
        record(decorationDef, {
          [PILL_BORDER_WIDTH_VAR_NAME]: "2px",
          [PILL_BORDER_COLOR_VAR_NAME]: "red",
          [PILL_BORDER_STYLE_VAR_NAME]: style,
        }).strokes[0].dash;
      expect(dash("dashed")).toEqual([6, 4]);
      expect(dash("dotted")).toEqual([2, 4]);
    });

    it("lays bands bottom first: border, inset ring, ring offset, ring, outline", () => {
      const reach = 2 + 3;
      const drawn = record(
        decorationDef,
        {
          [PILL_REACH_VAR_NAME]: `${reach}px`,
          [PILL_BORDER_WIDTH_VAR_NAME]: "1px",
          [PILL_BORDER_COLOR_VAR_NAME]: "red",
          [PILL_INSET_RING_WIDTH_VAR_NAME]: "2px",
          [PILL_INSET_RING_COLOR_VAR_NAME]: "green",
          [PILL_RING_WIDTH_VAR_NAME]: "3px",
          [PILL_RING_COLOR_VAR_NAME]: "blue",
          [PILL_RING_OFFSET_WIDTH_VAR_NAME]: "2px",
          [PILL_RING_OFFSET_COLOR_VAR_NAME]: "white",
          [PILL_OUTLINE_WIDTH_VAR_NAME]: "1px",
          [PILL_OUTLINE_OFFSET_VAR_NAME]: "1px",
          [PILL_OUTLINE_COLOR_VAR_NAME]: "black",
        },
        240 + 2 * reach,
        60 + 2 * reach,
      );
      // Each lower band runs half a pixel on under any band meeting it; see
      // "closes seams".
      expect(drawn.strokes.map((s) => [s.color, s.width])).toEqual([
        ["red", 2],
        ["green", 2],
        ["white", 2.5],
        ["blue", 3.5],
        ["black", 1],
      ]);
      // Each centred on its band, measured out from the outline, which sits
      // `reach` in from the edge of the grown box.
      const tops = drawn.strokes.map((s) => bounds(s.points).top);
      const expected = [-0.5, -2, 1.25, 3.25, 1.5].map((d) => reach - d);
      tops.forEach((top, i) => expect(top).toBeCloseTo(expected[i], 5));
    });

    it("closes seams: a lower band runs on under the band that meets it", () => {
      const bands = (props: Record<string, string>) =>
        new (decorationDef as unknown as new () => {
          decorationBands(p: unknown): { from: number; to: number; color: string }[];
        })()
          .decorationBands({
            get: (n: string) => (props[n] !== undefined ? { toString: () => props[n] } : undefined),
          })
          .map(({ from, to, color }) => [color, from, to]);
      const ring = { [PILL_RING_WIDTH_VAR_NAME]: "2px", [PILL_RING_COLOR_VAR_NAME]: "blue" };
      // Alone, a ring runs on over the background it meets.
      expect(bands(ring)).toEqual([["blue", -0.5, 2]]);
      // Over a border, the border runs on under it instead, and the
      // background pulls back under the border.
      expect(
        bands({
          ...ring,
          [PILL_BORDER_WIDTH_VAR_NAME]: "1px",
          [PILL_BORDER_COLOR_VAR_NAME]: "red",
        }),
      ).toEqual([
        ["red", -1, 0.5],
        ["blue", 0, 2],
      ]);
      // Never under a dashed band, whose gaps would show it.
      expect(
        bands({
          [PILL_BORDER_WIDTH_VAR_NAME]: "1px",
          [PILL_BORDER_COLOR_VAR_NAME]: "red",
          [PILL_OUTLINE_WIDTH_VAR_NAME]: "2px",
          [PILL_OUTLINE_COLOR_VAR_NAME]: "blue",
          [PILL_OUTLINE_STYLE_VAR_NAME]: "dashed",
        }),
      ).toEqual([
        ["red", -1, 0],
        ["blue", 0, 2],
      ]);
    });

    it("rings a tall pill on the same side, though its outline runs the other way", () => {
      const drawn = record(
        decorationDef,
        { [PILL_BORDER_WIDTH_VAR_NAME]: "4px", [PILL_BORDER_COLOR_VAR_NAME]: "red" },
        60,
        240,
      );
      const b = bounds(drawn.strokes[0].points);
      expect(b.left).toBeCloseTo(2, 5);
      expect(b.top).toBeCloseTo(2, 5);
    });

    it("casts outer shadows only outside the outline, last first, as CSS stacks them", () => {
      const reach = 20;
      const drawn = record(
        decorationDef,
        {
          [PILL_REACH_VAR_NAME]: `${reach}px`,
          [PILL_BOX_SHADOW_VAR_NAME]:
            "inset 0 2px 4px red, 0 0 0 2px blue, 0 4px 8px -2px rgb(0 0 0 / 0.6)",
        },
        240 + 2 * reach,
        60 + 2 * reach,
      );
      // The clip: the whole box, with the outline cut out of it.
      const clip = drawn.paths.find((p) => p.op === "clip");
      expect(clip?.rule).toBe("evenodd");
      // The inset one is the copy of the background's to paint.
      expect(drawn.shadows.map((s) => s.color)).toEqual(["rgb(0 0 0 / 0.6)", "blue"]);
      const [soft, solid] = drawn.shadows;
      expect(soft.blur).toBe(8);
      expect(soft.y).toBe(4);
      // Thrown back exactly onto the canvas: the shape grown by its spread,
      // shifted by its offset.
      const s = bounds(solid.points);
      expect(s.left).toBeCloseTo(reach - 2, 5);
      expect(s.right).toBeCloseTo(reach + 242, 5);
      const d = bounds(soft.points);
      expect(d.top).toBeCloseTo(reach + 2 + 4, 5);
      expect(d.left).toBeCloseTo(reach + 2, 5);
    });

    it("takes shadow lengths in rem and em at the default font size", () => {
      const drawn = record(
        decorationDef,
        { [PILL_REACH_VAR_NAME]: "20px", [PILL_BOX_SHADOW_VAR_NAME]: "0 0.25rem 1em black" },
        280,
        100,
      );
      expect(drawn.shadows[0].y).toBe(4);
      expect(drawn.shadows[0].blur).toBe(16);
    });
  });

  it("defaults match the shared constants", () => {
    // The worklet is deliberately import-free, so its own fallbacks are
    // duplicated from variants.ts; this is what keeps them from drifting.
    expect(record(paintDef, undefined).paths).toEqual(
      record(paintDef, {
        [PILL_AMT_VAR_NAME]: String(DEFAULT_PILL_AMT),
        [PILL_EASE_VAR_NAME]: String(DEFAULT_PILL_EASE),
        [PILL_CONTINUITY_VAR_NAME]: String(DEFAULT_PILL_CONTINUITY),
      }).paths,
    );
  });
});
