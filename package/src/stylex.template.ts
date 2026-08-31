/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import * as stylex from "@stylexjs/stylex";

/**
 * StyleX squircle utilities — generated from this template by
 * `scripts/generate-stylex.ts`.
 *
 * Each variant is a *dynamic* style — a function that takes a `radius` (and
 * an optional superellipse `amt`) and produces a `borderRadius` +
 * `cornerShape` pair gated behind `@supports (corner-shape: superellipse(2))`.
 * Browsers that don't support `corner-shape` fall back to a plain rounded
 * rectangle at the same radius.
 *
 * ```tsx
 * import * as stylex from '@stylexjs/stylex';
 * import { squircle } from '@klinking/squircle/stylex';
 *
 * <div {...stylex.props(squircle.all('1rem'))} />
 * <div {...stylex.props(squircle.topLeft('0.5rem', 3))} />
 * ```
 *
 * If `amt` is omitted, the corrected radius and `corner-shape` use the
 * literal default exponent of `2` — pass `amt` explicitly per-call site to
 * tune it. Unlike the Tailwind and Panda integrations, this preset does not
 * read `--squircle-amt`; StyleX's per-call parameter is the only knob.
 *
 * **Constraint** — StyleX's babel plugin requires `stylex.create(...)` to
 * receive a fully-static object literal, and forbids destructuring,
 * spreading, or default values on dynamic-style function parameters. The
 * whole 15-variant table is therefore spelled out verbatim in the generated
 * output. Every entry in this template must remain statically analyzable at
 * its final call site.
 *
 * **How to modify**
 *
 * - To tweak a *variant's body* (the `borderRadius`/`cornerShape` block),
 *   edit `renderVariant` in `scripts/generate-stylex.ts`.
 * - To add or rename variants, edit `CAMEL_VARIANTS` and `VARIANTS` in
 *   `variants.ts`.
 * - To tweak the *file shell* (imports, docstring, the wrapping
 *   `stylex.create({ ... })` call), edit this template.
 *
 * Then run `tsx scripts/generate-stylex.ts` (or just `vp run build`) to
 * regenerate `stylex.ts`. Do not hand-edit `stylex.ts`.
 */
export const squircle = stylex.create({
  // @stylex-generate:variants
});
