/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { definePreset, type PropertyConfig } from "@pandacss/dev";
import {
  CAMEL_VARIANTS,
  DEFAULT_AMOUNT_VAR_NAME,
  SUPPORTS_RULE,
  squircleCssObj,
  variantEntries,
} from "./variants";

export interface SquirclePandaPresetOptions {
  /** CSS custom property name for the superellipse amount (default: "--squircle-amt"). */
  amtVar?: string;
  /** CSS custom property name for the intermediate corrected radius (default: "--squircle-r"). */
  rVar?: string;
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
export function squirclePandaPreset(options: SquirclePandaPresetOptions = {}) {
  const amtVar = options.amtVar ?? DEFAULT_AMOUNT_VAR_NAME;
  const rVar = options.rVar ?? "--squircle-r";

  const utilities: Record<string, PropertyConfig> = {};

  const variantBySuffix = new Map(variantEntries());

  for (const variant of CAMEL_VARIANTS) {
    const props = variantBySuffix.get(variant.suffix);
    if (!props) continue;

    utilities[variant.property] = {
      shorthand: variant.shorthand,
      values: "radii",
      transform: (value) => squircleCssObj(props, value, { amtVar, rVar, case: "camel" }) as any,
    };
  }

  // Only sets the amount — the same thing writing the custom property yourself
  // does. Applying a corner-shape here would reshape all four corners,
  // including ones no squircle utility claimed.
  utilities["squircleAmount"] = {
    shorthand: "squircleAmt",
    values: { type: "number" },
    transform: (value) => ({ [amtVar]: value }),
  };

  return definePreset({
    name: "@klinking/squircle",
    utilities: { extend: utilities },
    conditions: {
      extend: {
        squircleSupported: SUPPORTS_RULE,
      },
    },
  });
}

export default squirclePandaPreset;
