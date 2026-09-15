/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { definePreset, type PropertyConfig } from "@pandacss/dev";
import { CAMEL_VARIANTS, DEFAULT_AMOUNT_VAR_NAME, variantEntries } from "./variants";

export interface SquirclePillPandaPresetOptions {
  /** CSS custom property name for the superellipse amount (default: "--pill-squircle-amt") */
  amtVar?: string;
}

/**
 * Panda CSS preset for pill shapes with Houdini paint worklet support.
 * Provides a single squirclePill utility with automatic radius calculation.
 */
export function squirclePillPandaPreset(options: SquirclePillPandaPresetOptions = {}) {
  const amtVar = options.amtVar ?? DEFAULT_AMOUNT_VAR_NAME;

  const utilities: Record<string, PropertyConfig> = {};
  const variantBySuffix = new Map(variantEntries());

  const pillBase = {
    "data-squircle-pill": "",
    backgroundImage: "paint(pill-shape)",
  };

  const pillFallback = {
    cornerShape: `superellipse(var(${amtVar}, 2))`,
  };

  // Base pill utility
  utilities["squirclePill"] = {
    values: { true: "" },
    transform: () => ({
      "@supports (background-image: paint(pill-shape))": pillBase,
      "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))":
        pillFallback,
    }),
  };

  // Side-specific variants
  for (const variant of CAMEL_VARIANTS) {
    const props = variantBySuffix.get(variant.suffix);
    if (!props) continue;

    utilities[`squirclePill${variant.property}`] = {
      values: { true: "" },
      transform: () => ({
        "@supports (background-image: paint(pill-shape))": pillBase,
        "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))":
          pillFallback,
      }),
    };
  }

  // Amount utility for pill transitions
  utilities["squirclePillAmt"] = {
    values: "numbers",
    transform: (value: string) => ({
      [amtVar]: value,
    }),
  };

  return definePreset({
    theme: { extend: { utilities } },
  });
}

export default squirclePillPandaPreset;
