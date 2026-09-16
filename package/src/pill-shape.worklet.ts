/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

interface PaintSize {
  width: number;
  height: number;
}

interface PaintProperties {
  get(name: string): { toString(): string } | undefined;
}

interface Point {
  x: number;
  y: number;
}

/**
 * `--pill-squircle-amt` sets how soft the easing is: how much of each cap is
 * given over to the curvature transition, in units of 30 degrees. `1` keeps a
 * bare semicircle (a plain stadium, what `border-radius: 9999px` already
 * draws), the default `2` eases the last 30 degrees at each end, `3` eases 60.
 *
 * `1` meaning "circular" matches `--squircle-amt` elsewhere in this package.
 * The request is only ever honoured up to what the element's aspect ratio can
 * fit; see `fitEase`.
 */
const DEFAULT_AMOUNT = 2;
const EASE_PER_AMOUNT = Math.PI / 6;
const MAX_EASE = Math.PI / 3;

/**
 * `--pill-ease-falloff` sets how fast the curvature leaves the circle, and so
 * how far the transition is drawn out along the flat edge — independently of
 * how much of the cap it consumes.
 *
 * Curvature runs `k(t) = (1 / R) * (1 - t)^(falloff - 1)` across the
 * transition, which makes it `falloff * beta * R` long. `2` is the plain
 * clothoid, where curvature falls linearly. Raising it lengthens the
 * transition while leaving the arc — and so how circular the ends look —
 * alone. Any value above 1 still starts at `1 / R` and ends at `0`, so G2
 * holds throughout.
 */
const DEFAULT_FALLOFF = 2;
/**
 * The clothoid is the floor: below 2 the curvature still reaches zero, but
 * `dk/ds` diverges as it arrives, which looks worse than the linear ramp and
 * shortens the transition — the opposite of what this control is for.
 */
const MIN_FALLOFF = 2;
const MAX_FALLOFF = 10;

/** Integration steps along one transition. Trapezoid error here is sub-pixel. */
const EASE_STEPS = 192;
/** Vertices emitted per transition and per cap arc. */
const EASE_VERTICES = 24;
const ARC_VERTICES = 32;

export const paintDef = class PillShape implements PaintWorklet {
  static get inputProperties() {
    // `color` is needed because a paint worklet cannot resolve the
    // `currentColor` keyword itself — it has to be passed in as a property.
    return ["color", "--pill-fill", "--pill-squircle-amt", "--pill-ease-falloff"];
  }

  /**
   * Resolve the paint colour: an explicit `--pill-fill` wins, otherwise the
   * element's computed `color` (what `currentColor` would have meant).
   */
  resolveFill(props?: PaintProperties): string {
    const read = (name: string): string => props?.get(name)?.toString().trim() ?? "";
    return read("--pill-fill") || read("color") || "black";
  }

  /** The requested easing angle, in radians, before it is fitted to the box. */
  resolveEase(props?: PaintProperties): number {
    const raw = Number.parseFloat(props?.get("--pill-squircle-amt")?.toString() ?? "");
    const amt = Number.isFinite(raw) ? raw : DEFAULT_AMOUNT;
    return Math.min(Math.max(amt - 1, 0) * EASE_PER_AMOUNT, MAX_EASE);
  }

  /** How sharply curvature leaves the arc; see `DEFAULT_FALLOFF`. */
  resolveFalloff(props?: PaintProperties): number {
    const raw = Number.parseFloat(props?.get("--pill-ease-falloff")?.toString() ?? "");
    const falloff = Number.isFinite(raw) ? raw : DEFAULT_FALLOFF;
    return Math.min(Math.max(falloff, MIN_FALLOFF), MAX_FALLOFF);
  }

  /**
   * Running integrals of `cos(b * u^q)` and `sin(b * u^q)` over `[0, t]`.
   *
   * At `q = 2` these are the Fresnel integrals describing a clothoid — the
   * curve whose curvature falls linearly with arc length, and so the curve that
   * joins a circular arc to a straight line with no jump in curvature. Other
   * exponents keep both endpoint curvatures and just redistribute the fall. The
   * same quadrature sizes the cap and places the points, so the transition
   * lands exactly on the straight edge.
   */
  fresnel(beta: number, q: number): { cos: number[]; sin: number[] } {
    const cos = [0];
    const sin = [0];
    const h = 1 / EASE_STEPS;
    let c = 0;
    let s = 0;

    for (let i = 1; i <= EASE_STEPS; i++) {
      // Integrating in tau, where u = 1 - tau.
      const u0 = (1 - (i - 1) * h) ** q;
      const u1 = (1 - i * h) ** q;
      c += ((Math.cos(beta * u0) + Math.cos(beta * u1)) / 2) * h;
      s += ((Math.sin(beta * u0) + Math.sin(beta * u1)) / 2) * h;
      cos.push(c);
      sin.push(s);
    }

    return { cos, sin };
  }

  /**
   * Cap radius, and the coordinate where the easing meets the flat edge, for a
   * cap of half-height `r` easing through `beta`.
   *
   * The cap still has to span the full height, so the arc's rise
   * (`R cos beta`) plus the transition's rise (`q R beta * S`) must equal `r`.
   */
  capMetrics(
    r: number,
    beta: number,
    q: number,
    fresnel: { cos: number[]; sin: number[] },
  ): { radius: number; junction: number } {
    const totalCos = fresnel.cos[EASE_STEPS];
    const totalSin = fresnel.sin[EASE_STEPS];
    const radius = r / (Math.cos(beta) + q * beta * totalSin);
    const junction = radius * (1 - Math.sin(beta) + q * beta * totalCos);
    return { radius, junction };
  }

  /**
   * The softest easing that still fits. A stubby pill has less room, so it eases
   * harder than asked; at width === height there is no flat edge to ease into
   * and this returns 0, leaving a plain circle.
   */
  fitEase(r: number, half: number, wanted: number, q: number): number {
    if (wanted <= 0) return 0;
    if (this.capMetrics(r, wanted, q, this.fresnel(wanted, q)).junction <= half) return wanted;

    let low = 0;
    let high = wanted;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (this.capMetrics(r, mid, q, this.fresnel(mid, q)).junction <= half) low = mid;
      else high = mid;
    }
    return low;
  }

  /**
   * One quadrant of the outline: from the leftmost point of the cap, round the
   * arc, and through the easing to where it becomes the flat top edge.
   */
  quadrant(r: number, beta: number, q: number): Point[] {
    const fresnel = this.fresnel(beta, q);
    const { radius } = this.capMetrics(r, beta, q, fresnel);
    const points: Point[] = [];

    // Circular cap, from the leftmost point to where the easing takes over.
    const sweep = Math.PI / 2 - beta;
    for (let i = 0; i <= ARC_VERTICES; i++) {
      const theta = Math.PI + (sweep * i) / ARC_VERTICES;
      points.push({ x: radius + radius * Math.cos(theta), y: r + radius * Math.sin(theta) });
    }

    if (beta <= 0) return points;

    // Curvature ramps from 1 / radius down to 0 across the transition, which
    // the falloff makes q * beta * radius long.
    const length = q * radius * beta;
    const start = points[points.length - 1];
    for (let i = 1; i <= EASE_VERTICES; i++) {
      const k = Math.round((i * EASE_STEPS) / EASE_VERTICES);
      points.push({
        x: start.x + length * fresnel.cos[k],
        y: start.y - length * fresnel.sin[k],
      });
    }

    return points;
  }

  paint(ctx: CanvasRenderingContext2D, size: PaintSize, props?: PaintProperties): void {
    const { width, height } = size;
    if (width <= 0 || height <= 0) return;

    ctx.fillStyle = this.resolveFill(props);
    ctx.beginPath();

    // Work along the pill's long axis, then transpose for a vertical pill.
    const vertical = height > width;
    const long = vertical ? height : width;
    const short = vertical ? width : height;
    const r = short / 2;
    const q = this.resolveFalloff(props);
    const beta = this.fitEase(r, long / 2, this.resolveEase(props), q);

    const outline = this.outline(long, short, this.quadrant(r, beta, q));
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

  /** Mirror one quadrant into the full outline, walking clockwise. */
  outline(long: number, short: number, quadrant: Point[]): Point[] {
    const reversed = [...quadrant].reverse();
    return [
      // Leftmost point, up through the easing into the flat top edge.
      ...quadrant,
      // Mirrored in x: back down to the rightmost point.
      ...reversed.map((p) => ({ x: long - p.x, y: p.y })),
      // Then the bottom half, mirrored in y.
      ...quadrant.map((p) => ({ x: long - p.x, y: short - p.y })),
      ...reversed.map((p) => ({ x: p.x, y: short - p.y })),
    ];
  }
};

// `registerPaint` only exists inside a paint worklet global scope. Guarding the
// call keeps this module importable from tests and bundlers.
declare const registerPaint: ((name: string, def: unknown) => void) | undefined;

if (typeof registerPaint !== "undefined") {
  registerPaint("pill-shape", paintDef);
}
