# Pill max radius

## Goal

Let a pill stop getting rounder past a given radius, so a composer whose
textarea grows to several lines becomes a rounded rectangle with the one-line
pill's corners, rather than a blob.

Below the limit nothing changes. Past it, each corner turns from the pill's
cap into a superellipse corner as the box grows:

- smoothly: the shape is continuous in the box's size, and at the limit it is
  exactly today's pill;
- keeping the pill's continuity, G3 or G2, along the whole corner and where it
  meets the straight edges;
- keeping the flat edge where the cap ends it: the arc gives way, the edge
  setback doesn't;
- ending, once the box is tall enough, on a symmetric superellipse corner whose
  two sides are identical;
- and staying exactly as round as the cap all the way.

## Utilities

| Utility               | Sets                         |
| --------------------- | ---------------------------- |
| `squircle-pill-max-*` | `--squircle-pill-max-radius` |

It's a modifier, written alongside `squircle-pill` like the setback knobs, and
like them it only sets the property. It isn't limited to pills, so it can also
go on an ancestor to limit every pill inside.

It takes:

- the radius theme keys `rounded-*` takes: `-max-lg`, `-max-3xl`, and any
  `--radius-*` added in `@theme`;
- arbitrary lengths and expressions: `-max-[26px]`, `-max-[1.625rem]`,
  `-max-[calc(…)]`;
- variable refs: `-max-(--field-radius)`;
- `-max-none` and `-max-full`, both meaning no limit. `none` reads as it does in
  `max-w-none`, `full` as `rounded-full`'s radius; both set
  `calc(infinity * 1px)`. They're how a limit is lifted at a breakpoint or in a
  variant: `md:squircle-pill-max-none`.

Bare numbers (`-max-6`) and arbitraries that aren't lengths (`-max-[50%]`,
`-max-[foo]`) produce nothing.

## The property

```css
@property --squircle-pill-max-radius {
  syntax: "<length>";
  initial-value: calc(infinity * 1px);
  inherits: true;
}
```

- A `<length>`, so `rem`, `em`, `lh` and `calc()` resolve to px before the
  worklet or the polyfill reads it. Percentages aren't accepted: the fallback
  and the drawing would take them as percentages of different things.
- It inherits, and unlike the side it isn't reset on each pill: set on an
  ancestor, it limits every pill inside, as the setbacks do. A pill nested in a
  limited one — a send button in a composer — is shorter than twice the limit,
  so it isn't affected.
- `calc(infinity * 1px)` is no limit, the value `rounded-full` uses. It computes
  to the largest length the engine holds (about 3.4e7px in Chromium), which no
  pill reaches.
- Every `var()` of it in the stylesheet carries `calc(infinity * 1px)` as its
  fallback too, so an engine that rejected the registration would still draw
  full pills, not square ones.
- Its readers, the worklet and the polyfill, take it in px. Anything that isn't
  a finite number is no limit; a negative value is 0.

`variants.ts` gains `PILL_MAX_RADIUS_VAR_NAME` and `DEFAULT_PILL_MAX_RADIUS`
(`Infinity`), namespaced like the other names; the worklet keeps its own copy,
`${NS}-max-radius`, as it does for the rest. `PILL_SHAPE_PROPERTIES` gains
`maxRadius: { name, default: Infinity }`, documented as px: write values with a
length unit, and `calc(infinity * 1px)` to lift the limit.

## CSS

### Fallback radius

Where the pill sets its stadium today, `border-radius: FULL_RADIUS`, it sets

```css
border-radius: var(--squircle-pill-max-radius, calc(infinity * 1px));
```

instead: in the `:where(&)` block with Tailwind, in the attribute rule
standalone. Each side's capped corners use the same expression in place of the
full radius, so `t` is `M M 0 0`, and so on, with `M` that expression. The max
utility sets no `border-radius` of its own, so it never competes with a side
utility over class order.

Below the limit the browser scales the radius down to the stadium, exactly as
it does now: when two radii on a side add up to more than the side, all of
them shrink by the same factor. Past the limit, the fallback is a rounded
rectangle at the max radius, which stands to the drawn corner as the stadium
stands to the pill today.

A max of `0` gives square corners. A negative one is invalid for
`border-radius` at computed-value time, so the fallback's radius is 0 too, and
the worklet clamps it to 0.

### Tailwind (`tailwind-pill.ts`)

`matchUtilities` gains `${prefix}-max`. Its values are `theme("borderRadius")`
without `none` and `full`, plus `none` and `full` mapped to
`calc(infinity * 1px)`. Arbitraries and `(--var)` refs pass when they are a
length (a number with a length unit) or an expression (`var(`, `calc(`, `min(`,
`max(`, `clamp(`), the test the setback utilities already use for theirs;
anything else produces no declarations.

### Standalone (`squircle-pill.css`)

The attribute rule and each side's rule (`data-squircle-pill="t"`, …) get the
same radius expressions. There's no attribute value for the limit: set
`--squircle-pill-max-radius` on the pill or an ancestor, inline or in any rule.

## Geometry (`pill-shape.worklet.ts`)

Both paint classes' `inputProperties` gain `--squircle-pill-max-radius`, read
by a `resolveMaxRadius(props)` as above.

### Terms

A corner is drawn as today's quadrant is: from where it leaves its short edge,
the edge the cap spans, to where it meets its long edge, in coordinates with
the box corner at the origin, x along the long edge and y along the short one.

- `longRoom` and `shortRoom`: how far along each edge the corner may reach.
  For a pill capped at both ends, half the long side and half the short side;
  for a side pill, see [Side pills](#side-pills).
- `m`: the max radius.
- `r = min(shortRoom, m)`: the cap's half-height.

### When the limit doesn't bind

If `r = shortRoom` — no limit, or one the box hasn't reached — the corner is
today's `fittedQuadrant`, computed and cached exactly as now. Existing pills
draw the same points and take the same paths, `traceBox` and the polyfill's
cached pieces included.

### The cap, the reach and the superellipse

Past the limit, `r < shortRoom`, the corner is built from two curves.

- **The cap:** today's quadrant for a cap of half-height `r`, with its easing
  fitted to `longRoom`: `fittedQuadrant(2 · longRoom, 2r, …)`. It runs from
  `(0, r)` to where its easing ends, `(X_cap, 0)`.
- **The reach,** `J = r · junctionRatio(β, q, continuity)` for the
  requested, unfitted easing: where the flat edge would start with room to spare. The ratio is
  already worked out and cached per request (`fitsAsAskedCache`).
- **The superellipse:** `((S − x) / S)^n + ((S − y) / S)^n = 1` for `x` and `y`
  in `[0, S]`, meeting both edges, with extent `S = min(J, longRoom)`.

The exponent `n` depends only on the request, the setbacks and the continuity,
so it is solved once and cached beside the setback solve.

- A corner's **roundness** is how far in from the box corner it reaches along
  the diagonal: the distance from the origin to its tangent line at 45°,
  `(x + y) / √2` at the point where its tangent has turned 45°. For a
  symmetric corner that is the distance to "the maximum pokage" the radius
  correction matches; it is just as well defined for the cap, which isn't
  symmetric.
- `n` makes a superellipse of extent `J` exactly as round as the unfitted cap:
  `n = −1 / log2(1 − d_cap / (√2 · J))`, with `d_cap` the cap's roundness, both
  worked out at `r = 1`. At the defaults, `n ≈ 3.51`.
- It is held at or above **3.25 with G3** and **2.25 with G2**. A superellipse
  meets a straight edge with G3 only for `n > 3`, and with G2 only for
  `n > 2`; where the floor applies, the grown corner is a little less round
  than the cap, never less smooth. Across arc setbacks of 30–60° and edge
  setbacks of 0.4–1.5, `n` ran from 3.3 to 5.2, so the floor is for the
  extremes.

### The blend

```
w = clamp((shortRoom − r) / (J − r), 0, 1)
corner(φ) = (1 − w) · cap(φ) + w · superellipse(φ)
```

for each tangent direction `φ`, from 0° (along the short edge) to 90° (along
the long edge), where `cap(φ)` and `superellipse(φ)` are each curve's point
whose tangent points that way.

- **Continuity.** Blending two convex curves at matching tangent directions
  blends their radii of curvature the same way, direction by direction. So the
  curvature is continuous wherever both curves' are, and so is its rate of
  change: the corner keeps the cap's joins between arc and easing, and the
  superellipse's meetings with the straight edges, at the pill's continuity.
- **Extents.** The corner reaches `(1 − w) · X_cap + w · S` along the long
  edge and `(1 − w) · r + w · S` along the short one. With room to spare
  (`longRoom ≥ J`), both curves end on the long edge at `J`, so the flat edge
  starts at `J` at every height; and the short extent is exactly `shortRoom`
  until `w` reaches 1, so the corners meet their mirror images at the middle
  of the short side until then, and straight edges grow between them after.
- **Roundness.** The blend's roundness is the same blend of theirs, so with
  room to spare it equals the cap's at every height.
- **At the limit.** At `w = 0` the corner is the cap, so the shape is
  continuous there. Just past it, the curvature where the corners meet falls
  to zero over a very short stretch, as today's fit makes it do when a pill
  nears square.
- **Full growth.** At the defaults, `w` reaches 1 at a short side of `2J`,
  about 3.4 × the max radius.

The two curves, by tangent direction:

- `cap(φ)`: on the arc, `φ ≤ 90° − β`, it's `(R − R cos φ, r − R sin φ)`,
  with `R` the cap's arc radius, `radiusRatio · r`. On
  the easing, it's the transition's point where it has turned
  `φ − (90° − β)`, found from its profile's `remaining` samples, which are
  monotone, and placed with the Hermite interpolation `quadrant` already uses.
  A circular cap (exponent 1, or β = 0) is arc all the way.
- `superellipse(φ)`: with `u = atan(tan(φ)^(n / (2n − 2)))`, it's
  `(S − S cos^(2/n) u, S − S sin^(2/n) u)`.

Vertices are placed along the blend with `quadrant`'s chord-error bound
(`MAX_SAGITTA`), and the corner ends exactly at `(0, Y)` and `(X, 0)`.

### No easing

With either setback at zero, or a cap whose fit has made it circular, `J = r`
and there's nothing to blend: `w = 0` and the corner is the cap's arc of
radius `r`. A pill past its limit is then a plain rounded rectangle, matching
the stadium it already is.

### Constrained both ways

A square or near-square box past its limit has `longRoom < J` as well. The
cap is fitted to `longRoom` as today, and `S = longRoom`. Both curves fit the
box, so their blend does: `X ≤ longRoom` because both `X_cap` and `S` are, and
`Y ≤ shortRoom` because `S ≤ J`. The roundness dips below the cap's, as the
easing already shrinks for a pill near square, and at `w = 0` the corner is
still exactly the cap, so nothing jumps.

### Assembling the outline

`boxOutline`, `traceBox` and `outline` take the corner where they take the
quadrant today. The corner's short extent may now be less than half the short
side; mirrored, the gap between a corner and its image is a straight side,
which the polygon draws as one segment. The outline is still convex, so
`offsetOutline`, and with it every border, ring, outline and shadow, works
unchanged.

### Side pills

`sideOutline` builds its capped corners the same way. Each capped corner's
edges offer what they do today: the capped edge its length over the number of
capped corners on it, so half of it, and the square edge its whole length. The
larger offer is `longRoom` and the smaller `shortRoom`; with no limit, `r` is
the smaller, which is today's clamp.

Past the limit, each capped corner is the blend above, turned into place as
today's quadrant is, transposed when the capped edge offers more. A straight
edge runs on from it to the square corner, and from one capped corner to the
other where the capped edge has room. `squircle-pill-t` on a wide button with
a small max is a tab whose top corners ease into the top edge and into
straight sides running down to its square bottom corners.

### Caching

- `n` is cached per request, beside the setback solve.
- Blended corners are cached as quadrants are, keyed by `r`, the fitted
  easing, `w`, `S` and the continuity; `n` follows from the request.
- A corner with room to spare that has fully grown depends only on `r` and the
  request, so every taller box shares it.
- Fields grow a line at a time, so a page holds few corners. An animated height
  makes a new one each frame, at about the cost of a new quadrant today.

## Polyfill (`pill-polyfill.ts`)

- `PillShapeInput` gains `maxRadius`, a computed length. It's read from computed
  style with the other shape properties, on the same triggers, passed to the
  worklet's geometry through the lookup, and part of every cache key built from
  the shape.
- `PillGeometry` gains the methods the polyfill calls for the corner and the
  limit.
- `pillPath`'s fast path takes the corner from the same method as
  `boxOutline`. Its pieces already carry a step across the short axis where the
  two halves meet (`join`), which becomes one straight side; `Z` draws the
  other. The offset path expects `4n − 2` points when the corners meet and
  `4n` when a straight side separates them.
- Pieces are keyed by the short side as well as the offset and orientation: a
  fully grown corner is shared by boxes of every height, and the pieces' `y0`,
  `y1` and `join` depend on it.

## tailwind-merge (`tailwind.ts`)

One more group, `squircle-pill-max`, holding `squircle-pill-max-*`. Its members
cancel each other and nothing else, and nothing else cancels them, as with the
other knobs. The catch-all `squircle-*` group already leaves `pill…` classes
alone, so `-max-lg` isn't taken for a radius.

## Docs

The README's pill section gets:

- a row in the utility table for `squircle-pill-max-*`: what it limits, its
  values, `-max-none` and `-max-full`, and that it inherits, so it can be set
  on an ancestor;
- the fallback past the limit, a rounded rectangle at the max radius;
- in the standalone section, setting `--squircle-pill-max-radius`;
- `maxRadius` in the `PILL_SHAPE_PROPERTIES` sentence, and the new group in the
  merge-config paragraph;
- under "How pill shapes work", a paragraph on blending the cap into an
  equal-roundness superellipse.

## Demo (`website/src/pages/demos/pill-max-radius.astro`)

Built like `pill-gallery.astro`: off the site layout, with `?mode=` choosing the
worklet, the polyfill or the fallback, each loading the page afresh.

Sections, after the composer this was asked for:

- **Field × actions:** a row for an input and one for a textarea, against
  columns for no actions, a send button, and icons with a send button.
- **Grown textarea:** three lines in, with the actions at the end of the last
  line.
- **Stack:** the field over a row holding a "Model" chip and, in its own
  column, Send.
- **Height scrubber:** one field whose height a slider, and a play button,
  sweep from one line to five, so the growth between line steps shows.

Each composer is a bordered `squircle-pill` with a max radius; its send button
and chip are pills nested inside it. Every textarea grows as you type, with
`field-sizing: content`, and a small script setting the height where that isn't
supported.

The controls, an island built from `PillControls`:

- the max radius, a slider in px, plus none;
- the arc and edge setbacks, and G2 or G3;
- a toggle overlaying the fallback's rounded rectangle on each composer.

The max opens at half the one-line field's height, so one-line fields look
exactly as they do today. The demos index gains a card for the page.

## Testing

- **Geometry:**
  - With no limit, or a limit at or above half the short side, outlines are
    point for point today's, for wide, tall, square and side pills, with G2
    and G3.
  - Just past the limit, the outline converges on the one at it.
  - With room to spare, at every height: the flat edge starts at `J`, the
    roundness equals the cap's, and the short extent is exactly half the short
    side until full growth.
  - Fully grown, the corner is symmetric and lies on the superellipse.
  - Constrained both ways: inside the box, convex, and continuous at the limit.
  - Curvature, sampled along the corner, has no jumps and falls to zero at the
    straight edges; with G3, its rate of change has no jumps either.
  - `n` is about 3.51 at the defaults, and the floors apply when the solve falls
    under them.
  - Zero setbacks give a rounded rectangle, a max of 0 a rectangle, and a value
    that isn't a number no limit.
  - Side pills past the limit: the square corners are exactly the box's, the
    capped corners are as above, and the outline is convex.
- **CSS:**
  - Snapshots for the utility: theme keys, arbitraries, refs, `none` and
    `full`, and rejected values.
  - The stadium and side radii read the variable, with its fallback.
  - The registration, and the standalone sheet.
- **tailwind-merge:** `squircle-pill-max-*` classes cancel only each other.
- **Polyfill:** the property from computed style reaches the clip, a change of
  it changes the clip, and the fast path matches `pillOutlinePoints` for a pill
  with straight sides.
- **Browser (`package/tests`):** max-radius cases on the setbacks page, a box
  past its limit drawn by the worklet, the polyfill and the reference path; and
  the registered initial value computing to a length.

## Release

One PR into `alpha`, `feat(pill): keep corners round past a max radius with
squircle-pill-max-*`, with a release note naming the utility and the property.

## Out of scope

- Panda and StyleX, which have no pill support yet.
- A limit per corner or per axis.
- Easing the growth itself. The shape is continuous in the box's size, but the
  blend weight is linear in it, so the rate the shape changes at starts and
  stops at the limit and at full growth. Fields grow a line at a time, so
  that's not visible there; an animated height could ease it later.
