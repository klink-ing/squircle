# Pill Sides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a pill cap one end only (`squircle-pill-t|r|b|l|s|e`), plus `-x`/`-y` aliases, across the worklet, polyfill, Tailwind plugin, standalone CSS, tailwind-merge config, README and the hidden pill gallery.

**Architecture:** One registered property, `--squircle-pill-side` (`auto | t | r | b | l`), carries the side. The worklet's `boxOutline` hands any side but `auto` to a new `sideOutline`, which builds the left-capped outline from today's `fittedQuadrant` and turns it into place. The polyfill calls `boxOutline` instead of duplicating it. The CSS keeps one table of per-side declarations (side property plus fallback `border-radius`) shared by the Tailwind utilities and the standalone `data-squircle-pill="…"` rules.

**Tech Stack:** TypeScript, Tailwind CSS v4 plugin API, CSS Paint API worklet, Vitest via `vp test`, vite-plus (`vp check`, `vp run ready`), Astro + React for the website.

**Spec:** `docs/superpowers/specs/2026-10-07-pill-sides-design.md`

## Global Constraints

- Branch: `feat/pill-sides` (stacked on `fix/twmerge-pill`, which targets `alpha`).
- Every custom property name comes from `pillVar(...)` in `package/src/variants.ts`; the worklet derives its own from `NS`. Never hard-code `--squircle-pill-…` in package source.
- The side property: `syntax: "auto | t | r | b | l"`, `initial-value: auto`, `inherits: true`.
- Side utility names, exactly: `x`, `y`, `t`, `r`, `b`, `l`, `s`, `e`. No corner variants (`tl`, `ss`, …), no sizes.
- `-x` and `-y` set the side to `auto`. `-s` is `l` (`r` under `:dir(rtl)`); `-e` is `r` (`l` under `:dir(rtl)`).
- Fallback radii: `auto` → `FULL_RADIUS`; `t` → `FULL FULL 0 0`; `r` → `0 FULL FULL 0`; `b` → `0 0 FULL FULL`; `l` → `FULL 0 0 FULL`, where `FULL` is `FULL_RADIUS` from `variants.ts`.
- `squircle-pill` with no side must render exactly as today (worklet and polyfill outlines unchanged).
- Comments match the surrounding prose style: full sentences, British spelling ("colour", "honours"), explaining why.
- Package source files keep their license header.
- Run commands from `package/` unless a step says otherwise. If a git command fails with "could not lock config file", rerun it outside the sandbox.

## Review Focus

- A square box with a side (`size-10 squircle-pill squircle-pill-t`) must be an arch, not a circle, including under the polyfill, whose `pillClipPath` returns `null` for squares today. Tests: Task 1 (geometry), Task 3 (clip path).
- A pill nested inside a side pill must be a full pill again: the side resets to `auto` on every pill at zero specificity. Test: Task 2.
- A side utility's radius must win over the pill's own, whichever Tailwind emits first: the pill's `border-radius` moves to `:where(&)`. Test: Task 2.
- The shape knobs still apply to side pills: every amount and ease, including the extremes `amt 1` and `ease -2`, stays convex and inside the box. Test: Task 1.
- `s`/`e` follow `direction` in CSS, but the polyfill reads computed style only when a pill's class or attribute changes, so toggling `dir` on an ancestor needs `polyfill.refresh()`. That's documented in the README (Task 4), not tested.

---

### Task 1: Side geometry in the worklet

**Files:**

- Modify: `package/src/variants.ts` (after `DEFAULT_PILL_CONTINUITY`, ~line 113)
- Modify: `package/src/pill-shape.worklet.ts` (constants ~line 21; `inputProperties` ~line 330 and ~line 1046; `boxOutline` ~line 834)
- Modify: `package/src/pill-css.ts` (`pillPropertyRegistrations`, ~line 72)
- Modify: `package/src/pill-shape.test.ts:172-200` (input lists)
- Create: `package/src/pill-shape.sides.test.ts`

**Interfaces:**

- Produces: `PILL_SIDE_VAR_NAME: string` and `DEFAULT_PILL_SIDE = "auto"` from `variants.ts`.
- Produces: worklet methods `resolveSide(props?): "auto" | "t" | "r" | "b" | "l"` and `sideOutline(width: number, height: number, side: "t" | "r" | "b" | "l", props?): Point[]`. `boxOutline(width, height, props)` now honours the side.

- [ ] **Step 1: Write the failing geometry tests**

Create `package/src/pill-shape.sides.test.ts`:

```ts
/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { describe, expect, it } from "vitest";
import { paintDef } from "./pill-shape.worklet";
import { PILL_AMT_VAR_NAME, PILL_EASE_VAR_NAME, PILL_SIDE_VAR_NAME } from "./variants";

type Point = { x: number; y: number };

const geometry = new (
  paintDef as unknown as new () => {
    boxOutline(width: number, height: number, props?: unknown): Point[];
  }
)();

const props = (values: Record<string, string | number | undefined>) => ({
  get: (name: string) =>
    values[name] === undefined ? undefined : { toString: () => String(values[name]) },
});

const outline = (width: number, height: number, side?: string, amt?: number, ease?: number) =>
  geometry.boxOutline(
    width,
    height,
    props({ [PILL_SIDE_VAR_NAME]: side, [PILL_AMT_VAR_NAME]: amt, [PILL_EASE_VAR_NAME]: ease }),
  );

const EPS = 1e-6;
const near = (a: number, b: number) => Math.abs(a - b) < EPS;
const has = (points: Point[], x: number, y: number) =>
  points.some((p) => near(p.x, x) && near(p.y, y));

/** Without the repeats where pieces meet, which have no direction. */
const distinct = (points: Point[]): Point[] => {
  const out: Point[] = [];
  for (const p of points) {
    const last = out.at(-1);
    if (!last || !near(last.x, p.x) || !near(last.y, p.y)) out.push(p);
  }
  if (out.length > 1 && near(out[0].x, out.at(-1)!.x) && near(out[0].y, out.at(-1)!.y)) out.pop();
  return out;
};

/** Every turn the same way round, so every band and shadow offsets cleanly. */
const isConvex = (points: Point[]): boolean => {
  const ring = distinct(points);
  let sign = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const c = ring[(i + 2) % ring.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-7) continue;
    if (sign !== 0 && Math.sign(cross) !== sign) return false;
    sign = Math.sign(cross);
  }
  return true;
};

const inside = (points: Point[], width: number, height: number) =>
  points.every((p) => p.x > -EPS && p.x < width + EPS && p.y > -EPS && p.y < height + EPS);

describe("pill sides", () => {
  describe("auto", () => {
    it("is today's pill, whether the side is unset, auto or not a side", () => {
      const today = geometry.boxOutline(200, 40);
      expect(outline(200, 40, "auto")).toEqual(today);
      expect(outline(200, 40, "q")).toEqual(today);
      expect(outline(40, 200, "auto")).toEqual(geometry.boxOutline(40, 200));
    });
  });

  describe("one end on a wide box", () => {
    it("caps the left end as today's pill does, and squares the right", () => {
      const left = outline(200, 40, "l");
      expect(has(left, 200, 0)).toBe(true);
      expect(has(left, 200, 40)).toBe(true);
      // Wide enough for the requested easing either way, so the cap is today's.
      const long = outline(400, 40, "l");
      for (const p of geometry.boxOutline(400, 40).filter((p) => p.x < 200)) {
        expect(has(long, p.x, p.y), `${p.x},${p.y}`).toBe(true);
      }
    });

    it("caps the right end, mirrored", () => {
      const left = outline(200, 40, "l");
      const right = outline(200, 40, "r");
      expect(has(right, 0, 0)).toBe(true);
      expect(has(right, 0, 40)).toBe(true);
      for (const p of left) expect(has(right, 200 - p.x, p.y)).toBe(true);
    });

    it("clamps a top cap to the height, a tab whose cap runs the full height", () => {
      const top = outline(200, 40, "t");
      expect(has(top, 0, 40)).toBe(true);
      expect(has(top, 200, 40)).toBe(true);
      // The left edge is used up: the cap only touches it at the bottom corner.
      for (const p of top.filter((p) => p.x < EPS)) expect(p.y).toBeCloseTo(40, 6);
      // So the radius is the height, 40: the top edge starts no nearer the corner.
      const topEdge = top.filter((p) => p.y < EPS).map((p) => p.x);
      expect(Math.min(...topEdge)).toBeGreaterThanOrEqual(40 - EPS);
    });

    it("caps the bottom, mirrored", () => {
      const top = outline(200, 40, "t");
      const bottom = outline(200, 40, "b");
      for (const p of top) expect(has(bottom, p.x, 40 - p.y)).toBe(true);
    });
  });

  describe("one end on a tall box", () => {
    it("caps the top end as today's pill does, and squares the bottom", () => {
      const top = outline(40, 200, "t");
      expect(has(top, 0, 200)).toBe(true);
      expect(has(top, 40, 200)).toBe(true);
      const long = outline(40, 400, "t");
      for (const p of geometry.boxOutline(40, 400).filter((p) => p.y < 200)) {
        expect(has(long, p.x, p.y), `${p.x},${p.y}`).toBe(true);
      }
    });

    it("clamps a left cap to the width", () => {
      const left = outline(40, 200, "l");
      expect(has(left, 40, 0)).toBe(true);
      expect(has(left, 40, 200)).toBe(true);
      // The top edge is used up: the cap only touches it at the square corner.
      for (const p of left.filter((p) => p.y < EPS)) expect(p.x).toBeCloseTo(40, 6);
      const leftEdge = left.filter((p) => p.x < EPS).map((p) => p.y);
      expect(Math.min(...leftEdge)).toBeGreaterThanOrEqual(40 - EPS);
    });
  });

  describe("on a square", () => {
    it("is an arch, not a circle", () => {
      const top = outline(40, 40, "t");
      expect(has(top, 0, 40)).toBe(true);
      expect(has(top, 40, 40)).toBe(true);
      // The two caps meet halfway along the top.
      for (const p of top.filter((p) => p.y < EPS)) expect(p.x).toBeCloseTo(20, 6);
    });
  });

  it("stays convex and inside the box at every side, ratio, amount and ease", () => {
    for (const side of ["t", "r", "b", "l"]) {
      for (const [width, height] of [
        [200, 40],
        [40, 200],
        [40, 40],
        [50, 40],
        [40, 50],
        [41, 80],
      ]) {
        for (const amt of [1, 2, 3]) {
          for (const ease of [-2, 0, 2, 6]) {
            const points = outline(width, height, side, amt, ease);
            const label = `${side} ${width}x${height} amt ${amt} ease ${ease}`;
            expect(inside(points, width, height), label).toBe(true);
            expect(isConvex(points), label).toBe(true);
          }
        }
      }
    }
  });
});
```

- [ ] **Step 2: Update the contract test's input lists**

In `package/src/pill-shape.test.ts`, add `PILL_SIDE_VAR_NAME` to the import from `./variants`. In `it("reads exactly the properties it needs, and no more", …)`, insert `PILL_SIDE_VAR_NAME,` directly after `PILL_CONTINUITY_VAR_NAME,` in both the `inputProperties` and the `decorationInputs` lists. In `it("registers every shaping property the worklet reads", …)`, add `PILL_SIDE_VAR_NAME` to the array.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `vp test src/pill-shape.sides.test.ts src/pill-shape.test.ts`
Expected: FAIL. `PILL_SIDE_VAR_NAME` is not exported (TypeScript or `undefined`), the input lists differ, and the side assertions fail.

- [ ] **Step 4: Add the property to `variants.ts`**

After `DEFAULT_PILL_CONTINUITY`:

```ts
/**
 * Which end of a pill is capped: `auto` caps both short ends, as a pill
 * always has; `t`, `r`, `b` or `l` caps that end alone and squares the other.
 * See the worklet's `sideOutline`.
 */
export const PILL_SIDE_VAR_NAME: string = pillVar("side");
export const DEFAULT_PILL_SIDE = "auto" as const;
```

- [ ] **Step 5: Register it in `pill-css.ts`**

Import `PILL_SIDE_VAR_NAME` and `DEFAULT_PILL_SIDE`. In `pillPropertyRegistrations()`, after the continuity registration:

```ts
    [`@property ${PILL_SIDE_VAR_NAME}`]: {
      syntax: '"auto | t | r | b | l"',
      "initial-value": DEFAULT_PILL_SIDE,
      inherits: "true",
    },
```

- [ ] **Step 6: Implement the worklet side**

In `pill-shape.worklet.ts`, after `const CONTINUITY_VAR = …`:

```ts
const SIDE_VAR = `${NS}-side`;
```

After the `Point` interface:

```ts
/** An end a pill can cap alone; see `sideOutline`. */
type Side = "t" | "r" | "b" | "l";
```

Change both `inputProperties` getters to read the side straight after continuity:

```ts
return [AMT_VAR, EASE_VAR, CONTINUITY_VAR, SIDE_VAR, BACKGROUND_INSET_VAR];
```

```ts
return [AMT_VAR, EASE_VAR, CONTINUITY_VAR, SIDE_VAR, ...DECORATION_INPUTS];
```

After `resolveContinuity`:

```ts
  /** The end the pill caps alone, or `auto` for both short ends. */
  resolveSide(props?: PaintProperties): Side | "auto" {
    const value = props?.get(SIDE_VAR)?.toString().trim();
    return value === "t" || value === "r" || value === "b" || value === "l" ? value : "auto";
  }
```

At the top of `boxOutline`, before `const vertical = …`:

```ts
const side = this.resolveSide(props);
if (side !== "auto") return this.sideOutline(width, height, side, props);
```

Directly after `boxOutline`:

```ts
  /**
   * The outline of a pill capped at `side` alone, square at the other end.
   * Built for the left end, then turned into place: `r` mirrored, `t`
   * transposed, `b` transposed and mirrored. Which way round it runs doesn't
   * matter; `offsetOutline` works out either.
   *
   * Each capped corner gets the largest radius both its edges can give it:
   * half the left edge, which the two caps share, or the whole top edge,
   * which the cap has to itself. Whichever is smaller is used up entirely, so
   * the corner is exactly a pill's quadrant. Its cap meets its mirror image
   * halfway down the left edge, or the square corner at the far end of the
   * top one, and its easing runs along the other edge.
   */
  sideOutline(width: number, height: number, side: Side, props?: PaintProperties): Point[] {
    const across = side === "t" || side === "b";
    // The box seen from the capped end: `w` along the square edges, `h` along the capped one.
    const w = across ? height : width;
    const h = across ? width : height;
    const ease = this.resolveAngle(props);
    const exponent = this.resolveExponent(props);
    const continuity = this.resolveContinuity(props);

    // The top-left corner, from the left edge round to the top edge.
    const corner =
      h / 2 <= w
        ? // The left edge binds: the caps meet halfway down it, and each eases
          // along the whole top edge.
          this.fittedQuadrant(2 * w, h, ease, exponent, continuity)
        : // The top edge binds: the cap spans it, meeting the square corner,
          // and eases down half the left edge.
          this.fittedQuadrant(h, 2 * w, ease, exponent, continuity)
            .map((p) => ({ x: p.y, y: p.x }))
            .reverse();
    const left: Point[] = [
      ...corner,
      { x: w, y: 0 },
      { x: w, y: h },
      ...[...corner].reverse().map((p) => ({ x: p.x, y: h - p.y })),
    ];

    if (side === "l") return left;
    if (side === "r") return left.map((p) => ({ x: w - p.x, y: p.y }));
    if (side === "t") return left.map((p) => ({ x: p.y, y: p.x }));
    return left.map((p) => ({ x: p.y, y: w - p.x }));
  }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `vp test src/pill-shape.sides.test.ts src/pill-shape.test.ts src/pill-shape.geometry.test.ts`
Expected: PASS. The geometry suite is unchanged, which shows `auto` still draws today's pill.

- [ ] **Step 8: Commit**

```bash
git add package/src/variants.ts package/src/pill-css.ts package/src/pill-shape.worklet.ts package/src/pill-shape.test.ts package/src/pill-shape.sides.test.ts
git commit -m "feat(pill): draw a pill capped at one end in the worklet"
```

---

### Task 2: Side utilities and standalone attribute values

**Files:**

- Modify: `package/src/pill-css.ts` (`pillCssObj` return, ~line 205; `:where(&)` block; `renderPillCss`; new `pillSideCss`)
- Modify: `package/src/tailwind-pill.ts` (`addUtilities` call; doc comment)
- Modify: `package/src/pill-worklet.ts:25-29` (`PILL_SHAPE_PROPERTIES`)
- Modify: `package/src/tailwind-pill.test.ts`
- Modify: `package/src/pill-shape.test.ts` (standalone stylesheet assertions)

**Interfaces:**

- Consumes: `PILL_SIDE_VAR_NAME`, `DEFAULT_PILL_SIDE` (Task 1).
- Produces: `PILL_SIDE_NAMES: readonly ["x","y","t","r","b","l","s","e"]`, `type PillSideName`, `pillSideCss(name: PillSideName): PillCss` from `pill-css.ts`; `PILL_SHAPE_PROPERTIES.side`.

- [ ] **Step 1: Write the failing Tailwind tests**

In `package/src/tailwind-pill.test.ts`, add `PILL_SIDE_VAR_NAME` to the `./variants` import, and add at the top level:

```ts
const FULL = FULL_RADIUS;
const escape = (s: string) => s.replace(/[()*]/g, "\\$&");
/** The declarations directly in `.name { … }`, before any nested rule. */
const ownBlock = (css: string, name: string) => {
  const start = css.indexOf(`.${name} {`);
  return css.slice(start, css.indexOf("{", css.indexOf("\n", start) + 1));
};
```

Replace the whole `it("is a plain fully-rounded rectangle on every branch", …)` with:

```ts
it("is a plain fully-rounded rectangle, at zero specificity", async () => {
  // The whole fallback without the worklet: the same radius the `-full`
  // utilities use, matching `rounded-full`. Zero specificity, so a side
  // utility's radius wins whichever is emitted first.
  const css = await compilePill(["squircle-pill"]);
  const own = /:where\(&\) \{([^}]*)\}/.exec(css)?.[1];
  expect(own).toContain(`border-radius: ${FULL};`);
  expect(ownBlock(css, "squircle-pill")).not.toContain("border-radius");
});
```

Replace `it("has no size or side variants", …)` with:

```ts
it("has no size or corner variants", async () => {
  // A pill is capped by its ends; a single corner isn't one, and its
  // caps are derived from its own size.
  const css = await compilePill([
    "squircle-pill-tl",
    "squircle-pill-ss",
    "squircle-pill-md",
    "squircle-pill-full",
  ]);
  expect(css).toBe("");
});
```

Add a new `describe` inside `describe("tailwind-pill.ts utilities", …)`:

```ts
describe("sides", () => {
  const radii: Record<string, string> = {
    t: `${FULL} ${FULL} 0 0`,
    r: `0 ${FULL} ${FULL} 0`,
    b: `0 0 ${FULL} ${FULL}`,
    l: `${FULL} 0 0 ${FULL}`,
  };

  for (const [side, radius] of Object.entries(radii)) {
    it(`-${side} caps that end, and rounds the fallback to match`, async () => {
      const css = await compilePill([`squircle-pill-${side}`]);
      expect(css).toContain(`${PILL_SIDE_VAR_NAME}: ${side};`);
      expect(css).toContain(`border-radius: ${radius};`);
    });
  }

  it("-x and -y are the automatic pill", async () => {
    for (const axis of ["x", "y"]) {
      const css = await compilePill([`squircle-pill-${axis}`]);
      expect(css).toContain(`${PILL_SIDE_VAR_NAME}: auto;`);
      expect(css).toMatch(new RegExp(`border-radius: ${escape(FULL)};`));
    }
  });

  it("-s and -e follow the direction", async () => {
    for (const [name, ltr, rtl] of [
      ["s", "l", "r"],
      ["e", "r", "l"],
    ]) {
      const css = await compilePill([`squircle-pill-${name}`]);
      const flipped = css.indexOf(":dir(rtl)");
      expect(flipped, name).toBeGreaterThan(-1);
      expect(css.slice(0, flipped)).toContain(`${PILL_SIDE_VAR_NAME}: ${ltr};`);
      expect(css.slice(flipped)).toContain(`${PILL_SIDE_VAR_NAME}: ${rtl};`);
      expect(css.slice(flipped)).toContain(`border-radius: ${radii[rtl]};`);
    }
  });

  it("sets only the side and the fallback radius", async () => {
    const css = await compilePill(["squircle-pill-t"]);
    expect(css).not.toContain("mask-image");
    expect(css).not.toContain("::before");
  });

  it("starts every pill at auto, so a nested pill doesn't take its parent's side", async () => {
    const css = await compilePill(["squircle-pill"]);
    const own = /:where\(&\) \{([^}]*)\}/.exec(css)?.[1];
    expect(own).toContain(`${PILL_SIDE_VAR_NAME}: auto;`);
  });

  it("honours a custom prefix", async () => {
    const css = await compilePill(["pillbox-l"], 'prefix: "pillbox";');
    expect(css).toContain(".pillbox-l");
    expect(css).toContain(`${PILL_SIDE_VAR_NAME}: l;`);
  });
});
```

In `it("registers the properties the pill reads", …)`, add `PILL_SIDE_VAR_NAME` to the `for` list and:

```ts
expect(css).toMatch(new RegExp(`@property ${PILL_SIDE_VAR_NAME} \\{[^}]*initial-value: auto;`));
```

- [ ] **Step 2: Write the failing standalone tests**

In `package/src/pill-shape.test.ts`, inside `describe("against squircle-pill.css", …)`:

```ts
it("caps one end from the attribute's value", () => {
  for (const [value, side] of [
    ["t", "t"],
    ["r", "r"],
    ["b", "b"],
    ["l", "l"],
    ["x", "auto"],
    ["y", "auto"],
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
});

it("starts a bare pill at auto, at zero specificity", () => {
  expect(stylesheet).toMatch(
    new RegExp(`:where\\(\\[${PILL_ATTRIBUTE}\\]\\) \\{[^}]*${PILL_SIDE_VAR_NAME}: auto;`),
  );
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `vp test src/tailwind-pill.test.ts src/pill-shape.test.ts`
Expected: FAIL on the new side tests and the zero-specificity radius test.

- [ ] **Step 4: Add the side table to `pill-css.ts`**

After `PillCss`:

```ts
/** Every side utility's suffix, and every value `data-<namespace>-pill` takes. */
export const PILL_SIDE_NAMES = ["x", "y", "t", "r", "b", "l", "s", "e"] as const;
export type PillSideName = (typeof PILL_SIDE_NAMES)[number];

type PillSide = typeof DEFAULT_PILL_SIDE | "t" | "r" | "b" | "l";

/** The stadium fallback for each side: full on the capped corners, square on the others. */
const SIDE_RADII: Record<PillSide, string> = {
  auto: FULL_RADIUS,
  t: `${FULL_RADIUS} ${FULL_RADIUS} 0 0`,
  r: `0 ${FULL_RADIUS} ${FULL_RADIUS} 0`,
  b: `0 0 ${FULL_RADIUS} ${FULL_RADIUS}`,
  l: `${FULL_RADIUS} 0 0 ${FULL_RADIUS}`,
};

const capping = (side: PillSide): PillCss => ({
  [PILL_SIDE_VAR_NAME]: side,
  "border-radius": SIDE_RADII[side],
});

/**
 * One side's rules: the end it caps, and the fallback radius to match, which
 * the browser scales down to the same radius the worklet clamps a cap to.
 * `x` and `y` are the automatic pill: a cap can never be wider than the box
 * allows, so capping both ends of either axis is what `auto` already draws.
 * `s` and `e` turn into `l` and `r`, swapped under `:dir(rtl)`, so the
 * worklet only ever sees a physical side.
 */
export function pillSideCss(name: PillSideName): PillCss {
  if (name === "x" || name === "y") return capping(DEFAULT_PILL_SIDE);
  if (name === "s") return { ...capping("l"), "&:dir(rtl)": capping("r") };
  if (name === "e") return { ...capping("r"), "&:dir(rtl)": capping("l") };
  return capping(name);
}
```

Import `FULL_RADIUS` if `pill-css.ts` doesn't already.

- [ ] **Step 5: Move the pill's radius to zero specificity**

In `pillCssObj`'s returned object, delete the top-level `"border-radius": FULL_RADIUS,` line and move its comment into the `:where(&)` block, which gains two declarations as its first entries:

```ts
    ":where(&)": {
      // A stadium on every branch: it is the whole fallback without the
      // worklet, and what an outline the pill doesn't draw itself — the
      // browser's focus ring — follows with it. Zero specificity, so a side
      // utility's radius wins whatever the order.
      "border-radius": FULL_RADIUS,
      // Every pill starts with both ends capped, rather than taking a side
      // from a pill it is nested in.
      [PILL_SIDE_VAR_NAME]: DEFAULT_PILL_SIDE,
      [PILL_BORDER_WIDTH_VAR_NAME]: "0px",
      // …the existing declarations, unchanged…
```

- [ ] **Step 6: Render the attribute values in `renderPillCss`**

After `blocks.push(...renderRule(selector, pillCssObj("standalone")));`:

```ts
// `data-<namespace>-pill="t"` and friends: the side utilities' rules, on
// the attribute's value.
for (const name of PILL_SIDE_NAMES) {
  blocks.push(...renderRule(selector.replace(/\]$/, `="${name}"]`), pillSideCss(name)));
}
```

- [ ] **Step 7: Add the Tailwind utilities**

In `tailwind-pill.ts`, import `PILL_SIDE_NAMES` and `pillSideCss` from `./pill-css`. In `addUtilities`, after the `-g3` entry:

```ts
          ...Object.fromEntries(
            PILL_SIDE_NAMES.map((name) => [
              `.${prefix}-${name}`,
              pillSideCss(name) as Record<string, string | Record<string, string>>,
            ]),
          ),
```

Rewrite the doc comment above `squirclePill` to:

```ts
/**
 * One shape, `squircle-pill`, with its caps derived from the element's own
 * size, so there is no size to pick. What can be picked is which end it caps:
 * `-t`, `-r`, `-b`, `-l`, and `-s`/`-e` for the inline ends, cap that end
 * alone and square the other; `-x` and `-y` are the automatic pill, spelled
 * out. The knobs the shape has — the easing amount, its ease, and its
 * continuity — get `-amt-*`, `-ease-*` and `-g2`/`-g3` utilities, which only
 * set the custom property, the same thing writing it yourself does.
 *
 * The rules themselves live in pill-css.ts, shared with the standalone
 * stylesheet.
 */
```

- [ ] **Step 8: List the side in `PILL_SHAPE_PROPERTIES`**

In `pill-worklet.ts`, import `DEFAULT_PILL_SIDE` and `PILL_SIDE_VAR_NAME`, and add:

```ts
  side: { name: PILL_SIDE_VAR_NAME, default: DEFAULT_PILL_SIDE },
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `vp test`
Expected: PASS. If a `tailwind.test.ts` snapshot that includes the pill changes, inspect the diff. The only change should be `border-radius` moving into `:where(&)` and the new side declarations. Then update it with `vp test -u`.

- [ ] **Step 10: Commit**

```bash
git add package/src
git commit -m "feat(pill): add squircle-pill-t/r/b/l/s/e/x/y and data-squircle-pill side values"
```

---

### Task 3: The polyfill draws sides

**Files:**

- Modify: `package/src/pill-polyfill.ts` (`PillShapeInput` ~line 41; `PillGeometry` ~line 46; `pillOutlinePoints` ~line 82; `pillClipPath` ~line 160; `read` ~line 469; shape key ~line 512)
- Modify: `package/src/pill-polyfill.test.ts`

**Interfaces:**

- Consumes: worklet `boxOutline(width, height, props)` (Task 1); `PILL_SIDE_VAR_NAME`.
- Produces: `PillShapeInput.side?: string`.

- [ ] **Step 1: Write the failing tests**

In `package/src/pill-polyfill.test.ts`, add `PILL_SIDE_VAR_NAME` to the `./variants` import, and inside `describe("outline", …)`:

```ts
it("traces a side pill exactly as the worklet does", () => {
  for (const side of ["t", "r", "b", "l"]) {
    for (const [width, height] of [
      [200, 40],
      [40, 200],
      [40, 40],
    ]) {
      const label = `${side} ${width}x${height}`;
      const ours = pillOutlinePoints(width, height, { side });
      const theirs = workletVertices(width, height, { [PILL_SIDE_VAR_NAME]: side });
      // The worklet closes its path by returning to the first point; ours
      // leaves the close to the path's `Z`.
      if (theirs.length === ours.length + 1) theirs.pop();
      expect(ours.length, label).toBe(theirs.length);
      ours.forEach((p, i) => {
        expect(p.x, label).toBeCloseTo((theirs[i] as Point).x, 6);
        expect(p.y, label).toBeCloseTo((theirs[i] as Point).y, 6);
      });
    }
  }
});
```

Inside `describe("background clip", …)`:

```ts
it("is still needed for a square with a side, which is an arch", () => {
  expect(pillClipPath(40, 40, { side: "t" })).toMatch(/^path\("M/);
  expect(pillClipPath(40, 40, { side: "auto" })).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vp test src/pill-polyfill.test.ts`
Expected: FAIL. The side is ignored, so the outlines are the automatic pill, and a square's clip is `null`.

- [ ] **Step 3: Implement**

`PillShapeInput` gains:

```ts
  side?: string;
```

In `PillGeometry`, replace the `resolveAngle`, `resolveExponent`, `resolveContinuity`, `fittedQuadrant` and `outline` members with:

```ts
  boxOutline(width: number, height: number, props: Lookup): Point[];
```

Import `PILL_SIDE_VAR_NAME`. Replace the body of `pillOutlinePoints` from `const props = lookup({` down to the end of its `for` loop with:

```ts
const props = lookup({
  [PILL_AMT_VAR_NAME]: shape.amt,
  [PILL_EASE_VAR_NAME]: shape.ease,
  [PILL_CONTINUITY_VAR_NAME]: shape.continuity,
  [PILL_SIDE_VAR_NAME]: shape.side,
});
const out: Point[] = [];
for (const q of geometry.boxOutline(width, height, props)) {
  // The pieces of the outline meet at shared points; drop the repeats,
  // which have no direction to offset along.
  const last = out[out.length - 1];
  if (!last || Math.abs(last.x - q.x) > 1e-6 || Math.abs(last.y - q.y) > 1e-6) out.push(q);
}
```

Keep the closing-point removal after it. Change its doc comment to:

```ts
/**
 * The pill's outline in box coordinates, in the order the worklet draws it,
 * which is the worklet's own `boxOutline`.
 */
```

In `pillClipPath`, change the early return and its doc comment's last sentence:

```ts
const auto = !shape?.side?.trim() || shape.side.trim() === "auto";
if (width <= 0 || height <= 0 || (width === height && inset <= 0 && auto)) return null;
```

```ts
 * … `null` for a square pill that needs no pulling in, whose stadium
 * `border-radius` is already the circle it has to be; a square capped at one
 * end is an arch, and needs its clip.
```

In `read`, add to `shape`:

```ts
        side: style.getPropertyValue(PILL_SIDE_VAR_NAME),
```

Change the shape key:

```ts
const shapeKey = `${width},${height},${shape.amt},${shape.ease},${shape.continuity},${shape.side}`;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `vp test` and `npx tsc --noEmit -p .. 2>&1 | grep -E "pill-polyfill|pill-shape|pill-css|tailwind-pill"`
Expected: all tests PASS; grep prints nothing (the repo has unrelated pre-existing `tsc` errors).

- [ ] **Step 5: Commit**

```bash
git add package/src/pill-polyfill.ts package/src/pill-polyfill.test.ts
git commit -m "feat(pill): draw side pills in the polyfill"
```

---

### Task 4: tailwind-merge group and README

**Files:**

- Modify: `package/src/tailwind.ts` (`classGroups`, comment above `SIDE_CORNERS`)
- Modify: `package/src/tailwind-merge.test.ts` (`describe("squircle-pill", …)`)
- Modify: `README.md` (tailwind-merge paragraph ~line 91; pill utilities table ~line 497; standalone section ~line 558; merge config copy ~line 1360)

**Interfaces:**

- Consumes: the utility names from Task 2.

- [ ] **Step 1: Write the failing test**

In `describe("squircle-pill", …)` in `tailwind-merge.test.ts`:

```ts
it("its sides replace each other and nothing else", () => {
  expect(twMerge("squircle-pill-t squircle-pill-l")).toBe("squircle-pill-l");
  expect(twMerge("squircle-pill-x squircle-pill-s")).toBe("squircle-pill-s");
  expect(twMerge("squircle-pill squircle-pill-e squircle-pill-amt-3")).toBe(
    "squircle-pill squircle-pill-e squircle-pill-amt-3",
  );
  expect(twMerge("squircle-pill-l squircle-md")).toBe("squircle-pill-l squircle-md");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vp test src/tailwind-merge.test.ts`
Expected: FAIL. `squircle-pill-t squircle-pill-l` keeps both, or a side drops the pill.

- [ ] **Step 3: Implement**

In `tailwind.ts`'s `classGroups`, after the continuity group:

```ts
  [`${PILL}-side`]: ["x", "y", "t", "r", "b", "l", "s", "e"].map((side) => `${PILL}-${side}`),
```

Extend the comment above `SIDE_CORNERS`: change "Its `-amt-*`, `-ease-*` and `-g2`/`-g3` knobs each get a group" to "Its `-amt-*`, `-ease-*`, `-g2`/`-g3` and side (`-t`, `-x`, …) knobs each get a group".

- [ ] **Step 4: Run it to verify it passes**

Run: `vp test src/tailwind-merge.test.ts`
Expected: PASS

- [ ] **Step 5: Update the README**

1. **tailwind-merge paragraph (~line 91):** replace "its `-amt-*`, `-ease-*` and `-g2`/`-g3` modifiers each only cancel their own kind" with "its `-amt-*`, `-ease-*`, `-g2`/`-g3` and side modifiers each only cancel their own kind".
2. **Merge config copy (~line 1360):** add the same `classGroups` line as Step 3 after the continuity group. Its comment, "`squircle-pill` is an all-corners utility; its knobs each get their own group.", already covers the sides.
3. **Pill utilities table (~line 497):** after the `squircle-pill` row, add:

```md
| `squircle-pill-t`, `-r`, `-b`, `-l` | Caps that end alone and squares the other. A cap is never larger than the box allows, so `squircle-pill-t` on a wide button is a tab whose top corners run its full height. |
| `squircle-pill-s`, `-e` | The inline-start or inline-end end: `-l`/`-r`, swapped under `dir="rtl"`. |
| `squircle-pill-x`, `-y` | The automatic pill, spelled out: a cap can't be wider than the box, so capping both ends of either axis is what `squircle-pill` already draws, and a square is always a circle. |
```

Then run `vp fmt README.md --write` to realign the table.

4. **After the table's paragraph (~line 502):** add a button-group example and the RTL caveat:

````md
A side is a modifier on the pill, one per pill; a later one replaces an earlier one. It's for button groups and segmented controls:

```html
<div class="flex gap-0.5">
  <button class="squircle-pill squircle-pill-s bg-zinc-800 px-4 py-2">Day</button>
  <button class="bg-zinc-800 px-4 py-2">Week</button>
  <button class="squircle-pill squircle-pill-e bg-zinc-800 px-4 py-2">Month</button>
</div>
```

The side sets `--squircle-pill-side` (`auto`, `t`, `r`, `b` or `l`) and the fallback's `border-radius`. Under the polyfill, a pill's side is read when its class or attribute changes. If you flip `dir` on an ancestor of `-s`/`-e` pills, call the polyfill's `refresh()`.
````

5. **Standalone section (~line 562):** after the `<button data-squircle-pill …>` example, add:

```md
Give the attribute a value to cap one end: `data-squircle-pill="t"`, and `r`, `b`, `l`, `s`, `e`, `x` and `y`, as the utilities do.
```

- [ ] **Step 6: Check and commit**

Run (from the repo root): `vp check`
Expected: format and lint pass.

```bash
git add package/src/tailwind.ts package/src/tailwind-merge.test.ts README.md
git commit -m "docs(pill): document pill sides, and add them to squircleMergeConfig"
```

---

### Task 5: Pill gallery demonstrates every side

**Files:**

- Modify: `website/src/pages/demos/pill-gallery.astro`

**Interfaces:**

- Consumes: every utility and attribute value from Task 2.

- [ ] **Step 1: Extend `Example`**

Change `build` and add `rtl`:

```ts
  /**
   * A plain pill; a tall or square one, for the sides; a focusable button for
   * focus states; a pill holding a smaller one; a three-button group capped
   * at its ends; or a `data-squircle-pill` element styled with the plain-CSS
   * stylesheet's own properties, or (`standalone-side`) given `classes` as
   * the attribute's value.
   */
  build?:
    | "pill"
    | "tall"
    | "square"
    | "button"
    | "nested"
    | "group"
    | "standalone"
    | "standalone-side";
  /** Laid out right to left, for the inline sides. */
  rtl?: boolean;
  /** For `group`: a border on every button. */
  bordered?: boolean;
```

- [ ] **Step 2: Add the sections**

Insert at the start of `sections`, so the sides come first:

```ts
  {
    title: "Sides",
    intro:
      "A side caps that end alone and squares the other. -s and -e are the inline ends, so they swap right to left. -x and -y are the automatic pill spelled out: a cap can't be wider than the box, so capping both ends of either axis is what squircle-pill already draws.",
    examples: [
      { classes: "", note: "Both short ends, chosen from the aspect ratio." },
      { classes: "squircle-pill-x", note: "The same pill, the axis spelled out." },
      { classes: "squircle-pill-y", note: "Still the same pill: the caps can't outgrow the height." },
      { classes: "squircle-pill-l", note: "The left end, the same cap as a full pill's." },
      { classes: "squircle-pill-r", note: "The right end." },
      { classes: "squircle-pill-t", note: "The top: a tab whose corners run the full height." },
      { classes: "squircle-pill-b", note: "The bottom." },
      { classes: "squircle-pill-s", note: "The inline start: the left here." },
      { classes: "squircle-pill-e", note: "The inline end: the right here." },
      { classes: "squircle-pill-s", note: "Right to left, the start is the right.", rtl: true },
      { classes: "squircle-pill-e", note: "Right to left, the end is the left.", rtl: true },
    ],
  },
  {
    title: "Sides on tall and square pills",
    intro:
      "The same utilities on a pill taller than it is wide, and on a square. A cap is clamped to what the box can give it, so a square capped at one end is an arch, not a circle.",
    examples: [
      { classes: "", note: "Tall: caps top and bottom.", build: "tall" },
      { classes: "squircle-pill-x", note: "Still top and bottom.", build: "tall" },
      { classes: "squircle-pill-y", note: "The axis spelled out.", build: "tall" },
      { classes: "squircle-pill-t", note: "The top end alone.", build: "tall" },
      { classes: "squircle-pill-b", note: "The bottom end alone.", build: "tall" },
      { classes: "squircle-pill-l", note: "The left, clamped to the width.", build: "tall" },
      { classes: "squircle-pill-r", note: "The right, clamped to the width.", build: "tall" },
      { classes: "", note: "Square: a circle.", build: "square" },
      { classes: "squircle-pill-t", note: "Square, top only: an arch.", build: "square" },
      { classes: "squircle-pill-l", note: "Square, left only.", build: "square" },
    ],
  },
  {
    title: "Button groups",
    intro:
      "What sides are for: the first button capped at the start, the last at the end, the middle square. The same markup right to left caps the other way round.",
    examples: [
      {
        classes: "squircle-pill-s · (square) · squircle-pill-e",
        note: "Left to right.",
        build: "group",
      },
      {
        classes: "squircle-pill-s · (square) · squircle-pill-e",
        note: "The same markup, right to left.",
        build: "group",
        rtl: true,
      },
      {
        classes: "squircle-pill-s · (square) · squircle-pill-e",
        note: "With a border on each button.",
        build: "group",
        bordered: true,
      },
    ],
  },
```

In the "Without Tailwind" section's `examples`, append:

```ts
      { classes: "t", note: "Capped at the top, from the attribute alone.", build: "standalone-side" },
      { classes: "l", note: "Capped at the left.", build: "standalone-side" },
      { classes: "e", note: "Capped at the inline end.", build: "standalone-side" },
      {
        classes: "e",
        note: "The inline end, right to left.",
        build: "standalone-side",
        rtl: true,
      },
      { classes: "x", note: "The automatic pill.", build: "standalone-side" },
```

- [ ] **Step 3: Render the new builds**

Destructure `rtl` and `bordered` too: `({ classes, note, build = "pill", light, rtl, bordered })`. On the tile `<div class:list={…}>`, add `dir={rtl ? "rtl" : undefined}` and give tall and square tiles room:

```astro
                    class:list={[
                      "flex items-center",
                      (section.light || light)
                        ? "h-28 self-stretch rounded-lg bg-zinc-100 px-6"
                        : build === "tall"
                          ? "h-40 px-3"
                          : "h-20 px-3",
                    ]}
```

Next to the existing builds:

```astro
                    {build === "tall" && (
                      <div class={`squircle-pill h-36 w-12 bg-indigo-500 ${classes}`} />
                    )}
                    {build === "square" && (
                      <div class={`squircle-pill size-16 bg-indigo-500 ${classes}`} />
                    )}
                    {build === "group" && (
                      <div class="flex gap-0.5">
                        <button
                          type="button"
                          class:list={[
                            "squircle-pill squircle-pill-s h-10 bg-indigo-500 px-4 text-sm font-medium",
                            bordered && "border-2 border-white",
                          ]}
                        >
                          Day
                        </button>
                        <button
                          type="button"
                          class:list={[
                            "h-10 bg-indigo-500 px-4 text-sm font-medium",
                            bordered && "border-2 border-white",
                          ]}
                        >
                          Week
                        </button>
                        <button
                          type="button"
                          class:list={[
                            "squircle-pill squircle-pill-e h-10 bg-indigo-500 px-4 text-sm font-medium",
                            bordered && "border-2 border-white",
                          ]}
                        >
                          Month
                        </button>
                      </div>
                    )}
                    {build === "standalone-side" && (
                      <div
                        data-squircle-pill={classes}
                        class="h-12 w-40 text-zinc-100"
                        style={STANDALONE_BACKGROUND}
                      />
                    )}
```

Change the label so attribute values read as markup:

```astro
                    <p class="font-mono text-xs break-all text-zinc-200">
                      {build === "standalone-side"
                        ? `data-squircle-pill="${classes}"`
                        : classes || "(no classes)"}
                      {rtl && " · dir=rtl"}
                    </p>
```

- [ ] **Step 4: Build and check**

Run (from the repo root): `vp check` then `vp run ready`.
Expected: both pass. `vp run ready` builds the package and the website.

- [ ] **Step 5: Look at it**

Start the site (`vp dev` in `website/`; if binding a port fails with EPERM, the sandbox needs `sandbox.network.allowLocalBinding: true`). With the Playwright browser tools, open `/demos/pill-gallery?mode=worklet` and `/demos/pill-gallery?mode=polyfill`, and screenshot the three side sections and "Without Tailwind" in each. Check:

- Each side caps the end its note says.
- The RTL examples are mirrored.
- The square `-t` is an arch.
- The bordered group's borders follow the caps.
- `?mode=none` shows the matching `border-radius` fallbacks.

- [ ] **Step 6: Commit**

```bash
git add website/src/pages/demos/pill-gallery.astro
git commit -m "chore(demos): show every pill side in the pill gallery"
```

---

### Task 6: Final verification

- [ ] **Step 1:** From the repo root, run `vp check` and `vp run ready`. Expected: both pass.
- [ ] **Step 2:** From `package/`, run `vp test`. Expected: everything passes, with no snapshot left outdated.
- [ ] **Step 3:** Run `git log --oneline alpha..HEAD` and confirm the commits: the merge fix, the spec and plan, then Tasks 1–5.
