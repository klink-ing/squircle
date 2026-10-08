/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import plugin from "tailwindcss/plugin";
import { PILL_SIDE_NAMES } from "./pill-css";
import {
  DEFAULT_AMOUNT_VAR_NAME,
  DEFAULT_R_VAR_NAME,
  NONE_RADIUS,
  cornerShapeProp,
  squircleFullCssObj,
  squircleCssObj,
  variantEntries,
} from "./variants";

// --- Tailwind plugin ---------------------------------------------------------

export interface SquirclePluginOptions {
  /** CSS custom property name for the superellipse amount (default: "--squircle-amt") */
  /**
   * @deprecated Set the namespace instead, with `SQUIRCLE_CSS_NAMESPACE` at
   * build time, which renames every property this package owns together. This
   * option still works and still wins, but it only ever reached the utilities
   * this plugin emits — never the paint worklet, which names the properties it
   * reads in a static `inputProperties` list.
   */
  amtVar?: string;
  /**
   * @deprecated Alias for {@link SquirclePluginOptions.amtVar}; see there.
   */
  "amt-var"?: string;
  /** CSS custom property name for the intermediate corrected radius (default: "--squircle-r") */
  /**
   * @deprecated Set the namespace instead, with `SQUIRCLE_CSS_NAMESPACE` at
   * build time. This option still works and still wins.
   */
  rVar?: string;
  /**
   * @deprecated Alias for {@link SquirclePluginOptions.rVar}; see there.
   */
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

      // Only sets the amount — the same thing writing the custom property
      // yourself does. Applying a corner-shape here would reshape all four
      // corners, including ones no squircle-* utility claimed.
      matchUtilities(
        { [`${prefix}-amt`]: (value: string) => ({ [amtVar]: value }) },
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
        // emits it alongside this one, so the radius still comes from core and
        // this contributes only the reset — the initial value, so it is inert
        // unless a squircle class set a shape on the same element. Without it a
        // rounded-* utility cannot take a corner back from a squircle, since it
        // only ever sets a radius. Restricted to lengths, the same values the
        // squircle-* utilities accept: a paren ref keeps its squircle shape, so
        // reach for a theme key there as everywhere else in this package.
        const roundedName = suffix ? `rounded-${suffix}` : "rounded";
        const reset = Object.fromEntries(props.map((p) => [cornerShapeProp(p), "round"]));
        addUtilities({ [`.${roundedName}-full`]: reset });
        matchUtilities({ [roundedName]: () => reset }, { type: "length", values: radiusValues });
      }
    },
  );

export default squircle;

// --- tailwind-merge config ---------------------------------------------------

// Mirrors tailwind-merge's own `rounded` hierarchy: a later all-corners
// utility cancels earlier side/corner utilities, a side cancels its two
// corners, and a narrower utility never cancels a broader one — so
// `squircle-md squircle-tl-sm` keeps both, refining one corner. Each squircle
// group also conflicts with its `rounded` counterpart (and vice versa), since
// both set the same border-radius properties. `squircle-amt-*` is orthogonal:
// it controls corner shape, not radius, so radius classes never cancel it.
//
// `squircle-pill` shapes all four corners, so it sits with the all-corners
// utilities. Its `-amt-*`, `-ease-*`, `-g2`/`-g3` and side (`-t`, `-s`, …)
// knobs each get a group of their own; left out, the catch-all `squircle-*`
// group would take them for radii and have them cancel the pill and each
// other.
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

const PILL = "squircle-pill";

const conflictingClassGroups: Record<string, string[]> = {
  squircle: [...ALL_SUFFIXES.slice(1).map(sq), ...ALL_SUFFIXES.map(rd), PILL],
  rounded: [...ALL_SUFFIXES.map(sq), PILL],
  [PILL]: [...ALL_SUFFIXES.map(sq), ...ALL_SUFFIXES.map(rd)],
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

// String-keyed, so it reads as an extension of tailwind-merge's own groups.
// The bare `squircle-*` group takes any value, so it leaves `pill…` to the
// pill's own groups; a pill class they don't know is then left alone rather
// than taken for a radius, which would cancel the pill.
const notPill = (value: string) => !/^pill(-|$)/.test(value);

const classGroups: Record<string, (string | Record<string, ((value: string) => boolean)[]>)[]> = {
  ...Object.fromEntries(
    ALL_SUFFIXES.map((suffix) => [sq(suffix), [{ [sq(suffix)]: [suffix ? () => true : notPill] }]]),
  ),
  "squircle-amt": [{ "squircle-amt": [() => true] }],
  [PILL]: [PILL],
  [`${PILL}-amt`]: [{ [`${PILL}-amt`]: [() => true] }],
  [`${PILL}-ease`]: [{ [`${PILL}-ease`]: [() => true] }],
  [`${PILL}-continuity`]: [`${PILL}-g2`, `${PILL}-g3`],
  [`${PILL}-side`]: PILL_SIDE_NAMES.map((side) => `${PILL}-${side}`),
};

export const squircleMergeConfig = {
  extend: { classGroups, conflictingClassGroups },
};
