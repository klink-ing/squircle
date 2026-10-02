/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import plugin from "tailwindcss/plugin";
import {
  PILL_BORDER_COLOR_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_DECORATED_VAR_NAME,
  PILL_FILTER_OUTSET_VAR_NAME,
  PILL_INSET_RING_WIDTH_VAR_NAME,
  PILL_OUTLINE_COLOR_VAR_NAME,
  PILL_OUTLINE_OFFSET_VAR_NAME,
  PILL_OUTLINE_WIDTH_VAR_NAME,
  PILL_POLYFILL_ATTRIBUTE,
  PILL_RING_WIDTH_VAR_NAME,
  PILL_WORKLET_ATTRIBUTE,
} from "./variants";

export interface SquirclePillBorderPluginOptions {
  /** Class name of the pill utility these borders apply to (default: "squircle-pill") */
  prefix?: string;
}

/**
 * Teaches Tailwind's own `border-*`, `outline-*` and `ring-*` utilities to
 * drive the border, outline and rings a pill draws along its own outline.
 *
 * A pill is shaped by a mask, and a mask erases everything outside the shape,
 * so a real CSS border survives only as a stadium ring clipped to the pill.
 * The shape's border has to be drawn by the worklet instead, from the pill's
 * own width and colour properties — which would otherwise mean a second way
 * of spelling something Tailwind already spells.
 *
 * This registers those same utility names again. Tailwind does not treat that
 * as an override: it emits a second rule alongside its own, so `border-2` keeps
 * setting `border-width` and additionally sets the pill's width. Nothing here
 * reimplements what a border utility means, which is what keeps it from
 * breaking when those utilities change.
 *
 * It also means this plugin never has to decide whether `border-red-500` is a
 * width or a colour: a functional utility only matches when the value resolves
 * against the values and type given to it, so widths and colours can be
 * registered separately and anything unrecognised falls through to Tailwind
 * untouched.
 *
 * `border-dashed` and friends need no help — they set `--tw-border-style`, and
 * the pill utility reads that variable directly.
 *
 * Outlines and rings are the same story one step out. They paint outside the
 * box, which the pill leaves alone, so natively they would show — but around
 * the stadium `border-radius`, which the pill sits up to a few pixels inside,
 * enough for a crisp line to visibly part from it. So their widths, an
 * outline's colour and offset are mirrored too, and the native ones are kept
 * from painting on pills while the pill draws its own. Ring colours, the ring
 * offset and the outline style already live in Tailwind variables, which the
 * pill utility reads directly. The browser's own focus ring, set by no
 * utility, is left as it is.
 *
 * Shadows are left to the browser, which draws them outside the pill. A drop
 * shadow is a `filter`, though, which Chromium's masks stop short of unless
 * told how far it reaches; `drop-shadow-*` tells them.
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
         *
         * The suppression only applies once the worklet or the polyfill is
         * drawing the ring: without either, the real border is the pill's
         * border, a stadium ring on the fallback shape, and must keep
         * painting. Width and colour both suppress it, because either one
         * alone is a visible border.
         */
        const onPill = (
          declarations: Record<string, string>,
          suppress: Record<string, string> = { "border-color": "transparent" },
        ) => ({
          [`&:is(.${prefix})`]: declarations,
          [`:where(:root[${PILL_WORKLET_ATTRIBUTE}], :root[${PILL_POLYFILL_ATTRIBUTE}]) &:is(.${prefix})`]:
            suppress,
        });

        // Bare numbers are px, as Tailwind reads `border-3` or `ring-3`.
        const widths = (themed: Record<string, string> | undefined, fallback?: string) =>
          ({
            ...themed,
            // After the theme: v4's bare `ring` is 1px, where the theme
            // Tailwind keeps for plugins still says v3's 3px.
            ...(fallback ? { DEFAULT: fallback } : {}),
            __BARE_VALUE__: ({ value }: { value: string }) =>
              /^\d+(\.\d+)?$/.test(value) ? `${value}px` : undefined,
          }) as unknown as Record<string, string>;
        const colors = theme("colors") ?? {};
        // `length` keeps a paren reference like `border-(--var)`, which
        // Tailwind resolves as a colour, from being taken for a width as well.
        const asWidths = (themed: Record<string, string> | undefined, fallback?: string) => ({
          values: widths(themed, fallback),
          type: "length" as const,
        });

        matchUtilities(
          { border: (value: string) => onPill({ [PILL_BORDER_WIDTH_VAR_NAME]: value }) },
          asWidths(theme("borderWidth"), "1px"),
        );
        matchUtilities(
          { border: (value: string) => onPill({ [PILL_BORDER_COLOR_VAR_NAME]: value }) },
          { values: colors, type: "color" },
        );

        const noOutline = { "outline-color": "transparent" };
        // Gives the pill the `::before` its outline and rings are drawn on.
        const decorated = { [PILL_DECORATED_VAR_NAME]: '""' };
        matchUtilities(
          {
            outline: (value: string) =>
              onPill({ [PILL_OUTLINE_WIDTH_VAR_NAME]: value, ...decorated }, noOutline),
          },
          asWidths(theme("outlineWidth"), "1px"),
        );
        matchUtilities(
          {
            outline: (value: string) => onPill({ [PILL_OUTLINE_COLOR_VAR_NAME]: value }, noOutline),
          },
          { values: colors, type: "color" },
        );
        matchUtilities(
          {
            "outline-offset": (value: string) =>
              onPill({ [PILL_OUTLINE_OFFSET_VAR_NAME]: value }, {}),
          },
          { ...asWidths(theme("outlineOffset")), supportsNegativeValues: true },
        );

        // Far enough for the largest of Tailwind's drop shadows, blur and
        // offset together; `drop-shadow-none` needs nothing.
        matchUtilities(
          {
            "drop-shadow": (value: string) => ({
              [`&:is(.${prefix})`]:
                value === "none" || value === "0 0 #0000"
                  ? { [PILL_FILTER_OUTSET_VAR_NAME]: "0px" }
                  : { [PILL_FILTER_OUTSET_VAR_NAME]: "6rem", ...decorated },
            }),
          },
          { values: theme("dropShadow") ?? {}, type: "any" },
        );

        matchUtilities(
          {
            ring: (value: string) =>
              onPill(
                { [PILL_RING_WIDTH_VAR_NAME]: value, ...decorated },
                { "--tw-ring-shadow": "0 0 #0000", "--tw-ring-offset-shadow": "0 0 #0000" },
              ),
          },
          asWidths(theme("ringWidth"), "1px"),
        );
        matchUtilities(
          {
            "inset-ring": (value: string) =>
              onPill(
                { [PILL_INSET_RING_WIDTH_VAR_NAME]: value, ...decorated },
                { "--tw-inset-ring-shadow": "0 0 #0000" },
              ),
          },
          asWidths(theme("ringWidth"), "1px"),
        );
      },
  );

export default squirclePillBorder;
