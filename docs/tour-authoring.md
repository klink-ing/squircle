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

## Change scenes and timing

`website/src/components/tour/timeline.ts` defines each scene's name, entrance frame, settled reading frame, and forward-button label. Frames start at zero; the next scene begins immediately after the preceding reading frame. `DURATION` follows the final checkpoint. The two format dimensions are also here.

`TourComposition.tsx` places content on native Remotion sequences. `TimedText` supplies a short entrance and exit relative to each sequence; headings span several body reveals. Keep each checkpoint after its entrances have finished. Allow enough overlap for an outgoing text block to exit while the next enters. Outgoing blocks become inert so invisible controls cannot retain keyboard interaction.

`graphic-state.ts` describes the authored numeric tracks using Remotion interpolation. `graphicAtFrame(frame, chosenAmount)` must return the same result for a direct seek and normal playback. Reuse the geometry in `website/src/math.ts`; do not capture a previous rendered frame to compute the next one.

The tour currently changes measurement radius continuously through the correction track. Its SVG measurement color follows that same correction amount.

## Add or move an interactive control

Place a normal React input between paragraphs, beside the diagram, or elsewhere inside the composition. Keep its value in `GuidedExplorer` and pass the value/callback through Player inputs so unmounting a sequence does not discard user choices. Controls can remain in ordinary DOM reading order.

The current strength slider is enabled at its settled checkpoint. It updates the diagram immediately while playback stays paused. Next eases the chosen strength back to the authored value of 2 during correction; Back restores the remembered choice. Reset returns the choice to 2. A new control needs an explicit policy for which scenes it influences and how that influence ends.

`GuidedExplorer.tsx` owns playback, remembered choices, and Explore. Forward navigation updates `outFrame` before playing; Remotion stops at that frame and emits `ended`. Back pauses and seeks directly. Repeated forward activation while moving is ignored. Reduced motion seeks directly to settled frames. Entering Explore hides the paused tour without unmounting the Player, and returning restores the final tour checkpoint.

## Test both formats

The compact stage is 400 × 840, capped at 440 CSS pixels wide. The wide stage is 960 × 560, selected at a 960-pixel viewport breakpoint. These are authored layouts, not continuous browser-width reflow. Vertical scrolling on the page is expected. There is no custom ResizeObserver.

Before extending copy or controls, check the longest scene at 320, 390, 768, and 1280 viewport widths. Check the actual displayed font and hit-target sizes, text selection, complete copy, keyboard navigation, and the absence of overlap or clipping. Resizing across the breakpoint must preserve the frame and user choice.

```sh
pnpm --filter website exec vp test run
pnpm --filter website exec tsc --noEmit
pnpm --filter website exec astro build
```

The website tests cover timeline boundaries, direct seeking, remembered exploration, and finite/continuous numeric tracks. Browser checks are still necessary for layout and event behavior. Root `ready` includes the website test and typecheck tasks; unrelated package/toolchain baseline failures are recorded in the implementation plan.
