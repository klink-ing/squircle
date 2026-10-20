# Remotion guided tour analysis and implementation plan

Replace the current collection of short Remotion players with one persistent tour composition. Remotion will own the timeline, narrative text, graphic transitions, and placement of interactive controls. Sliders can appear between paragraphs or beside the diagram. A small React controller will own navigation and remembered user choices.

This plan covers the existing tour on `feat/guided-tour-slideshow`, starting at commit `0bed1455`. It includes repository analysis, architecture decisions, implementation stages, and acceptance checks. The sizing decision was revised after reviewing the RenderComp multi-format guide: use two fixed presets before considering continuous measurement. The implementation uses the revised approach below.

## Repository analysis

### Application and package boundaries

- `package/` publishes `@klinking/squircle`. Its Tailwind plugin, CSS generator, variants, and merge configuration are independent of the tour. `package/src/variants.ts` implements the CSS correction formula; `website/src/math.ts` implements the numeric geometry used by the website. Keep that boundary intact.
- `website/` is an Astro 5 application using React 19 and Tailwind 4. `website/src/pages/tour.astro` mounts `GuidedExplorer` with `client:only="react"`. The homepage is a separate placeholder. Shared navigation does not currently link to the tour.
- `website/src/styles/global.css` imports the built Tailwind plugin from `package/dist/tw-plugin.mjs`. The package must therefore build before a clean website build. Its typography, slider styles, and curve colors are reusable in the composition.
- `website/examples/react-basic/` is a separate example project embedded through StackBlitz. It is outside the pnpm workspace package list. Changes to the tour do not require changes to its source or dependencies.
- `website/src/components/MathExplorer.tsx`, `CodeGenerator.tsx`, and `SlideControls.tsx`, plus `website/src/demo.ts`, have no consumers in the current pages. They contain earlier exploration and presentation approaches. Do not migrate or delete them as part of this work.
- The committed Panda output in `website/styled-system/` and `website/src/styles/panda.css` is not imported by the tour. It is generated code, not the styling architecture to extend.

### Current tour behavior and limitations

`GuidedExplorer.tsx` owns a slide index, step index, revision counter, previous graphic state, target state, last displayed state, slider override, Explore state, mode, and portal destination. `computeGraphicState()` replays all preceding graphic patches to determine the current target. Every navigation increments the revision and remounts the Player with a short local timeline.

`Animate.tsx` still implements custom step visibility and navigation context. `slides.tsx` combines React content, step gates, animation helpers, buttons, local slider state, graphic patches, and transition durations. Remotion currently supplies interpolation and a clock, while these modules still own the slideshow model.

The current text is already rendered outside the Player visually, through a portal originating inside its React subtree. This preserves Remotion context but introduces a DOM destination into the composition and prevents it from being a self-contained scene.

Specific issues the migration should address:

1. There are seven reachable checkpoints across three slides. The superellipse slide also contains an `inStep={3}` block, but its step list ends at index 2. That reveal is unreachable and lacks a forward button.
2. Two superellipse headings include draft animation-debugging copy. They should become one intended heading during the content move.
3. The strength slider keeps its displayed value in local state while the graphic override lives in the parent. Navigation clears that override and remounts the slider. Returning does not restore a user's choice.
4. Text entrances restart on each step because the Player restarts at frame zero. Persistent headings cannot naturally retain their timeline position.
5. The rendered composition writes the displayed graphic into a mutable parent ref during render. Results depend on traversal history rather than just frame and explicit inputs.
6. Measurement selectors change immediately while numeric geometry interpolates. Some measurement changes can therefore snap rather than transition.
7. `ExplorerGraphic.tsx` is otherwise a useful frame-independent SVG renderer. It supports fractional visibility values, curve generation, radius correction, measurement geometry, and colors. Reuse it rather than creating another graphic implementation.
8. `FreeExplorer.tsx` is controlled by its graphic props, with a local editable numeric field. Reuse it for the handoff, and ensure its text field stays consistent when the supplied amount changes.
9. Several sliders have visually adjacent labels without explicit input associations. Moving controls should include accessible labels and keyboard checks.

### Tooling and validation baseline

The workspace uses pnpm 10.33.0 and Vite+ tasks. The declared Node minimum and `.node-version` are 24.14.1. CI and site deployment still specify Node 22, while the release workflow uses `.node-version`.

Baseline checks on October 20, before implementation:

- `pnpm --filter website exec astro build` passes, with existing Astro/Vite deprecation warnings. Its tour chunk is about 365 kB before gzip and 114 kB after gzip, separate from the shared React client.
- `pnpm --filter website exec tsc --noEmit` fails on missing `vite` and `@vitejs/plugin-react` imports in the separate example project's config.
- `pnpm exec vp lint` reports three errors in generated `website/styled-system/` files.
- `pnpm exec vp run ready` fails during package building because one installed Vite+ dependency path cannot resolve `picomatch`.
- Direct package tests report 68 passing and 60 failing. The plugin test file passes; named CSS radius utilities produce empty output in the CSS test file. The CSS generator currently uses `--value([--radius-*])`; diagnosis and repair of that package issue are separate from the slideshow migration.

There are no website tour tests or Remotion Studio entry points. New timeline tests must be wired into the website task configuration; merely adding test files would not make existing CI run them.

## Architecture decisions

### Put text and interleaved controls inside the composition

Use normal React headings, paragraphs, code, buttons, inputs, and SVG inside `TourComposition`. A sequence can contain a paragraph, a strength slider, and a second paragraph in ordinary DOM order. Controls can also appear beside the diagram. No portal or separate text-animation clock is needed.

Remotion supports ordinary pointer events and state callbacks through Player `inputProps`. This makes interleaved controls feasible without using canvas text or rendering the tour to a video. Keep the Player's default controls and click-to-play behavior disabled so text selection and inputs do not trigger playback. [Remotion interaction guidance](https://www.remotion.dev/docs/player/drag-and-drop)

Considered alternatives:

- **External text and controls:** normal page flow is easy, and Player `frameupdate` events can drive external text styles. However, external text would still need its own frame-to-content mapping and entrance/exit handling. It also cannot directly use `useCurrentFrame()` or native sequence lifetimes. This is viable if external DOM ownership later becomes a hard requirement, but adds coordination for the present goal. [Player events](https://www.remotion.dev/docs/player/player#frameupdate)
- **Text inside, controls outside:** keeps form management independent of the stage, but restricts the requested ability to interleave controls with narrative content. Keep this as an available placement option, not an architectural restriction.
- **The current portal:** retains hook access but preserves split layout ownership and a DOM-dependent composition input. Remove it.

The controller remains outside the composition as a state owner. Control placement does not determine where state must live. A slider inside a sequence receives a value and callback; the sequence may unmount without losing the choice.

### Use one timeline and named checkpoints

Keep a single stable Player instance, component identity, frame rate, and total duration. Define a small set of named scene ranges and settled checkpoint frames in `tour/timeline.ts`. Scenes use native `Sequence` components; animation uses sequence-local frames and Remotion interpolation or springs. Checkpoint definitions describe reading/interaction stops, not partial graphic mutations. [Sequence API](https://www.remotion.dev/docs/sequence)

Start with these seven narrative beats:

1. Rounded corner: introduce the existing radius.
2. Superellipse: animate the strength change and explain the apparent size difference.
3. Radius comparison: reveal the circle and measurement.
4. Strength exploration: pause for the slider, initially at 2 with a range of 1 to 3 and increments of 0.1.
5. Correction: animate into the corrected radius and measurement.
6. Alignment: explain the matched visual size.
7. Utilities: explain automatic correction and offer Explore.

Use 60 fps, preserve the current approximate 0.4-second and 1-second transition durations, and leave each checkpoint after its text and graphic transitions have settled. Derive total duration and sequence boundaries from the same constants. Remove the unreachable draft reveal rather than silently introducing an eighth narrative beat. Incorporate useful radius-versus-perception wording into the existing comparison and correction beats.

Animation state is a function of absolute frame and explicit interaction inputs. Seeking directly to a scene must render the same result as playing there. Do not fold earlier state patches, sample a previous rendered frame, or restart a local animation clock.

### Limit the controller to playback and interaction state

`GuidedExplorer` will own the Player ref, navigation destination, moving/settled status, remembered choices, and Explore session. It will not calculate per-frame graphic or text styles.

Use Player `outFrame` to end playback at the requested checkpoint with `moveToBeginningWhenEnded={false}`. Update the playback bound before calling `play()`, then use the `ended` event to mark the checkpoint settled. This delegates exact stop-frame handling to Remotion rather than polling frames or racing timers. Verify this transition order in the first implementation spike. [Playback bounds](https://www.remotion.dev/docs/player/player#outframe)

- On initial load, play the introductory entrance and pause at the first reading checkpoint.
- Next plays forward to the next checkpoint. Disable repeated forward activation while moving so one double click cannot skip reading stops.
- Back pauses any movement and seeks to the previous settled checkpoint. Back is a direct seek in the initial implementation; it does not require a separate reverse-animation system.
- Reduced motion seeks directly to each settled checkpoint. React to preference changes, including a change during playback.
- Disable implicit spacebar playback so keyboard interaction with sliders and buttons remains native.
- Keep the Player mounted when entering Explore; pause and hide its subtree so it is neither visible nor focusable. Returning restores the last checkpoint and remembered tour choices.
- Clean up Player listeners on unmount. Avoid parent state updates on every frame. A development scrubber may subscribe to `frameupdate` in its own component, but normal navigation does not need that subscription.

### Preserve slider choices without history-dependent rendering

Store choices by a stable checkpoint/control key, for example `strength.amount`, outside the scene component. The slider is controlled directly by that value. It is usable while its checkpoint is settled, and its updates change composition inputs without seeking or playing.

Use a bounded frame-dependent contribution for the exploration override. At the strength checkpoint its weight is 1; by the correction checkpoint its weight is 0. For example:

```ts
amount = canonicalAmount(frame)
  + (chosenAmount - canonicalAmount(strengthCheckpoint))
  * explorationWeight(frame);
```

The weight is zero before the relevant scene, reaches one by the interaction checkpoint, and eases to zero during the following transition. Thus, choosing 2.7 displays 2.7 immediately; Next smoothly returns to the authored correction value of 2; Back restores 2.7 at the exploration checkpoint. Replaying or seeking uses the same explicit choice and frame, without a captured `from` state. Define this one behavior directly rather than building a generic override engine.

Provide a small reset action beside the strength slider. Keep slider values session-local; persistence across reloads is outside this migration. Snapshot the final resolved graphic state when entering Explore. Explore adjustments remain independent of tour choices, and returning restores the tour checkpoint rather than importing unrelated Explore edits.

### Use two layout presets before introducing continuous sizing

Use one composition component at two configured sizes: compact at 400 × 840 and wide at 960 × 560. Select the wide preset at a 960-pixel viewport breakpoint using `matchMedia`; cap the displayed compact stage at 440 pixels and the wide stage at 992 pixels. Update dimensions on the existing Player rather than changing its key. Inside the composition, `useVideoConfig()` selects stacked or horizontal layout from the configured aspect ratio.

This follows the useful part of the [RenderComp multi-format guide](https://rendercomp.com/blog/remotion-responsive-composition-multi-format/): one timeline and component can adapt to several authored formats. It does not make `useVideoConfig()` an observer of the browser container. Remotion scales each chosen composition to fit the host. [Player sizing](https://www.remotion.dev/docs/player/scaling)

Size typography and form targets for their displayed size at the smallest supported viewport, rather than applying a proportional scale formula to everything. Reserve enough stage height for the longest scene and let the page scroll vertically. Keep the complete instructional text; do not truncate it to fit. Use normal grid/flex flow within each format and independently size the illustration.

No custom `ResizeObserver` or per-frame sizing adapter is needed for these controlled tour formats. The first implementation gate verifies selection, long text, control interaction, overflow, and preservation of the frame/choice when switching presets. Add continuous measurement only if actual supported layouts fail those checks. Studio registers both presets using the same component, scene ranges, and serialized default choice.

## Implementation stages

### Stage 1 Prove composition layout and control interaction

Create `website/src/components/tour/TourComposition.tsx` with one representative scene containing long text, an interleaved strength slider, and the existing graphic. Implement the two fixed formats and media-query selection. Keep small scene/layout helpers together until splitting them provides a concrete benefit.

Verify selection/copy, touch and keyboard input, and layout at 390, 768, and 1280 viewport widths before migrating all scenes. Resize while paused and while playing. Confirm that composition dimension changes retain the Player and frame. Prove checkpoint stopping with a persistent Player and changing `outFrame`. These are implementation checks, not requests for another approval round.

### Stage 2 Author the continuous timeline and geometry

Add `tour/timeline.ts`, `tour/graphic-state.ts`, and focused tests. Define the seven checkpoint identities and shared scene ranges. Implement direct numeric tracks for amount, correction, zoom, and opacities using Remotion functions. Keep these as explicit tour choreography, not a replacement animation framework.

Retain `website/src/math.ts` and the SVG renderer. Where measurement modes change, interpolate resolved endpoints or crossfade two complete measurement layers. Do not numerically interpolate enum values or switch visible measurement geometry halfway through a fade.

Separate semantic visibility/toggles from rendered opacity fields where this makes the renderer clearer. Avoid spreading boolean-or-number values through interactive form state merely to support fades.

### Stage 3 Move the narrative and interleaved controls

Add `tour/TourScenes.tsx` with named native sequences for headings, paragraphs, comparisons, and the strength control. Let headings span multiple checkpoint ranges so subsequent body reveals do not restart them. Define exits and entrances in frame space, including overlap only where it is intentional.

Move useful copy from `slides.tsx`, remove debug headings and unreachable draft content, and keep package naming accurate. Place the controlled strength slider between its explanatory paragraphs. Make hidden/outgoing content non-interactive and unavailable to keyboard focus; opacity alone is insufficient. Maintain a sensible DOM reading order.

### Stage 4 Replace navigation and add remembered exploration

Rewrite `GuidedExplorer.tsx` as the persistent Player host and checkpoint controller. Add `tour/useTourPlayback.ts` only if extracting the event and navigation logic improves clarity. Remove slide/step/revision state, replay-based merging, render-time ref writes, and the portal.

Implement the remembered strength value and the weighted return to canonical choreography. Add accessible labels, reset behavior, pending-navigation protection, reduced-motion handling, and focus transfer when a sequence containing the focused control exits. Pass values and callbacks as explicit Player inputs; browser callbacks are not required for deterministic Studio preview.

### Stage 5 Preserve the Explore handoff

Reuse `FreeExplorer` and `ExplorerGraphic`. Seed Explore from the resolved final frame through the same pure graphic function used by the composition. Keep its state separate. Verify return, repeated entry, slider/text-field consistency, and absence of duplicate active controls when the tour is hidden.

### Stage 6 Add useful Remotion authoring support

Add `website/src/remotion/index.ts`, `Root.tsx`, and `website/remotion.config.ts`. Register portrait and landscape previews of the same component and timeline. Pass serializable default interaction choices; use a preview adapter for callbacks if interactive Studio controls are needed. The Player receives `TourComposition` directly, not the Studio registration wrapper.

Add `@remotion/cli` and `@remotion/tailwind-v4` as development dependencies at the existing matching Remotion version, 4.0.537, through the workspace catalog. Add a website Studio task and configure Tailwind 4 with `enableTailwind()`, importing the same styles/tokens and honoring the existing built-plugin prerequisite. [Tailwind integration](https://www.remotion.dev/docs/tailwind-v4/enable-tailwind), [Studio CLI](https://www.remotion.dev/docs/cli/studio)

Studio should expose named sequences, continuous playback, and arbitrary scrubbing. A public timeline scrubber, automated video export, and a separate rendering service are not required. Do not add transition packages unless the authored scenes actually need them.

### Stage 7 Remove the superseded slideshow system and wire checks

Delete `Animate.tsx` and `slides.tsx` once imports have moved. Retain the unrelated legacy explorer/generator files. Update only tour-related typography/layout styles in `global.css`; avoid broad styling-system cleanup.

Add website timeline test and typecheck tasks in `website/vite.config.ts`, with explicit dependencies in the root readiness task. Scope the website TypeScript config to application and Remotion source so it does not typecheck the separately installed StackBlitz project. Add required test dependencies using the existing workspace catalogs.

Keep the `/tour` route. Homepage replacement and site navigation changes are separate product decisions. Add concise authoring instructions covering checkpoints, scene durations, control choices, and Studio commands.

## Acceptance and verification

### Timeline and interaction tests

- Directly evaluating a frame produces the same graphic state regardless of evaluation order or navigation history.
- All seven checkpoint frames are in bounds, sorted, reachable, and settled after their entrances finish.
- A chosen amount of 2.7 produces 2.7 at the interaction checkpoint, changes smoothly immediately after it, and reaches the canonical value at the correction checkpoint. Back restores the choice; reset restores 2.
- Every sampled frame across transitions has finite SVG geometry and bounded opacities. Measurement transitions remain continuous or deliberately crossfade.
- Navigation cannot advance past the final checkpoint or before the first. Repeated forward activation while moving does not skip a stop. Interrupted navigation and listener cleanup are covered.

### Browser verification

Use the T3 collaborative browser against the real `/tour` route, then a production build preview. Exercise every checkpoint, rapid Next, interrupted Back, Explore entry/return, and reload. Confirm there is one persistent Player and no portal destination or independent animation timer.

At desktop and phone widths, verify long-copy wrapping, diagram/text order, control hit targets, no horizontal overflow, no clipping, and normal selection/copy. Resize at the strength checkpoint without losing its value or frame. Exercise range controls with touch/pointer and arrow keys; check associated labels, focus order, and outgoing sequence focus handling. With reduced motion enabled, navigation must show complete settled content without playing transitions.

Open both Studio compositions and scrub directly into every scene with default inputs and a nondefault remembered strength choice. Studio should render the same timeline result as the Player; an absent live callback must not crash the scene.

Run website tests, scoped typecheck, lint, Astro production build, and the workspace readiness task. Compare failures with the recorded baseline. Do not update package snapshots to conceal the existing CSS utility failure or claim that a successful Astro build proves the interactive behavior. Report remaining unrelated failures explicitly.

## Completion criteria

The migration is complete when adding or retiming a narrative beat means editing named timeline ranges and scene content, rather than coordinating slide indexes, accumulated patches, and Player remounts. The same composition must support readable horizontal and vertical layouts, controls interleaved with text, remembered mid-tour choices, and deterministic seeking in Studio.

## Implementation verification

Implemented October 20, 2026 using the two-format design. `TourComposition.tsx` contains the normal HTML text, interleaved strength control, and SVG graphic. `GuidedExplorer` keeps one Player mounted, including across format changes and Explore. The old `Animate.tsx`, `slides.tsx`, portal, revision counter, and accumulated state replay were removed.

- Four website timeline tests pass, including deterministic seeking, remembered slider values, bounded opacity, and finite/continuous numeric tracks.
- The scoped website TypeScript check and changed-source lint pass. The website TypeScript config excludes the independently installed example project.
- The Astro production build passes. Frozen lockfile validation passes.
- Remotion's CLI discovers both `Tour-compact` at 400 × 840 and `Tour-wide` at 960 × 560, each 445 frames at 60 fps. Both Studio previews were checked at the strength checkpoint with working controls.
- Production browser checks cover all seven scenes, rapid forward activation, interrupted Back, immediate slider-driven geometry, remembered choices, Explore entry/return, text-selection styles, and native range-key input. A simulated reduced-motion preference seeks directly to the checkpoint.
- The longest scene fits without page overflow or control overlap at 320, 768, 960, and 1280 viewport widths. Switching formats preserves the same composition DOM node and paused frame. Explore's controls now wrap on narrow screens, its table scrolls within its panel, and repeated slider key presses retain focus.
- Workspace `ready` remains blocked by the existing generated Panda lint errors. The package task runner's `picomatch` failure is also still reproducible; the documented direct package commands remain a workaround.

Authoring commands and interaction policies are in [Guided tour authoring](../../tour-authoring.md). The separately requested library research is in [Responsive interactive demo animation alternatives](2026-10-20-interactive-demo-alternatives.md). That research favors GSAP for a fresh browser-first implementation; it did not change the authorized Remotion implementation in this branch.
