# Pill sides

## Goal

Let a pill cap one end only, so a button group can pill its first and last
items and leave the middle ones square. The pill keeps its eased caps; the end
that isn't capped gets plain right-angle corners.

## Utilities

| Utility                          | Caps                                                               |
| -------------------------------- | ------------------------------------------------------------------ |
| `squircle-pill`                  | The short ends, chosen from the aspect ratio (as today)            |
| `squircle-pill-x`                | Left and right                                                     |
| `squircle-pill-y`                | Top and bottom                                                     |
| `squircle-pill-t` `-r` `-b` `-l` | That end only                                                      |
| `squircle-pill-s` `-e`           | The inline-start or inline-end end; `l`/`r` in LTR, `r`/`l` in RTL |

The side utilities are modifiers, written alongside `squircle-pill` like the
`-amt-*`, `-ease-*` and `-g2`/`-g3` knobs. They don't combine: one side per
pill, and a later one replaces an earlier one.

`-x` and `-y` change nothing about the shape (see Geometry): they exist so the
axis can be spelled out in markup, and they set the same value `squircle-pill`
does.

## The side property

One registered property, `--squircle-pill-side`:

```css
@property --squircle-pill-side {
  syntax: "auto | t | r | b | l";
  initial-value: auto;
  inherits: true;
}
```

It inherits because the pseudo-elements that paint the pill read it, as they
do every other pill property. Each pill resets it to `auto` in the existing
zero-specificity `:where(&)` block, so a pill nested in a `pill-l` doesn't
inherit the parent's side, and any utility or rule that sets it wins whatever
the order.

`s` and `e` never reach the property: the utilities map them to `l`/`r`, and
under `:dir(rtl)` to `r`/`l`. The worklet only ever sees a physical side.

## CSS

### Fallback radius

`border-radius: FULL_RADIUS` moves from the pill rule into its `:where(&)`
block. Each side utility sets the radius of its own end, `FULL_RADIUS` on the
capped corners and `0` on the others, with one class's specificity, so it
always wins over the pill's own. `t` is `FULL FULL 0 0`, and so on.

With every capped radius at `FULL_RADIUS`, the browser scales them down to
exactly the radius the worklet clamps them to (see Geometry), so the fallback
and the drawn shape agree on every side.

### Tailwind (`tailwind-pill.ts`)

`addUtilities` gains `${prefix}-x`, `-y`, `-t`, `-r`, `-b`, `-l`, `-s` and
`-e`. Each sets `--squircle-pill-side` and `border-radius`; `-s` and `-e` add
an `&:dir(rtl)` rule with the mirrored values. The shared rules in
`pill-css.ts` hold the per-side values, so the Tailwind and standalone outputs
are generated from one table.

### Standalone (`squircle-pill.css`)

The side goes in the attribute's value: `data-squircle-pill="t"`, and `x`,
`y`, `r`, `b`, `l`, `s` and `e`. A bare `data-squircle-pill` stays the
automatic pill. Each value gets the same declarations as its utility, under
`[data-squircle-pill="t"]`, and so on. Setting `--squircle-pill-side` directly
also works, but only the attribute sets the fallback radius too.

## Geometry (`pill-shape.worklet.ts`)

`inputProperties` gains `--squircle-pill-side`. `boxOutline` reads it:

- `auto` takes today's path unchanged, so existing pills render the same, down
  to the cache keys. (`-x` and `-y` set `auto`.)
- A side takes a new path, `sideOutline`, built corner by corner.

### Why `-x` and `-y` are the automatic pill

A corner's radius is clamped (below) to the smaller of what its two edges can
give it. With caps on both ends of either axis, all four corners are capped,
and every corner's limit comes out as half the shorter side, which is
today's pill. `-x` on a tall element can't be wider than the element, so it
turns into the top-and-bottom stadium too, and a square is always a circle.

### Clamped radius

For a capped corner, each of its two edges offers its length divided by the
number of capped corners on it. The corner's radius is the smaller of the two:

```
r = min(edge_a / capped_on_a, edge_b / capped_on_b)
```

`-l` on a 200×40 box caps `tl` and `bl`: the left edge offers 40 / 2 = 20, the
top edge 200 / 1 = 200, so `r` = 20, the same as today's left cap. `-t` on the
same box caps `tl` and `tr`: the left edge offers 40 / 1 = 40, the top edge
200 / 2 = 100, so `r` = 40, a tab whose capped corners run the full height.

The smaller edge, the binding one, is used up entirely by the corner: either
the corner meets its mirror image halfway along it, or it meets the square
corner at its far end. So every capped corner is exactly today's quadrant:

- `fittedQuadrant(long, short, …)`, with `short = 2r` and
  `long = 2 × (the other edge's length / capped corners on it)`, which is the
  room the easing has along the other edge.
- The cap end of the quadrant lies on the binding edge, and the easing runs
  along the other edge.

On a tie (the binding edge offers the same as the other), the easing has no
room and the corner is a circular arc, as a square pill is today.

### Assembling the outline

Clockwise from the top-left corner. Each capped corner is its quadrant, moved
and reflected into place; when the binding edge is horizontal it is also
transposed. Each square corner is a single point. The result is convex, so
`offsetOutline`, and with it every border, ring, outline and shadow, works
unchanged.

`decorationDef` uses `boxOutline`, so decorations follow without changes.

## Polyfill (`pill-polyfill.ts`)

`pillOutlinePoints` duplicates the worklet's outline assembly. It moves into a
worklet method that both share. The polyfill reads `--squircle-pill-side` from
computed style with the other shape inputs, adds it to `PillShapeInput` and to
any cache key built from the shape, and passes it in.

`PILL_SHAPE_PROPERTIES` in `pill-worklet.ts` lists the new property and its
default.

## tailwind-merge (`tailwind.ts`)

One more group, `squircle-pill-side`, holding `-x`, `-y`, `-t`, `-r`, `-b`,
`-l`, `-s` and `-e`. Its members cancel each other and nothing else, and
nothing else cancels them, as with the other knobs.

## Docs

The README's pill section gets the side utilities, the standalone
`data-squircle-pill` attribute values, a button-group example, and one line
each on `-x`/`-y` being the automatic pill and on the clamp. Its copy of the
merge config gains the new group.

## Testing

- **Geometry:**
  - `auto` outlines unchanged for wide, tall and square boxes.
  - `t`, `r`, `b` and `l` on wide, tall and square boxes: the clamped radius
    from the formula; the square corners are exactly the box's corners; the
    outline is convex and stays inside the box.
  - `l` on a box wide enough for the requested easing matches the left half
    of the automatic pill.
- **Polyfill:** the side from computed style reaches the clip path, and a
  change of side changes it.
- **CSS:**
  - Snapshots for the new utilities, including the `:dir(rtl)` rules for `s`
    and `e`, and for the standalone attribute rules.
  - A pill nested in a side pill resets to `auto`.
  - A side utility's radius wins over the pill's, whichever is emitted first.
- **tailwind-merge:** side utilities cancel each other only.

## Out of scope

- Corners: a pill is capped by ends, and a single capped corner isn't one.
- Combining sides (`-t` with `-l`).
- Panda and StyleX, which have no pill support yet.
- Vertical writing modes for `s`/`e`: they follow `direction` only.
