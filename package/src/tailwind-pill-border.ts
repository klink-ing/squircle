/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import plugin from "tailwindcss/plugin";
import { PILL_BORDER_COLOR_VAR_NAME, PILL_BORDER_WIDTH_VAR_NAME } from "./variants";

export interface SquirclePillBorderPluginOptions {
  /** Class name of the pill utility these borders apply to (default: "squircle-pill") */
  prefix?: string;
}

/**
 * Teaches Tailwind's own `border-*` utilities to drive a pill's drawn border.
 *
 * A pill is shaped by a mask, and a mask erases everything outside the shape,
 * so a real CSS border survives only as rectangle fragments. The shape's border
 * has to be drawn by the worklet instead, from `--pill-border-width` and
 * `--pill-border-color` — which would otherwise mean a second way of spelling
 * something Tailwind already spells.
 *
 * This registers those same utility names again. Tailwind does not treat that
 * as an override: it emits a second rule alongside its own, so `border-2` keeps
 * setting `border-width` and additionally sets `--pill-border-width`. Nothing
 * here reimplements what a border utility means, which is what keeps it from
 * breaking when those utilities change.
 *
 * It also means this plugin never has to decide whether `border-red-500` is a
 * width or a colour: a functional utility only matches when the value resolves
 * against the values given to it, so widths and colours can be registered
 * separately and anything unrecognised falls through to Tailwind untouched.
 *
 * `border-dashed` and friends need no help — they set `--tw-border-style`, and
 * the pill utility reads that variable directly.
 */
const squirclePillBorder: ReturnType<typeof plugin.withOptions<SquirclePillBorderPluginOptions>> =
  plugin.withOptions<SquirclePillBorderPluginOptions>(
    (options = {}) =>
      ({ matchUtilities, theme }) => {
        const prefix = options.prefix ?? "squircle-pill";

        /*
         * Scoped to pills, so a border utility keeps behaving normally
         * everywhere else. `:is()` also lifts specificity above a bare utility
         * class, which is what lets the pill suppress the real border's paint
         * without depending on which rule Tailwind happens to emit last.
         */
        const onPill = (declarations: Record<string, string>) => ({
          [`&:is(.${prefix})`]: declarations,
        });

        matchUtilities(
          {
            border: (value: string) => onPill({ [PILL_BORDER_WIDTH_VAR_NAME]: value }),
          },
          { values: theme("borderWidth") ?? {} },
        );

        matchUtilities(
          {
            border: (value: string) =>
              onPill({
                [PILL_BORDER_COLOR_VAR_NAME]: value,
                // The real border must not paint: under the mask it is a
                // rectangle clipped to the pill. Its width still contributes to
                // layout, which correctly reserves room for the drawn ring.
                "border-color": "transparent",
              }),
          },
          { values: theme("colors") ?? {}, type: "color" },
        );
      },
  );

export default squirclePillBorder;
