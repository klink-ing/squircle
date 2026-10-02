# @klinking/squircle

[![npm version](https://img.shields.io/npm/v/@klinking/squircle.svg)](https://www.npmjs.com/package/@klinking/squircle)

We're all excited about `corner-shape: squircle`, but we're in a pickle right now. Squircle corners look _better_ (natch), but at the same `border-radius`, they look _itty bitty_ compared to regular rounded corners. You're saying to yourself: "Who cares! I'll just crank up the border-radius until it look good and be done with it!" Then you see your site in Safari, and now your rounded corners are just _massive_. That's because Safari ain't supportin' no squircles yet. Now you gotta manually eyeball what border-radius kinda looks the same as the squircle and throw in an `@supports` rule and then your head explodes (why, head, why you explode?). Well… what if I told you you could eat your squircle and have your border-radius too? Read on, child.

> **[Interactive Demo →](https://dogmar.github.io/squircle)**

## Contents

<!-- BEGIN:toc -->

- [Requirements](#requirements)
- [Install & setup](#install--setup)
- [Pill Shapes with Houdini CSS Paint Worklet](#pill-shapes-with-houdini-css-paint-worklet)
- [How the radius correction works](#how-the-radius-correction-works)
- [Browser support & fallback strategy](#browser-support--fallback-strategy)
- [Why it called "squircle" when it use "superellipse()"?](#why-it-called-squircle-when-it-use-superellipse)
- [Alternatives considered](#alternatives-considered)
- [Should you install or copy/paste?](#should-you-install-or-copypaste)
- [FAQ](#faq)
- [Copy/paste source](#copypaste-source)
- [Prior art & credits](#prior-art--credits)
- [License](#license)

<!-- END:toc -->

## Requirements

- **Modern browsers** for the squircle shape itself. Unsupported browsers get a clean `border-radius` fallback that matches visual size of rounding; see [Browser support](#browser-support--fallback-strategy) for the feature-by-feature matrix.
- **One of:** [Tailwind CSS](https://tailwindcss.com/) v4+, [Panda CSS](https://panda-css.com/) v0.40+, or [StyleX](https://stylexjs.com/) v0.18+. All three are optional peer dependencies — install only what you use.

<!-- Uncomment once the converter at squircle.klink.ing is live:
- **"I just want to convert one little ol' border-radius to one squircle!"** Well, then just [go here](https://squircle.klink.ing).
-->

## Install & setup

```bash
npm install @klinking/squircle
```

Each option produces the same `@supports`-gated radius correction — pick the one that fits your stack.

<details>
<summary><strong>Tailwind CSS</strong></summary>

Two setup options: the **CSS import** is zero-config and recommended for most projects. The **JS plugin** gives you control over the class prefix and CSS variable names.

### CSS import (recommended)

```css
@import "tailwindcss";
@import "@klinking/squircle/tailwind/utils.css";
```

That's it. All `squircle-*` classes are available. This path uses Tailwind v4's `@utility` directive, so everything is generated at build time with zero runtime cost.

### JS plugin (for customization)

Use this if you want to change the class prefix or the `--squircle-amt` CSS variable name:

```css
@import "tailwindcss";
@plugin "@klinking/squircle/tailwind";
```

Or with options:

```css
@import "tailwindcss";
@plugin "@klinking/squircle/tailwind" {
  prefix: sq; /* use `sq-md`, `sq-t-lg`, etc. */
  amt-var: --my-amt; /* use `--my-amt` instead of `--squircle-amt` */
}
```

### tailwind-merge (optional)

If your project already uses [`tailwind-merge`](https://github.com/dcastil/tailwind-merge) to de-duplicate conflicting classes, pull in the squircle conflict config so `rounded-lg squircle-md` resolves the way you'd expect:

```js
import { squircleMergeConfig } from "@klinking/squircle/tailwind";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge(squircleMergeConfig, {
  // your other customizations
});
```

The conflicts mirror Tailwind's own `rounded` hierarchy: a later all-corners utility cancels earlier side/corner utilities (from either family), a side cancels its two corners, and a narrower utility refines a broader one instead of canceling it — `squircle-md squircle-tl-sm` keeps both. `squircle-amt-*` is independent of radius classes.

### Utilities

| Utility          | Equivalent     | Description                       |
| ---------------- | -------------- | --------------------------------- |
| `squircle-*`     | `rounded-*`    | All corners                       |
| `squircle-t-*`   | `rounded-t-*`  | Top corners                       |
| `squircle-r-*`   | `rounded-r-*`  | Right corners                     |
| `squircle-b-*`   | `rounded-b-*`  | Bottom corners                    |
| `squircle-l-*`   | `rounded-l-*`  | Left corners                      |
| `squircle-s-*`   | `rounded-s-*`  | Inline-start corners (logical)    |
| `squircle-e-*`   | `rounded-e-*`  | Inline-end corners (logical)      |
| `squircle-tl-*`  | `rounded-tl-*` | Top-left corner                   |
| `squircle-tr-*`  | `rounded-tr-*` | Top-right corner                  |
| `squircle-br-*`  | `rounded-br-*` | Bottom-right corner               |
| `squircle-bl-*`  | `rounded-bl-*` | Bottom-left corner                |
| `squircle-ss-*`  | `rounded-ss-*` | Start-start corner (logical)      |
| `squircle-se-*`  | `rounded-se-*` | Start-end corner (logical)        |
| `squircle-es-*`  | `rounded-es-*` | End-start corner (logical)        |
| `squircle-ee-*`  | `rounded-ee-*` | End-end corner (logical)          |
| `squircle-amt-*` | —              | Superellipse exponent (default 2) |
| `squircle-none`  | `rounded-none` | Remove rounding                   |
| `squircle-full`  | `rounded-full` | Fully rounded (pill)              |

### What values are accepted?

Values are validated strictly so typos fail at build time instead of producing invalid CSS:

- **`squircle-*` and its variants** accept the same theme values as `rounded-*` (`sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, plus anything you add to `@theme`) and arbitrary lengths like `squircle-[16px]`. Non-length arbitraries (`[50%]`, `[foo]`) and paren refs (`squircle-(--my-radius)`) are rejected — use a theme key instead.
- **`squircle-none` and `squircle-full`** (and their side/corner variants) are static utilities defined the same way as `rounded-none` and `rounded-full`: `0` and `calc(infinity * 1px)`. Neither needs the visual radius correction — correcting zero or infinity is a no-op — so `squircle-full` is just `rounded-full` plus the superellipse corner shape, and `squircle-none` is identical to `rounded-none`.
- **`squircle-amt-*`** accepts bare numbers (`squircle-amt-2`), arbitrary numbers (`squircle-amt-[3.5]`), and theme values. Unit-bearing arbitraries (`[1em]`) and paren refs (`(--my-amt)`) are rejected. It only sets the amount — exactly what writing `--squircle-amt` yourself does — and applies no corner shape of its own, so it never reshapes a corner no `squircle-*` utility claimed.

### Mixing squircled and rounded corners

Corner shape is tracked per corner, so the two families compose in both directions on the same element:

```html
<!-- squircled everywhere except the top-left, which stays round -->
<div class="squircle-lg rounded-tl-lg">…</div>

<!-- squircled top corners, ordinary rounded bottom corners -->
<div class="squircle-t-lg rounded-b-lg">…</div>
```

Two things make that work. A `squircle-*` utility only shapes the corners it sets a radius on — the all-corners utility uses the `corner-shape` shorthand, while the side and corner variants use the matching longhands (`corner-top-left-shape` and friends). And because Tailwind's own `rounded-*` utilities only set a radius, they could never take a corner back from a squircle, so this package re-declares them to also reset their corners to `round`. That reset is the initial value, so it changes nothing unless a squircle class is on the same element.

Note that a corner reclaimed by `rounded-*` uses the plain radius, not the corrected one — the correction exists only to make a squircle look the same size as a rounded corner, so a genuinely round corner doesn't want it.

The reset accepts the same values the `squircle-*` utilities do — theme keys and arbitrary lengths like `rounded-tl-[3px]`. Tailwind's own `rounded-*` is looser, so a corner named with a paren ref (`rounded-tl-(--my-radius)`) or a non-length arbitrary still gets its radius from Tailwind but keeps its squircle shape. Use a theme key there, as everywhere else in this package.

### What does `squircle-amt-*` control?

The value is the `K` parameter passed to `superellipse(K)`, which controls how square the corner shape is:

- **2** — the classic squircle (this package's default), same as the `squircle` keyword. Values greater than 2 get more and more square as they increase, becoming visually indistinguishable from a perfect square around 10 or higher.
- **1** — ordinary ellipse (same as the `round` keyword). The _classic_. Just like standard `border-radius`, no squircling at all. Why are you even here?
- **0** — straight bevel (same as the `bevel` keyword)
- **Negative values** — concave "scooped out" corners (`-1` = `scoop`, `-∞` = `notch`)

See the [MDN reference for `superellipse()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/superellipse) for the full spec.

### Configuring theme tokens

Everything that `squircle-*` and `squircle-amt-*` accept is driven by Tailwind's `@theme` block, so configuration is standard Tailwind — no special knobs.

#### Custom radius sizes

Any `--radius-*` token you define works automatically:

```css
@theme {
  --radius-hero: 2.5rem;
  --radius-blob: 48px;
}
```

```html
<div class="squircle-hero">…</div>
<div class="squircle-blob">…</div>
```

#### Default superellipse amount

`--squircle-amt` is a regular CSS custom property — set it anywhere it'll be in scope and it overrides the default of `2` for every `squircle-*` and `squircle-amt-*` utility beneath it:

```css
:root {
  --squircle-amt: 3;
}

/* or scoped to a subtree: */
.hero {
  --squircle-amt: 2.5;
}
```

Individual elements can still override with `squircle-amt-*` classes.

#### Referencing a runtime CSS variable

Paren refs like `squircle-(--my-radius)` or `squircle-amt-(--my-amt)` are intentionally rejected (poor things). Tailwind can't distinguish them from unit-typo brackets like `squircle-amt-[1em]` at the validation level, so allowing one means allowing the other. Thread the var through a theme key instead (or, y'know, fork this repo, or tell me I'm wrong, and maybe I'll change):

```css
@theme {
  --radius-hero: var(--hero-radius);
  --squircle-amt-hero: var(--hero-squircle-amt);
}
```

```html
<div class="squircle-hero squircle-amt-hero">…</div>
```

Tailwind resolves the theme key, which reads your underlying CSS variable — you get the runtime indirection, the validator still catches typos.

### JS plugin options

If you installed via the JS plugin, three options tune the emitted output:

| Option    | Default            | Effect                                                             |
| --------- | ------------------ | ------------------------------------------------------------------ |
| `prefix`  | `"squircle"`       | Class prefix. `prefix: "sq"` → `sq-md`, `sq-t-lg`                  |
| `amt-var` | `"--squircle-amt"` | CSS variable name for the `K` parameter passed to `superellipse()` |
| `r-var`   | `"--squircle-r"`   | CSS variable name for the intermediate corrected-radius variable   |

All three are exposed as kebab-case inside the `@plugin` block and as camelCase (`amtVar`, `rVar`) when requiring the plugin from JavaScript.

</details>

<details>
<summary><strong>Panda CSS</strong></summary>

### 1. Install Panda

```bash
npm install -D @pandacss/dev @klinking/squircle
```

If you don't have Panda set up yet, follow the [official quickstart](https://panda-css.com/docs/installation/cli) to initialize a `panda.config.ts` and your `styled-system/` codegen output.

### 2. Register the preset

```ts
// panda.config.ts
import { defineConfig } from "@pandacss/dev";
import squirclePreset from "@klinking/squircle/panda";

export default defineConfig({
  presets: ["@pandacss/dev/presets", squirclePreset()],
  // ... your other config
});
```

Re-run `panda codegen` so the new `squircle*` properties show up in the typed `css({ … })` and `cva({ … })` APIs.

### 3. Use the utilities

The naming follows Panda's own border-radius convention exactly — substitute `border` ↔ `squircle` and `rounded` ↔ `squircle` (the shorthand) and the table is identical to Panda's:

| Full property name          | Shorthand             | CSS targets                        |
| --------------------------- | --------------------- | ---------------------------------- |
| `squircleRadius`            | `squircle`            | `border-radius` (all four corners) |
| `squircleTopRadius`         | `squircleTop`         | top corners                        |
| `squircleRightRadius`       | `squircleRight`       | right corners                      |
| `squircleBottomRadius`      | `squircleBottom`      | bottom corners                     |
| `squircleLeftRadius`        | `squircleLeft`        | left corners                       |
| `squircleStartRadius`       | `squircleStart`       | inline-start corners (logical)     |
| `squircleEndRadius`         | `squircleEnd`         | inline-end corners (logical)       |
| `squircleTopLeftRadius`     | `squircleTopLeft`     | top-left corner                    |
| `squircleTopRightRadius`    | `squircleTopRight`    | top-right corner                   |
| `squircleBottomRightRadius` | `squircleBottomRight` | bottom-right corner                |
| `squircleBottomLeftRadius`  | `squircleBottomLeft`  | bottom-left corner                 |
| `squircleStartStartRadius`  | `squircleStartStart`  | start-start corner (logical)       |
| `squircleStartEndRadius`    | `squircleStartEnd`    | start-end corner (logical)         |
| `squircleEndStartRadius`    | `squircleEndStart`    | end-start corner (logical)         |
| `squircleEndEndRadius`      | `squircleEndEnd`      | end-end corner (logical)           |
| `squircleAmount`            | `squircleAmt`         | superellipse exponent (default 2)  |

All radius utilities resolve through your `radii` theme tokens, so `squircle: "md"` reads the same `--radii-md` your `borderRadius: "md"` does:

```tsx
import { css, cva } from "../styled-system/css";

// All four corners, token radius
<div className={css({ squircle: "md", padding: "4" })} />

// Single corner with explicit superellipse amount
<div className={css({ squircleTopLeft: "lg", squircleAmt: 3 })} />

// Arbitrary value (any string Panda would accept for borderRadius)
<div className={css({ squircle: "24px" })} />

// Inside a recipe
const button = cva({
  base: { squircle: "md", paddingInline: "4" },
  variants: { tone: { brand: { squircleAmt: 3 } } },
});
```

The preset also registers a `_squircleSupported` condition mapped to `@supports (corner-shape: superellipse(2))`. Use it to layer on extra styles in the squircle branch only:

```tsx
<div
  className={css({
    squircle: "lg",
    boxShadow: "sm",
    _squircleSupported: { boxShadow: "0 0 0 1px rgb(0 0 0 / 0.1)" },
  })}
/>
```

### 4. (Optional) customize CSS variable names

If you've already standardized on different variable names — say your design system uses `--corner-amt` everywhere — pass them when calling the preset:

```ts
squirclePreset({
  amtVar: "--corner-amt", // default: --squircle-amt
  rVar: "--corner-r", // default: --squircle-r
});
```

The override flows through every transform: the `@supports` calc, the `cornerShape: superellipse(var(--corner-amt))`, and the `squircleAmount` utility's variable write.

### 5. (Optional) prefix the generated classes

If you're running Panda alongside another utility framework (Tailwind, Mantine, etc.) and worried about class collisions, use Panda's own [`prefix`](https://panda-css.com/docs/concepts/extend) option in `panda.config.ts`. It applies to every Panda utility, this preset included:

```ts
export default defineConfig({
  prefix: "pd",
  presets: ["@pandacss/dev/presets", squirclePreset()],
});
```

### Notes

- **Usage-driven extraction.** Panda only emits CSS for properties it finds in scanned source. If you want every `squircle*` variant in the output regardless of usage, opt them in via Panda's [`staticCss`](https://panda-css.com/docs/guides/static-css) config.
- **Optional peer.** `@pandacss/dev` is an _optional_ peer dependency on `@klinking/squircle` — installing the package without Panda doesn't pull Panda in.

</details>

<details>
<summary><strong>StyleX</strong></summary>

### 1. Install & configure StyleX

```bash
npm install @stylexjs/stylex @klinking/squircle
npm install -D @stylexjs/babel-plugin
```

Set up `@stylexjs/babel-plugin` in your bundler per the [StyleX installation guide](https://stylexjs.com/docs/learn/installation/). One extra detail: `@klinking/squircle/stylex` ships a pre-compiled module that contains `stylex.create()` calls, so your StyleX babel config must also process this package — not just your own source files. See the [babel plugin docs](https://stylexjs.com/docs/api/configuration/babel-plugin/) for how to configure external module processing.

### 2. Use the utilities

```tsx
import * as stylex from "@stylexjs/stylex";
import { squircle } from "@klinking/squircle/stylex";

// All four corners
<div {...stylex.props(squircle.all("1rem"))} />

// Single corner with custom superellipse amount
<div {...stylex.props(squircle.topLeft("1.5rem", 3))} />

// Per-side
<div {...stylex.props(squircle.top("0.75rem"))} />

// Logical (inline-start/inline-end aware)
<div {...stylex.props(squircle.startStart("0.5rem"))} />
```

`squircle` exposes one entry per variant — same 15-name table as the Panda preset (`all`, `top`, `right`, `bottom`, `left`, `start`, `end`, `topLeft`, `topRight`, `bottomRight`, `bottomLeft`, `startStart`, `startEnd`, `endStart`, `endEnd`). Each entry is a function with this signature:

```ts
(radius: string | number, amt?: string | number) => StyleXStyles;
```

- `radius` — any value valid for `border-radius` (rem, px, %, a `var(--…)` reference, or a number which StyleX converts to px).
- `amt` — the superellipse exponent. **Defaults to `2`.** Unlike the Tailwind and Panda integrations, this preset does _not_ read `--squircle-amt` from the cascade — pass `amt` explicitly per call site to tune it.

Browsers without `corner-shape` support fall back to a plain `border-radius` at the same size (the `@supports` block silently drops out).

### 3. Mix with your own styles

`stylex.props` accepts any number of style references and merges them. Layer squircle on top of your own component styles:

```tsx
const styles = stylex.create({
  card: { padding: 16, backgroundColor: "#fff", boxShadow: "0 1px 2px #0002" },
});

<div {...stylex.props(styles.card, squircle.all("1rem"))} />;
```

### 4. Use shared radius tokens

Pull radii out into a `defineVars` file so multiple components share one scale:

```ts
// theme/radii.stylex.ts
import * as stylex from "@stylexjs/stylex";

export const radii = stylex.defineVars({
  sm: "0.25rem",
  md: "0.5rem",
  lg: "1rem",
});
```

```tsx
import { radii } from "./theme/radii.stylex";
import { squircle } from "@klinking/squircle/stylex";

<div {...stylex.props(squircle.all(radii.md))} />;
```

`radii.md` is a `var(--xR-…)` reference at runtime, which StyleX wraps in another custom property and the squircle calc resolves transitively.

### Notes

- **No CSS-variable knobs.** The Tailwind and Panda integrations expose `amtVar` / `rVar` because they emit static `@supports` blocks the cascade can override. StyleX's preset is per-call parametric instead — there's nothing to rename.
- **Static analysis.** The 15-variant table is a single statically-analyzable `stylex.create({ … })` literal, so your StyleX bundler picks it up the same way it picks up your own create calls. The literal is generated from a template — see `package/scripts/generate-stylex.ts`.
- **Optional peer.** `@stylexjs/stylex` is an _optional_ peer dependency on `@klinking/squircle` — installing the package without StyleX doesn't pull it in.

</details>

<details>
<summary><strong>CSS function: <code>squircle-radius()</code></strong> (experimental)</summary>

> CSS `@function` is in [CSS Values 5](https://drafts.csswg.org/css-values-5/#custom-functions) and enabled behind a flag in recent Chrome. Check current support on [caniuse](https://caniuse.com/?search=%40function). For the same correction in today's browsers, use one of the options above — they expand to inline `calc()` that has been supported for years.

For the footure. Less total CSS than all those tailwind utilities. So beautiful. So utterly currently unusable.

```css
@import "@klinking/squircle/radius-function.css";

.card {
  --squircle-amt: 2;
  border-radius: squircle-radius(1rem, var(--squircle-amt));
  corner-shape: superellipse(var(--squircle-amt));
}
```

Arguments:

- `--radius` — the target `<length>` (what you'd have passed to `border-radius`)
- `--squircle-amt` — the `K` value you're passing to `superellipse()`

The parameters are deliberately untyped so relative units (`em`, `rem`, container queries, etc.) resolve at the call site, not at function-definition time — matching how CSS custom properties normally propagate.

**Heads up:** this doesn't supply the uncorrected fallback for browsers that have `@function` but lack `corner-shape`. By the time `@function` support is widespread, `corner-shape` probably will be too, so ¯\\\_(ツ)\_/¯.

</details>

## Pill Shapes with Houdini CSS Paint Worklet

`rounded-full` gives you a stadium: two semicircles and two straight edges, meeting where the curvature drops from `1/r` to zero in a single step. That step is visible as a faint crease at each end of every pill button. `corner-shape: superellipse()` can't fix it — on a pill the cap _is_ the shape, so reshaping the corner changes the silhouette — and no combination of `border-radius` values can ease one curvature into another.

`squircle-pill` draws the pill with a [Houdini paint worklet](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Painting_API) instead. The caps stay circular arcs, and the last stretch of each arc is replaced by a **G2-continuous easing**: a power-law spiral (a [clothoid](https://en.wikipedia.org/wiki/Euler_spiral) at its simplest setting) along which curvature falls smoothly to zero before the flat edge begins. There are no size variants — the shape is derived from the element's own dimensions, so one utility covers every button, badge and avatar.

<details>
<summary><strong>Tailwind CSS v4</strong></summary>

### 1. Add the plugins

```css
@import "tailwindcss";
@plugin "@klinking/squircle/tailwind-pill";
@plugin "@klinking/squircle/tailwind-pill-border"; /* optional: border-* drives the pill's border */
```

Both plugins take a `prefix` option (default `squircle-pill`), the same way the squircle plugin does.

### 2. Register the paint worklet

Once, in your app's entry point:

```js
import { registerPillWorklet } from "@klinking/squircle/pill-worklet";

registerPillWorklet();
```

The helper loads the worklet shipped next to it and, once it is in, marks `<html>` with `data-squircle-pill-worklet`. That mark is what switches pills from their `rounded-full` fallback to the drawn shape — `@supports (mask-image: paint(pill-shape))` is true whether or not a worklet by that name ever loaded, so gating on it alone would erase every pill the moment the file failed to load. Where paint worklets are unsupported it resolves to `false` and nothing changes; a load that fails rejects, so the error shows up in the console rather than as blank buttons.

The default locates the worklet with `new URL("./pill-shape.worklet.mjs", import.meta.url)`, which Vite, webpack 5 and Parcel all turn into an emitted asset. If your bundler doesn't, or you serve the file yourself, pass its URL:

```js
// Vite
import workletUrl from "@klinking/squircle/pill-shape.worklet.js?url";
registerPillWorklet(workletUrl);
```

### 3. Use it

```html
<button class="squircle-pill bg-blue-500 px-4 py-2 text-white">Save</button>
<span class="squircle-pill bg-green-100 px-3 py-1 text-green-900">New</span>
<div class="squircle-pill h-10 w-10 bg-zinc-200"></div>
```

| Utility                | Effect                                                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `squircle-pill`        | The pill. Caps derived from the element's size.                                                                                                                                                          |
| `squircle-pill-amt-*`  | How much of each cap is handed to the easing, in 30° steps. `1` is a bare semicircle; default `2`.                                                                                                       |
| `squircle-pill-ease-*` | Stretches the easing further along the flat edge without spending more of the arc. `0` is a clothoid; default `2`.                                                                                       |
| `squircle-pill-g2`     | Matches curvature only (G2), where the easing leaves the arc and where it meets the edge. `squircle-pill-g3`, the default, also matches the rate curvature changes (G3) at both, for any ease above `0`. |

Both accept bare numbers (`squircle-pill-amt-3`, `squircle-pill-amt-1.5`) and arbitrary values (`squircle-pill-amt-[2.5]`), and reject anything else. They only set the custom property — `--squircle-pill-amt` and `--squircle-pill-ease`, and `--squircle-pill-continuity` (`2` or `3`) for the `-g2`/`-g3` utilities — which you can also set yourself, on the element or an ancestor; both are registered and animate. When an element is too narrow for what you asked for, both are eased down together so the join stays smooth; a square renders as a plain circle.

### Borders, outlines and shadows

The element itself is left unshaped. Its background is hidden and painted again on its `::before`, under the content, shaped exactly to the pill, so whatever the background is — colour, gradient, image — that's what gets pill-shaped. Nothing of the stadium `border-radius` underneath ever shows, which matters most next to a shadow: the stadium sits up to a few pixels outside the pill near its caps, and a background painted there would show as a hairline between the pill and its shadow.

**Borders, outlines, rings and box shadows are drawn by the pill**, on its `::after`, along its true outline. With `tailwind-pill-border` loaded, Tailwind's own utilities drive them, and nothing new needs learning:

- `border-*`: a band along the inside of the outline, solid, dashed or dotted. It reserves the same room in layout as a real border.
- `outline-*` and `outline-offset-*`: a band outside the outline, or inside it with a negative offset, solid, dashed or dotted.
- `ring-*` and `ring-offset-*`: a band outside the outline, beyond an offset band in the offset colour, as Tailwind draws them.
- `inset-ring-*`: a band inside the border.
- `shadow-*`: cast by the outline, with the same offsets, blur and spread. Inner shadows (`shadow-inner`, `inset-shadow-*`) are painted by the copy of the background, inside the pill.

The two pseudo-elements are the pill's own. Variants work as anywhere else, so `focus-visible:ring-2` draws a focus ring along the pill and `hover:shadow-lg` lifts it. On any element that isn't a pill, the utilities keep behaving normally. Without the plugin, set the pill's own properties: `--squircle-pill-border-width`, `-border-color` and `-border-style`, `--squircle-pill-outline-width`, `-outline-offset`, `-outline-color` and `-outline-style`, `--squircle-pill-ring-width`, `-ring-color`, `-ring-offset-width` and `-ring-offset-color`, `--squircle-pill-inset-ring-width` and `-inset-ring-color`, and `--squircle-pill-box-shadow`, with `--squircle-pill-shadow-reach` set to how far its shadows reach past the pill — offset plus blur plus spread.

**Everything else is left to the browser**, and follows the pill by itself: a `drop-shadow-*` or any other `filter` sees the pill-shaped background, and Tailwind's `mask-*` utilities and any `clip-path` apply to the whole pill as they would to any element — `squircle-pill mask-b-from-20%` is a pill that fades out towards the bottom, its border and shadow with it. The browser's own focus ring, set by no utility, follows the stadium.

One thing to know: the pill hides its own background by clipping it to its text, and its own box shadow, both with `!important` so that nothing — a utility, an inline `background` — can put the stadium back. So `bg-clip-text` on the pill itself has no effect of its own: the copy still fills the pill. For gradient text inside a pill, put the text in a child.

### Fallback

Without the worklet — Safari, Firefox, or before `registerPillWorklet()` resolves — a pill is a plain `rounded-full` stadium with a real border, and nothing else. Not a superellipse: on a pill the cap is the whole shape, so a superellipse would change the silhouette rather than soften a corner. No layout shift when the worklet lands.

### Polyfill for browsers without paint worklets

To get the real shape in Safari and Firefox too, load the polyfill where the worklet isn't available:

```js
import { registerPillWorklet } from "@klinking/squircle/pill-worklet";

if (!(await registerPillWorklet())) {
  const { polyfillPills } = await import("@klinking/squircle/pill-polyfill");
  polyfillPills();
}
```

It runs the worklet's own geometry on the main thread: a `ResizeObserver` watches every pill, and on each new size the outline is set as a `clip-path: path()` for the copy of the background, and everything drawn around it — border, outline, rings, shadows — as an SVG image, on two custom properties the pill styles read. A clip rather than a mask image for the shape, because a mask image is decoded and rasterised again on every resize, which was over five times slower. The shapes are identical to the worklet's, borders, dashes and shadows included; a square needs no clip at all, its stadium already being the circle it has to be. Each pill shows its stadium until its clip is computed, so there is no flash of anything worse, and a resize too large for one frame spreads over the next few rather than dropping them. The element's own `clip-path` and masks are never touched, so they apply as they do with the worklet.

It picks up pills added or removed later, and re-reads a pill when its `class` changes and when it gains or loses focus, hover or a press, so `focus-visible:` and `hover:` decorations work too. Changes it can't see — an inline `style` setting a pill property or a clip, a stylesheet swap, a media query — need a `refresh()`:

```js
const pills = polyfillPills();
pills.refresh(element); // or pills.refresh() for all of them
```

The cost is main-thread work on resize; the site's `/bench/pills` page measures it against the worklet for a few thousand pills at once, and `website/scripts/bench-pills.mjs` runs the same matrix headlessly.

</details>

<details>
<summary><strong>Without Tailwind</strong></summary>

The same rules, hung off an attribute:

```css
@import "@klinking/squircle/squircle-pill.css";
```

```html
<button data-squircle-pill style="--squircle-pill-border-width: 2px">Save</button>
```

Register the worklet as above. Here the pill's own properties also drive a real border, so a bordered pill degrades to a bordered stadium without the worklet; `--squircle-pill-border-color` defaults to `currentColor` and `--squircle-pill-border-style` to `solid`. The stylesheet is generated from the same source as the Tailwind utility, so the two never disagree.

</details>

### How pill shapes work

A circular arc has constant curvature `1/R`; a straight edge has none. The worklet joins them with a transition along which curvature falls off over the transition's arc length. With `squircle-pill-g2` it falls as `k(t) = (1/R) · (1 − t)^(q − 1)` — a clothoid at `q = 2`, where the fall is linear, and a softer spiral above it. `squircle-pill-amt-*` sets how much of the arc (β, in 30° steps) the transition replaces, and `squircle-pill-ease-*` offsets `q` (`q = ease + 2`), which lengthens the transition to `q · R · β` along the edge without eating any more of the arc. The cap radius is then solved so that the arc's rise plus the transition's rise is exactly half the element's height, so the outline always fits the box; the position along the transition is the Fresnel-type integral of that curvature, evaluated numerically once per shape and cached.

That profile leaves the arc already shedding curvature at a finite rate, so it is only G2 where it leaves the arc. The default, G3, uses `k(t) = (1/R) · (1 − t²)^(q − 1)` instead, whose curvature starts falling with zero slope — G3 at the arc — and, for `q > 2` (any ease above `0`), also arrives with zero slope at the edge. Everything else, including the fit to the box, is the same for both.

That's a different construction from the curvature-continuous fillet in CAD tools (SolidWorks and Onshape's "curvature continuous", Fusion's G2, Rhino's `BlendCrv`), which blend arc into edge with a quintic Hermite polynomial that has position, tangent and curvature prescribed at both ends, controlled by a setback per face and a bulge per end. The spiral's advantage is that its curvature profile is monotone by construction and its length is a closed-form function of the cap, which is what lets it fit itself to the box; the Hermite blend keeps the cap at its full radius and lets the blend bow outward, which is right for a model and wrong for a button. The site's [pill algorithms demo](https://squircle.klink.ing/demos/pill-algorithms) renders the two side by side, with each one's controls and a curvature comb, so you can judge for yourself.

**Browser support:** the Paint API is in Chromium (Chrome, Edge, Opera, Samsung Internet). Safari and Firefox get the stadium fallback. Both `--squircle-pill-*` properties are registered with `@property`, which those browsers support, so nothing else changes.

## How the radius correction works

A superellipse at the same outer `border-radius` as a circular arc pokes further into the corner. The fix is to scale the radius up by some maths, so the _apparent_ roundness matches what you'd get from `rounded-*`. That is, the distance from the corner to the maximum pokage will match for both the superelliptical corner and the circular corner.

The correction formula:

$$r' = r \cdot \frac{1 - 2^{-\frac{1}{2}}}{1 - 2^{-\frac{1}{n}}}$$

where $n = 2^K$ and $K$ is the value you pass to `superellipse(K)` (same K as [`squircle-amt-*`](#what-does-squircle-amt--control)).

### Worked example: `squircle-md`

With the default Tailwind `--radius-md: 0.375rem` and the default `--squircle-amt: 2` (so `K = 2`, `n = 4`):

$$r' = 0.375\text{rem} \cdot \frac{1 - 2^{-1/2}}{1 - 2^{-1/4}} \approx 0.375\text{rem} \cdot 1.840 \approx 0.690\text{rem}$$

So `.squircle-md` compiles to roughly:

```css
.squircle-md {
  border-radius: 0.375rem; /* fallback: matches rounded-md visually */
  @supports (corner-shape: superellipse(2)) {
    --squircle-r: calc(0.375rem * (1 - pow(2, -0.5)) / (1 - pow(2, -0.25)));
    border-radius: var(--squircle-r); /* ≈ 0.690rem, compensated */
    corner-shape: superellipse(2);
  }
}
```

The browser does the actual `calc()` at render time using native [`pow()` and `calc()`](https://caniuse.com/?search=pow) — there's no build-time float math in the emitted CSS.

The adjusted radius is wrapped in a `@supports (corner-shape: superellipse(2))` rule, so browsers without support simply use the original `border-radius` unchanged. This means your corners will look visually consistent regardless of browser — no sudden changes when support lands, no broken fallbacks. Since browser support for `corner-shape` is still not universal, this gives you consistent visual border-radius forever.

See the [interactive demo](https://dogmar.github.io/squircle) for a visual explanation.

## Browser support & fallback strategy

### Support matrix

| Feature                                                                    | Used for                                       | Support                                                        |
| -------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| [`corner-shape: superellipse()`](https://caniuse.com/?search=corner-shape) | The squircle shape itself                      | New; fallback to plain `border-radius` in unsupported browsers |
| [`@supports`](https://caniuse.com/css-supports-api)                        | Gating the correction                          | Universal for years                                            |
| [`pow()` / `calc()`](https://caniuse.com/?search=pow)                      | The correction math                            | Widely supported (Safari 16.4+, Chrome 112+, Firefox 118+)     |
| [Logical properties](https://caniuse.com/css-logical-props)                | `squircle-s/e/ss/se/es/ee-*`                   | Widely supported                                               |
| [CSS `@function`](https://caniuse.com/?search=%40function)                 | Optional `squircle-radius()` helper            | Experimental; Chrome flag only                                 |
| [CSS custom properties](https://caniuse.com/css-variables)                 | Theme tokens, `--squircle-amt`, `--squircle-r` | Universal                                                      |
| [CSS Paint API](https://caniuse.com/css-paint-api)                         | `squircle-pill` shape and border               | Chromium only; fallback to `rounded-full` elsewhere            |

The Tailwind utilities depend on rows 1–4 and row 6. Only `corner-shape` itself is "new" — everything else is shipped broadly. The standalone `@function` helper is the only genuinely experimental piece.

### Fallback strategy

The corrected radius is wrapped in `@supports (corner-shape: superellipse(2))`, so browsers that don't know about `corner-shape` skip the entire block and fall back to the plain `border-radius` declaration above — no `corner-shape`, no squircle, just a regular rounded corner at your original theme radius. Ship `squircle-*` today without worrying about Safari: unsupported browsers show `rounded-*`-equivalent corners now, and the squircle shape lights up automatically when support lands, without any visual jump in the already-shipped radius.

## Why it called "squircle" when it use "superellipse()"?

Cuz ain't no one, not even a clanker want to type supperlips over and over again. See? I couldn't even type it _once_ without mussin' it up.

## Alternatives considered

- **Just use `corner-shape: superellipse()` directly.** Works fine, but at the same `border-radius` the corners read as smaller than `rounded-*` — so swapping one for the other breaks your visual hierarchy and you end up eyeballing compensation for every component. This package is that eyeballing, solved once.
- **JS squircle libraries** (e.g. Figma Squircle). SVG-based, not native CSS, they carry a runtime cost and don't compose with Tailwind's utility model.
- **Write the `@utility` block in your own project.** Totally reasonable — it's ~100 lines of CSS. See ["Should you install or copy/paste?"](#should-you-install-or-copypaste) for when that's the right call.
- **Wait for `corner-shape` to land everywhere and skip the correction.** I mean, sure. You'll just need to get used to how `border-radius` effects superellipseseses. Go for it. Though if you keep using the border-radiuses you know and love, it makes it easier to do the math on getting nested corners to snug up nicely.

## Should you install or copy/paste?

Both are first-class — at least for the Tailwind CSS utilities, which are ~100 lines you can drop straight into your project. The Panda and StyleX presets are JS modules with more moving parts, so installing makes more sense there.

**Copy/paste if** (Tailwind):

- Honestly, I recommend it. Let's be real, I'm probably not going to make many updates to this library, and why expose yourself to some future security risk when I die and Vladimir Jong Un trojan-horses this thing.
- You want zero runtime/build dependencies.
- You want to tweak the formula, the utility names, or the value validation yourself.
- You're not sure you'll want updates — the CSS is short and the math won't change.

**Install if:**

- You want upgrades when the formula tightens, the value validation changes, or the utility surface grows.
- You're using the Panda CSS preset or StyleX preset — those are JS modules, so copy/paste isn't practical.
- You want Tailwind's JS plugin form (custom `prefix`, `amt-var`, `r-var`) or the `tailwind-merge` conflict config.
- You want the standalone [`squircle-radius()`](#css-function-squircle-radius) CSS function.

## FAQ

<details>
<summary><strong>Does this work in Safari/Firefox/Chrome today?</strong></summary>

Partially, at time of writing — recent Chrome ships `corner-shape`, Safari and Firefox are still catching up. Check [caniuse](https://caniuse.com/?search=corner-shape) for the current state. Either way you're fine: in a browser without support, you get a plain `border-radius` at the pre-correction value, which visually matches `rounded-*`. No broken layouts, no visible fallback weirdness.

</details>

<details>
<summary><strong>Does it work with Tailwind v3?</strong></summary>

The **CSS utilities** (`tailwind/utils.css`) are v4-only — they use `@utility` and `--value()`, which don't exist in v3.

The **JS plugin** uses only APIs that exist in both v3 and v4 (`plugin.withOptions`, `matchUtilities`, `type: "length" | "number"`, `theme()`), so it's likely to work in v3 via a `tailwind.config.js`-style registration — but it's not currently tested or declared against v3. Tracked in [#26](https://github.com/klink-ing/squircle/pull/26).

</details>

<details>
<summary><strong>Why do my corners look smaller with <code>corner-shape: superellipse</code> without this?</strong></summary>

At the same `border-radius`, a squircle pokes further into the corner, so less of the box edge is rounded off. The fix is to scale the radius up so the visual roundness matches `rounded-*` — see [How the radius correction works](#how-the-radius-correction-works).

</details>

<details>
<summary><strong>Does this add runtime JS?</strong></summary>

No. Everything is static CSS — the Tailwind utilities expand at build time into declarations with a native `calc()` the browser evaluates. The JS plugin also runs at build time only. Zero JS ships to the browser.

</details>

<details>
<summary><strong>What happens once <code>corner-shape</code> is universal?</strong></summary>

Nothing you need to do. The correction lives inside `@supports (corner-shape: superellipse(2))`, so it activates exactly when the shape does. Once the browser ships support, the shape applies _and_ the compensated radius applies, at the same moment. Your layout is identical before and after.

</details>

<details>
<summary><strong>Do I need <code>tailwind-merge</code>?</strong></summary>

Only if your project already uses it. The extra config (`squircleMergeConfig`) exists so `rounded-lg squircle-md` de-duplicates the way you'd expect — otherwise tailwind-merge doesn't know `squircle-*` and `rounded-*` occupy the same slot.

</details>

<details>
<summary><strong>What's the difference between the utilities and the <code>squircle-radius()</code> function?</strong></summary>

The utilities expand to inline `calc()` at build time — they work in any browser that supports `calc()` + `pow()` (most current ones) and degrade to plain `border-radius` where `corner-shape` isn't supported.

The `@function` form runs the same math at CSS runtime via CSS Values 5's `@function` — which is [experimental](https://caniuse.com/?search=%40function) (Chrome behind a flag, nothing else yet). Use the utilities unless you're specifically building for a non-Tailwind setup.

</details>

<details>
<summary><strong>Can I use a different <code>squircle-amt</code> for each corner?</strong></summary>

No. `corner-shape` is declared once per element, so all four corners share the same K. You can still mix per-corner _radii_ (`squircle-tl-lg squircle-br-sm`), but the squircle-ness is uniform across the element.

</details>

<details>
<summary><strong>Why is the tone of this README all over the place?</strong></summary>

Because I made Claude write most of it, got mad at claude, re-wrote a lot of stuff myself, then got tired and let Claude win.

</details>

<details>
<summary><strong>Did you just let Claude write this?</strong></summary>

Kinda. Honestly I wrote the basic tailwind utilities by hand using a weird cobbled together formula I just kinda eyeballed to work for most values anyone would actually want to use for the `superellipse()` param. But then I thought, hey, robots are good at math, maybe they can make the formula _actually_ **correct**. And they could! The robots _could_ make a right formula. I was so happy. I cried tears of joy for days and days. So many tears I drowned my robot. And now I'll never code again. Alas.

</details>

## Copy/paste source

If you'd rather not add a dependency, copy the source directly. Click to expand each file.

<details>
<summary><strong><code>tailwind/utils.css</code></strong> — the Tailwind utilities</summary>

<!-- BEGIN:dist/tailwind/utils.css -->

```css
/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

/* ── Squircle utilities ─────────────────────────────────────── */
/* squircle-amt-[n] sets the superellipse amount (default 2)    */
/* squircle-* mirrors rounded-* variants: t, r, b, l, s, e, tl, tr, br, bl, ss, se, es, ee */
/* squircle-*-none and squircle-*-full are static, matching rounded-none and rounded-full */

/* squircle-amt-[n] only sets the amount — the same thing writing
   --squircle-amt yourself does. It applies no corner-shape of its own, so it
   never reshapes corners that no squircle-* utility claimed. */
@utility squircle-amt-* {
  --squircle-amt: --value(--squircle-amt-*, number, [number]);
}

@utility squircle-none {
  border-radius: 0;
}

@utility squircle-full {
  border-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-* {
  border-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    --squircle-r: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    border-radius: var(--squircle-r);
    corner-shape: superellipse(var(--squircle-amt, 2));
  }
}

/* --- Per-side physical variants --- */

@utility squircle-t-none {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

@utility squircle-t-full {
  border-top-left-radius: calc(infinity* 1px);
  border-top-right-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-top-left-shape: superellipse(var(--squircle-amt, 2));
    corner-top-right-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-t-* {
  border-top-left-radius: --value(--radius-*, [length]);
  border-top-right-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    --squircle-r: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    border-top-left-radius: var(--squircle-r);
    border-top-right-radius: var(--squircle-r);
    corner-top-left-shape: superellipse(var(--squircle-amt, 2));
    corner-top-right-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-r-none {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

@utility squircle-r-full {
  border-top-right-radius: calc(infinity* 1px);
  border-bottom-right-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-top-right-shape: superellipse(var(--squircle-amt, 2));
    corner-bottom-right-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-r-* {
  border-top-right-radius: --value(--radius-*, [length]);
  border-bottom-right-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    --squircle-r: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    border-top-right-radius: var(--squircle-r);
    border-bottom-right-radius: var(--squircle-r);
    corner-top-right-shape: superellipse(var(--squircle-amt, 2));
    corner-bottom-right-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-b-none {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

@utility squircle-b-full {
  border-bottom-left-radius: calc(infinity* 1px);
  border-bottom-right-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-bottom-left-shape: superellipse(var(--squircle-amt, 2));
    corner-bottom-right-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-b-* {
  border-bottom-left-radius: --value(--radius-*, [length]);
  border-bottom-right-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    --squircle-r: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    border-bottom-left-radius: var(--squircle-r);
    border-bottom-right-radius: var(--squircle-r);
    corner-bottom-left-shape: superellipse(var(--squircle-amt, 2));
    corner-bottom-right-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-l-none {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

@utility squircle-l-full {
  border-top-left-radius: calc(infinity* 1px);
  border-bottom-left-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-top-left-shape: superellipse(var(--squircle-amt, 2));
    corner-bottom-left-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-l-* {
  border-top-left-radius: --value(--radius-*, [length]);
  border-bottom-left-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    --squircle-r: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    border-top-left-radius: var(--squircle-r);
    border-bottom-left-radius: var(--squircle-r);
    corner-top-left-shape: superellipse(var(--squircle-amt, 2));
    corner-bottom-left-shape: superellipse(var(--squircle-amt, 2));
  }
}

/* --- Per-side logical variants --- */

@utility squircle-s-none {
  border-start-start-radius: 0;
  border-end-start-radius: 0;
}

@utility squircle-s-full {
  border-start-start-radius: calc(infinity* 1px);
  border-end-start-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-start-start-shape: superellipse(var(--squircle-amt, 2));
    corner-end-start-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-s-* {
  border-start-start-radius: --value(--radius-*, [length]);
  border-end-start-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    --squircle-r: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    border-start-start-radius: var(--squircle-r);
    border-end-start-radius: var(--squircle-r);
    corner-start-start-shape: superellipse(var(--squircle-amt, 2));
    corner-end-start-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-e-none {
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}

@utility squircle-e-full {
  border-start-end-radius: calc(infinity* 1px);
  border-end-end-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-start-end-shape: superellipse(var(--squircle-amt, 2));
    corner-end-end-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-e-* {
  border-start-end-radius: --value(--radius-*, [length]);
  border-end-end-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    --squircle-r: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    border-start-end-radius: var(--squircle-r);
    border-end-end-radius: var(--squircle-r);
    corner-start-end-shape: superellipse(var(--squircle-amt, 2));
    corner-end-end-shape: superellipse(var(--squircle-amt, 2));
  }
}

/* --- Per-corner physical variants --- */

@utility squircle-tl-none {
  border-top-left-radius: 0;
}

@utility squircle-tl-full {
  border-top-left-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-top-left-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-tl-* {
  border-top-left-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    border-top-left-radius: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    corner-top-left-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-tr-none {
  border-top-right-radius: 0;
}

@utility squircle-tr-full {
  border-top-right-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-top-right-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-tr-* {
  border-top-right-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    border-top-right-radius: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    corner-top-right-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-br-none {
  border-bottom-right-radius: 0;
}

@utility squircle-br-full {
  border-bottom-right-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-bottom-right-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-br-* {
  border-bottom-right-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    border-bottom-right-radius: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    corner-bottom-right-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-bl-none {
  border-bottom-left-radius: 0;
}

@utility squircle-bl-full {
  border-bottom-left-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-bottom-left-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-bl-* {
  border-bottom-left-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    border-bottom-left-radius: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    corner-bottom-left-shape: superellipse(var(--squircle-amt, 2));
  }
}

/* --- Per-corner logical variants --- */

@utility squircle-ss-none {
  border-start-start-radius: 0;
}

@utility squircle-ss-full {
  border-start-start-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-start-start-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-ss-* {
  border-start-start-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    border-start-start-radius: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    corner-start-start-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-se-none {
  border-start-end-radius: 0;
}

@utility squircle-se-full {
  border-start-end-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-start-end-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-se-* {
  border-start-end-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    border-start-end-radius: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    corner-start-end-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-es-none {
  border-end-start-radius: 0;
}

@utility squircle-es-full {
  border-end-start-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-end-start-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-es-* {
  border-end-start-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    border-end-start-radius: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    corner-end-start-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-ee-none {
  border-end-end-radius: 0;
}

@utility squircle-ee-full {
  border-end-end-radius: calc(infinity* 1px);
  @supports (corner-shape: superellipse(2)) {
    corner-end-end-shape: superellipse(var(--squircle-amt, 2));
  }
}

@utility squircle-ee-* {
  border-end-end-radius: --value(--radius-*, [length]);
  @supports (corner-shape: superellipse(2)) {
    border-end-end-radius: calc(
      --value(--radius- *, [length]) * (1 - pow(2, -0.5)) /
        (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt, 2))))
    );
    corner-end-end-shape: superellipse(var(--squircle-amt, 2));
  }
}

/* ── rounded-* corner-shape resets ──────────────────────────── */
/* Tailwind's rounded-* utilities only set a radius, so on their own they can't
   take a corner back from a squircle. These re-declarations add the matching
   corner-shape reset; Tailwind still emits its own rule for the radius. The
   reset is the initial value, so it does nothing unless a squircle class set a
   shape on the same element. rounded-*-none needs none: a zero radius has no
   visible corner to shape. */

@utility rounded-full {
  corner-shape: round;
}

@utility rounded-* {
  border-radius: --value(--radius-*, [length]);
  corner-shape: round;
}

@utility rounded-t-full {
  corner-top-left-shape: round;
  corner-top-right-shape: round;
}

@utility rounded-t-* {
  border-top-left-radius: --value(--radius-*, [length]);
  border-top-right-radius: --value(--radius-*, [length]);
  corner-top-left-shape: round;
  corner-top-right-shape: round;
}

@utility rounded-r-full {
  corner-top-right-shape: round;
  corner-bottom-right-shape: round;
}

@utility rounded-r-* {
  border-top-right-radius: --value(--radius-*, [length]);
  border-bottom-right-radius: --value(--radius-*, [length]);
  corner-top-right-shape: round;
  corner-bottom-right-shape: round;
}

@utility rounded-b-full {
  corner-bottom-left-shape: round;
  corner-bottom-right-shape: round;
}

@utility rounded-b-* {
  border-bottom-left-radius: --value(--radius-*, [length]);
  border-bottom-right-radius: --value(--radius-*, [length]);
  corner-bottom-left-shape: round;
  corner-bottom-right-shape: round;
}

@utility rounded-l-full {
  corner-top-left-shape: round;
  corner-bottom-left-shape: round;
}

@utility rounded-l-* {
  border-top-left-radius: --value(--radius-*, [length]);
  border-bottom-left-radius: --value(--radius-*, [length]);
  corner-top-left-shape: round;
  corner-bottom-left-shape: round;
}

@utility rounded-s-full {
  corner-start-start-shape: round;
  corner-end-start-shape: round;
}

@utility rounded-s-* {
  border-start-start-radius: --value(--radius-*, [length]);
  border-end-start-radius: --value(--radius-*, [length]);
  corner-start-start-shape: round;
  corner-end-start-shape: round;
}

@utility rounded-e-full {
  corner-start-end-shape: round;
  corner-end-end-shape: round;
}

@utility rounded-e-* {
  border-start-end-radius: --value(--radius-*, [length]);
  border-end-end-radius: --value(--radius-*, [length]);
  corner-start-end-shape: round;
  corner-end-end-shape: round;
}

@utility rounded-tl-full {
  corner-top-left-shape: round;
}

@utility rounded-tl-* {
  border-top-left-radius: --value(--radius-*, [length]);
  corner-top-left-shape: round;
}

@utility rounded-tr-full {
  corner-top-right-shape: round;
}

@utility rounded-tr-* {
  border-top-right-radius: --value(--radius-*, [length]);
  corner-top-right-shape: round;
}

@utility rounded-br-full {
  corner-bottom-right-shape: round;
}

@utility rounded-br-* {
  border-bottom-right-radius: --value(--radius-*, [length]);
  corner-bottom-right-shape: round;
}

@utility rounded-bl-full {
  corner-bottom-left-shape: round;
}

@utility rounded-bl-* {
  border-bottom-left-radius: --value(--radius-*, [length]);
  corner-bottom-left-shape: round;
}

@utility rounded-ss-full {
  corner-start-start-shape: round;
}

@utility rounded-ss-* {
  border-start-start-radius: --value(--radius-*, [length]);
  corner-start-start-shape: round;
}

@utility rounded-se-full {
  corner-start-end-shape: round;
}

@utility rounded-se-* {
  border-start-end-radius: --value(--radius-*, [length]);
  corner-start-end-shape: round;
}

@utility rounded-es-full {
  corner-end-start-shape: round;
}

@utility rounded-es-* {
  border-end-start-radius: --value(--radius-*, [length]);
  corner-end-start-shape: round;
}

@utility rounded-ee-full {
  corner-end-end-shape: round;
}

@utility rounded-ee-* {
  border-end-end-radius: --value(--radius-*, [length]);
  corner-end-end-shape: round;
}
```

<!-- END:dist/tailwind/utils.css -->

</details>

<details>
<summary><strong><code>radius-function.css</code></strong> — the <code>squircle-radius()</code> CSS function</summary>

<!-- BEGIN:dist/radius-function.css -->

```css
/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

/* ── squircle-radius() ────────────────────────────────────────
 * Computes the visually-corrected border-radius for use with
 * corner-shape: superellipse(). A superellipse corner appears
 * tighter than a circular arc at the same radius, so the radius
 * must be scaled up to preserve the intended visual size.
 *
 * --radius       The target border-radius (any <length>).
 * --squircle-amt The superellipse exponent passed to corner-shape.
 *
 * Parameters are untyped to preserve standard CSS resolution of
 * relative units (em, rem, etc.) — they resolve in the context
 * where the function result is applied, not at call time.
 *
 * Usage:
 *   border-radius: squircle-radius(1rem, 1.5);
 *   corner-shape: superellipse(1.5);
 * ──────────────────────────────────────────────────────────── */
@function squircle-radius(--radius, --squircle-amt) {
  result: calc(
    var(--radius) * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * var(--squircle-amt))))
  );
}
```

<!-- END:dist/radius-function.css -->

</details>

<details>
<summary><strong><code>squircleMergeConfig</code></strong> — tailwind-merge conflict config</summary>

```js
/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { extendTailwindMerge } from "tailwind-merge";

// Mirrors tailwind-merge's own `rounded` hierarchy: a later all-corners
// utility cancels earlier side/corner utilities, a side cancels its two
// corners, and a narrower utility never cancels a broader one. Each squircle
// group also conflicts with its `rounded` counterpart (and vice versa).
// `squircle-amt-*` is orthogonal: radius classes never cancel it.
const SIDE_CORNERS = {
  t: ["tl", "tr"],
  r: ["tr", "br"],
  b: ["br", "bl"],
  l: ["tl", "bl"],
  s: ["ss", "es"],
  e: ["se", "ee"],
};
const CORNERS = ["tl", "tr", "br", "bl", "ss", "se", "es", "ee"];
const SIDES = Object.keys(SIDE_CORNERS);
const ALL_SUFFIXES = ["", ...SIDES, ...CORNERS];

const sq = (suffix) => (suffix ? `squircle-${suffix}` : "squircle");
const rd = (suffix) => (suffix ? `rounded-${suffix}` : "rounded");

const conflictingClassGroups = {
  squircle: [...ALL_SUFFIXES.slice(1).map(sq), ...ALL_SUFFIXES.map(rd)],
  rounded: ALL_SUFFIXES.map(sq),
};
for (const side of SIDES) {
  const corners = SIDE_CORNERS[side];
  conflictingClassGroups[sq(side)] = [...corners.map(sq), rd(side), ...corners.map(rd)];
  conflictingClassGroups[rd(side)] = [sq(side), ...corners.map(sq)];
}
for (const corner of CORNERS) {
  conflictingClassGroups[sq(corner)] = [rd(corner)];
  conflictingClassGroups[rd(corner)] = [sq(corner)];
}

export const squircleMergeConfig = {
  extend: {
    classGroups: {
      ...Object.fromEntries(
        ALL_SUFFIXES.map((suffix) => [sq(suffix), [{ [sq(suffix)]: [() => true] }]]),
      ),
      "squircle-amt": [{ "squircle-amt": [() => true] }],
    },
    conflictingClassGroups,
  },
};

export const twMerge = extendTailwindMerge(squircleMergeConfig);
```

</details>

<details>
<summary><strong><code>stylex/index.mjs</code></strong> — the StyleX dynamic-style preset</summary>

<!-- BEGIN:dist/stylex/index.mjs -->

````js
import * as stylex from "@stylexjs/stylex";
/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */
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
const squircle = stylex.create({
  all: (radius, amt) => ({
    borderRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
  top: (radius, amt) => ({
    borderTopLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    borderTopRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerTopLeftShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
    cornerTopRightShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
  right: (radius, amt) => ({
    borderTopRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    borderBottomRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerTopRightShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
    cornerBottomRightShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
  bottom: (radius, amt) => ({
    borderBottomLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    borderBottomRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerBottomLeftShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
    cornerBottomRightShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
  left: (radius, amt) => ({
    borderTopLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    borderBottomLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerTopLeftShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
    cornerBottomLeftShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
  start: (radius, amt) => ({
    borderStartStartRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    borderEndStartRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerStartStartShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
    cornerEndStartShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
  end: (radius, amt) => ({
    borderStartEndRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    borderEndEndRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerStartEndShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
    cornerEndEndShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
  topLeft: (radius, amt) => ({
    borderTopLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerTopLeftShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
  topRight: (radius, amt) => ({
    borderTopRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerTopRightShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
  bottomRight: (radius, amt) => ({
    borderBottomRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerBottomRightShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
  bottomLeft: (radius, amt) => ({
    borderBottomLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerBottomLeftShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
  startStart: (radius, amt) => ({
    borderStartStartRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerStartStartShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
  startEnd: (radius, amt) => ({
    borderStartEndRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerStartEndShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
  endStart: (radius, amt) => ({
    borderEndStartRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerEndStartShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
  endEnd: (radius, amt) => ({
    borderEndEndRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? 2}))))`,
    },
    cornerEndEndShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? 2})`,
    },
  }),
});
export { squircle };
````

<!-- END:dist/stylex/index.mjs -->

</details>

## Prior art & credits

- **CSS Backgrounds 4** — the [`corner-shape` spec](https://drafts.csswg.org/css-backgrounds-4/#corner-shape-value) defines the `superellipse()` family of corner curves and their maths.
- **MDN** — the [`superellipse()` reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/superellipse) has the clearest plain-language walkthrough of what K values produce.
- **Tailwind CSS v4** — the `@utility` / `--value()` API this package is built on.

## License

MIT
