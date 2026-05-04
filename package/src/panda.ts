import {
  CAMEL_VARIANTS,
  DEFAULT_AMOUNT_VAR_NAME,
  SUPPORTS_RULE,
  squircleCssObj,
  variantEntries,
} from "./variants";

/**
 * Panda CSS utility entry shape (subset). We do not depend on `@pandacss/dev`
 * at runtime — the preset is a plain object literal and the consumer's Panda
 * install loads it. Typing the public surface manually keeps `@pandacss/dev`
 * an *optional* peer dependency and avoids versioning entanglement.
 */
type PandaUtility = {
  shorthand?: string | string[];
  values?: string | string[] | Record<string, string> | { type: string };
  transform?: (
    value: string,
    helpers: { token: (path: string) => string; raw: string },
  ) => Record<string, unknown>;
};

export interface SquirclePandaPresetOptions {
  /** CSS custom property name for the superellipse amount (default: "--squircle-amt"). */
  amtVar?: string;
  /** CSS custom property name for the intermediate corrected radius (default: "--squircle-r"). */
  rVar?: string;
}

export interface SquirclePandaPreset {
  name: string;
  utilities: { extend: Record<string, PandaUtility> };
  conditions: { extend: Record<string, string> };
}

/**
 * Build the Panda preset object. Pass directly to `presets:` in `panda.config.ts`:
 *
 * ```ts
 * import { defineConfig } from '@pandacss/dev'
 * import squirclePreset from '@klinking/squircle/panda'
 *
 * export default defineConfig({
 *   presets: ['@pandacss/dev/presets', squirclePreset()],
 * })
 * ```
 *
 * Naming follows Panda's own border-radius convention: full property names like
 * `squircleTopLeftRadius` mirror `borderTopLeftRadius`, and shorthands like
 * `squircleTopLeft` mirror `roundedTopLeft`. The shape table is identical to
 * Panda's built-in radius utilities.
 */
export function squirclePandaPreset(
  options: SquirclePandaPresetOptions = {},
): SquirclePandaPreset {
  const amtVar = options.amtVar ?? DEFAULT_AMOUNT_VAR_NAME;
  const rVar = options.rVar ?? "--squircle-r";

  const utilities: Record<string, PandaUtility> = {};

  const variantBySuffix = new Map(variantEntries());

  for (const variant of CAMEL_VARIANTS) {
    const props = variantBySuffix.get(variant.suffix);
    if (!props) continue;

    utilities[variant.property] = {
      shorthand: variant.shorthand,
      values: "radii",
      transform: (value: string) =>
        squircleCssObj(props, value, { amtVar, rVar, case: "camel" }) as Record<
          string,
          unknown
        >,
    };
  }

  utilities["squircleAmount"] = {
    shorthand: "squircleAmt",
    values: { type: "number" },
    transform: (value: string) => ({
      [amtVar]: value,
      [SUPPORTS_RULE]: {
        cornerShape: `superellipse(var(${amtVar}))`,
      },
    }),
  };

  return {
    name: "@klinking/squircle",
    utilities: { extend: utilities },
    conditions: {
      extend: {
        squircleSupported: SUPPORTS_RULE,
      },
    },
  };
}

export default squirclePandaPreset;
