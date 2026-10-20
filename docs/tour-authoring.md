# Guided tour authoring

The `/tour` page uses one persistent Remotion Player. Narrative text, the SVG diagram, and inline controls share its timeline. There is no portal, accumulated graphic-state replay, or Player remount between scenes.

## Run the tour and Studio

Use the workspace tasks from the repository root:

```sh
pnpm exec vp run website#dev
pnpm exec vp run website#studio
```

Both build the Tailwind package first. Studio has `Tour-compact` and `Tour-wide` compositions. The webpage passes the shared component directly to its Player. Studio's default `amount` prop is serializable; its adapter supplies a live slider callback for interactive previews.

If the existing workspace task runner hits its `picomatch` resolution issue, the local package and website binaries also work directly:

```sh
pnpm --filter @klinking/squircle exec vp pack
pnpm --filter @klinking/squircle exec tsx scripts/generate-squircle-css.ts
pnpm --filter website exec astro dev
pnpm --filter website exec remotion studio src/remotion/index.ts
```

For the isolated Remotion comparison, use `astro preview --host 127.0.0.1 --port 4331`
after building, and `remotion studio src/remotion/index.ts --port 3011 --no-open`.
The running comparison URLs are `http://localhost:4331/tour` and
`http://localhost:3011/Tour-compact` (also `/Tour-wide`).
Install dependencies before starting Studio; restart it after adding a dependency.
Zod 4.5.4 is an explicit development dependency matching Remotion 4.0.537.
`remotion versions` should report all versions correct.

## Change scenes and timing

`website/src/components/tour/timeline.ts` defines each scene's name, entrance frame, settled reading frame, and forward-button label. Frames start at zero; the next scene begins immediately after the preceding reading frame. `DURATION` follows the final checkpoint. The two format dimensions are also here.

`TourComposition.tsx` declares ten native `Sequence` elements at distinct source
locations: three headings and seven body reveals. This matters in Studio: putting
`Sequence` inside one reusable wrapper or map groups the clips as programmatically
duplicated instances, hiding their individual tracks. Keep the literal sequence
declarations when adding content. `Reveal` supplies a 24-frame entrance and
18-frame exit using sequence-local frames; headings span several body reveals.
Keep its `length` equal to its containing sequence's `durationInFrames`.
Keep each checkpoint after its entrances have finished. Outgoing blocks and the
fully transparent first entrance frame are inert and hidden from accessibility.

Retiming is a source-authoring operation: edit `timeline.ts`, then adjust numeric
tracks in `graphic-state.ts` when needed. The sequence expressions follow those
checkpoints. Studio exposes individual clips, source locations, playback, and
scrubbing; its visual trim/metadata edits can replace expressions with literals.
It does not synchronize a visual trim back into the checkpoint table or the
graphic tracks. Review such edits before keeping them.

In Studio, click the current time/frame readout at the lower left (or View → Go
to frame), enter a frame, and press Enter. The seven reading frames are 48, 120,
192, 252, 324, 384, and 444. At 252 the live slider and Reset work. The Inspector's
`amount` default prop has a schema limiting it to 1–3 in steps of 0.1; use it to
author a reproducible nondefault choice for seeking/rendering. Live slider edits
belong to the preview session and do not save themselves to `defaultProps`.
The composition's Next/Back buttons are intentionally disabled in Studio; use
Studio's transport to inspect the continuous timeline. The website controller
provides reading pauses and Explore.

`graphic-state.ts` describes the authored numeric tracks using Remotion interpolation. `graphicAtFrame(frame, chosenAmount)` must return the same result for a direct seek and normal playback. Reuse the geometry in `website/src/math.ts`; do not capture a previous rendered frame to compute the next one.

The tour currently changes measurement radius continuously through the correction track. Its SVG measurement color follows that same correction amount.

## Add or move an interactive control

Place a normal React input between paragraphs, beside the diagram, or elsewhere inside the composition. Keep its value in `GuidedExplorer` and pass the value/callback through Player inputs so unmounting a sequence does not discard user choices. Controls can remain in ordinary DOM reading order.

The current strength slider is enabled at its settled checkpoint. It updates the diagram immediately while playback stays paused. Next eases the chosen strength back to the authored value of 2 during correction; Back restores the remembered choice. Reset returns the choice to 2. A new control needs an explicit policy for which scenes it influences and how that influence ends.

`GuidedExplorer.tsx` owns playback, remembered choices, and Explore. Forward
navigation updates `outFrame` before playing; Remotion stops at that frame and
emits `ended`. Back uses the requested destination, so it can interrupt even
before the first forward animation frame. It pauses and seeks directly. Repeated
forward activation while moving is ignored. Reduced motion seeks directly to
settled frames, including when the preference changes during playback. Requested
navigation focuses the persistent reading-heading container after settlement;
initial playback and slider updates do not steal focus. Entering Explore hides
the paused tour without unmounting the Player, and returning restores the final
tour checkpoint.

## Test both formats

The compact stage is 400 × 840, capped at 440 CSS pixels wide. The wide stage is 960 × 560, selected at a 960-pixel viewport breakpoint. These are authored layouts, not continuous browser-width reflow. Vertical scrolling on the page is expected. There is no custom ResizeObserver.

Before extending copy or controls, check all seven scenes at 320, 390, 768, 960,
and 1280 viewport widths. At 320 the compact body text displays at about 17.3px,
button text at 15.8px, and 64-unit controls at 46.1px high. Check text selection,
complete copy, keyboard navigation, and the absence of overlap or clipping.
Resizing across the breakpoint must preserve the Player, frame, choice, and
slider focus.

```sh
pnpm --filter website exec vp test run
pnpm --filter website exec tsc --noEmit
pnpm --filter website exec astro build
```

The eight website tests cover timeline boundaries, direct seeking, remembered
exploration, finite/continuous numeric tracks, native composition rendering at
every stop, outgoing accessibility/control gates, immediate Back availability,
and interleaved control order. Browser checks remain necessary for playback,
focus, and layout. See [Remotion verification](tour-remotion-verification.md) for
the exact comparison audit, bundle accounting, and remaining baseline failures.
