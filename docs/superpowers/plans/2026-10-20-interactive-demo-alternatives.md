# Responsive interactive demo animation alternatives

For this tour, GSAP is the strongest alternative to Remotion's runtime model. Motion with Motion Studio is another credible option when editing animations visually on the real page matters. The comparison below is research, not an implemented engine switch.

The tour needs selectable responsive HTML, inputs interleaved with explanatory text, animated SVG geometry, reading checkpoints, remembered slider choices, backward navigation, and an Explore handoff. Video export is not a requirement. All candidates still need application state and an explicit policy for resuming from a user's chosen value.

## GSAP timelines with React

GSAP timelines provide named labels, seeking and reversing, `tweenTo()` for playing to a label and stopping, and `addPause()` for exact pause points. The React integration scopes selectors and cleans up animations. Normal CSS grid and container queries can lay out the DOM without video composition dimensions. [Timeline](https://gsap.com/docs/v3/GSAP/Timeline/), [checkpoint playback](https://gsap.com/docs/v3/GSAP/Timeline/tweenTo()/), [pause points](https://gsap.com/docs/v3/GSAP/Timeline/addPause()/), [React integration](https://github.com/greensock/react)

This would remove Player scaling and format selection and give checkpoint playback a direct library API. We would still own content visibility, focus, slider state, and the bridge from animated numeric values to the SVG renderer. React and GSAP must not both write the same style or SVG attribute. A migration would replace controller/choreography code while retaining content, controls, math, and much of the graphic renderer.

GSDevTools offers playback and scrubbing controls rather than a full keyframe authoring editor. GSAP uses a custom license rather than MIT; review its terms for the intended product. [GSDevTools](https://gsap.com/docs/v3/Plugins/GSDevTools/), [license](https://gsap.com/community/standard-license/)

## Motion sequences and Motion Studio

Motion's `useAnimate` can run a shared sequence across DOM, SVG, motion values, and JavaScript objects. Sequence labels and playback controls offer more coordination than the independent springs/presence components previously used in this repository. A return to Motion would therefore not necessarily recreate the previous architecture. [Animation API](https://motion.dev/docs/animate), [React sequence hook](https://motion.dev/docs/react-use-animate)

Motion Studio puts a visual timeline on the running website and documents support for Astro and hydrated React. Visual preview/editing is free; applying changes to source requires Motion+. Its integration with this repository's Astro version would need a small proof. [Studio documentation](https://motion.dev/docs/studio)

This avoids composition dimensions and supports native responsive page layout. It still needs a checkpoint controller and an interaction policy; its sequence API does not provide the same direct checkpoint methods as GSAP. The Motion runtime is MIT licensed. [License](https://github.com/motiondivision/motion/blob/main/LICENSE.md)

## Anime.js

Anime.js offers timelines, labels, seeking, reversing, callbacks, and scoped media-query behavior, plus React integration guidance. It can animate a normal responsive DOM. It would need roughly the same React state, geometry bridge, and checkpoint controller as Motion. It is a credible third option but offers less distinctive value here than GSAP's checkpoint APIs or Motion's website editor. [Timelines](https://animejs.com/documentation/timeline/), [React](https://animejs.com/documentation/getting-started/using-with-react/), [media queries](https://animejs.com/documentation/scope/scope-parameters/mediaqueries/)

## Theatre.js

Theatre.js provides visual authoring of values and sequence playback that can be bound to HTML or SVG. It has no requirement for a fixed video viewport, but introduces project/sheet/object bindings and exported animation data. That is a larger architectural change than the other candidates. Its release cadence and the separate licensing of core and Studio warrant closer evaluation before adopting it. [HTML and SVG workflow](https://www.theatrejs.com/docs/latest/getting-started/with-html-svg), [API](https://www.theatrejs.com/docs/latest/api/core), [repository](https://github.com/theatre-js/theatre)

## Recommendation for this repository

For a fresh implementation whose primary purpose is a responsive interactive explanation, start with GSAP and ordinary React/CSS. Evaluate Motion Studio if visual editing on the actual page is the priority. Both fit the browser layout problem more directly than Remotion.

Remotion remains reasonable when deterministic React rendering at arbitrary frames and its Studio workflow justify explicitly authored composition formats. The approved Remotion migration addresses the previous tour's history-dependent state and repeated Player remounts. Its pure graphic tracks and remembered choices can be reused in a later engine comparison; they are application behavior, not a reason to remain on a particular library.
