# Guided tour authoring — Motion sequences

The `/tour` route is a hydrated React island in the existing Astro shell. It uses Motion 14.4.0, Astro 5.18.1, React 19.2.4 and the official scoped `useAnimate()` integration. There are no Remotion runtime, Player, Studio, composition presets or interpolation dependencies on this branch.

## Run locally

From the repository root, install the entire workspace (a filtered install can leave the package build dependencies unlinked):

```sh
pnpm install
pnpm exec vp run website#dev
```

The website task builds the utility package and starts Astro on **http://localhost:4333/tour**. In a second terminal start the actual Motion Studio companion:

```sh
pnpm exec vp run website#studio
```

Its endpoint is **http://localhost:3013**; the editor itself appears on the website. There is no separate composition browser at that URL. The companion is confined to the website directory. Its installed CLI supports `serve --port`, `--root`, `--origin` and `--experimental`; the checked-in command uses `--port 3013`.

Direct commands, also tested, avoid the workspace task runner:

```sh
pnpm --filter @klinking/squircle exec vp pack
pnpm --filter @klinking/squircle exec tsx scripts/generate-squircle-css.ts
pnpm --filter website exec astro dev --host 127.0.0.1 --port 4333
# Second terminal:
pnpm --filter website exec motion-studio serve --port 3013
```

The previously reported Vite+ task-graph/picomatch failure did not reproduce after the full workspace install: `pnpm exec vp run website#build` passed. Astro/Vite still emit existing React Babel/esbuild/rollupOptions/JSX-option deprecation warnings. After changing dependencies or running a build while dev is open, Vite can serve `504 (Outdated Optimize Dep)` to the island. Restart the dev server and reload; do not interpret an unhydrated empty island as a passing check.

## The shared timeline

`website/src/components/GuidedExplorer.tsx` contains **one** `animate(sequence, { autoplay: false })` call returned by `useAnimate`. Keep the sequence literal there so Studio can parse its DOM segments. The scoped sequence contains:

- A full-duration clock track, first in the group, so `controls.time` always represents the whole tour.
- Seven Motion labels and seven DOM entrance segments, each animating opacity and horizontal translation.
- Numeric MotionValue tracks for base strength, remembered-choice weight, comparison visibility and radius correction.

`tour/timeline.ts` is the source for scene IDs, label offsets, reading checkpoint times and button copy. Times are seconds: **0.8, 2, 3.2, 4.2, 5.4, 6.4, 7.4**. The final checkpoint determines duration. A checkpoint belongs to the scene just completed; moving beyond it reveals the next scene. Keep each reading stop after that scene's text and graphic segments finish.

Next resumes the existing group, and one animation-frame observer pauses and seeks it exactly at the requested reading stop. A synchronous moving ref rejects rapid activation before React commits. Back cancels that observer, pauses and seeks to the previous destination. There are no completion-callback chains, independent springs, or per-scene animation instances. Cleanup stops the group and cancels the observer; `useAnimate` also provides scope cleanup.

Open **Seek the tour** to scrub the same controls directly. Scrubbing pauses playback and keeps keyboard focus on the range, including across scene boundaries. Next then proceeds to the next reading checkpoint. Next/Back focus the settled heading. Hidden sections have `hidden`, `inert` and `aria-hidden`; outgoing controls cannot receive input.

## Graphic and interaction ownership

Motion owns section opacity/transform and the numeric tracks. React does not set those section styles. React subscribes to the numeric tracks and alone owns `ExplorerGraphic`'s SVG attributes and geometry. `tour/graphic-state.ts` maps current tracks to SVG inputs; it does no time interpolation. Geometry still uses the existing `website/src/math.ts`.

The remembered strength is React state, initially 2. Its contribution is `(choice - 2) * choiceWeight`. At the paused strength checkpoint the weight is 1, so the inline slider updates the SVG immediately without restarting the group or replacing the input. Its range is 1–3, step 0.1. Reset sets the remembered choice to 2. Correction animates the weight to 0 and correction to 1 together, smoothly returning to canonical strength 2. Back seeks the weight to 1 and restores the choice. This remains deterministic after arbitrary direct seeks.

Explore receives a separate graphic-state snapshot. Its edits do not change the remembered tour choice. Returning reveals the persistent final checkpoint and focuses the tour heading. The media-query subscription observes live reduced-motion changes: a change to reduce pauses/seeks an in-flight transition to its destination; subsequent navigation seeks immediately. Switching the preference back permits normal playback.

## Copy and responsive layout

`tour/TourComposition.tsx` preserves the seven narrative beats and baseline copy. The strength control is ordinary selectable HTML between its two paragraphs. `tour/tour.css` controls native reflow, normal document height, readable type and minimum 48px buttons. The diagram uses its existing SVG viewBox. At 960px the layout changes to two columns; smaller widths stack the diagram and narrative. There is no fixed composition viewport, scaled text, dimension preset, ResizeObserver or animation rebuild on resize. Vertical page scrolling is expected.

## Motion Studio: verified capabilities and limits

Integration follows the [official Studio Astro instructions](https://motion.dev/docs/studio#astro): `motionStudio({ serverUrl: "http://localhost:3013" })` is in `astro.config.mjs`, and the React island has a `client:*` hydration directive. The installed **motion-studio 2.1.0** was exercised on this repository's **Astro 5.18.1**, Node **24.14.1**, and hydrated React island. The official page's published Astro verification uses Astro 7.3.3; this repository was tested separately without upgrading it.

Tested free workflow:

1. Open `/tour` in development and use the real **Open Motion timeline** control (or Alt+T). Trigger the tour if needed. Studio loads its client from port 3013 and discovers the shared sequence's seven DOM tracks.
2. Select the first rounded track's starting opacity keyframe, change `segments[8].keyframes.opacity[0]` from 0 to 0.25, and press **Enter**. Studio accepts a staged local edit and shows one pending change. Merely blurring this input did not commit the edit.
3. Apply opens the actual **Sign up to Motion Studio** dialog. The installed editor says saving source and agent use require a Studio subscription; its wording differs from the current docs' Motion+ wording. No signup, purchase, login or paid source application was performed.
4. Dismiss the dialog, discard pending edits and reload before testing product navigation. Studio preview replaces/stops the original animation controls; attempting product Next after a preview left those controls stopped until reload in this version.

This is a **partial authoring integration**, not a verified full-tour visual editor. Studio 2.1.0 lists the seven DOM selectors, but omits the numeric MotionValue tracks. With label positions expressed as `CHECKPOINTS[index].start`, its static model displayed **9.50s** and put the rounded track at **2.40s**; the real runtime group is **7.40s**, with rounded at **0s**. Moving tracks was disabled, while literal opacity/translation keyframes were editable. Staging an edit worked, but a faithful full-tour preview/retime was not established. Use source editing plus the runtime scrubber for numeric tracks and checkpoint retiming. Do not substitute Studio's inferred timings for the runtime sequence. The [Studio docs](https://motion.dev/docs/studio#troubleshooting) also describe expression values as read-only.

The plugin is development-only. The production build was scanned for Studio/Remotion markers, and the production browser loaded no Studio script, companion requests or editor host. Studio is a devDependency; it carries its own Motion 13.3.0 dependency, separate from the application's Motion 14.4.0.

## Verification and production size

Run from the root:

```sh
pnpm --filter website exec vp test run
pnpm --filter website exec tsc --noEmit
pnpm exec vp lint website/src/components/GuidedExplorer.tsx website/src/components/ExplorerGraphic.tsx website/src/components/tour website/astro.config.mjs website/vite.config.ts website/scripts/report-tour-size.mjs
pnpm --filter website exec astro build
node website/scripts/report-tour-size.mjs
```

Final implementation checks on 2026-10-20:

- Website tests: **7 passed**, one file. They mount the actual React/Motion runtime in jsdom: settled stops, rapid Next, interrupted Back, smooth nondefault correction, Back restore, Reset, slider focus, scrub focus, direct seeking, Explore isolation, reduced motion at startup and during playback, preference reversal, and unmount cleanup. No animation library mocks.
- Website TypeScript: **passed**. Scoped lint: **0 warnings, 0 errors**, 10 files.
- Production build: **passed**, four static routes. Workspace `website#build`, including the package build, also passed.
- Root lint: **3 existing generated Panda errors** in `website/styled-system/css/cx.mjs`, `jsx/create-style-context.mjs`, and `patterns/float.mjs`. Those files were not changed.
- Package tests: **68 passed / 60 failed**, two files, **15 failed snapshots**; the CSS utility suite still returns empty/missing utilities. Package sources and snapshots were not changed to conceal these baseline failures. Full-repository ready is therefore not green.
- T3 Chromium browser, dedicated tab and own servers: all **35** combinations of seven checkpoints at **320, 390, 768, 960, 1280px** had no page/copy overflow, overlapping navigation buttons or unsettled checkpoint opacity. Inspected compact strength and wide layouts visually. Tested rapid Next, interrupted Back, native keyboard slider input to 2.7 with focus retained, selectable text, nondefault correction, Back restore, Reset, arbitrary seeking, keyboard scrub focus, resize while playing and paused, Explore edits to 1.2 and tour choice restoration to 2.7. Reduced-motion changes were exercised with a browser `matchMedia` snapshot simulation; OS-level preference toggling and non-Chromium browsers were not tested. Native change-event subscription is covered by the runtime tests.
- A separate production preview on port 4335 was checked for hydration, navigation, seeking, focus and absence of Studio. The development demo remains on port 4333 and the Studio companion on 3013.

`report-tour-size.mjs` sums emitted bytes and each file's `node:zlib.gzipSync` bytes with default compression. It excludes maps, unrelated DemoEmbed code and HTML. Do not sum the build tool's rounded kB values or concatenate files before compression. Final measurements:

- Tour + Motion + SVG/math + Explore: **81,344 raw / 28,403 gzip bytes**.
- Shared React, React DOM, Astro React client and JSX: **191,956 raw / 60,470 gzip bytes**.
- Shared bundler helper: **558 raw / 356 gzip bytes**.
- Total tour-route JS: **273,858 raw / 89,229 gzip bytes**.
- Site CSS across all routes: **29,129 raw / 5,731 gzip bytes**.

The size script also fails if it finds Studio or Remotion markers in emitted JavaScript. Run it again after any production code change.
