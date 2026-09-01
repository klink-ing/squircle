// THIS FILE IS GENERATED — DO NOT EDIT.
// Source: scripts/generate-stylex.ts (template: src/stylex.template.ts)
//
// To regenerate: tsx package/scripts/generate-stylex.ts (also runs in vp build).
// To modify variant shape, edit `renderVariant` in the generator.
// To add/rename variants, edit `CAMEL_VARIANTS` and `VARIANTS` in src/variants.ts.

/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import * as stylex from "@stylexjs/stylex";

/**
 * StyleX squircle utilities — generated from this template by
 * `scripts/generate-stylex.ts`.
 *
 * Each variant is a *dynamic* style — a function that takes a `radius` (and
 * an optional superellipse `amt`) and produces a `borderRadius` +
 * `cornerShape` pair gated behind `@supports (corner-shape: superellipse(2))`.
 * Browsers that don't support `corner-shape` fall back to a plain rounded
 * rectangle at the same radius.
 *
 * ```tsx
 * import * as stylex from '@stylexjs/stylex';
 * import { squircle } from '@klinking/squircle/stylex';
 *
 * <div {...stylex.props(squircle.all('1rem'))} />
 * <div {...stylex.props(squircle.topLeft('0.5rem', 3))} />
 * ```
 *
 * If `amt` is omitted, the corrected radius and `corner-shape` use the
 * literal default exponent of `2` — pass `amt` explicitly per-call site to
 * tune it. Unlike the Tailwind and Panda integrations, this preset does not
 * read `--squircle-amt`; StyleX's per-call parameter is the only knob.
 *
 * **Constraint** — StyleX's babel plugin requires `stylex.create(...)` to
 * receive a fully-static object literal, and forbids destructuring,
 * spreading, or default values on dynamic-style function parameters. The
 * whole 15-variant table is therefore spelled out verbatim in the generated
 * output. Every entry in this template must remain statically analyzable at
 * its final call site.
 *
 * **How to modify**
 *
 * - To tweak a *variant's body* (the `borderRadius`/`cornerShape` block),
 *   edit `renderVariant` in `scripts/generate-stylex.ts`.
 * - To add or rename variants, edit `CAMEL_VARIANTS` and `VARIANTS` in
 *   `variants.ts`.
 * - To tweak the *file shell* (imports, docstring, the wrapping
 *   `stylex.create({ ... })` call), edit this template.
 *
 * Then run `tsx scripts/generate-stylex.ts` (or just `vp run build`) to
 * regenerate `stylex.ts`. Do not hand-edit `stylex.ts`.
 */
export const squircle = stylex.create({
  // --- All corners ---

  all: (radius: string | number, amt: string | number | undefined) => ({
    borderRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),

  // --- Per-side physical ---

  top: (radius: string | number, amt: string | number | undefined) => ({
    borderTopLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    borderTopRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerTopLeftShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
    cornerTopRightShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),

  right: (radius: string | number, amt: string | number | undefined) => ({
    borderTopRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    borderBottomRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerTopRightShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
    cornerBottomRightShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),

  bottom: (radius: string | number, amt: string | number | undefined) => ({
    borderBottomLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    borderBottomRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerBottomLeftShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
    cornerBottomRightShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),

  left: (radius: string | number, amt: string | number | undefined) => ({
    borderTopLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    borderBottomLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerTopLeftShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
    cornerBottomLeftShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),

  // --- Per-side logical ---

  start: (radius: string | number, amt: string | number | undefined) => ({
    borderStartStartRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    borderEndStartRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerStartStartShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
    cornerEndStartShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),

  end: (radius: string | number, amt: string | number | undefined) => ({
    borderStartEndRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    borderEndEndRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerStartEndShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
    cornerEndEndShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),

  // --- Per-corner physical ---

  topLeft: (radius: string | number, amt: string | number | undefined) => ({
    borderTopLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerTopLeftShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),

  topRight: (radius: string | number, amt: string | number | undefined) => ({
    borderTopRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerTopRightShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),

  bottomRight: (radius: string | number, amt: string | number | undefined) => ({
    borderBottomRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerBottomRightShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),

  bottomLeft: (radius: string | number, amt: string | number | undefined) => ({
    borderBottomLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerBottomLeftShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),

  // --- Per-corner logical ---

  startStart: (radius: string | number, amt: string | number | undefined) => ({
    borderStartStartRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerStartStartShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),

  startEnd: (radius: string | number, amt: string | number | undefined) => ({
    borderStartEndRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerStartEndShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),

  endStart: (radius: string | number, amt: string | number | undefined) => ({
    borderEndStartRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerEndStartShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),

  endEnd: (radius: string | number, amt: string | number | undefined) => ({
    borderEndEndRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerEndEndShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
});
