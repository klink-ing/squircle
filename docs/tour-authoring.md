# Guided tour authoring · GSAP with React

The `/tour` page is responsive HTML/CSS driven by one native GSAP timeline. It uses `gsap@3.15.0` and the official `@gsap/react@2.1.2` integration. There are eight reading stops: rounded corner, superellipse, vertical radius, diagonal radius comparison, strength exploration, correction, alignment, and utility usage. Existing slide copy is preserved; the inserted comparison slide uses placeholder copy. This branch has no Remotion runtime, Player, Studio, video configuration, or interpolation imports.

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

`website/src/components/tour/timeline.ts` contains the native choreography. `CHECKPOINTS` lists entrance times and settled reading times in **seconds**. `createTourTimeline` adds a label for each reading stop (`strength`, `correction`, etc.) and an entrance label (`strength:enter`, etc.). Numeric geometry tracks and DOM entrances share that timeline. Reading stops are at 0.8, 2, 3.2, 4.9, 5.9, 7.1, 8.1, and 9.1 seconds.

Edit copy and interleaved controls in `TourNarrative.tsx`. Each section remains mounted with a stable identity; only the current section participates in layout. React applies `hidden` and `inert` to outgoing sections. GSAP owns each section's opacity and transform; React never writes those properties. Entrances take 0.4 seconds. There is no outgoing crossfade or fixed-height stage: the next paragraph reflows normally. Keep each reading label after its narrative entrance and geometry tweens finish.

For retiming, change the cue's `start`/`time` and any numeric tween duration together. Geometry tweens use entrance labels rather than duplicated absolute starts. Strength/correction checkpoints and the final duration are resolved by ID/the last reading stop. Extending the beat list also requires updating narrative content and behavioral tests. This is intentionally small, tour-specific choreography.

`tour.css` uses a single column below 768px and a fluid two-column grid above it. Narrative font sizes are 17.6–22px; headings are 28.8–44px; navigation and slider controls have 48px minimum heights. SVG `viewBox` coordinates describe the existing mathematical illustration, not a composition viewport. Page scrolling is normal. There is no resize measurement or layout-dependent timeline rebuild.

Slide 3 begins with a full closed magenta outline, a 20%-opacity magenta fill, a vertical dotted measurement (dots one-third the endpoint-marker diameter), and a magenta endpoint/1.00. The outline, fill, dot, and text all use `--color-squircle-border`; the underlying blue shape is hidden throughout the comparison. Next advances to the inserted comparison slide. Its native `radiusSweep` track rotates the measurement to 45 degrees over one second. The magenta marker follows the superellipse, while a blue marker follows the circle at one CSS radius and draws a blue arc from the top tangent only as far as its current position. Both numbers stay 1.00 as specified. The blue arc, marker, and number are not mounted until the sweep has begun, and are painted underneath their magenta counterparts. After the sweep, `radiusLabels` dissolves in the two-line `CSS` / `radius` caption below the blue number and `Visual` / `“radius”` above the magenta number. The shared `radiusComparison` track fades the whole illustration in/out. Back and arbitrary seeking restore all three tracks, including the absence of blue before the sweep.

## Geometry and controls

GSAP owns a plain numeric proxy: `baseAmount`, `choiceWeight`, `correction`, `roundedOpacity`, `radiusComparison`, `radiusSweep`, and `radiusLabels`. Its `onUpdate` publishes an immutable snapshot through `graphicFromTracks`. React alone renders the existing SVG paths from that snapshot using `website/src/math.ts`. There are no competing SVG attribute writes, previous-frame replay, generic animation engine, or React render loops while paused.

The remembered strength is React state plus a ref for synchronous publishing. At the settled strength label, the native range input (1–3, step 0.1, initial 2) updates the diagram immediately without remounting the input, changing the playhead, or rebuilding the timeline. Reset sets the remembered value to 2. Memory lasts for this mounted tour session, including Back and Explore return; it does not persist across page reloads.

The graphic's amount is `baseAmount + (chosenAmount - 2) * choiceWeight`. The strength entrance raises the weight to 1. Correction animates it to 0 while the correction track rises to 1, so the diagram smoothly returns from the user's choice to canonical strength 2. Direct seeking or Back restores the same numeric result, including the chosen strength. Measurement endpoints and color follow the correction continuously.

`playback.ts` contains the explicit interaction policy. Next uses native `timeline.tweenTo(label)` and stops exactly at that label. A synchronous moving guard ignores repeated activation until settlement. Back kills the playhead tween and seeks the previous label, even mid-transition. Reduced motion seeks immediately; a live preference change during playback kills the driver and settles its destination. Settling requests heading focus after React commits. Slider changes never request focus.

`GuidedExplorer.tsx` creates the timeline once in scoped `useGSAP`; event-driven tweens are created through `contextSafe`. Cleanup reverts the context and kills any active playhead driver. Explore hides/inerts the paused tour, uses separate graphic state, and focuses its heading. Return preserves the final checkpoint and tour choices and restores tour heading focus. Explore's range row wraps; the formula/table can scroll inside its own container on narrow screens.

## Development transport

Open **Author transport · GSAP** below the tour on the development server. It has a labeled seconds scrubber, reading-stop select, and Pause / Play to checkpoint button. Arbitrary seeks are deterministic and keep input focus. Play finishes the selected reading stop. After a scrub, Next first settles the current scene before advancing. The strength input is enabled only at its exact settled label.

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
