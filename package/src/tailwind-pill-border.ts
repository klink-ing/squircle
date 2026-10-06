/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import plugin from "tailwindcss/plugin";
import {
  PILL_BORDER_COLOR_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_DECORATED_VAR_NAME,
  PILL_INSET_RING_WIDTH_VAR_NAME,
  PILL_OUTLINE_COLOR_VAR_NAME,
  PILL_OUTLINE_OFFSET_VAR_NAME,
  PILL_OUTLINE_WIDTH_VAR_NAME,
  PILL_POLYFILL_ATTRIBUTE,
  PILL_RING_WIDTH_VAR_NAME,
  PILL_SHADOW_REACH_VAR_NAME,
  PILL_WORKLET_ATTRIBUTE,
} from "./variants";

/**
 * How far a `box-shadow` list reaches past the box it is cast by: offset,
 * blur and spread together, for the furthest outer shadow. Inset shadows,
 * and lengths it can't read, count for nothing.
 */
export function shadowReach(value: string): number {
  let reach = 0;
  let depth = 0;
  let layer = "";
  const layers: string[] = [];
  for (const ch of value) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      layers.push(layer);
      layer = "";
    } else layer += ch;
  }
  layers.push(layer);
  for (const shadow of layers) {
    if (/\binset\b/.test(shadow)) continue;
    // Lengths outside any colour function, in order: x, y, blur, spread.
    const bare = shadow.replace(/[a-z-]+\([^()]*(?:\([^()]*\)[^()]*)*\)/gi, " ");
    const lengths = [...bare.matchAll(/(^|\s)(-?(?:\d+\.?\d*|\.\d+))(px|rem|em)?(?=\s|$)/g)].map(
      (m) => Number(m[2]) * (m[3] === "rem" || m[3] === "em" ? 16 : 1),
    );
    const [x = 0, y = 0, blur = 0, spread = 0] = lengths;
    reach = Math.max(reach, Math.max(Math.abs(x), Math.abs(y)) + Math.max(blur, 0) + spread);
  }
  return Math.ceil(Math.max(reach, 0));
}

export interface SquirclePillBorderPluginOptions {
  /** Class name of the pill utility these borders apply to (default: "squircle-pill") */
  prefix?: string;
}

/**
 * Teaches Tailwind's own `border-*`, `outline-*` and `ring-*` utilities to
 * drive the border, outline and rings a pill draws along its own outline.
 *
 * A real CSS border follows the stadium `border-radius`, which the pill sits
 * up to a few pixels inside near its caps, so the pill hides it and draws its
 * own along its outline instead, from its own width and colour properties —
 * which would otherwise mean a second way of spelling something Tailwind
 * already spells.
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
 * Outlines and rings are the same story one step out: natively they would
 * follow the stadium too, far enough from the pill for a crisp line to
 * visibly part from it. So their widths, an outline's colour and offset are
 * mirrored too, and the native ones are kept from painting on pills while the
 * pill draws its own. Ring colours, the ring
 * offset and the outline style already live in Tailwind variables, which the
 * pill utility reads directly. The browser's own focus ring, set by no
 * utility, is left as it is.
 *
 * Box shadows are drawn by the pill too, cast by its own outline, from the
 * shadow list Tailwind's utilities build, which the pill utility reads. The
 * one thing it can't read from CSS is how far a shadow reaches, which the box
 * it is drawn on has to grow by; `shadow-*` says. Drop shadows need nothing:
 * a filter on a pill already follows its shape.
 *
 * Every pill draws its border, outline, rings and shadows on `::after`, which
 * costs a paint per resize even with nothing to draw; with this plugin
 * loaded, a pill only has one when one of those utilities is on it.
 */
const squirclePillBorder: ReturnType<typeof plugin.withOptions<SquirclePillBorderPluginOptions>> =
  plugin.withOptions<SquirclePillBorderPluginOptions>(
    (options = {}) =>
      ({ addBase, matchUtilities, theme }) => {
        const prefix = options.prefix ?? "squircle-pill";

        // No `::after` unless a utility below asks for one.
        addBase({ [`.${prefix}`]: { [PILL_DECORATED_VAR_NAME]: "none" } });

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

        // Gives the pill the `::after` its border, outline, rings and shadows
        // are drawn on.
        const decorated = { [PILL_DECORATED_VAR_NAME]: '""' };
        matchUtilities(
          {
            border: (value: string) =>
              onPill({ [PILL_BORDER_WIDTH_VAR_NAME]: value, ...decorated }),
          },
          asWidths(theme("borderWidth"), "1px"),
        );
        matchUtilities(
          { border: (value: string) => onPill({ [PILL_BORDER_COLOR_VAR_NAME]: value }) },
          { values: colors, type: "color" },
        );

        const noOutline = { "outline-color": "transparent" };
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

        // The shadow list itself reaches the pill through Tailwind's own
        // variables; only its reach has to be worked out here.
        matchUtilities(
          {
            shadow: (value: string) => ({
              [`&:is(.${prefix})`]: {
                [PILL_SHADOW_REACH_VAR_NAME]: `${shadowReach(value)}px`,
                ...decorated,
              },
            }),
          },
          { values: theme("boxShadow") ?? {}, type: "any" },
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
