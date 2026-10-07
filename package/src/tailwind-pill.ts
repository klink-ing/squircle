/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import plugin from "tailwindcss/plugin";
import { PILL_SIDE_NAMES, pillCssObj, pillPropertyRegistrations, pillSideCss } from "./pill-css";
import { PILL_AMT_VAR_NAME, PILL_CONTINUITY_VAR_NAME, PILL_EASE_VAR_NAME } from "./variants";

export interface SquirclePillPluginOptions {
  /** Class name prefix for utilities (default: "squircle-pill") */
  prefix?: string;
}

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
const squirclePill: ReturnType<typeof plugin.withOptions<SquirclePillPluginOptions>> =
  plugin.withOptions<SquirclePillPluginOptions>(
    (options = {}) =>
      ({ addBase, addUtilities, matchUtilities }) => {
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
              pillSideCss(name) as Record<string, string | Record<string, string>>,
            ]),
          ),
        });

        // `type: "number"` alone only admits arbitrary values; the bare-value
        // hook is what lets `-amt-3` work like `squircle-amt-3` does through
        // `@utility`. Anything that is not a plain number falls through.
        const numbers = {
          __BARE_VALUE__: ({ value }: { value: string }) =>
            /^-?\d+(\.\d+)?$/.test(value) ? value : undefined,
        } as unknown as Record<string, string>;

        matchUtilities(
          {
            [`${prefix}-amt`]: (value: string) => ({ [PILL_AMT_VAR_NAME]: value }),
            [`${prefix}-ease`]: (value: string) => ({ [PILL_EASE_VAR_NAME]: value }),
          },
          { type: "number", values: numbers },
        );
      },
  );

export default squirclePill;
