# Independent tour engine evaluation

Reviewed 2026-10-20 against the original [comparison brief](superpowers/plans/2026-10-20-tour-engine-comparison-brief.md). This is the first independent evaluation of the completed implementations. The recommendation below follows code inspection, fresh builds/tests, and actual browser/editor exercises, rather than implementer rankings or the earlier alternatives research.

## Recommendation and scope

**Use the GSAP implementation for this interactive website.** Its responsive HTML, explicit property ownership, native labels, and killable `tweenTo` navigation fit a tour that pauses for reading and accepts live input. It preserves the required behavior while leaving less application-owned playback machinery than Motion and avoiding Remotion's composition scaling and much larger runtime.

**Motion is a credible second choice**, especially if Motion is already part of the site or minimizing the additional payload is decisive. Its product behavior passed the exercised cases, and it has the smallest emitted tour chunk. However, the installed Studio integration is only partially usable: the editor omits numeric geometry tracks, models timing incorrectly, gates source application behind a subscription, and leaves runtime navigation stuck after preview editing until reload. Do not choose this completed version on the assumption that Studio provides faithful full-tour visual retiming.

**Prefer Remotion when the same narrative must be a frame-authored composition, with reliable Studio inspection and a future video/rendering workflow.** Its direct frame evaluation and visible native sequence tracks are compelling for that use. For this website, its larger payload, fixed composition presets, and source coordination between frame checkpoints and geometry outweigh those benefits. Video export itself was not tested.

These are qualitative judgments, not numerical ratings. Test counts are not quality scores.

## Immutable targets and runnable entry points

| Engine | Branch and exact evaluated commit | Worktree | Production | Development/editor |
| --- | --- | --- | --- | --- |
| Remotion | `feat/tour-remotion` · `31938e2184ec85ffba29413ab42598fc96d7771e` | `/Users/klink/.t3/worktrees/tw-squircle/t3-b6ac089e` | http://localhost:4331/tour | http://localhost:3011/Tour-compact and http://localhost:3011/Tour-wide |
| GSAP | `feat/tour-gsap` · `7460ec01d2c106a1d5168d07e7e61e79884ced11` | `/Users/klink/.t3/worktrees/tw-squircle/t3-67afdff1` | http://localhost:4432/tour | http://localhost:4332/tour — developer transport; no visual editor |
| Motion | `feat/tour-motion` · `b191907380085f5d94e03dc57eba8cac244c8bf5` | `/Users/klink/.t3/worktrees/tw-squircle/t3-7047586d` | http://localhost:4335/tour | http://localhost:4333/tour, in-page Studio with companion http://localhost:3013 |

The reviewer checkout began at `38151f2adc1fdf629bf75503a7836ff0944757b8` and uses `feat/tour-engine-evaluation`. All target HEADs were checked. No implementation commits, push, PR, dependency installation, formatting, or snapshot updates were made. The parent checkout was not used.

**Editor audit incident:** changing Remotion's Inspector amount from 2 to 2.7 auto-saved `Root.tsx` immediately, without a separate Apply step. I used Studio's Undo immediately and verified an empty tracked diff/status. Thus there was a temporary editor-induced source mutation, despite the intended read-only evaluation; the delivered targets and final source trees remain exactly at their supplied commits. Motion staged edits were discarded without applying source. This distinction is disclosed rather than claiming no write ever occurred.

Servers supplied by implementers were available; no restart was necessary. To reproduce from each target's own root after dependencies/package outputs are available:

```sh
pnpm --filter website exec astro build
# Remotion production:
pnpm --filter website exec astro preview --host 127.0.0.1 --port 4331
pnpm --filter website exec remotion studio src/remotion/index.ts --port 3011 --no-open
# GSAP:
pnpm --filter website exec astro dev --host 127.0.0.1 --port 4332
pnpm --filter website exec astro preview --host 127.0.0.1 --port 4432
# Motion:
pnpm --filter website exec astro dev --host 127.0.0.1 --port 4333
pnpm --filter website exec motion-studio serve --port 3013
pnpm --filter website exec astro preview --host 127.0.0.1 --port 4335
```

The branch-specific `docs/tour-authoring.md` files were read in full, as was Remotion's `docs/tour-remotion-verification.md`. They are instructions and claims, not substitutes for the checks below.

## Independently executed checks

From every implementation root:

```sh
pnpm --filter website exec vp test run
pnpm --filter website exec tsc --noEmit
pnpm exec vp lint website/src/components/GuidedExplorer.tsx website/src/components/tour
pnpm --filter website exec astro build
pnpm exec vp run website#build
pnpm exec vp lint
pnpm --filter @klinking/squircle exec vp test run
```

| Check | Remotion | GSAP | Motion |
| --- | --- | --- | --- |
| Focused website tests | 8 passed, 2 files | 7 passed, 1 file | 7 passed, 1 file |
| Scoped TypeScript | pass | pass | pass |
| Scoped lint above | 0 errors/warnings, 7 files | 0 errors/warnings, 7 files | 0 errors/warnings, 6 files |
| Direct production build | pass, 4 routes | pass, 4 routes | pass, 4 routes |
| Workspace production build | pass | pass | pass |
| Root lint | 3 existing errors | same 3 | same 3 |
| Utility package suite | 68 pass / 60 fail; 15 failed snapshots | same | same |

Additionally, Remotion `remotion versions` passed with all packages at 4.0.537 and Zod 4.5.4. `remotion compositions src/remotion/index.ts` discovered both presets: 400×840 and 960×560, 445 frames at 60fps (7.42 seconds).

The scoped lint is deliberately described as the command actually rerun; it does not claim the broader implementer lint commands were rerun. Typecheck is the configured website `tsc --noEmit`, not a full `astro check` audit of every Astro file.

Baseline failures are separate: generated `website/styled-system/jsx/create-style-context.mjs:3` has unused `css`, `css/cx.mjs:8` has an unused expression, and `patterns/float.mjs:6` has unused `offset`. The unchanged utility suite produces missing/empty CSS and snapshot failures. `git diff 38151f2a -- package website/styled-system` is empty on each target. These failures therefore do not distinguish engines. Full-repository readiness is not green. No historical `picomatch` task-runner failure reproduced in the fresh workspace builds. Existing Astro/Vite deprecation/JSX-option warnings remain; none prevented a build.

The measurement shell reports Node 24.14.1, pnpm 10.33.0 and zlib 1.3.1-e00f703. Remotion CLI's own banner reports Node 25.6.1, so the launcher environments are not identical; no cross-Node performance claim is made.

### Browser method and matrix

Used the T3 collaborative browser: `preview_status` first; six new owned tabs opened with `reuseExistingTab:false`, one production and one authoring tab per engine; explicit `tabId` on every subsequent call. No other session's tab was operated. Coverage is desktop Chromium 154.0.0.0 with CSS viewport resizing, not physical mobile devices.

All seven stops were reached by normal runtime navigation at each width, with a 900px-high viewport. Read DOM checkpoint/time/moving attributes after settlement, paragraph/text bounds, page scroll width, navigation bounds and button sizes; tested DOM text selection. Screenshots of compact strength scenes were also visually inspected. Most repeated navigation and input assertions used in-page DOM events; native browser keyboard ArrowRight/Tab and editor pointer/typing tools were exercised separately. This is not a claim of manual touch-device testing.

| Width | Remotion | GSAP | Motion |
| ---: | --- | --- | --- |
| 320 | 7 settled stops pass | 7 pass | 7 pass |
| 390 | 7 pass | 7 pass | 7 pass |
| 768 | 7 pass | 7 pass | 7 pass |
| 960 | 7 pass | 7 pass | 7 pass |
| 1280 | 7 pass | 7 pass | 7 pass |

**105 settled combinations:** zero page horizontal overflow; no paragraph scroll overflow or text extending beyond its box; positive copy-to-navigation gaps; selectable copy. All settled time sequences matched 48/120/192/252/324/384/444 frames or 0.8/2/3.2/4.2/5.4/6.4/7.4 seconds. Vertical scrolling is expected.

Further production interaction checks:

| Scenario | Observed result |
| --- | --- |
| Twelve rapid Next activations | All stop at scene 2, not a later reading stop |
| Immediate Back after React's event commit, before ordinary playback progress | All restore the prior stop |
| Back after approximately 250ms of forward movement | All cancel safely and restore the previous checkpoint |
| Inline 2.7 choice | Graphic changes immediately while paused; input remains focused; range is 1–3, step 0.1 |
| Correction and Back | Nondefault geometry changes in flight; completion is canonical; Back restores 2.7 and identical strength SVG markup |
| Reset | All return slider choice to 2 |
| Native ArrowRight on strength | All change 2.7 to 2.8 with paused location and input focus preserved |
| Keyboard/hidden controls | Tab reaches visible controls; inactive/outgoing strength controls are disabled and/or under hidden/inert ancestors; Explore hides/inerts the tour |
| Resize paused 1280→390 | All retain strength choice, playhead and slider focus |
| Resize playing 390→960 | All settle correction at the intended destination; Back restores 2.7 |
| Explore edit to -1.2, return | Changed Explore graphic, final tour SVG unchanged on return; Back to strength restores 2.7 |
| Arbitrary seek and reverse seek | GSAP developer transport and Motion runtime scrubber reproduce identical SVG at revisited times, with scrubber focus preserved |
| Reduced motion | Initial reduced setting settles intro; reduced Next seeks; turning reduction off restores motion; changing to reduce during playback settles destination; Back restores 2.7 |

The main detailed interaction run used 1280px; resize and Explore runs also used 960px. Slider/correction/Back/Explore isolation were then rerun at all five widths: immediate SVG change from 2 to 2.7, focused slider, identical SVG after Back, Explore amount -1.2 without page overflow, and remembered 2.7 after return all passed. Hidden sections were inspected throughout the settled matrix; keyboard tests were focused scenarios, not a complete assistive-technology audit.

**Reduced-motion method:** unmounted the real production Astro React island, imported its already-built component and renderer, substituted a controlled `matchMedia` object for the reduced-motion query while retaining native behavior for other queries, and mounted the same component into a temporary browser root. Changed the controlled preference and dispatched subscribed callbacks. No animation engine was mocked. These are browser runtime simulations, not OS preference changes or browser media emulation. Native OS reduced motion remains unverified. Unmount removed the test component; there was no heap/leak benchmark or independent replay of the implementer's three StrictMode cycles.

## Readability and responsive behavior

| Body text in CSS pixels | 320 | 390 | 768 | 960 | 1280 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Remotion, after Player scale | 17.28 | 21.48 | 26.40 | 21.27 | 22.73 |
| GSAP | 17.60 | 17.60 | 18.432 | 22.00 | 22.00 |
| Motion | 16.80 | 16.80 | 16.896 | 21.12 | 22.00 |

Observed: GSAP and Motion use ordinary HTML flow. GSAP switches to columns at 768px; Motion at 960px. Neither rebuilds animation on resize. Remotion chooses the compact 400×840 preset below 960px and scales it, capped at 440 CSS px, then selects 960×560. It does not continuously reflow copy for the actual viewport.

At 320px, Remotion's shortest navigation buttons are 46.08px high; GSAP/Motion are at least 48px. This is a measurable difference, not a finding that a mandatory 48px brief requirement was violated. The brief did not specify a minimum. At the compact strength stop, Remotion wraps Back and the scene count as well as the long forward label. It remains legible and nonoverlapping, but looks more compressed. Its smallest copy-to-navigation gap was 20.16px; GSAP/Motion keep 24px.

Judgment: GSAP's larger narrow-screen text and compact diagram make the reading/control relationship clearer. Motion remains readable but its narrow-screen diagram consumes more vertical space. Remotion offers more stable composition positioning and crossfades, at the cost of abrupt typography/layout changes at the preset boundary and manual space budgeting when copy grows. All passed the supplied copy at the tested widths; larger fonts, localization and substantially longer copy were not tested.

## Architecture, coordination and retiming

All code references below refer to the immutable branch/SHA in the target table. Paths and line numbers are from those commits, not this review branch.

### Remotion

Observations:

- `feat/tour-remotion:website/src/components/GuidedExplorer.tsx:20` keeps one Player ref, a synchronous moving guard, requested destination, remembered choice and separate Explore state. Lines 42–79 manage ended events, focus and reduced motion; lines 81–107 implement navigation; line 113 creates the persistent Player with committed `outFrame` bounds.
- `website/src/components/tour/timeline.ts:4` is the seven-frame-stop table; line 17 defines the two formats. `website/src/components/tour/graphic-state.ts:15` evaluates numeric tracks from frame and chosen amount directly, using independent duration constants such as +30/+48/+60.
- `website/src/components/tour/TourComposition.tsx:29` derives Reveal opacity/transform from local frames and hides/inerts transparent/outgoing blocks. Line 87 creates the fixed composition grid. Ten literal native Sequence call sites start at line 125. Strength controls at lines 239/248 are gated by exact checkpoint/moving state.
- `website/src/remotion/Root.tsx:8` defines the 1–3, 0.1-step Zod schema; line 11 adapts serialized input props to local interactive preview state.

Judgment: this has the simplest deterministic geometry model: a frame and choice determine the graphic without replay history. Studio accurately exposes sequence lifetimes, but the website still needs playback/focus/Explore policy. Retiming a body sequence does not automatically retime its numeric interpolation, reading checkpoint or exit duration. Literal declarations improve track visibility while repeating authoring expressions. New copy must fit both presets. This is source-authored choreography with a useful composition editor, not one visual operation that safely retimes the whole interactive experience.

### GSAP

Observations:

- `feat/tour-gsap:website/src/components/tour/timeline.ts:32` constructs one paused native timeline, native reading/entrance labels (lines 37–38), DOM entrances, and plain-object numeric tracks (lines 54–65). The dummy duration tween includes the final hold.
- `website/src/components/tour/playback.ts:20` kills the playhead driver and pauses; lines 32–50 use `seek(label)` and `tweenTo(label)`; lines 57–79 implement rapid-input, Back, reduced-motion and scrub policies. Direct seeking explicitly publishes because suppressed callbacks must not leave React stale.
- `website/src/components/GuidedExplorer.tsx:44` creates the timeline in scoped `useGSAP`, with disposal at line 54. Event-driven operations use `contextSafe` at lines 85–94. Line 80 synchronously updates the remembered ref and publishes geometry.
- `website/src/components/tour/TourNarrative.tsx:71` renders stable sections; inactive sections use `hidden` and `inert`, with `aria-labelledby` naming each section. GSAP owns their opacity/transform. React owns visibility/layout participation, state and SVG attributes.
- `website/src/components/tour/tour.css:1` defines responsive HTML flow, wrapped navigation and control sizing; the 768px media query changes columns.

Judgment: this best matches the interactive task. Native labels and the killable playhead tween handle timing/interruption; application code expresses product rules without a second animation-frame stopping loop. The separate playback module is still real glue, not zero-code integration. Retiming requires adjusting cue start/stop and tween durations, plus checking strength/correction index assumptions. Its development transport is useful for deterministic inspection but provides no visual keyframe authoring or source rewriting.

The native `tweenTo` behavior is also documented in the [official GSAP API](https://gsap.com/docs/v3/GSAP/Timeline/tweenTo()/). The measured implementation behavior, rather than that API's existence, drives this recommendation.

### Motion

Observations:

- `feat/tour-motion:website/src/components/GuidedExplorer.tsx:20` uses scoped `useAnimate`; lines 21–25 create clock and numeric MotionValues. Lines 37–40 subscribe to geometry tracks and publish React values.
- Lines 56–92 implement arbitrary seeking and an application `requestAnimationFrame` observer that pauses/seeks at the chosen reading checkpoint.
- Lines 96–158 declare one literal `animate(sequence, {autoplay:false})` group: full-duration clock, labels, seven DOM entrances and numeric geometry tracks. Lines 161–165 cancel the observer and stop the group.
- Lines 169–175 handle live reduced-motion/focus effects; lines 178–191 implement navigation; lines 227–255 expose the runtime scrubber, including in production.
- `website/src/components/tour/timeline.ts:2` defines checkpoint metadata and boundary helpers. `website/src/components/tour/TourComposition.tsx:90` renders normal sections with hidden/inert gates. `website/astro.config.mjs:9` configures the actual Studio Vite plugin and companion URL.

Judgment: it satisfies the actual shared-sequence boundary, with clean style ownership and deterministic seeking in tested samples. It is not a set of unrelated springs. However, checkpoint stopping remains application code, including frame polling, a dummy clock, target/moving refs and React playback snapshots. The sequence and checkpoint metadata are coordinated in source. Studio additionally depends on static parsing of those expressions, which fails to model this full sequence accurately. Its small payload is meaningful; it does not remove that authoring/coordination cost.

## Actual editor workflows and reproducible issues

### Remotion Studio — working composition tools, source-edit caution

Both compact and wide routes load. All ten individual tracks were visible: three headings plus seven text blocks. Go-to-frame via the lower-left readout changed the composition to frame 48 and 252; both presets showed the expected strength state. After explicitly focusing the slider, native ArrowRight updated 2→2.1 without changing frame 252 in both presets. One unfocused wide interaction instead advanced Studio a frame via its global shortcut; explicit input focus resolved it.

The Inspector schema exposes amount, and changing 2→2.7 worked. It immediately saved the compact composition's default prop to source. Undo restored the exact tracked file. This verifies actual input-prop authoring, and also means evaluations must not assume Inspector edits are preview-only. Live composition slider edits are preview state; Inspector defaults are source state. Wide Studio arbitrary seeks 282→0→282 also reproduced identical SVG geometry.

Embedded Next/Back are disabled in Studio; use its continuous transport. There was no signup/paywall encountered in the local preview/props workflow. No video export or paid-license eligibility determination was performed. The production Player logs a license reminder. Remotion Studio's role as a composition preview/render environment is described in its [official documentation](https://www.remotion.dev/docs/studio).

### GSAP transport — verified, not a visual editor

At the development URL, opened “Author transport · GSAP.” Scrubbed 4.2→4.7→0.3→6.8→4.7→4.2; revisited times produced identical SVG and retained scrubber focus. Selected reading stop 3, scrubbed to 2.3, played to 2.5, paused there, then resumed to exact 3.2; these controls worked. The production page has no author transport.

There is no Studio, visual track editor, keyframe editing, automatic retiming, recording, or export in this delivery. No account/paid editor gate was involved. This is a feature boundary, not an undiscovered editor.

### Motion Studio 2.1.0 — material authoring limitations reproduced

1. Open http://localhost:4333/tour with companion 3013 running; open the Motion timeline (it may persist open from local browser state). The panel discovers seven `[data-scene="…"]` DOM tracks, but no clock/baseAmount/choiceWeight/comparison/correction tracks.
2. Inspect the first rounded opacity keyframe. Its popup reports **2.40s**, while the source/runtime rounded entrance starts at **0**. The editor duration is **9.50s**, whereas the runtime sequence is **7.40s**. Movement buttons for the expression-positioned segments are disabled.
3. Edit `segments[8].keyframes.opacity[0]` from 0 to 0.25 and press Enter. A staged edit is accepted. Click Apply. The real dialog requires a Motion Studio subscription for source saving/agent use; no login, signup or purchase was performed.
4. Dismiss “Not now,” discard the staged change, close the timeline, then activate product Next. After 1.6 seconds the product still reports time **0.8000**, moving **true**, instead of reaching 2.0. Reload the page and Next again: it settles at 2.0 normally.

The timing and missing-track problems prevent faithful full-tour visual retiming. The navigation failure is development/editor-specific; it was not observed in production. A working plugin config alone would have missed these defects.

The installed dialog describes a Studio subscription and a Motion+ discount. The current [official Studio docs](https://motion.dev/docs/studio) instead describe Apply under Motion+ and agent tiers, and explain expression-value restrictions. These are version/account wording differences, not proof of paid functionality working here. The docs list Astro support tested on a newer Astro version; this review verified the real Astro 5.18.1 integration only as far as stated. Paid Apply/source rewriting and faithful full-tour editing remain unverified.

### Remotion same-task navigation edge — synthetic, low priority

At scene 2/frame 120, run both DOM clicks in one JavaScript task:

```js
const nav = document.querySelector('nav[aria-label="Tour navigation"]');
nav.querySelector('button:last-child').click();
nav.querySelector('button:first-child').click();
```

Observed frame 48, rather than returning to frame 120. `onBack` reads the prior React `playback.destination` closure before the Next state commit (`GuidedExplorer.tsx:97`). Adding `await Promise.resolve()` between clicks lets React commit and restores frame 120 correctly; a 250ms interruption also passes. GSAP/Motion synchronous destination state handles the same-task stress case. This does **not** establish a reproducible ordinary pointer-event failure, since real browser clicks occupy separate events; it does limit an unconditional claim that every immediate synthetic interruption is safe.

## Production JavaScript, independently measured

Measured final emitted assets after fresh production builds, with the same Node/zlib process and **gzip level 9** for every file. Each file is compressed independently, then byte counts are summed. The observed production network/import graphs contain the tour entry, client, React/ReactDOM, JSX and helper chunks. No engine/editor chunk was silently omitted.

| Group, bytes | Remotion raw | Remotion gzip9 | GSAP raw | GSAP gzip9 | Motion raw | Motion gzip9 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Tour app + engine + SVG/math + Explore | 366,676 | 113,174 | 87,058 | 32,746 | 81,344 | 28,360 |
| Shared React/ReactDOM/Astro client + JSX | 191,964 | 60,537 | 191,944 | 60,353 | 191,956 | 60,363 |
| Shared bundler helper | 558 | 356 | 77 | 78 | 558 | 356 |
| **Total emitted route JS** | **559,198** | **174,067** | **279,079** | **93,177** | **273,858** | **89,079** |
| Site CSS, separate | 29,408 | 5,752 | 29,270 | 5,769 | 29,129 | 5,718 |

Motion saves 4,386 gzip bytes in the tour chunk and 4,098 bytes across route JS relative to GSAP. Remotion adds 80,890 route gzip bytes relative to GSAP. These are emitted asset costs, not engine-only package sizes, parse/execute time, memory, LCP, or a full HTTP transfer benchmark.

Excluded from all three totals: unrelated `DemoEmbed.*.js` (417 raw bytes; gzip9 331 Remotion/Motion, 332 GSAP), source maps, HTML and inline Astro hydration bootstrap. Shared chunks are included once, not charged to every component. Different helper and React chunk boundaries reflect bundler sharing; they are not application feature differences. The tour chunk includes engine plus implementation code, so it cannot be interpreted as library-only size.

Reproduce in each target root:

```sh
node --input-type=module <<'JS'
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
for (const name of readdirSync('website/dist/_astro')) {
  if (!/\.(js|css)$/.test(name)) continue;
  const bytes = readFileSync('website/dist/_astro/' + name);
  console.log(name, bytes.length, gzipSync(bytes, { level: 9 }).length);
}
JS
```

The companion summary JSON records the exact asset names and numbers. Some implementer numbers used default gzip compression, so they should not be mixed with this table.

### Development dependencies and production exclusion

Shared installed platform versions: Astro 5.18.1, @astrojs/react 4.4.2, React/ReactDOM 19.2.4, TypeScript 5.9.3, Tailwind 4.2.2.

| Engine | Added production packages | Editor/test development cost |
| --- | --- | --- |
| Remotion | remotion + @remotion/player 4.0.537 | @remotion/cli, @remotion/tailwind-v4, Zod 4.5.4; CLI includes renderer/bundler/Studio ecosystem and platform compositor |
| GSAP | gsap 3.15.0 + @gsap/react 2.1.2 | No editor package/server; uses existing focused test tooling |
| Motion | motion 14.4.0 | motion-studio 2.1.0 companion/plugin, @testing-library/react 16.3.3, jsdom 26.1.0; Studio also carries a separate Motion 13.3.0 dependency |

GSAP and Motion remove unused Remotion runtime/editor entrypoints and dependency declarations. Remotion's production runtime naturally contains Player/Remotion; CLI/Studio/Zod are outside its tour import graph. Motion Studio is a devDependency, and its development plugin is excluded from production output. Production browser requests contain no companion/editor requests or editor UI. GSAP's DEV transport is stripped. Motion's “Seek the tour” disclosure is intentionally still in production; it is application UI, not Studio.

No installed-disk size or install-time comparison was performed; direct dependency counts are not a meaningful transitive-cost score. Package licenses differ: GSAP is not MIT, Motion runtime is MIT, and Remotion has its own licensing terms. Account gates here describe observed local tools; legal eligibility and current pricing were not evaluated.

## What remains unverified

Safari, Firefox, native mobile/touch interaction, real OS reduced-motion toggling, screen-reader announcements, zoom/text-only enlargement, localization, extended-copy stress, performance under throttling, memory leaks, video rendering, paid Motion Apply and subsequent source round trips were not tested. No claim that the full repository is green or that Studio source retiming keeps all product checkpoints synchronized is warranted.

Within those limits, the production behavior is strong in all three. The deciding differences are GSAP's native navigation and responsive readability, Motion's smaller payload versus incomplete editor and custom checkpoint observer, and Remotion's deterministic composition/Studio strengths versus runtime and preset-layout cost.
