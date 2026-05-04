import * as stylex from "@stylexjs/stylex";

/**
 * Radii tokens mirroring Panda's default `radii` scale, declared via
 * `stylex.defineVars` so the StyleX demo can pass `radii.md` etc. into
 * `squircle.all(...)` instead of hard-coded rem strings.
 */
export const radii = stylex.defineVars({
  sm: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  "2xl": "1rem",
  "3xl": "1.5rem",
});
