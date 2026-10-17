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

import { shadowReach } from "./shadow-reach";
export { shadowReach } from "./shadow-reach";

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
 * untouched. Untyped variables are forwarded as colours after those typed
 * matchers decline them, following Tailwind's border and outline defaults.
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
 * shadow list Tailwind's utilities build, which the pill utility reads. This
 * plugin estimates reach for px literals; initialization resolves the actual
 * list and painting space in the browser. Drop shadows need nothing:
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
        const mirror = (
          name: string,
          widthTheme: Record<string, string> | undefined,
          width: (value: string) => ReturnType<typeof onPill>,
          color: (value: string) => ReturnType<typeof onPill>,
        ) => {
          const widthOptions = asWidths(widthTheme, "1px");
          let matched = false;
          const handled = (emit: typeof width) => (value: string) => {
            matched = true;
            return emit(value);
          };
          matchUtilities({ [name]: handled(width) }, widthOptions);
          matchUtilities({ [name]: handled(color) }, { values: colors, type: "color" });
          // A `var()` has no inferable type. `['color', 'any']` would be a
          // fallback utility, skipped once Tailwind's native rule matches.
          // Instead, run an untyped matcher after the typed ones. Its values
          // and modifiers cover every typed match so it always consumes the
          // flag, including named widths and colours with opacity modifiers.
          matchUtilities(
            {
              [name]: (value: string, { modifier }) => {
                const alreadyMatched = matched;
                matched = false;
                if (alreadyMatched || modifier !== null || !value.startsWith("var(")) return {};
                return color(value);
              },
            },
            {
              values: {
                inherit: "inherit",
                transparent: "transparent",
                current: "currentcolor",
                ...colors,
                ...widthOptions.values,
              },
              type: "any",
              modifiers: "any",
            },
          );
        };
        mirror(
          "border",
          theme("borderWidth"),
          (value) => onPill({ [PILL_BORDER_WIDTH_VAR_NAME]: value, ...decorated }),
          (value) => onPill({ [PILL_BORDER_COLOR_VAR_NAME]: value }),
        );

        const noOutline = { "outline-color": "transparent" };
        mirror(
          "outline",
          theme("outlineWidth"),
          (value) => onPill({ [PILL_OUTLINE_WIDTH_VAR_NAME]: value, ...decorated }, noOutline),
          (value) => onPill({ [PILL_OUTLINE_COLOR_VAR_NAME]: value }, noOutline),
        );
        matchUtilities(
          {
            "outline-offset": (value: string) =>
              onPill({ [PILL_OUTLINE_OFFSET_VAR_NAME]: value }, {}),
          },
          { ...asWidths(theme("outlineOffset")), supportsNegativeValues: true },
        );

        // The shadow list itself reaches the pill through Tailwind's own
        // variables; its literal reach is an estimate until initialization resolves it.
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
