/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import * as stylex from "@stylexjs/stylex";

/**
 * StyleX pill shape utilities — for use with Houdini paint worklet.
 *
 * Each variant is a *dynamic* style — a function that takes a `radius`
 * and produces paint worklet configuration with fallback to corner-shape.
 *
 * ```tsx
 * import * as stylex from '@stylexjs/stylex';
 * import { squirclePill } from '@klinking/squircle/stylex-pill';
 *
 * <div {...stylex.props(squirclePill.all('1rem'))} />
 * <div {...stylex.props(squirclePill.topLeft('0.5rem', 2.5))} />
 * ```
 *
 * If `amt` is omitted, the pill transition uses the default exponent of `2`.
 * Pass `amt` explicitly to tune the superellipse transition curves.
 *
 * **Constraint** — StyleX's babel plugin requires `stylex.create(...)` to
 * receive a fully-static object literal. All 15 variants are spelled out
 * in the generated output.
 *
 * This is a template file. To regenerate the actual stylex-pill.ts:
 * Update scripts/generate-stylex.ts to support pill generation, then run:
 * `tsx package/scripts/generate-stylex.ts`
 */
export const squirclePill = stylex.create({
  // --- All corners ---

  all: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "--pill-width": "100%",
    "--pill-height": "100%",
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderRadius: radius,
      cornerShape: `superellipse(${amt ?? 2})`,
    },
  }),

  // --- Per-side physical variants ---

  top: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderTopLeftRadius: radius,
      borderTopRightRadius: radius,
      cornerTopLeftShape: `superellipse(${amt ?? 2})`,
      cornerTopRightShape: `superellipse(${amt ?? 2})`,
    },
  }),

  right: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderTopRightRadius: radius,
      borderBottomRightRadius: radius,
      cornerTopRightShape: `superellipse(${amt ?? 2})`,
      cornerBottomRightShape: `superellipse(${amt ?? 2})`,
    },
  }),

  bottom: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderBottomLeftRadius: radius,
      borderBottomRightRadius: radius,
      cornerBottomLeftShape: `superellipse(${amt ?? 2})`,
      cornerBottomRightShape: `superellipse(${amt ?? 2})`,
    },
  }),

  left: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderTopLeftRadius: radius,
      borderBottomLeftRadius: radius,
      cornerTopLeftShape: `superellipse(${amt ?? 2})`,
      cornerBottomLeftShape: `superellipse(${amt ?? 2})`,
    },
  }),

  // --- Per-side logical variants ---

  start: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderStartStartRadius: radius,
      borderEndStartRadius: radius,
      cornerStartStartShape: `superellipse(${amt ?? 2})`,
      cornerEndStartShape: `superellipse(${amt ?? 2})`,
    },
  }),

  end: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderStartEndRadius: radius,
      borderEndEndRadius: radius,
      cornerStartEndShape: `superellipse(${amt ?? 2})`,
      cornerEndEndShape: `superellipse(${amt ?? 2})`,
    },
  }),

  // --- Per-corner physical variants ---

  topLeft: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderTopLeftRadius: radius,
      cornerTopLeftShape: `superellipse(${amt ?? 2})`,
    },
  }),

  topRight: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderTopRightRadius: radius,
      cornerTopRightShape: `superellipse(${amt ?? 2})`,
    },
  }),

  bottomRight: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderBottomRightRadius: radius,
      cornerBottomRightShape: `superellipse(${amt ?? 2})`,
    },
  }),

  bottomLeft: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderBottomLeftRadius: radius,
      cornerBottomLeftShape: `superellipse(${amt ?? 2})`,
    },
  }),

  // --- Per-corner logical variants ---

  startStart: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderStartStartRadius: radius,
      cornerStartStartShape: `superellipse(${amt ?? 2})`,
    },
  }),

  startEnd: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderStartEndRadius: radius,
      cornerStartEndShape: `superellipse(${amt ?? 2})`,
    },
  }),

  endStart: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderEndStartRadius: radius,
      cornerEndStartShape: `superellipse(${amt ?? 2})`,
    },
  }),

  endEnd: (radius: string | number, amt: string | number | undefined) => ({
    "--pill-radius": radius,
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderEndEndRadius: radius,
      cornerEndEndShape: `superellipse(${amt ?? 2})`,
    },
  }),
});
