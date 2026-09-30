/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

/**
 * Dev page only; not shipped.
 *
 * A second paint worklet, `pill-fillet`, that draws the same pill but builds
 * the arc-to-edge join the way CAD fillet tools build a curvature-continuous
 * fillet: as a polynomial Hermite blend between the two curves, with position,
 * tangent and — for G2 and above — curvature prescribed at both ends. That is
 * the construction behind SolidWorks' and Onshape's "curvature continuous"
 * fillets, Fusion's G2 fillet, and Rhino's BlendCrv, and the knobs those tools
 * expose map onto the properties this worklet reads:
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
 * Unlike the shipped worklet this makes no attempt to fit itself to the box:
 * the cap keeps its full radius, the blend bows outward from it, and an
 * extreme bulge may leave the element altogether. That is what a CAD fillet
 * does too — it is fitted to a model, not to a bounding box — and the
 * difference is part of what the comparison is for.
 *
 * Exposes its geometry, so the page can measure the curve it draws.
 */

const CONTINUITY_VAR = "--fillet-continuity";
const ARC_SETBACK_VAR = "--fillet-arc-setback";
const EDGE_SETBACK_VAR = "--fillet-edge-setback";
const BULGE_START_VAR = "--fillet-bulge-start";
const BULGE_END_VAR = "--fillet-bulge-end";

const BLEND_SAMPLES = 96;
/** Arc step, in radians: a constant radius needs no adaptive sampling. */
const ARC_STEP = Math.PI / 90;

export interface Point {
  x: number;
  y: number;
}

interface PaintSize {
  width: number;
  height: number;
}

interface PaintProperties {
  get(name: string): { toString(): string } | undefined;
}

export interface FilletParams {
  /** 1, 2 or 3: the G-level matched at both ends. */
  continuity: 1 | 2 | 3;
  /** Radians of arc handed to the blend. */
  arcSetback: number;
  /** Length along the flat edge, in multiples of the half-height. */
  edgeSetback: number;
  bulgeStart: number;
  bulgeEnd: number;
}

export const DEFAULT_FILLET: FilletParams = {
  continuity: 2,
  arcSetback: Math.PI / 6,
  edgeSetback: 1,
  bulgeStart: 1,
  bulgeEnd: 1,
};

const number = (props: PaintProperties | undefined, name: string, fallback: number): number => {
  const raw = Number.parseFloat(props?.get(name)?.toString() ?? "");
  return Number.isFinite(raw) ? raw : fallback;
};

export function readParams(props?: PaintProperties): FilletParams {
  const continuity = Math.min(Math.max(Math.round(number(props, CONTINUITY_VAR, 2)), 1), 3) as
    | 1
    | 2
    | 3;
  const degrees = Math.min(Math.max(number(props, ARC_SETBACK_VAR, 30), 0), 89);
  return {
    continuity,
    arcSetback: (degrees * Math.PI) / 180,
    edgeSetback: Math.max(number(props, EDGE_SETBACK_VAR, 1), 0),
    bulgeStart: Math.max(number(props, BULGE_START_VAR, 1), 0.05),
    bulgeEnd: Math.max(number(props, BULGE_END_VAR, 1), 0.05),
  };
}

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });

/**
 * Derivatives, up to third order, of a curve leaving `P` along unit tangent
 * `T` at speed `s` with curvature `k` and curvature rate zero. `N` is the
 * normal `T` turns towards. Arc-length parametrised and then rescaled, so
 * the speed is constant and the second derivative is pure normal.
 */
function endDerivatives(T: Point, k: number, s: number): [Point, Point, Point] {
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
 */
export function blendControlPoints(
  P0: Point,
  T0: Point,
  k0: number,
  s0: number,
  P1: Point,
  T1: Point,
  k1: number,
  s1: number,
  m: 1 | 2 | 3,
): Point[] {
  const n = 2 * m + 1;
  const fromEnd = (P: Point, [first, second, third]: [Point, Point, Point]): Point[] => {
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

/** De Casteljau. */
export function bezierPoint(controls: Point[], t: number): Point {
  let pts = controls;
  while (pts.length > 1) {
    const next: Point[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i] as Point;
      const b = pts[i + 1] as Point;
      next.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    pts = next;
  }
  return pts[0] as Point;
}

export interface FilletQuadrant {
  /** From the leftmost point of the cap to where the blend takes over. */
  arc: Point[];
  /** From the end of the arc to where the flat edge begins. */
  blend: Point[];
  controls: Point[];
  /** x where the flat top edge begins. */
  edgeStart: number;
}

/**
 * One quadrant of the outline, for a cap of half-height `r` in a box whose
 * half-length is `half`. The cap is a true semicircle of radius `r`; the
 * blend leaves it `arcSetback` before the top and lands on the flat edge
 * `edgeSetback · r` past the top's x, or at the box's centre if that is
 * sooner.
 */
export function filletQuadrant(r: number, half: number, params: FilletParams): FilletQuadrant {
  const beta = params.arcSetback;
  const P0 = { x: r - r * Math.sin(beta), y: r - r * Math.cos(beta) };
  const T0 = { x: Math.cos(beta), y: -Math.sin(beta) };
  const reach = Math.max(Math.min(params.edgeSetback * r, half - r), 0);
  const P1 = { x: r + reach, y: 0 };
  const T1 = { x: 1, y: 0 };

  const arc: Point[] = [];
  const sweep = Math.PI / 2 - beta;
  const steps = Math.max(Math.ceil(sweep / ARC_STEP), 1);
  for (let i = 0; i <= steps; i++) {
    const theta = Math.PI + (sweep * i) / steps;
    arc.push({ x: r + r * Math.cos(theta), y: r + r * Math.sin(theta) });
  }

  if (beta <= 0 && reach <= 0) {
    return { arc, blend: [], controls: [], edgeStart: r };
  }

  const chord = Math.hypot(P1.x - P0.x, P1.y - P0.y);
  const controls = blendControlPoints(
    P0,
    T0,
    1 / r,
    params.bulgeStart * chord,
    P1,
    T1,
    0,
    params.bulgeEnd * chord,
    params.continuity,
  );
  const blend: Point[] = [];
  for (let i = 1; i <= BLEND_SAMPLES; i++) blend.push(bezierPoint(controls, i / BLEND_SAMPLES));

  return { arc, blend, controls, edgeStart: P1.x };
}

export const paintDef = class PillFillet {
  static get inputProperties() {
    return [CONTINUITY_VAR, ARC_SETBACK_VAR, EDGE_SETBACK_VAR, BULGE_START_VAR, BULGE_END_VAR];
  }

  paint(ctx: CanvasRenderingContext2D, size: PaintSize, props?: PaintProperties): void {
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
      const p = outline[i] as Point;
      const x = vertical ? p.y : p.x;
      const y = vertical ? p.x : p.y;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
};

declare const registerPaint: ((name: string, def: unknown) => void) | undefined;

if (typeof registerPaint !== "undefined") {
  registerPaint("pill-fillet", paintDef);
}
