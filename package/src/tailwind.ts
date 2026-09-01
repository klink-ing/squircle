/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import plugin from "tailwindcss/plugin";
import {
  DEFAULT_AMOUNT_VAR_NAME,
  DEFAULT_R_VAR_NAME,
  FULL_RADIUS,
  NONE_RADIUS,
  cornerShapeProp,
  squircleFullCssObj,
  SUPPORTS_RULE,
  squircleCssObj,
  variantEntries,
} from "./variants";

// --- Tailwind plugin ---------------------------------------------------------

export interface SquirclePluginOptions {
  /** CSS custom property name for the superellipse amount (default: "--squircle-amt") */
  amtVar?: string;
  /** @plugin CSS alias for amtVar */
  "amt-var"?: string;
  /** CSS custom property name for the intermediate corrected radius (default: "--squircle-r") */
  rVar?: string;
  /** @plugin CSS alias for rVar */
  "r-var"?: string;
  /** Class name prefix for utilities (default: "squircle") */
  prefix?: string;
}

const squircle: ReturnType<typeof plugin.withOptions<SquirclePluginOptions>> =
  plugin.withOptions<SquirclePluginOptions>((options = {}) =>
    // eslint-disable-next-line @typescript-eslint/unbound-method
    ({ addUtilities, matchUtilities, theme }) => {
    const amtVar = options.amtVar ?? options["amt-var"] ?? DEFAULT_AMOUNT_VAR_NAME;
    const rVar = options.rVar ?? options["r-var"] ?? DEFAULT_R_VAR_NAME;
    const prefix = options.prefix ?? "squircle";
    // Drop none/full from the functional values (the v3-compat theme still
    // carries them) — they're registered as static utilities below instead,
    // with the same values Tailwind uses for rounded-none/rounded-full.
    const { none: _none, full: _full, ...radiusValues } = theme("borderRadius") ?? {};

    matchUtilities(
      {
        [`${prefix}-amt`]: (value: string) => ({
          [amtVar]: value,
          [SUPPORTS_RULE]: {
            "corner-shape": `superellipse(var(${amtVar}))`,
          },
        }),
      },
      { type: "number" },
    );

    for (const [suffix, props] of variantEntries()) {
      const name = suffix ? `${prefix}-${suffix}` : prefix;
      // Static -none/-full utilities, registered the same way Tailwind
      // defines rounded-none and rounded-full (0 and calc(infinity * 1px)
      // rather than theme values). -none needs no superellipse correction.
      addUtilities({
        [`.${name}-none`]: Object.fromEntries(props.map((p) => [p, NONE_RADIUS])),
        [`.${name}-full`]: squircleFullCssObj(props, { amtVar }) as Record<
          string,
          string | Record<string, string>
        >,
      });
      matchUtilities(
        {
          [name]: (value: string) =>
            squircleCssObj(props, value, { amtVar, rVar }) as Record<
              string,
              string | Record<string, string>
            >,
        },
        { type: "length", values: radiusValues },
      );

      // Re-declare the matching rounded-* utility so it also resets the
      // corners it owns back to `round`. Tailwind keeps its own definition and
      // emits it after this one, so the radius still comes from core and this
      // only contributes the reset — the initial value, so it is inert unless
      // a squircle class set a shape on the same element. Without it a
      // rounded-* utility cannot take a corner back from a squircle, since it
      // only ever sets a radius.
      const roundedName = suffix ? `rounded-${suffix}` : "rounded";
      const reset = Object.fromEntries(props.map((p) => [cornerShapeProp(p), "round"]));
      addUtilities({
        [`.${roundedName}-full`]: {
          ...Object.fromEntries(props.map((p) => [p, FULL_RADIUS])),
          ...reset,
        },
      });
      matchUtilities(
        {
          [roundedName]: (value: string) => ({
            ...Object.fromEntries(props.map((p) => [p, value])),
            ...reset,
          }),
        },
        { type: "length", values: radiusValues },
      );
    }
  });

export default squircle;

// --- tailwind-merge config ---------------------------------------------------

// Mirrors tailwind-merge's own `rounded` hierarchy: a later all-corners
// utility cancels earlier side/corner utilities, a side cancels its two
// corners, and a narrower utility never cancels a broader one — so
// `squircle-md squircle-tl-sm` keeps both, refining one corner. Each squircle
// group also conflicts with its `rounded` counterpart (and vice versa), since
// both set the same border-radius properties. `squircle-amt-*` is orthogonal:
// it controls corner shape, not radius, so radius classes never cancel it.
const SIDE_CORNERS = {
  t: ["tl", "tr"],
  r: ["tr", "br"],
  b: ["br", "bl"],
  l: ["tl", "bl"],
  s: ["ss", "es"],
  e: ["se", "ee"],
} as const;
const CORNERS = ["tl", "tr", "br", "bl", "ss", "se", "es", "ee"] as const;
const SIDES = Object.keys(SIDE_CORNERS) as (keyof typeof SIDE_CORNERS)[];
const ALL_SUFFIXES: readonly string[] = ["", ...SIDES, ...CORNERS];

const sq = (suffix: string) => (suffix ? `squircle-${suffix}` : "squircle");
const rd = (suffix: string) => (suffix ? `rounded-${suffix}` : "rounded");

const conflictingClassGroups: Record<string, string[]> = {
  squircle: [...ALL_SUFFIXES.slice(1).map(sq), ...ALL_SUFFIXES.map(rd)],
  rounded: ALL_SUFFIXES.map(sq),
};
for (const side of SIDES) {
  const corners: readonly string[] = SIDE_CORNERS[side];
  conflictingClassGroups[sq(side)] = [...corners.map(sq), rd(side), ...corners.map(rd)];
  conflictingClassGroups[rd(side)] = [sq(side), ...corners.map(sq)];
}
for (const corner of CORNERS) {
  conflictingClassGroups[sq(corner)] = [rd(corner)];
  conflictingClassGroups[rd(corner)] = [sq(corner)];
}

export const squircleMergeConfig = {
  extend: {
    classGroups: {
      ...Object.fromEntries(
        ALL_SUFFIXES.map((suffix) => [sq(suffix), [{ [sq(suffix)]: [() => true] }]]),
      ),
      "squircle-amt": [{ "squircle-amt": [() => true] }],
    },
    conflictingClassGroups,
  },
};
