# Remotion comparison verification

Audited independently from baseline `38151f2a` on October 20, 2026 in
`/Users/klink/.t3/worktrees/tw-squircle/t3-b6ac089e`, branch `feat/tour-remotion`.
No other checkout, engine implementation, push, or PR was involved.

## Changes from baseline

- Back is available as soon as a forward destination is requested, including
  before the first animation frame. Previously its disabled state used only the
  rendered frame's scene.
- Requested navigation focuses the persistent reading container after the final
  frame commits, including reduced-motion seeks. Initial playback and amount
  updates preserve the user's focus. Reduced-motion settlement no longer seeks
  again just because the moving flag changed to false.
- Fully transparent entrances and outgoing copy are inert and `aria-hidden`.
  The strength slider and Reset remain disabled whenever the narrative moves.
- Ten explicit native Sequence call sites expose ten separate Studio clips.
  Baseline's shared wrapper grouped all of them into one clip with nine hidden
  duplicate instances. The seven beats, copy, checkpoints, and geometry remain.
- Studio has an explicit strength schema and a direct Zod 4.5.4 development
  dependency. This fixes the CLI resolving Astro's transitive Zod 3 and reporting
  a version mismatch. No Zod/schema code enters the website's tour bundle.
- Four additional tests render the actual Player/composition at chosen frames,
  checking content lifetimes, interaction gates, immediate Back, and slider order.

## Commands and results

Node `v24.14.1`, pnpm `10.33.0`, Remotion packages `4.0.537`, React `19.2.4`.
Commands run from the repository root unless otherwise indicated.

```sh
pnpm install --frozen-lockfile
pnpm --filter @klinking/squircle exec vp pack
pnpm --filter @klinking/squircle exec tsx scripts/generate-squircle-css.ts
pnpm --filter website exec vp test run
pnpm --filter website exec tsc --noEmit
pnpm exec vp lint website/src/components/GuidedExplorer.tsx website/src/components/tour website/src/remotion
pnpm --filter website exec astro build
pnpm --filter website exec remotion versions
pnpm --filter website exec remotion compositions src/remotion/index.ts
pnpm install --frozen-lockfile --ignore-scripts
git diff --check
```

All pass. Website tests: **8/8**, two files. Scoped lint: **0 errors, 0
warnings**, nine files. TypeScript: exit 0. Astro: four static routes built,
including `/tour`. Remotion versions: all correct. Composition discovery:
`Tour-compact` 400×840 and `Tour-wide` 960×560, both 445 frames at 60fps.

`pnpm exec vp fmt` was also run on the four changed TypeScript files.
Astro/Vite still emits the baseline esbuild/React plugin and invalid `jsx` option
deprecation warnings; the build succeeds. Installation reports a transitive
schema-utils/webpack peer warning; the real Studio and CLI checks succeed.

Baseline failures checked separately:

- `pnpm exec vp run ready`: exit 1 on the same three generated Panda lint errors:
  unused `css` in `website/styled-system/jsx/create-style-context.mjs`, unused
  expression in `css/cx.mjs`, and unused `offset` in `patterns/float.mjs`.
- `pnpm --filter @klinking/squircle exec vp test run`: 68 pass, 60 fail,
  15 failed snapshots, one passing and one failing file. The existing CSS utility
  output failures were not changed or re-snapshotted.
- `pnpm --filter @klinking/squircle exec vp run build`: **passes** in this
  installation. The historical task-runner picomatch failure was not reproduced.

## Real browser checks

T3 preview was used first, with separate owned demo/Studio tabs and explicit
tab IDs throughout. Initial connection refusal occurred before the demo server
was started; navigation succeeded after startup. Product checks used the actual
production Astro preview on port 4331 after the development audit.

Passed checks:

- Intro settles at 48. Rapid tenfold Next activation stops at 120. Immediate
  Back before a new animation frame returns to 48. Back also interrupts forward
  playback safely.
- Strength settles at 252. Pointer input and native ArrowRight update the range;
  focus and paused frame persist. Reset returns 2. A choice of 2.7 returns after
  correction/Back, with identical SVG markup at the strength frame.
- Once the correction sequence starts at 253, the outgoing range is disabled
  inside an inert block. Forward movement settles at 324 and focuses the reading
  container. Numeric track tests independently cover continuous restoration to 2.
- All seven settled scenes at **320, 390, 768, 960, 1280**: document overflow
  equals zero; copy ends before navigation; navigation stays inside the stage.
  At 320, strength copy ends 20.2 CSS pixels before navigation. Body text is
  about 17.3px and 64-unit controls display at 46.1px high. Vertical page scrolling
  is expected. Wide and compact layouts were also visually inspected.
- Copy selection works. Slider updates preserve focus. Changing compact/wide
  presets preserves the same composition DOM node, paused frame, choice, and
  slider focus. Resizing during forward playback reaches its intended stop and
  retains the choice.
- Explore hides/inerts the persistent Player, focuses its heading, accepts an
  independent amount of -1.3, and returns to the unchanged final SVG/frame 444.
  Back to strength restores 2.7. Explore has no page overflow at all five widths.
- A controlled `matchMedia` implementation installed before test hydration
  verifies reduced-motion changes during playback, direct settled navigation,
  focus, and remembered Back. This is a **simulation**, not OS/browser media
  emulation; the preview tools do not expose reduced-motion emulation.
- Both real Studio presets scrub directly to all seven reading frames and show
  the ten individual sequence tracks. Native range-key input works at frame
  252 in each. The wide Inspector default amount was changed to 2.7, reflected
  immediately in the slider, then restored to 2. Studio's source edit was checked.
  Composition discovery passes again after the Zod fix.

No custom ResizeObserver, Player remount strategy, second clock, or generic
animation framework was added. The only observer used during evaluation was a
temporary browser-test MutationObserver to inspect outgoing controls at 253;
it is not application code.

## Production bundle accounting

Exact bytes from the final `website/dist/_astro` files. Gzip uses Node 24's
`node:zlib.gzipSync(buffer)` defaults (zlib `1.3.1-e00f703`), independently per
file. Use this method consistently when comparing engines; build-log gzip
estimates use different compression and are not the figures below.

| Asset | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| GuidedExplorer.DOX9Mxnm.js (tour, Remotion, geometry, Explore) | 366,676 | 113,386 |
| client.B-V6xTFL.js (shared Astro React client/ReactDOM) | 180,543 | 56,446 |
| react-dom.DefXh2jo.js (shared React/ReactDOM exports) | 10,997 | 3,902 |
| jsx-runtime.CZc1cyaE.js (shared JSX runtime) | 424 | 298 |
| chunk.r_4oBX0g.js (shared module helpers) | 558 | 356 |
| Shared JavaScript subtotal | 192,522 | 61,002 |
| Tour plus shared JavaScript | 559,198 | 174,388 |
| index.DpbddUMW.css (site CSS, separate) | 29,408 | 5,767 |

The unrelated DemoEmbed chunk (417 raw / 331 gzip) is excluded. HTML and Astro's
inline hydration bootstrap are excluded; this is emitted asset accounting,
not a network waterfall or engine-only tree-shaken package size. Studio/CLI and
Zod are development dependencies and absent from this production import graph.

Reproduce after `astro build`:

```sh
node --input-type=module - <<'JS'
import {readFileSync, readdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
for (const name of readdirSync('website/dist/_astro')) {
  const bytes = readFileSync('website/dist/_astro/' + name);
  console.log(name, bytes.length, gzipSync(bytes).length);
}
JS
```

## Evaluation servers and authoring limits

Servers are left running:

- Production demo: `http://localhost:4331/tour`, started with
  `pnpm --filter website exec astro preview --host 127.0.0.1 --port 4331`.
- Studio: `http://localhost:3011/Tour-compact` and `/Tour-wide`, started with
  `pnpm --filter website exec remotion studio src/remotion/index.ts --port 3011 --no-open`.

One persistent Player uses one frame timeline and native sequences. Controller
state holds the requested destination, moving gate, tour choice, and separate
Explore session. Pure geometry tracks combine frame and explicit choice;
authored compact/wide presets use matchMedia and Remotion's own scaling.

Studio is a continuous authoring preview, not the website's checkpoint
controller. Its transport scrubs/plays the timeline; embedded Next/Back are
disabled there. Retiming checkpoints/geometry remains a source operation, and
visual trim edits do not update those source tables automatically. Live slider
edits are preview state; Inspector default props are serializable source edits.
See [tour authoring](tour-authoring.md) for the workflow.

Browser coverage is Chromium on this host, not Safari/Firefox or physical touch
devices. Reduced motion was simulated as described above. Automated video
export is outside this interactive-tour task; CLI composition discovery and
actual Studio previews were verified.
