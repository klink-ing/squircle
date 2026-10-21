# Guided tour authoring · GSAP with React

The `/tour` page is responsive HTML/CSS driven by one native GSAP timeline. It uses `gsap@3.15.0` and the official `@gsap/react@2.1.2` integration. There are eight reading stops: rounded corner, superellipse, vertical radius, diagonal radius comparison with strength exploration, apparent radius, correction, alignment, and utility usage. The original strength copy and controls accompany the diagonal comparison; there is no separate strength visual or reading stop. This branch has no Remotion runtime, Player, Studio, video configuration, or interpolation imports.

## Run

From the repository root, with Node 24.14.1 and pnpm 10.33.0:

```sh
pnpm install --frozen-lockfile
pnpm exec vp run website#dev
```

The task builds the local Tailwind package and serves http://localhost:4321/tour. If the workspace task runner is unavailable, use the same binaries directly, in order:

```sh
pnpm --filter @klinking/squircle exec tsx scripts/build.ts
pnpm --filter website exec astro dev --host 0.0.0.0 --port 4321
```

For a production preview:

```sh
pnpm exec vp run website#build
pnpm --filter website preview --host 0.0.0.0 --port 4432
```

The production tour is http://localhost:4432/tour. The development transport is available only on the development server.

## Edit and retime

`website/src/components/tour/timeline.ts` contains the native choreography. `CHECKPOINTS` lists entrance times and settled reading times in **seconds**. `createTourTimeline` adds a label for each reading stop (`visual-radius`, `correction`, etc.) and an entrance label (`visual-radius:enter`, etc.). Numeric geometry tracks and DOM entrances share that timeline. Reading stops are at 0.8, 2, 3.2, 4.9, 6.1, 7.3, 8.3, and 9.3 seconds.

Edit copy and interleaved controls in `TourNarrative.tsx`. Each section remains mounted with a stable identity; only the current section participates in layout. React applies `hidden` and `inert` to outgoing sections. GSAP owns each section's opacity and transform; React never writes those properties. Entrances take 0.4 seconds. There is no outgoing crossfade or fixed-height stage: the next paragraph reflows normally. Keep each reading label after its narrative entrance and geometry tweens finish.

For retiming, change the cue's `start`/`time` and any numeric tween duration together. Geometry tweens use entrance labels rather than duplicated absolute starts. The strength interaction shares the comparison checkpoint; correction and the final duration are resolved by ID/the last reading stop. Extending the beat list also requires updating narrative content and behavioral tests. This is intentionally small, tour-specific choreography.

`tour.css` uses a single column below 768px and a fluid two-column grid above it. Narrative font sizes are 17.6–22px; headings are 28.8–44px; navigation and slider controls have 48px minimum heights. SVG `viewBox` coordinates describe the existing mathematical illustration, not a composition viewport. The graphic width and viewBox stay fixed across reading stops, reserving room for radius labels from the start. Page scrolling is normal. There is no resize measurement or layout-dependent timeline rebuild.

The slide 2→3 transition keeps the same mounted SVG and closed superellipse path, with unchanged geometry and fill color. Only its fill opacity fades from 1 to 0.2 while its solid outline opacity rises from 0 to 1. The closed fill reaches the left and bottom boundaries, but only the top/right boundary is stroked, implying that the shape continues beyond the viewport. When tangent points pass the box boundaries at larger radii, the outline continues outward rather than doubling back to the original corners; the fill closes outside the box and its stroke gap covers that full closure. Slide 3 adds a vertical dotted measurement (dots one-third the endpoint-marker diameter) and a fixed magenta top endpoint labeled 1.00 / CSS Radius. That dot, number, and label stay at the initial tangent throughout both comparisons; a separate magenta marker and live readout follow the sweep. The outline, dot, and text use `--color-squircle-border`; the underlying blue shape is hidden throughout the comparison. Next advances to the inserted comparison slide. Its native `radiusSweep` track rotates the measurement to 45 degrees over one second. The magenta marker follows the superellipse, while a blue marker follows the circle at one CSS radius and draws a blue arc from the top tangent only as far as its current position. The blue CSS radius stays 1.00. The magenta visual radius updates from the actual center-to-marker distance at each animation frame, normalized to the CSS radius and rounded to two decimals (1.00 vertically, approximately 1.19 at 45 degrees for strength 2). Numeric readouts throughout the tour, SVG, transport, and Explore controls use tabular figures. The blue arc, marker, and number are not mounted until the sweep has begun, and are painted underneath their magenta counterparts. After the sweep, `radiusLabels` dissolves in the two-line `CSS` / `radius` caption below the blue number and `???` above the moving magenta number. The shared `radiusComparison` track fades the annotations and persistent shape outline in/out while dimming/restoring the shape fill. Back and arbitrary seeking restore all three tracks, including the absence of blue before the sweep.

Slide 5 adds the apparent-radius construction from the reference sketch. The magenta path, scale, and chosen strength stay fixed. Over one second, `apparentRadius` shrinks and shifts the same blue arc to a circle sharing the top/right edges and meeting the superellipse at 45 degrees. Its radius is the inverse correction, `r / correctedRadius(1, n)`, approximately 0.54 CSS radii at strength 2; this is a matching circular corner, not the local curvature radius. The original top endpoint and CSS Radius 1.00 stay fixed while the center appears below them. The swept magenta endpoint stays at 45 degrees; its live number and `???` caption fade out in place rather than sweeping back. The blue center, top endpoint, and vertical/diagonal dotted radii appear, with an Apparent Radius readout updating during the shrink. The prior diagonal remains as a faint guide. Coincident blue/magenta markers use a hard 50% split fill: blue on the left hemisphere and magenta on the right. The same rule covers endpoints, top tangents, and centers (including their extra overlaps at strength 1); separate markers retain their original colors. The new narrative uses placeholder copy; all prior narrative is preserved. Back restores the previous comparison and remembered strength exactly.

Slide 6 keeps the comparison visible as the correction track grows the CSS radius at the chosen strength. The strength slider and Reset remain live on this slide, keeping apparent radius 1.00 while recomputing the required CSS radius. The blue apparent radius grows to 1.00; the magenta CSS value updates from 1.00 to the required correction (approximately 1.84 at strength 2). Dots and dotted radii use the same corrected radius as the superellipse. The SVG size, viewBox, and box clipping rectangle stay fixed; SVG overflow lets construction markers extend outside the viewport while the filled shape remains inside the original box. Each CSS readout line stays centered until its left edge hits the SVG boundary, then stops there, becoming left-aligned. CSS `transform-box: fill-box` and `max()` use the actual rendered text width, without a resize observer or DOM measurements. Back restores the chosen strength and the exact preceding drawing. The comparison fades out on slide 7 instead of slide 6.

## Geometry and controls

GSAP owns a plain numeric proxy: `baseAmount`, `choiceWeight`, `correction`, `roundedOpacity`, `radiusComparison`, `radiusSweep`, `radiusLabels`, and `apparentRadius`. Its `onUpdate` publishes an immutable snapshot through `graphicFromTracks`. React alone renders the existing SVG paths from that snapshot using `website/src/math.ts`. There are no competing SVG attribute writes, previous-frame replay, generic animation engine, or React render loops while paused.

The remembered strength is React state plus a ref for synchronous publishing. At the settled `visual-radius`, `apparent-radius`, and `correction` labels, the shared strength control’s native range input (1–3, step 0.1, initial 2) updates the diagram immediately without remounting the input, changing the playhead, or rebuilding the timeline. Reset sets the remembered value to 2. Memory lasts for this mounted tour session, including Back and Explore return; it does not persist across page reloads.

The graphic's amount is `baseAmount + (chosenAmount - 2) * choiceWeight`. As the comparison labels dissolve in, the choice weight rises to 1, restoring the remembered strength by the comparison reading stop. Correction keeps the choice weight at 1 while the correction track rises to 1, so the chosen strength remains live on slide 6. The following alignment transition animates the choice weight to 0, returning to canonical strength 2 after the interactive stops. Direct seeking or Back restores the same numeric result, including the chosen strength. Measurement endpoints and color follow the correction continuously.

`playback.ts` contains the explicit interaction policy. Next uses native `timeline.tweenTo(label)` and stops exactly at that label. A synchronous moving guard ignores repeated activation until settlement. Back kills the playhead tween and seeks the previous label, even mid-transition. Reduced motion seeks immediately; a live preference change during playback kills the driver and settles its destination. Settling requests heading focus after React commits. Slider changes never request focus.

`GuidedExplorer.tsx` creates the timeline once in scoped `useGSAP`; event-driven tweens are created through `contextSafe`. Cleanup reverts the context and kills any active playhead driver. Explore hides/inerts the paused tour, uses separate graphic state, and focuses its heading. Return preserves the final checkpoint and tour choices and restores tour heading focus. Explore's range row wraps; the formula/table can scroll inside its own container on narrow screens.

## Development transport

Open **Author transport · GSAP** below the tour on the development server. It has a labeled seconds scrubber, reading-stop select, and Pause / Play to checkpoint button. Arbitrary seeks are deterministic and keep input focus. Play finishes the selected reading stop. After a scrub, Next first settles the current scene before advancing. The strength inputs are enabled only at their exact settled comparison, apparent-radius, or correction labels. Both use the same remembered value and Reset handler, with distinct IDs for their labels; inactive inputs are disabled.

This is a small development preview transport, not a visual animation editor. It has no timeline editing, keyframe authoring, source rewriting, recording, or export. The `import.meta.env.DEV` block is removed from the production bundle. There is no separate Studio application or Studio server on this branch.

## API and license references

Verified against the installed GSAP timeline implementation and React integration, plus the official [React/useGSAP documentation](https://gsap.com/resources/React/), [tweenTo documentation](<https://gsap.com/docs/v3/GSAP/Timeline/tweenTo()/>), and [seek documentation](<https://gsap.com/docs/v3/GSAP/Timeline/seek()/>). `seek` suppresses callbacks by default, so direct navigation explicitly publishes the proxy after seeking. Native `tweenTo` returns a killable playhead tween and leaves the shared timeline paused at completion.

GSAP uses Webflow's [Standard “No Charge” License](https://gsap.com/community/standard-license/), not MIT. The current terms permit website/web application use, including commercial use, and restrict competing visual animation builders. This implementation provides a code-authored website tour and preview transport. The installed package points to those terms; the page reviewed lists an effective date of April 30, 2025 and modification date of May 30, 2025. No paid editor, plugin, or account is needed here.

## Current-site integration

`feat/tour-gsap-ready` ports the tour onto current `alpha`. `pnpm exec vp run ready` passes: root lint and formatting, package TypeScript and its 567 tests, the tour tests, the tour TypeScript check, and the 12-page production build. `website#typecheck` intentionally uses `tsconfig.tour.json` to check the complete tour and its imports. A separate full-site `tsc --noEmit` still reports existing errors in `PillAlgorithmsDemo.tsx` (experimental Paint API typing) and `StyleXDemo.tsx` (StyleX call signatures); those unrelated demos are not changed here.

## Original comparison verification, 2026-10-20

The measurements below apply to evaluated commit `7460ec01d2c106a1d5168d07e7e61e79884ced11`, preserved on `feat/tour-gsap`. The ready PR ports the same tour source onto the current `alpha` site, retaining its Tailwind, StyleX, Panda, pill demos, and package build. Its site-wide checks and bundle sizes must be measured separately; the old generated-Panda lint and utility CSS failures below describe the comparison baseline.

```sh
pnpm --filter website exec vp test run
pnpm --filter website exec tsc --noEmit
pnpm exec vp lint website/src website/scripts/tour-bundle-sizes.mjs website/vite.config.ts
pnpm exec vp fmt --check website/src/components/GuidedExplorer.tsx website/src/components/tour website/src/components/ExplorerGraphic.tsx website/src/env.d.ts website/vite.config.ts website/tsconfig.json website/package.json website/scripts/tour-bundle-sizes.mjs pnpm-workspace.yaml docs/tour-authoring.md
pnpm exec vp run website#build
node website/scripts/tour-bundle-sizes.mjs
```

- Website tests: **7 passed**. They run the real GSAP timeline and playhead tweens: arbitrary/reverse seeks; remembered strength/reset bridge and correction midpoint; rapid Next and interrupted Back; live reduced motion; scrub focus policy/current-stop semantics; pause/resume/disposal; finite continuous geometry throughout the timeline for strengths 1, 2, and 3.
- Website TypeScript: **passed**, no diagnostics. Scoped lint: **passed**, zero warnings/errors. Scoped formatting: **passed**. Production build: **passed**, four static routes. Both direct Astro build and workspace `website#build` succeeded. No `picomatch` task-runner resolution error was observed in this checkout.
- Real T3 browser tab, Chromium **154.0.0.0**, independent server: all seven stops at **320, 390, 768, 960, 1280px** widths; no page horizontal overflow or clipped narrative; no narrative/navigation overlap; 48px navigation targets; inactive sections hidden/inert; selectable text. Body text measured 17.6px at 320/390, 18.432px at 768, 22px at 960/1280.
- At every width: remembered 2.7 strength updated SVG immediately and kept input focus; Explore changed its own amount to -1.2; return restored final checkpoint/heading, and seeking Back to strength restored 2.7. Keyboard ArrowLeft changed 3 to 2.9 with focus and time 4.2 preserved; Tab from the returned strength heading reached Reset.
- Rapid repeated Next traversed exactly 2.0 / 3.2 / 4.2 / 5.4 / 6.4 / 7.4 seconds. At correction time 4.5, a remembered 2.7 had interpolated to 2.6385344; Back interrupted and restored 2.7 at 4.2. Completion reached strength 2/correction 1. Reset restored 2.
- Resizing 1280→390 while paused retained slider focus, strength 2.9 and time 4.2; resizing 390→960 during correction settled at 5.4, and Back restored 2.9.
- Three real React StrictMode mount/unmount cycles through the installed Astro renderer each left **one shared GSAP timeline after mounting, zero GSAP children after unmount during playback**. Initial and live reduced-motion changes passed using a controlled `matchMedia` object/change events in the real browser. Native OS preference toggling was not available through the preview API; it was not claimed as tested.
- Production preview: all seven stops and Explore/return passed; final heading focus restored; author transport absent. No application console errors were observed. Astro/Vite logged existing plugin deprecation and invalid `jsx` option warnings.

Baseline failures are separate from the tour checks. Before implementation, root `pnpm exec vp lint` failed on three generated Panda files: `website/styled-system/css/cx.mjs` (unused expression), `patterns/float.mjs` (unused `offset`), and `jsx/create-style-context.mjs` (unused `css`). The initial root `vp run ready` stopped on these lint errors and canceled other tasks (exit 137); direct baseline website TypeScript and its four original tests passed. Package tests before building had 61 failures due to missing generated CSS. After the unchanged package build/generator, `pnpm --filter @klinking/squircle exec vp test run` reports **60 failed / 68 passed**, including 15 CSS snapshot failures (empty radius utility output). Package code and snapshots were not changed to conceal these results.

Only Chromium was exercised; Safari, Firefox, native mobile browsers, assistive-technology announcements, and native OS reduced-motion toggling remain unverified. Copy may make the page taller between scenes because it uses natural document flow. This is expected; there is no fixed composition crop.

## Production bundle accounting

Run `node website/scripts/tour-bundle-sizes.mjs` after a production build. It measures exact file bytes and gzip **level 9 per file**, then sums compressed files; this differs slightly from Vite's default gzip report. The tour chunk includes GSAP, `@gsap/react`, application coordination, math, SVG renderer, and Explore. Shared React/ReactDOM/JSX/runtime helpers are accounted separately. Unrelated `DemoEmbed` is excluded. HTML includes Astro's inline hydration bootstrap. CSS is the shared site stylesheet, not an engine-only delta.

Measured from the final build:

- Tour + GSAP (`GuidedExplorer.SIkoGSUY.js`): **87,058 raw / 32,746 gzip bytes**.
- Shared React (`client`, `react`, `jsx-runtime`, `chunk`): **192,021 raw / 60,431 gzip bytes**.
- Route external JS total: **279,079 raw / 93,177 gzip bytes**.
- Site CSS: **29,270 raw / 5,769 gzip bytes**.
- Tour HTML: **7,823 raw / 3,198 gzip bytes**.

Hashed filenames and HTML gzip may change when source is edited. No Remotion package remains in the workspace dependency graph or source imports. The pnpm lockfile is authoritative.
