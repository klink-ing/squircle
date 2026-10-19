# Pill Max Radius Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `squircle-pill-max-*` and `--squircle-pill-max-radius` stop a pill getting rounder past a radius, blending each corner from the pill's cap into an equal-roundness superellipse as the box grows.

**Architecture:** One new length property, read by the worklet's geometry (which the polyfill shares). A new worklet method `corner()` replaces `fittedQuadrant()` wherever outlines are built; below the limit it returns `fittedQuadrant()`'s own result, so existing pills are untouched. CSS fallbacks read the property for `border-radius`.

**Tech Stack:** TypeScript, Tailwind v4 plugin API, CSS Paint API worklet, Vitest (`vp test`), Playwright, Astro + React (site).

**Spec:** `docs/superpowers/specs/2026-10-19-pill-max-radius-design.md`

## Global Constraints

- Property: `--squircle-pill-max-radius` (namespaced via `pillVar("max-radius")`), `syntax: "<length>"`, `initial-value: calc(infinity * 1px)`, `inherits: true`, not reset per pill.
- Every `var()` of it carries `calc(infinity * 1px)` (`FULL_RADIUS`) as fallback.
- Readers: px; non-finite or unparseable → `Infinity`; negative → `0`.
- Exponent floors: `3.25` with G3, `2.25` with G2.
- `-max-none` and `-max-full` both set `calc(infinity * 1px)`.
- Below the limit (`r = shortRoom`) outlines are point-for-point today's.
- Run tests from `package/` with `npx vp test run <file>`; formatting and lint from the root with `npx vp fmt --check` and `npx vp lint`.
- Commits are GPG-signed; if signing fails in the sandbox, re-run the commit outside it. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Limit set on an ancestor, pill nested inside: limit applies (CSS test in Task 1, polyfill reads computed value in Task 5).
- `calc(infinity * 1px)` arriving as a huge finite px string (`3.35544e+07px`): treated as no limit, today's path (Task 3 test).
- Fully grown corner shared across heights must not reuse polyfill pieces built for another height (Task 5 test).
- Tall (vertical) pills past the limit: transposed outline still convex and inside the box (Task 4 test).
- Max radius of `0`: a rectangle, with no NaN points (Task 3 test).

---

### Task 1: Property, registration and fallback radii

**Files:**

- Modify: `package/src/variants.ts` (after `DEFAULT_PILL_SIDE`)
- Modify: `package/src/pill-css.ts` (`SIDE_RADII`, `pillPropertyRegistrations`, `pillCssObj`)
- Modify: `package/src/pill-worklet.ts` (`PILL_SHAPE_PROPERTIES`)
- Test: `package/src/tailwind-pill.test.ts`, `package/src/pill-polyfill.test.ts` (if it asserts `PILL_SHAPE_PROPERTIES`), standalone CSS test wherever `renderPillCss` is tested (`grep -rn renderPillCss src/*.test.ts`)

**Interfaces:**

- Produces: `PILL_MAX_RADIUS_VAR_NAME: string`, `DEFAULT_PILL_MAX_RADIUS = Infinity`, `PILL_MAX_RADIUS_CSS = \`var(${PILL_MAX_RADIUS_VAR_NAME}, ${FULL_RADIUS})\``(exported from`variants.ts`), `PILL_SHAPE_PROPERTIES.maxRadius = { name, default: Infinity }`.

- [ ] **Step 1: Write failing tests** in `tailwind-pill.test.ts`:
  - `"registers the max radius as an inherited length with no limit"`: `compilePillAll(["squircle-pill"])` contains `@property --squircle-pill-max-radius` with `syntax: "<length>"`, `initial-value: calc(infinity * 1px)`, `inherits: true`.
  - In "the stadium underneath": the pill's `:where(...)` block has `border-radius: var(--squircle-pill-max-radius, calc(infinity * 1px))` and no bare `border-radius: calc(infinity * 1px)`.
  - Update the `sides` `radii` table so `FULL` there is `PILL_MAX_RADIUS_CSS`: `t` → `${M} ${M} 0 0`, etc.
  - `"does not reset the max radius on each pill"`: the pill's `:where(...)` block does not contain `--squircle-pill-max-radius:`.
  - Standalone: `renderPillCss()` contains `border-radius: var(--squircle-pill-max-radius, calc(infinity * 1px))` in the `[data-squircle-pill]` rule and `M M 0 0` in `[data-squircle-pill="t"]`.
  - `PILL_SHAPE_PROPERTIES.maxRadius` deep-equals `{ name: "--squircle-pill-max-radius", default: Infinity }` (add next to the existing `PILL_SHAPE_PROPERTIES` assertion; `grep -rn PILL_SHAPE_PROPERTIES src/*.test.ts`).
- [ ] **Step 2: Run** `npx vp test run src/tailwind-pill.test.ts` — expect the new tests to FAIL.
- [ ] **Step 3: Implement.** Add the three exports to `variants.ts` with a doc comment like the side's. In `pill-css.ts`: `SIDE_RADII` uses `PILL_MAX_RADIUS_CSS` for capped corners; the registration as in Global Constraints; both `border-radius: FULL_RADIUS` sites in `pillCssObj` become `PILL_MAX_RADIUS_CSS`. Add `maxRadius` to `PILL_SHAPE_PROPERTIES` and mention the max utility in its doc comment.
- [ ] **Step 4: Run** `npx vp test run` (whole package) — expect PASS; update `__snapshots__` only where the change is the radius expression (`npx vp test run -u` then review the diff).
- [ ] **Step 5: Commit** `feat(pill): register --squircle-pill-max-radius and read it in the fallback radius`.

### Task 2: Tailwind utility and merge group

**Files:**

- Modify: `package/src/tailwind-pill.ts`
- Modify: `package/src/tailwind.ts` (`classGroups`, comment above `SIDE_CORNERS`)
- Test: `package/src/tailwind-pill.test.ts`, `package/src/tailwind-merge.test.ts`

**Interfaces:**

- Consumes: `PILL_MAX_RADIUS_VAR_NAME`, `FULL_RADIUS` from `variants.ts`.

- [ ] **Step 1: Write failing tests** in a new `describe("max radius")` in `tailwind-pill.test.ts`:
  - theme keys: `compilePill(["squircle-pill-max-lg", "squircle-pill-max-3xl"])` contains `--squircle-pill-max-radius: var(--radius-lg)` and `var(--radius-3xl)` (match whatever `theme("borderRadius")` yields — check with one console.log first, then pin it).
  - arbitraries and refs: `-max-[26px]` → `26px`; `-max-[1.625rem]` → `1.625rem`; `-max-[calc(1lh+12px)]` → `calc(1lh + 12px)`; `-max-(--field-radius)` → `var(--field-radius)`.
  - `-max-none` and `-max-full` → `calc(infinity * 1px)`.
  - rejected, each compiles to `""`: `-max-6`, `-max-[50%]`, `-max-[foo]`, `-max-[2]`.
  - sets nothing else: no `border-radius`, no `mask-image`, not wrapped in `:where(.squircle-pill)`.
  - custom prefix: with `prefix: "my-pill"`, `my-pill-max-lg` works (extend the existing "honours a custom prefix" test).
  - In `tailwind-merge.test.ts` under `squircle-pill`: `twMerge("squircle-pill-max-lg squircle-pill-max-[26px]")` → `"squircle-pill-max-[26px]"`; `twMerge("squircle-pill squircle-pill-max-lg squircle-pill-edge-setback-1 squircle-pill-l")` unchanged; `twMerge("squircle-pill-max-lg squircle-lg")` unchanged; `twMerge("squircle-pill-max-none md:squircle-pill-max-lg")` unchanged.
- [ ] **Step 2: Run** `npx vp test run src/tailwind-pill.test.ts src/tailwind-merge.test.ts` — FAIL.
- [ ] **Step 3: Implement** a third `matchUtilities` for `${prefix}-max` in `tailwind-pill.ts`, with `values: { ...radiusValues, none: FULL_RADIUS, full: FULL_RADIUS }` where `radiusValues` is `theme("borderRadius")` without `none`/`full` (as `tailwind.ts:58` does), and `type: ["length", "any"]`. The callback emits `{ [PILL_MAX_RADIUS_VAR_NAME]: value }` when `value` is a theme value, `FULL_RADIUS`, matches `/^[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?[a-z]+$/i` with a non-`%` unit, or the existing `expression` regex; otherwise `{}`. Add `[\`${PILL}-max\`]: [{ [\`${PILL}-max\`]: [() => true] }]`to`classGroups` and the max knob to the comment.
- [ ] **Step 4: Run** the two test files — PASS.
- [ ] **Step 5: Commit** `feat(pill): add squircle-pill-max-* and its merge group`.

### Task 3: Worklet corner geometry

**Files:**

- Modify: `package/src/pill-shape.worklet.ts`
- Create: `package/src/pill-shape.max-radius.test.ts`

**Interfaces:**

- Produces (methods on `paintDef`):
  - `resolveMaxRadius(props?: PaintProperties): number` — px; `Infinity` when missing, unparseable or non-finite; `Math.max(0, value)`.
  - `roundnessExponent(beta: number, q: number, continuity: Continuity): number` — cached per `${beta},${q},${continuity}`.
  - `corner(longRoom: number, shortRoom: number, maxRadius: number, angle: number, exponent: number, continuity?: Continuity): Point[]` — points from `(0, Y)` to `(X, 0)` in quadrant coordinates (x along the long edge).
- `MAX_RADIUS_VAR = \`${NS}-max-radius\``; `ROUNDNESS_FLOOR = { 2: 2.25, 3: 3.25 }`.

Algorithm for `corner` (from the spec, "Geometry"):

```
r = min(shortRoom, maxRadius)
if r >= shortRoom: return fittedQuadrant(2*longRoom, 2*shortRoom, angle, exponent, continuity)   // same cached array
if r <= 0: return [{x:0, y:0}]
cap = fittedQuadrant(2*longRoom, 2*r, …)   and its fitted {beta, q} from fitEasing(r, longRoom, …)
J = r * junctionRatio(angle, exponent, continuity)       // unfitted request; reuse fitsAsAskedCache
if angle <= 0 || exponent <= 1 || J <= r: w = 0          // no easing: arc of radius r, straight sides
w = clamp((shortRoom - r) / (J - r), 0, 1);  S = min(J, longRoom);  n = roundnessExponent(angle, exponent, continuity)
corner(φ) = (1-w)·capAt(φ) + w·seAt(φ), φ ∈ [0, π/2]
```

- `capAt(φ)` for the fitted cap (R = `transition(beta,q).radiusRatio · r`): arc `(R − R cos φ, r − R sin φ)` for `φ ≤ π/2 − beta`; otherwise the transition point where `remaining = (π/2 − φ)/beta`, located by binary search over the profile's `remaining` nodes and placed like `quadrant` places `at(k)` (fractional `k`, Hermite on `fresnel`). Circular cap (`q === 1` or `beta === 0`): arc with `R = r` all the way.
- `seAt(φ)`: `u = atan(tan(φ)^(n/(2n−2)))`, `(S − S·cos(u)^(2/n), S − S·sin(u)^(2/n))`; exact endpoints at φ = 0 and π/2.
- `roundnessExponent`: `d_cap` = `(x+y)/√2` of the unfitted cap at `r = 1`, `φ = π/4`; `J1 = junctionRatio(beta, q, continuity)`; `n = −1/log2(1 − d_cap/(√2·J1))`, then `max(n, ROUNDNESS_FLOOR[continuity])`; non-finite → the floor.
- Vertices: evaluate the blend at 1024 equal φ steps; keep the first and last, and keep a point whenever skipping it would let the chord from the last kept point stray more than `MAX_SAGITTA` from any skipped point. Cache the result in `quadrantCache` under `max:${r},${fitted.beta},${fitted.exponent},${w},${S},${continuity}`.

- [ ] **Step 1: Write failing tests** in `pill-shape.max-radius.test.ts` (geometry helper as in `pill-shape.sides.test.ts`; `const DEG45 = Math.PI / 4`; defaults resolved through `resolveSetbacks(props({}))`):
  - `"is today's quadrant below the limit"`: for `(200, 20)`, `(200, 26)` with `maxRadius` `Infinity`, `26`, `3.35544e7`: `corner(...)` is the very array `fittedQuadrant(400, 2*shortRoom, …)` returns (`toBe`).
  - `"solves the roundness exponent"`: defaults G3 → `toBeCloseTo(3.51, 1)`; `(beta=30°, q from edge 0.6035)` → between 3.25 and 3.4; G2 default → `≥ 2.25`; a request whose solve is under the floor (arc 45°, edge 0.05) → exactly `3.25`.
  - `"keeps the flat edge and the roundness while it grows"`: `m = 26`, `longRoom = 200`, `shortRoom` in `[26.5, 30, 35, 40, 44, 60]`: last point `x` equals `J` (≈ `1.697·26`, assert against `26 * junctionRatio(...)` within 1e-6); first point `y` equals `min(shortRoom, J)` within 1e-6; roundness `min over points of (x+y)/√2` within 0.01·m of the cap's (`shortRoom = 26` corner).
  - `"converges on the cap at the limit"`: max point-to-polyline distance between `shortRoom = 26.001` and `26` corners `< 0.01`.
  - `"ends on a symmetric superellipse"`: `shortRoom = 60`: every point `p` has a mirror `(p.y, p.x)` within 0.05 px of the polyline, and `((S−x)/S)^n + ((S−y)/S)^n` within 1e-3 of 1.
  - `"stays smooth"`: discrete curvature `Δθ/Δs` from the polyline (θ = segment direction) at `shortRoom` in `[30, 40, 60]`: no step between neighbours larger than 15 % of the max curvature, and the last segment's curvature `< 0.05/m`; repeat with continuity 2.
  - `"draws rounded rectangles without easing"`: arc `0deg` and edge `0`, `shortRoom = 60`: all points lie on the circle of radius 26 centred `(26, 26)` within 1e-6.
  - `"draws a rectangle at zero"`: `maxRadius = 0` → `[{x:0,y:0}]`; no `NaN` anywhere for `maxRadius = 1e-9`.
  - `"fits boxes constrained both ways"`: `longRoom = shortRoom = 30`, `m = 26`: all points within `[0,30]²`, convex, and at `30 → 26.001` converges as above.
  - `resolveMaxRadius`: `"26px"` → 26, `"3.35544e+07px"` → 33554400, `""`/`"foo"`/missing → `Infinity`, `"-4px"` → 0.
- [ ] **Step 2: Run** `npx vp test run src/pill-shape.max-radius.test.ts` — FAIL.
- [ ] **Step 3: Implement** the three methods and constants as above.
- [ ] **Step 4: Run** `npx vp test run src/pill-shape*.test.ts` — PASS (existing geometry tests unchanged).
- [ ] **Step 5: Commit** `feat(pill): blend corners past a max radius into an equal-roundness superellipse`.

### Task 4: Outlines and paint inputs

**Files:**

- Modify: `package/src/pill-shape.worklet.ts` (`inputProperties` of both classes, `boxOutline`, `traceBox`, `sideOutline`)
- Test: `package/src/pill-shape.max-radius.test.ts`

**Interfaces:**

- Consumes: `corner`, `resolveMaxRadius` (Task 3).

- [ ] **Step 1: Write failing tests** (`outline(width, height, side?, max?)` helper passing `MAX_RADIUS` through props):
  - `"reads the max radius"`: `paintDef.inputProperties` and `decorationDef.inputProperties` include `--squircle-pill-max-radius`.
  - `"leaves pills under their limit alone"`: for `(120,40)`, `(40,120)`, `(40,40)`, sides `t r b l` on `(120,40)` and `(40,120)`: outline with max `"20px"` and `"100px"` deep-equals the outline with none.
  - `"grows straight sides past the limit"`: `(400, 120)`, max `26px`: convex, inside the box, has points `(0, y)` for some `y` in `(40, 80)` only as the two ends of one straight segment, symmetric about both centre lines.
  - `"turns tall pills"`: `(120, 400)` max `26px` equals `(400,120)`'s outline transposed (as point sets).
  - `"traces what it lists"`: a recording `ctx` (`moveTo`/`lineTo` into an array) passed to `traceBox(ctx, 400, 120, props)` gives the same points as `boxOutline`.
  - `"limits side caps"`: `t` on `(400, 40)` with max `10px`: points `(0,40)` and `(400,40)` present (square corners), convex, top corners each match `corner(…)` placed and transposed; with max `"100px"` equals today's.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Add `MAX_RADIUS_VAR` to both `inputProperties`. In `boxOutline`/`traceBox`, replace `fittedQuadrant(long, short, …)` with `corner(long/2, short/2, this.resolveMaxRadius(props), …)`. In `sideOutline`, compute `capped = h/2`, `square = w`, `longRoom = max`, `shortRoom = min`, call `corner(longRoom, shortRoom, max, …)`, and transpose + reverse exactly when `h/2 > w` as today; the `left` assembly is unchanged.
- [ ] **Step 4: Run** `npx vp test run` — PASS.
- [ ] **Step 5: Commit** `feat(pill): draw pills and side pills with a max radius`.

### Task 5: Polyfill

**Files:**

- Modify: `package/src/pill-polyfill.ts` (`PillShapeInput`, `PillGeometry`, every `lookup({...})` of shape props, `pillPath`, `makePieces`, settings read near line 700)
- Test: `package/src/pill-polyfill.test.ts`, `package/src/pill-polyfill.dom.test.ts`

**Interfaces:**

- Consumes: `corner`, `resolveMaxRadius`, `PILL_MAX_RADIUS_VAR_NAME`.
- Produces: `PillShapeInput.maxRadius?: string`.

- [ ] **Step 1: Write failing tests:**
  - `pillOutlinePoints(400, 120, { maxRadius: "26px" })` equals `boxOutline` with the same props (de-duplicated as the function does) and differs from `{}`.
  - `pillOutlinePath` (fast path) for `(400,120)`, `(400,140)`, `(400,160)` with `maxRadius: "26px"`, distances `0` and `2`: parses to the same points as `pillOutlinePoints` (and its offset) within 0.01 — the 140/160 cases share one fully grown corner and must still each get their own height.
  - DOM test: a pill inside `<div style="--squircle-pill-max-radius: 12px">` sized 300×100 under `polyfillPills({force:true})` gets a clip different from the same pill without the ancestor variable; changing the ancestor's inline variable and calling `refresh()` changes the clip.
- [ ] **Step 2: Run** `npx vp test run src/pill-polyfill*.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Add `maxRadius` to `PillShapeInput` and to every shape `lookup` as `[PILL_MAX_RADIUS_VAR_NAME]: shape.maxRadius`; read it with `style.getPropertyValue(PILL_MAX_RADIUS_VAR_NAME)` in settings; add `corner`/`resolveMaxRadius` to `PillGeometry`. `pillPath` takes `geometry.corner(long/2, short/2, geometry.resolveMaxRadius(props), …)`. In `makePieces` accept `moved.length` of `4n − 2` or `4n` (the latter when `quadrant[0].y < short/2 − 1e-6`). Key pieces by `${distance},${vertical},${short}`.
- [ ] **Step 4: Run** `npx vp test run` — PASS.
- [ ] **Step 5: Commit** `feat(pill): polyfill pills with a max radius`.

### Task 6: Browser check

**Files:**

- Modify: `package/tests/setbacks.ts`, `package/tests/browser/setbacks.spec.ts`

- [ ] **Step 1:** Extend `setSetbacks(arc, edge, degrees, width, height = 40, max = "")`: sets `--squircle-pill-max-radius` on the fixture (empty → removed), button heights, the reference `<svg>`'s height/viewBox, `pillOutlinePoints(width, height, { …, maxRadius: max || undefined })`, and for `native` a `<rect rx>` of `min(max, height/2)`.
- [ ] **Step 2:** Add cases to the spec's table: `["45deg", "0.75", 45, 160, 80, "16px"]`, `["45deg", "0.75", 45, 160, 50, "16px"]`, `["30deg", "1", 30, 60, 60, "16px"]`; plus a test that `getComputedStyle(button).getPropertyValue("--squircle-pill-max-radius")` ends in `px` and parses above 1e6 when unset.
- [ ] **Step 3: Run** `npx vp run build` then `npx playwright test -c tests/playwright.config.ts tests/browser/setbacks.spec.ts` — PASS for worklet, polyfill and native.
- [ ] **Step 4: Commit** `test(pill): compare max-radius pills across renderers`.

### Task 7: README

**Files:**

- Modify: `README.md` (pill section; run `bash scripts/sync-readme.sh` if the package README is synced from it — check `scripts/`)

- [ ] **Step 1:** Add, per the spec's "Docs": a table row for `squircle-pill-max-*` (values, `-max-none`/`-max-full`, inherits so it can go on an ancestor); a sentence in "Fallback" on the rounded rectangle past the limit; in "Without Tailwind" setting `--squircle-pill-max-radius`; `maxRadius` beside `PILL_SHAPE_PROPERTIES`; `squircle-pill-max` in the merge-config paragraph; a paragraph in "How pill shapes work" on the blend into an equal-roundness superellipse (roundness = distance to the 45° tangent, `n ≈ 3.5` at the defaults, floors 3.25/2.25).
- [ ] **Step 2: Run** `npx vp fmt README.md` from the root and `npx vp test run` (README tests, if any).
- [ ] **Step 3: Commit** `docs(pill): document squircle-pill-max-*`.

### Task 8: Demo page

**Files:**

- Create: `website/src/pages/demos/pill-max-radius.astro`
- Create: `website/src/components/PillMaxRadiusControls.tsx`
- Modify: `website/src/pages/demos/index.astro` (card)
- Modify (only if needed): `website/src/components/PillControls.tsx` to export reusable sliders

- [ ] **Step 1:** Build the page like `pill-gallery.astro` (no site layout; `?mode=worklet|polyfill|native` nav; same worklet/polyfill registration). Sections, all composers `squircle-pill border border-zinc-300 bg-white` with `--squircle-pill-max-radius` from the controls:
  - Field × actions: rows input/textarea × columns none / send / icons + send (send is a nested `squircle-pill` button, icons are inline SVG buttons).
  - Grown textarea (three lines prefilled, actions bottom-right).
  - Stack: textarea over a row with a `squircle-pill` "Model" chip and Send in its own column.
  - Height scrubber: one composer whose height a range input (1–5 lines) and a Play button animate.
  - Textareas use `field-sizing: content`; where `CSS.supports("field-sizing", "content")` is false, an `input` listener sets `height = scrollHeight`.
- [ ] **Step 2:** `PillMaxRadiusControls.tsx` (React island, `client:load`): max radius slider (px, 8–80, plus a "None" checkbox writing `calc(infinity * 1px)`), arc/edge setback sliders and G2/G3 via `PillControls`' `Slider` and `shapeStyle`, and a "Show fallback" toggle that adds an absolutely positioned outline `<div>` with `border-radius: var(--squircle-pill-max-radius)` over each composer. All settings are written as custom properties on the page root. Default max: half the one-line composer's measured height.
- [ ] **Step 3:** Add a card to `demos/index.astro`: title "Pill max radius", text "Keep a growing composer's corners round: pills that stop getting rounder past a radius, in Tailwind, the polyfill and the fallback."
- [ ] **Step 4: Run** `npx vp run build` in `package/`, then the site build (`npx vp build` in `website/`) — no errors; then `npx vp dev` in `website/`, open `/demos/pill-max-radius` and check each mode by eye (screenshot with Playwright).
- [ ] **Step 5: Commit** `feat(demo): add the pill max radius demo`.

### Task 9: Finish

- [ ] **Step 1: Run** from the root: `npx vp fmt --check`, `npx vp lint`, `npx vp run @klinking/squircle#typecheck`, `cd package && npx vp test run` — all PASS.
- [ ] **Step 2:** Push `feat/pill-max-radius` and open a PR into `alpha` titled `feat(pill): keep corners round past a max radius with squircle-pill-max-*`, assigned to `@dogmar`, body: what/why, test plan, and

  ```md
  ## Release note

  Pills can stop getting rounder past a radius: `squircle-pill-max-*` (or `--squircle-pill-max-radius`) keeps a growing field's corners as round as its one-line cap, easing them into a superellipse as it grows.
  ```

- [ ] **Step 3:** Link the PR to the thread.
