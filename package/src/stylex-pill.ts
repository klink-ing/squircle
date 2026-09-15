/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import * as stylex from "@stylexjs/stylex";

/**
 * StyleX pill shape utilities — for use with Houdini paint worklet.
 *
 * Single base pill utility with automatic radius calculation and side-specific variants.
 *
 * ```tsx
 * import * as stylex from '@stylexjs/stylex';
 * import { squirclePill } from '@klinking/squircle/stylex-pill';
 *
 * <div {...stylex.props(squirclePill.all())} />
 * <div {...stylex.props(squirclePill.top())} />
 * <div {...stylex.props(squirclePill.all(2.5))} /> // with amt parameter
 * ```
 *
 * The `amt` parameter is optional and controls the superellipse transition smoothness.
 * If omitted, defaults to `2`.
 */
export const squirclePill = stylex.create({
  all: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderRadius: "50%",
      cornerShape: `superellipse(${amt})`,
    },
  }),

  top: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderTopLeftRadius: "50%",
      borderTopRightRadius: "50%",
      cornerTopLeftShape: `superellipse(${amt})`,
      cornerTopRightShape: `superellipse(${amt})`,
    },
  }),

  right: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderTopRightRadius: "50%",
      borderBottomRightRadius: "50%",
      cornerTopRightShape: `superellipse(${amt})`,
      cornerBottomRightShape: `superellipse(${amt})`,
    },
  }),

  bottom: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderBottomLeftRadius: "50%",
      borderBottomRightRadius: "50%",
      cornerBottomLeftShape: `superellipse(${amt})`,
      cornerBottomRightShape: `superellipse(${amt})`,
    },
  }),

  left: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderTopLeftRadius: "50%",
      borderBottomLeftRadius: "50%",
      cornerTopLeftShape: `superellipse(${amt})`,
      cornerBottomLeftShape: `superellipse(${amt})`,
    },
  }),

  start: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderStartStartRadius: "50%",
      borderEndStartRadius: "50%",
      cornerStartStartShape: `superellipse(${amt})`,
      cornerEndStartShape: `superellipse(${amt})`,
    },
  }),

  end: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderStartEndRadius: "50%",
      borderEndEndRadius: "50%",
      cornerStartEndShape: `superellipse(${amt})`,
      cornerEndEndShape: `superellipse(${amt})`,
    },
  }),

  topLeft: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderTopLeftRadius: "50%",
      cornerTopLeftShape: `superellipse(${amt})`,
    },
  }),

  topRight: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderTopRightRadius: "50%",
      cornerTopRightShape: `superellipse(${amt})`,
    },
  }),

  bottomRight: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderBottomRightRadius: "50%",
      cornerBottomRightShape: `superellipse(${amt})`,
    },
  }),

  bottomLeft: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderBottomLeftRadius: "50%",
      cornerBottomLeftShape: `superellipse(${amt})`,
    },
  }),

  startStart: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderStartStartRadius: "50%",
      cornerStartStartShape: `superellipse(${amt})`,
    },
  }),

  startEnd: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderStartEndRadius: "50%",
      cornerStartEndShape: `superellipse(${amt})`,
    },
  }),

  endStart: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderEndStartRadius: "50%",
      cornerEndStartShape: `superellipse(${amt})`,
    },
  }),

  endEnd: (amt: string | number | undefined = 2) => ({
    "@supports (background-image: paint(pill-shape))": {
      backgroundImage: "paint(pill-shape)",
    },
    "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
      borderEndEndRadius: "50%",
      cornerEndEndShape: `superellipse(${amt})`,
    },
  }),
});
