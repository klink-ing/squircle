/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

/**
 * Demo only; not part of the package.
 *
 * A second paint worklet, `pill-fillet`, that draws the same pill as the
 * shipped `pill-shape` worklet but builds the arc-to-edge join the way CAD
 * fillet tools build a curvature-continuous fillet: as a polynomial Hermite
 * blend between the two curves, with position, tangent and — for G2 and
 * above — curvature prescribed at both ends. That is the construction behind
 * SolidWorks' and Onshape's "curvature continuous" fillets, Fusion's G2
 * fillet, and Rhino's BlendCrv, and the knobs those tools expose map onto the
 * properties this worklet reads:
 *
 *   --fillet-continuity    1 | 2 | 3 — G1 (cubic), G2 (quintic), G3 (septic).
 *                          Rhino's continuity picker; SolidWorks/Onshape offer
 *                          G1 (circular) and G2 (curvature continuous).
 *   --fillet-arc-setback   Degrees of the semicircle replaced by the blend.
 *                          The "distance" along the first face of an
 *                          asymmetric fillet.
 *   --fillet-edge-setback  How far along the flat edge the blend ends, in
 *                          multiples of the cap's half-height. The second
 *                          distance of an asymmetric fillet.
 *   --fillet-bulge-start   Handle length at each end, as a multiple of the
 *   --fillet-bulge-end     chord. Rhino's per-end bulge sliders; the same
 *                          role as SolidWorks' and Onshape's rho (ρ), which
 *                          also sets how full the blend is.
 *
 *   --fillet-fit           1 (default) shrinks the cap radius until the blend
 *                          stays inside the box, the way the shipped worklet
 *                          fits its easing. 0 keeps the cap at full radius,
 *                          as a CAD fillet would keep a dimensioned radius,
 *                          and the blend bows out past the box to ease off it.
 *
 * Plain JS rather than TS so the same file can be imported for its geometry
 * and handed to `CSS.paintWorklet.addModule()` by URL, in dev and in the
 * built site alike.
 */

const CONTINUITY_VAR = "--fillet-continuity";
const ARC_SETBACK_VAR = "--fillet-arc-setback";
const EDGE_SETBACK_VAR = "--fillet-edge-setback";
const BULGE_START_VAR = "--fillet-bulge-start";
const BULGE_END_VAR = "--fillet-bulge-end";
const FIT_VAR = "--fillet-fit";

const BLEND_SAMPLES = 96;
/** Arc step, in radians: a constant radius needs no adaptive sampling. */
const ARC_STEP = Math.PI / 90;

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ get(name: string): { toString(): string } | undefined }} PaintProperties
 * @typedef {{
 *   continuity: 1 | 2 | 3,
 *   arcSetback: number,
 *   edgeSetback: number,
 *   bulgeStart: number,
 *   bulgeEnd: number,
 *   fit: boolean,
 * }} FilletParams
 * @typedef {{
 *   arc: Point[],
 *   blend: Point[],
 *   controls: Point[],
 *   edgeStart: number,
 *   capRadius: number,
 * }} FilletQuadrant
 */

/** @type {FilletParams} */
export const DEFAULT_FILLET = {
  continuity: 2,
  arcSetback: Math.PI / 6,
  edgeSetback: 1,
  bulgeStart: 1,
  bulgeEnd: 1,
  fit: true,
};

/**
 * @param {PaintProperties | undefined} props
 * @param {string} name
 * @param {number} fallback
 */
const number = (props, name, fallback) => {
  const raw = Number.parseFloat(props?.get(name)?.toString() ?? "");
  return Number.isFinite(raw) ? raw : fallback;
};

/**
 * @param {PaintProperties} [props]
 * @returns {FilletParams}
 */
export function readParams(props) {
  const continuity = /** @type {1 | 2 | 3} */ (
    Math.min(Math.max(Math.round(number(props, CONTINUITY_VAR, 2)), 1), 3)
  );
  const degrees = Math.min(Math.max(number(props, ARC_SETBACK_VAR, 30), 0), 89);
  return {
    continuity,
    arcSetback: (degrees * Math.PI) / 180,
    edgeSetback: Math.max(number(props, EDGE_SETBACK_VAR, 1), 0),
    bulgeStart: Math.max(number(props, BULGE_START_VAR, 1), 0.05),
    bulgeEnd: Math.max(number(props, BULGE_END_VAR, 1), 0.05),
    fit: number(props, FIT_VAR, 1) >= 0.5,
  };
}

/** @type {(a: Point, b: Point) => Point} */
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
/** @type {(a: Point, k: number) => Point} */
const scale = (a, k) => ({ x: a.x * k, y: a.y * k });

/**
 * Derivatives, up to third order, of a curve leaving a point along unit
 * tangent `T` at speed `s` with curvature `k` and curvature rate zero. `N` is
 * the normal `T` turns towards. Arc-length parametrised and then rescaled, so
 * the speed is constant and the second derivative is pure normal.
 *
 * @param {Point} T
 * @param {number} k
 * @param {number} s
 * @returns {[Point, Point, Point]}
 */
function endDerivatives(T, k, s) {
  const N = { x: -T.y, y: T.x };
  return [
    scale(T, s),
    scale(N, s * s * k),
    // d/ds of (k N) with k' = 0 is -k^2 T.
    scale(T, -(s ** 3) * k * k),
  ];
}

/**
 * Control points of the degree-(2m+1) Bézier curve that interpolates the
 * given derivatives at both ends — the Hermite blend. Forward differences at
 * the start, backward at the end: Δ^j P_0 = C^(j)(0) · (n-j)! / n!.
 *
 * @param {Point} P0
 * @param {Point} T0
 * @param {number} k0
 * @param {number} s0
 * @param {Point} P1
 * @param {Point} T1
 * @param {number} k1
 * @param {number} s1
 * @param {1 | 2 | 3} m
 * @returns {Point[]}
 */
export function blendControlPoints(P0, T0, k0, s0, P1, T1, k1, s1, m) {
  const n = 2 * m + 1;
  /** @type {(P: Point, derivs: [Point, Point, Point]) => Point[]} */
  const fromEnd = (P, [first, second, third]) => {
    const d1 = scale(first, 1 / n);
    const d2 = scale(second, 1 / (n * (n - 1)));
    const d3 = scale(third, 1 / (n * (n - 1) * (n - 2)));
    const p1 = add(P, d1);
    const p2 = add(add(scale(p1, 2), scale(P, -1)), d2);
    const p3 = add(add(add(scale(p2, 3), scale(p1, -3)), P), d3);
    return [P, p1, p2, p3].slice(0, m + 1);
  };

  const head = fromEnd(P0, endDerivatives(T0, k0, s0));
  // The curve run backwards: odd derivatives flip sign, even ones do not.
  const [first, second, third] = endDerivatives(T1, k1, s1);
  const tail = fromEnd(P1, [scale(first, -1), second, scale(third, -1)]);
  return [...head, ...tail.reverse()];
}

/**
 * De Casteljau.
 *
 * @param {Point[]} controls
 * @param {number} t
 * @returns {Point}
 */
export function bezierPoint(controls, t) {
  let pts = controls;
  while (pts.length > 1) {
    /** @type {Point[]} */
    const next = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      next.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    pts = next;
  }
  return pts[0];
}

/** How far below the box the cap radius may be shrunk, as a share of `r`. */
const MIN_FIT_RADIUS = 0.3;
/** How far past the box edge a fitted blend may stray, as a share of `r`. */
const FIT_TOLERANCE = 1e-4;

/**
 * One quadrant of the outline for a cap of radius `rho` in a box of
 * half-height `r` and half-length `half`. The cap is a circular arc centred
 * on the pill's axis and touching the box's end; the blend leaves it
 * `arcSetback` before the arc's top and lands on the flat edge
 * `edgeSetback · r` past the arc's top, or at the box's centre if sooner.
 *
 * @param {number} r
 * @param {number} rho
 * @param {number} half
 * @param {FilletParams} params
 * @returns {FilletQuadrant}
 */
function quadrantFor(r, rho, half, params) {
  const beta = params.arcSetback;
  const P0 = { x: rho - rho * Math.sin(beta), y: r - rho * Math.cos(beta) };
  const T0 = { x: Math.cos(beta), y: -Math.sin(beta) };
  const reach = Math.max(Math.min(params.edgeSetback * r, half - rho), 0);
  const P1 = { x: rho + reach, y: 0 };
  const T1 = { x: 1, y: 0 };

  /** @type {Point[]} */
  const arc = [];
  const sweep = Math.PI / 2 - beta;
  const steps = Math.max(Math.ceil(sweep / ARC_STEP), 1);
  for (let i = 0; i <= steps; i++) {
    const theta = Math.PI + (sweep * i) / steps;
    arc.push({ x: rho + rho * Math.cos(theta), y: r + rho * Math.sin(theta) });
  }

  if (beta <= 0 && reach <= 0 && rho >= r) {
    return { arc, blend: [], controls: [], edgeStart: rho, capRadius: rho };
  }

  const chord = Math.hypot(P1.x - P0.x, P1.y - P0.y);
  const controls = blendControlPoints(
    P0,
    T0,
    1 / rho,
    params.bulgeStart * chord,
    P1,
    T1,
    0,
    params.bulgeEnd * chord,
    params.continuity,
  );
  /** @type {Point[]} */
  const blend = [];
  for (let i = 1; i <= BLEND_SAMPLES; i++) blend.push(bezierPoint(controls, i / BLEND_SAMPLES));

  return { arc, blend, controls, edgeStart: P1.x, capRadius: rho };
}

/**
 * How far the blend strays past the box: above the flat edge, before the
 * box's end, or past its centre line.
 *
 * @param {FilletQuadrant} q
 * @param {number} half
 */
const overshoot = (q, half) => Math.max(0, ...q.blend.map((p) => Math.max(-p.y, -p.x, p.x - half)));

/**
 * One quadrant of the outline, for a box of half-height `r` and half-length
 * `half`.
 *
 * Unfitted, the cap keeps the full radius `r`. A blend that eases curvature
 * off an arc already touching the box edge turns more slowly than the arc
 * would have, so it has to climb past that edge to finish turning: the
 * bulge is geometry, not a setting.
 *
 * Fitted, the largest cap radius whose blend stays inside the box is found
 * by bisection — the same constraint the shipped spiral satisfies by solving
 * for its radius — so the two differ only in the shape of the transition.
 *
 * @param {number} r
 * @param {number} half
 * @param {FilletParams} params
 * @returns {FilletQuadrant}
 */
export function filletQuadrant(r, half, params) {
  const full = quadrantFor(r, r, half, params);
  if (!params.fit || overshoot(full, half) <= FIT_TOLERANCE * r) return full;

  let low = MIN_FIT_RADIUS * r;
  let high = r;
  let best = quadrantFor(r, low, half, params);
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    const candidate = quadrantFor(r, mid, half, params);
    if (overshoot(candidate, half) <= FIT_TOLERANCE * r) {
      low = mid;
      best = candidate;
    } else {
      high = mid;
    }
  }
  return best;
}

export const paintDef = class PillFillet {
  static get inputProperties() {
    return [
      CONTINUITY_VAR,
      ARC_SETBACK_VAR,
      EDGE_SETBACK_VAR,
      BULGE_START_VAR,
      BULGE_END_VAR,
      FIT_VAR,
    ];
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ width: number, height: number }} size
   * @param {PaintProperties} [props]
   */
  paint(ctx, size, props) {
    const { width, height } = size;
    if (width <= 0 || height <= 0) return;

    const vertical = height > width;
    const long = vertical ? height : width;
    const short = vertical ? width : height;
    const r = short / 2;
    const { arc, blend } = filletQuadrant(r, long / 2, readParams(props));
    const quadrant = [...arc, ...blend];
    const reversed = [...quadrant].reverse();
    const outline = [
      ...quadrant,
      ...reversed.map((p) => ({ x: long - p.x, y: p.y })),
      ...quadrant.map((p) => ({ x: long - p.x, y: short - p.y })),
      ...reversed.map((p) => ({ x: p.x, y: short - p.y })),
    ];

    ctx.fillStyle = "#000";
    ctx.beginPath();
    for (let i = 0; i < outline.length; i++) {
      const p = outline[i];
      const x = vertical ? p.y : p.x;
      const y = vertical ? p.x : p.y;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
};

// `registerPaint` only exists inside a paint worklet global scope. Guarding
// the call keeps this module importable from the page for its geometry.
if (typeof registerPaint !== "undefined") {
  registerPaint("pill-fillet", paintDef);
}
