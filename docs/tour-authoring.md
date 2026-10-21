# Guided tour authoring · GSAP with React

The `/tour` page is responsive HTML/CSS driven by a native GSAP parent timeline containing one nested timeline per slide. It uses `gsap@3.15.0` and the official `@gsap/react@2.1.2` integration. There are eight reading stops: rounded corner, superellipse, vertical radius, diagonal radius comparison with strength exploration, apparent radius, correction, alignment, and utility usage. The original strength copy and controls accompany the diagonal comparison; there is no separate strength visual or reading stop. This branch has no Remotion runtime, Player, Studio, video configuration, or interpolation imports.

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

Edit **`website/src/components/tour/slides.tsx`**. Each ordered block owns a complete slide: `heading`, `content` (including interleaved React controls), `nextLabel`, `transition`, and `hold`. The transition is the entrance **into that slide**, and its GSAP positions always start at **local time 0**. Text entrance timing is inside that same transition, beside the graphic tweens:

```tsx
transition(timeline, { tracks, text, previousText }) {
  exitText(timeline, previousText, { at: 0, duration: 0.18 });
  enterText(timeline, text, { at: ">", duration: 0.7 });
  timeline.to(tracks, { radiusSweep: 1, duration: 1, ease: "power2.inOut" }, 0);
  timeline.addLabel("labels", ">");
  timeline.to(tracks, { radiusLabels: 1, duration: 0.45, ease: "none" }, "labels");
  timeline.to(tracks, { choiceWeight: 1, duration: 0.45, ease: "power2.inOut" }, "labels");
},
```

These are ordinary nested GSAP timelines. Use numeric seconds, local labels, `"<"`, `">"`, or GSAP relative positions. In this example, the labels fade in after the sweep finishes; changing the sweep duration also moves that local label. Change the copy and entrance timing in this block together. `text` targets the slide’s heading and copy paragraphs; GSAP owns their opacity and transform. Strength controllers are excluded, so they take their new layout position immediately without fading or sliding in. The exit fades and shifts the old copy 48px left over 0.18 seconds with `power1.in`. The entrance follows it using native `">"` timing, fading in over 0.7 seconds with a 64px shift from the right and `power3.out` easing. Each slide explicitly supplies both timings. The shared travel distances are `TEXT_ENTER_DISTANCE` and `TEXT_EXIT_DISTANCE` at the top of `slides.tsx`. The text column clips horizontal travel to prevent page overflow on narrow screens, with an 8px clip margin for focus outlines. `enterText` also registers the local `text:enter` label; the parent derives the narrative switch from it, keeping the old section visible until its exit finishes. Changing the exit duration therefore moves the entrance and narrative switch together. `tracks` is the shared numeric geometry proxy.

`hold` adds a short breathing interval **after the last animation** before the tour pauses for the reader; it is not a fixed slide duration. `timeline.ts` builds and nests each slide's timeline, then derives its entrance label, settled reading label, and navigation checkpoint from the actual child duration. Longer text or geometry animations automatically move every later slide. There is no authored absolute schedule or separate checkpoint list to maintain. A 0.02-second boundary gap keeps exact checkpoint seeks on the settled slide. Add/reorder slide blocks in `SLIDES`; narrative, navigation, and the author transport follow that order. The behavior tests protect the existing geometry and interaction expectations.

`TourNarrative.tsx` renders these blocks with stable section identities. Only the current section participates in layout; outgoing sections are `hidden` and `inert`. Copy remains selectable, responsive React HTML. Outgoing copy remains in normal flow during its exit, then the incoming section takes its place as its entrance begins. There is no fixed-height stage. Strength controllers switch position with the section and never participate in either text animation. Slides with a strength controller also declare `strength: true`, enabling their input at the settled reading stop. Geometry, remembered strength, and keyboard/focus behavior are unchanged by this authoring structure.

`tour.css` uses a single column below 768px and a fluid two-column grid above it. Narrative font sizes are 17.6–22px; headings are 28.8–44px; navigation and slider controls have 48px minimum heights. SVG `viewBox` coordinates describe the existing mathematical illustration, not a composition viewport. The graphic width and viewBox stay fixed across reading stops, reserving room for radius labels from the start. Its container aligns to the start of its column; the SVG anchors its contents to the left and bottom, so the DOM box meets those shape edges and lines up with surrounding text even when the graphic reaches its maximum width. The box stays 180 × 180 SVG units; a normalized 1.00 radius spans 90 units (half the box side), using tour zoom 0.5. Readouts normalize against those 90 units, so the smaller displayed radius still reads 1.00. Page scrolling is normal. There is no resize measurement or layout-dependent timeline rebuild.

The slide 2→3 transition keeps the same mounted SVG and closed superellipse path, with unchanged geometry and fill color. Only its fill opacity fades from 1 to 0.2 while its solid outline opacity rises from 0 to 1. The closed fill reaches the left and bottom boundaries, but only the top/right boundary is stroked, implying that the shape continues beyond the viewport. When tangent points pass the box boundaries at larger radii, the outline continues outward rather than doubling back to the original corners; the fill closes outside the box and its stroke gap covers that full closure. Slide 3 adds a vertical dotted measurement (dots one-third the endpoint-marker diameter) and a fixed magenta top endpoint labeled 1.00 / CSS Radius. That dot, number, and label stay at the initial tangent throughout both comparisons; a separate magenta marker and live readout follow the sweep. The outline, dot, and text use `--color-squircle-border`; the underlying blue shape is hidden throughout the comparison. Next advances to the inserted comparison slide. Its native `radiusSweep` track rotates the measurement to 45 degrees over one second. The magenta marker follows the superellipse, while a blue marker follows the circle at one CSS radius and draws a blue arc from the top tangent only as far as its current position. The blue CSS radius stays 1.00. Its number and two-line caption sit below the blue dot, to the right of the dotted diagonal and inside the magenta outline, including at strength 1. All label/number stacks share 12-unit baseline spacing, with no additional gap between captions and values. The magenta visual radius updates from the actual center-to-marker distance at each animation frame, normalized to the CSS radius and rounded to two decimals (1.00 vertically, approximately 1.19 at 45 degrees for strength 2.0). Numeric readouts throughout the tour, SVG, transport, and Explore controls use tabular figures. The blue arc, marker, and number are not mounted until the sweep has begun, and are painted underneath their magenta counterparts. After the sweep, `radiusLabels` dissolves in the two-line `CSS` / `radius` caption below the blue number and `???` above the moving magenta number. The shared `radiusComparison` track fades the annotations and persistent shape outline in/out while dimming/restoring the shape fill. Back and arbitrary seeking restore all three tracks, including the absence of blue before the sweep.

Slide 5 adds the apparent-radius construction from the reference sketch. The magenta path, scale, and chosen strength stay fixed. Over one second, `apparentRadius` shrinks and shifts the same blue arc to a circle sharing the top/right edges and meeting the superellipse at 45 degrees. Its radius is the inverse correction, `r / correctedRadius(1, n)`, approximately 0.54 CSS radii at strength 2.0; this is a matching circular corner, not the local curvature radius. The original top endpoint and CSS Radius 1.00 stay fixed while the center appears below them. The swept magenta endpoint stays at 45 degrees; its live number and `???` caption fade out in place rather than sweeping back. The blue center, top endpoint, and vertical/diagonal dotted radii appear, with an Apparent Radius readout updating during the shrink. The prior diagonal remains as a faint guide. Every blue marker has two permanent paint layers: a full blue circle below all magenta markers, and its clipped left hemisphere above them. All marker layers remain above the drawing. As endpoints, top tangents, or centers slide together, overlap naturally shows blue on the left and magenta on the right; separated markers remain solid. There is no coincidence detection or overlap-triggered visibility or fill change. The new narrative uses placeholder copy; all prior narrative is preserved. Back restores the previous comparison and remembered strength exactly.

Slide 6 uses a collision handoff. `apparentCorrection` accelerates the blue dot into the stationary magenta dot with `power2.in` over 0.6 seconds. The local `impact` label marks contact: blue reaches apparent radius 1.00 and stops abruptly. At exactly that label, the CSS `correction` tween starts with `power2.out`, immediately carrying magenta onward and easing to rest. There is no overlap or pause. Magenta travels `correctedRadius(1, 2 ** DEFAULT_STRENGTH)` times farther than blue, so its duration is that ratio times the approach duration. The complementary cubic eases therefore match their actual screen velocities at contact, using the default strength restored by Next. Both phases and the approach duration are authored together in slide 6; changing the default recomputes the handoff automatically. The strength slider and Reset remain live on this slide, keeping apparent radius 1.00 while recomputing the required CSS radius. During the blue-only lead, the magenta path, CSS dot, and CSS value stay fixed at 1.00. The delayed magenta CSS value then updates from 1.00 to the required correction (approximately 1.84 at strength 2.0). Dots and dotted radii use the same corrected radius as the superellipse. The SVG size, viewBox, and box clipping rectangle stay fixed; The SVG crops all content at the shape’s left and bottom edges, including overflowing construction markers and dotted lines. Space above and to the right stays open for labels; neither the box nor the viewBox is resized. During CSS correction, the CSS Radius label and number share one left-aligned anchor, initially positioning the number above the dot, and transition together to an anchor at the shape’s left edge. Both finish at exactly the same x coordinate, independent of their text widths; each line remains clamped inside the shape while moving. A shared SVG anchor and CSS `max()` clamp the whole stack without a resize observer or DOM measurements. Back restores the preceding drawing at the current strength, including any return to the default completed by Next. The corrected blue/magenta comparison persists unchanged through slides 7 and 8; those slides animate only their narrative. There is no final switch to the orange filled diagram or its legacy diagonal measurement. Explore initializes its independent curve controls and measurements separately.

## Default strength

Change only `DEFAULT_STRENGTH` in `website/src/components/tour/state.ts` (supported range 1–3). It drives the initial tour shape, all three strength controls and Reset buttons, the timeline’s return value, and numeric copy. Reload an already-open tour to start a fresh session with the new default. Tests derive their default-dependent expectations from that same constant; the numeric examples in this guide use strength 2.0 independently of the configured default.

## Geometry and controls

GSAP owns a plain numeric proxy: `baseAmount`, `choiceWeight`, `correction`, `apparentCorrection`, `roundedOpacity`, `radiusComparison`, `radiusSweep`, `radiusLabels`, and `apparentRadius`. Its `onUpdate` publishes an immutable snapshot through `graphicFromTracks`. React alone renders the existing SVG paths from that snapshot using `website/src/math.ts`. There are no competing SVG attribute writes, previous-frame replay, generic animation engine, or React render loops while paused.

The remembered strength is React state plus a ref for synchronous publishing. At the settled `visual-radius`, `apparent-radius`, and `correction` labels, the shared strength control’s native range input (1–3, step 0.1, initial `DEFAULT_STRENGTH`) updates the diagram immediately without remounting the input, changing the playhead, or rebuilding the timeline. Reset sets the remembered value to `DEFAULT_STRENGTH`. Each Next activation first eases the live input back to that same default (currently 2.0), then starts the slide transition. `DEFAULT_STRENGTH` in `state.ts` is shared by the timeline, state bridge, controls, and numeric copy. The current input lasts for this mounted session until changed by the slider, Reset, or Next; it does not persist across page reloads.

The graphic's amount is `baseAmount + (chosenAmount - DEFAULT_STRENGTH) * choiceWeight`. As the comparison labels dissolve in, the choice weight rises to 1, restoring the remembered strength by the comparison reading stop. Correction keeps the choice weight at 1 while the correction track rises to 1, so the chosen strength remains live on slide 6. The alignment and utilities slides retain the same geometry tracks and choice weight. Next still returns the live input to `DEFAULT_STRENGTH` before advancing, as it does on every slide. Direct seeking or Back restores the same numeric result, including the chosen strength. Measurement endpoints and color follow the correction continuously.

`playback.ts` contains the explicit interaction policy. Before advancing, Next holds the slide playhead still and uses a native `gsap.to` with `power2.out` easing to return strength to `DEFAULT_STRENGTH`. Duration is `abs(current - DEFAULT_STRENGTH) / STRENGTH_RETURN_SPEED`; the speed is 4 strength units per second, so distance 1 takes 0.25 seconds and distance 0 takes no time or extra tween. Only after the return does native `timeline.tweenTo(label)` advance to the next reading stop. A synchronous moving guard ignores repeated activation until settlement. Back kills either active tween and any pending advance, then seeks the previous label, even mid-transition. Scrubbing, jumping to a checkpoint, and unmounting also cancel the return. Pause/resume continues from the remaining strength distance. Reduced motion resets strength and seeks immediately; a live preference change during either phase cancels animation and settles its destination. Settling requests heading focus after React commits. Slider changes never request focus.

`GuidedExplorer.tsx` creates the timeline once in scoped `useGSAP`; event-driven tweens are created through `contextSafe`. Cleanup reverts the context and kills any active playhead driver. Explore hides/inerts the paused tour, uses separate graphic state, and focuses its heading. Return preserves the final checkpoint and tour choices and restores tour heading focus. Explore's range row wraps; the formula/table can scroll inside its own container on narrow screens.

## Development transport

Open **Author transport · GSAP** below the tour on the development server. It has a labeled **slide-local** seconds scrubber, reading-stop select, and Pause / Play to checkpoint button. Select a reading stop, then scrub its entrance from 0 seconds to the end of its nested timeline, including its hold. The displayed time restarts at 0 for each slide. The scrubber’s last 0.01-second step snaps to the exact reading stop, including geometry-derived durations that fall between steps. Arbitrary seeks are deterministic and keep input focus. Play finishes the selected reading stop. After a scrub, Next first settles the current scene before advancing. The strength inputs are enabled only at their exact settled comparison, apparent-radius, or correction labels. Both use the same remembered value and Reset handler, with distinct IDs for their labels; inactive inputs are disabled.

This is a small development preview transport, not a visual animation editor. It has no timeline editing, keyframe authoring, source rewriting, recording, or export. The `import.meta.env.DEV` block is removed from the production bundle. There is no separate Studio application or Studio server on this branch.

## API and license references

Verified against the installed GSAP timeline implementation and React integration, plus the official [React/useGSAP documentation](https://gsap.com/resources/React/), [tweenTo documentation](<https://gsap.com/docs/v3/GSAP/Timeline/tweenTo()/>), and [seek documentation](<https://gsap.com/docs/v3/GSAP/Timeline/seek()/>). `seek` suppresses callbacks by default, so direct navigation explicitly publishes the proxy after seeking. Native `tweenTo` returns a killable playhead tween and leaves the shared timeline paused at completion.

GSAP uses Webflow's [Standard “No Charge” License](https://gsap.com/community/standard-license/), not MIT. The current terms permit website/web application use, including commercial use, and restrict competing visual animation builders. This implementation provides a code-authored website tour and preview transport. The installed package points to those terms; the page reviewed lists an effective date of April 30, 2025 and modification date of May 30, 2025. No paid editor, plugin, or account is needed here.

## Current-site integration

`feat/tour-gsap-ready` ports the tour onto current `alpha`. The initial port passed `pnpm exec vp run ready`: root lint and formatting, package TypeScript and its 567 tests, the tour tests, the tour TypeScript check, and the 12-page production build. `website#typecheck` intentionally uses `tsconfig.tour.json` to check the complete tour and its imports. A separate full-site `tsc --noEmit` still reports existing errors in `PillAlgorithmsDemo.tsx` (experimental Paint API typing) and `StyleXDemo.tsx` (StyleX call signatures); those unrelated demos are not changed here.

The current tour passes 36 tour tests, focused TypeScript, scoped lint/formatting, and the production build. Tests cover independent local timelines, automatically shifted reading stops after extending text or geometry, native context cleanup, sequential text exits/entrances, forward/reverse seeks at boundaries and intermediate frames, navigation, distance-based returns before Next, collision timing and SVG velocity continuity, reset interruption and reduced motion, strength input, and continuous geometry. Rendered narrative was compared against the pre-refactor markup, preserving the author's current copy. Chrome checks verified all eight slide-local scrubber endpoints, live strength, correction/Back restoration, separate Explore state, and all eight stops at 320px without page overflow.

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
