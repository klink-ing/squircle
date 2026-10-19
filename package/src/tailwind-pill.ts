/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import plugin from "tailwindcss/plugin";
import { PILL_SIDE_NAMES, pillCssObj, pillPropertyRegistrations, pillSideCss } from "./pill-css";
import {
  FULL_RADIUS,
  PILL_CONTINUITY_VAR_NAME,
  PILL_ARC_SETBACK_VAR_NAME,
  PILL_EDGE_SETBACK_VAR_NAME,
  PILL_MAX_RADIUS_VAR_NAME,
} from "./variants";

export interface SquirclePillPluginOptions {
  /** Class name prefix for utilities (default: "squircle-pill") */
  prefix?: string;
}

/**
 * One shape, `squircle-pill`, with its caps derived from the element's own
 * size, so there is no size or axis to pick: a cap can't be wider than the
 * box, so it always caps the short ends. What can be picked is capping one
 * end alone: `-t`, `-r`, `-b`, `-l`, and `-s`/`-e` for the inline ends,
 * square the other. The knobs the shape has — the arc setback, edge setback, and its
 * continuity — get `-arc-setback-*`, `-edge-setback-*` and `-g2`/`-g3` utilities, as does
 * its largest radius, `-max-*`, which only
 * set the custom property, the same thing writing it yourself does.
 *
 * The rules themselves live in pill-css.ts, shared with the standalone
 * stylesheet.
 */
const squirclePill: ReturnType<typeof plugin.withOptions<SquirclePillPluginOptions>> =
  plugin.withOptions<SquirclePillPluginOptions>(
    (options = {}) =>
      ({ addBase, addUtilities, matchUtilities, theme }) => {
        const prefix = options.prefix ?? "squircle-pill";

        // The utility has to carry the registrations itself rather than lean
        // on squircle-pill.css, which a Tailwind project need not load.
        addBase(pillPropertyRegistrations());

        addUtilities({
          [`.${prefix}`]: pillCssObj("tailwind") as Record<string, string | Record<string, string>>,
          [`.${prefix}-g2`]: { [PILL_CONTINUITY_VAR_NAME]: "2" },
          [`.${prefix}-g3`]: { [PILL_CONTINUITY_VAR_NAME]: "3" },
          ...Object.fromEntries(
            PILL_SIDE_NAMES.map((name) => [
              `.${prefix}-${name}`,
              // Only on a pill, at no cost in specificity: left on a plain
              // element, a side would round half of it.
              { [`&:where(.${prefix})`]: pillSideCss(name) } as Record<
                string,
                string | Record<string, string>
              >,
            ]),
          ),
        });

        // `type: "number"` alone only admits arbitrary values; the bare-value
        // hook is what lets `-edge-setback-3` work like `squircle-amt-3` does through
        // `@utility`. Anything that is not a plain number falls through.
        const numbers = {
          __BARE_VALUE__: ({ value }: { value: string }) =>
            /^-?\d+(\.\d+)?$/.test(value) ? value : undefined,
        } as unknown as Record<string, string>;
        const numeric = /^[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?$/i;
        const angle = /^[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?(?:deg|rad|grad|turn)$/i;
        const expression = /^(?:var|calc|min|max|clamp)\(/;

        matchUtilities(
          {
            [`${prefix}-arc-setback`]: (value: string) =>
              angle.test(value) || expression.test(value)
                ? { [PILL_ARC_SETBACK_VAR_NAME]: value }
                : {},
          },
          {
            type: ["angle", "any"],
            values: {
              __BARE_VALUE__: ({ value }: { value: string }) =>
                /^\d+(\.\d+)?$/.test(value) ? `${value}deg` : undefined,
            } as unknown as Record<string, string>,
          },
        );
        matchUtilities(
          {
            [`${prefix}-edge-setback`]: (value: string) =>
              numeric.test(value) || expression.test(value)
                ? { [PILL_EDGE_SETBACK_VAR_NAME]: value }
                : {},
          },
          { type: ["number", "any"], values: numbers },
        );

        // Drop none/full from the theme's radii (the v3-compat theme still
        // carries them): both lift the cap, so they map to FULL_RADIUS.
        const { none: _none, full: _full, ...radiusValues } = theme("borderRadius") ?? {};
        const themeRadii = new Set<string>(Object.values(radiusValues));
        // A length, but never a percentage, which has no box to resolve against.
        const length = /^[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?([a-z]+)$/i;
        matchUtilities(
          {
            [`${prefix}-max`]: (value: string) =>
              themeRadii.has(value) ||
              value === FULL_RADIUS ||
              length.test(value) ||
              expression.test(value)
                ? { [PILL_MAX_RADIUS_VAR_NAME]: value }
                : {},
          },
          {
            type: ["length", "any"],
            values: { ...radiusValues, none: FULL_RADIUS, full: FULL_RADIUS },
          },
        );
      },
  );

export default squirclePill;
