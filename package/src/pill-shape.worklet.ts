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
// Kept in step with DEFAULT_PILL_AMT in variants.ts by a test; this module is
// deliberately import-free so the worklet stays a standalone module script.
const DEFAULT_AMOUNT = 2;
const EASE_PER_AMOUNT = Math.PI / 6;
const MAX_EASE = Math.PI / 3;

/**
 * `--pill-ease-spread` smooths the join into the flat edge: it draws the
 * transition further along that edge without spending any more of the arc, so
 * a softer join no longer costs you a rounder cap. Raising it lets
 * `--pill-squircle-amt` come down.
 *
 * `0` is a clothoid, where curvature falls linearly from the arc to the edge.
 * The spread offsets the exponent that governs that fall,
 * `k(t) = (1 / R) * (1 - t)^(q - 1)` with `q = spread + 2`, which makes the
 * transition `q * beta * R` long. Any spread above -1 still starts at `1 / R`
 * and ends at `0`, so G2 holds throughout.
 *
 * The default sits one step above the clothoid, which reads as a softer join
 * without noticeably flattening the cap. Kept in step with
 * DEFAULT_PILL_EASE_SPREAD in variants.ts by a test.
 */
const DEFAULT_SPREAD = 1;
/** The exponent a spread of 0 means: curvature falling linearly, a clothoid. */
const CLOTHOID_EXPONENT = 2;
/**
 * 0 is the sane floor for real use. Below it the curvature still reaches zero,
 * but `dk/ds` diverges as it arrives; at -1 curvature never decays at all,
 * leaving the same corner a bare stadium has; and at -2 the transition has no
 * length. Those are still honoured so the effect can be seen. Lower would need
 * a negative exponent, where `u ** q` blows up at `u = 0`.
 */
const MIN_SPREAD = -CLOTHOID_EXPONENT;

/** Integration steps along one transition. Trapezoid error here is sub-pixel. */
const EASE_STEPS = 512;

/**
 * How far the emitted polyline may sit from the true curve, in pixels.
 *
 * A chord spanning arc length `ds` while the curve turns `dphi` misses it by
 * about `ds * dphi / 8`, so bounding that product places vertices densely where
 * the outline turns hardest and sparsely down the near-straight tail. Sampling
 * at a fixed rate instead starves the start of the transition, which is exactly
 * where a wide spread piles up all of the curvature.
 */
const MAX_SAGITTA = 0.03;
const MIN_SEGMENTS = 4;
const MAX_SEGMENTS = 256;

export const paintDef = class PillShape implements PaintWorklet {
  static get inputProperties() {
    // `color` is needed because a paint worklet cannot resolve the
    // `currentColor` keyword itself — it has to be passed in as a property.
    return [
      "--pill-squircle-amt",
      "--pill-ease-spread",
      "--pill-stroke-width",
      "--pill-border-style",
    ];
  }

  /**
   * Dash pattern for the stroke, in multiples of its width, for
   * `--pill-border-style`. `none` and `hidden` suppress the ring entirely,
   * matching what those keywords do to a real border.
   *
   * The worklet keeps its own vocabulary rather than reading a framework's
   * variables directly; the Tailwind layer maps `--tw-border-style` onto this.
   */
  resolveDash(props: PaintProperties | undefined, width: number): number[] | null {
    const style = props?.get("--pill-border-style")?.toString().trim();
    if (style === "none" || style === "hidden") return null;
    if (style === "dashed") return [width * 3, width * 2];
    if (style === "dotted") return [width, width * 2];
    return [];
  }

  /**
   * Stroke width, in pixels. Zero fills the shape; anything larger draws an
   * inset band of exactly that width, hugging the inside of the outline.
   */
  resolveStrokeWidth(props?: PaintProperties): number {
    const raw = Number.parseFloat(props?.get("--pill-stroke-width")?.toString() ?? "");
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  /** The requested easing angle, in radians, before it is fitted to the box. */
  resolveEase(props?: PaintProperties): number {
    const raw = Number.parseFloat(props?.get("--pill-squircle-amt")?.toString() ?? "");
    const amt = Number.isFinite(raw) ? raw : DEFAULT_AMOUNT;
    return Math.min(Math.max(amt - 1, 0) * EASE_PER_AMOUNT, MAX_EASE);
  }

  /**
   * How far the join is spread along the flat edge, as the curvature exponent
   * it offsets; see `DEFAULT_SPREAD`.
   */
  resolveExponent(props?: PaintProperties): number {
    const raw = Number.parseFloat(props?.get("--pill-ease-spread")?.toString() ?? "");
    const spread = Number.isFinite(raw) ? raw : DEFAULT_SPREAD;
    return Math.max(spread, MIN_SPREAD) + CLOTHOID_EXPONENT;
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
   * The softest easing that still fits, backing off the amount and the spread
   * together.
   *
   * What reads as a smooth transition is the rate curvature changes,
   * `|dk/ds| * R^2 = (q - 1) / (q * beta)`. Surrendering beta alone sends that
   * rate up like `1 / beta`, so a pill too narrow for the requested easing ends
   * up looking abruptly cornered even though it is still formally G2. Holding
   * the rate fixed instead pins the exponent to whatever beta survives:
   *
   *     q = 1 / (1 - rate * beta)
   *
   * which returns the requested exponent at the requested beta and eases down
   * towards the plain clothoid as the room runs out. Once it bottoms out there
   * the rate does climb, on the way to the bare semicircle a square has no
   * choice but to be.
   */
  fitEasing(
    r: number,
    half: number,
    wantedBeta: number,
    wantedExponent: number,
  ): { beta: number; exponent: number } {
    if (wantedBeta <= 0) return { beta: 0, exponent: wantedExponent };

    // There is only something to trade above the clothoid. At or below it the
    // requested exponent is passed through and the amount absorbs the
    // shortfall, which also keeps the rate away from the 0 and 1 singularities.
    const tradeable = wantedExponent > CLOTHOID_EXPONENT;
    const rate = tradeable ? (wantedExponent - 1) / (wantedExponent * wantedBeta) : 0;
    // rate * beta <= rate * wantedBeta = (q - 1) / q < 1, so the denominator
    // stays positive.
    const exponentFor = (beta: number): number =>
      tradeable
        ? Math.min(Math.max(1 / (1 - rate * beta), CLOTHOID_EXPONENT), wantedExponent)
        : wantedExponent;

    const fits = (beta: number): boolean => {
      const exponent = exponentFor(beta);
      return this.capMetrics(r, beta, exponent, this.fresnel(beta, exponent)).junction <= half;
    };

    if (fits(wantedBeta)) return { beta: wantedBeta, exponent: wantedExponent };

    let low = 0;
    let high = wantedBeta;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (fits(mid)) low = mid;
      else high = mid;
    }
    return { beta: low, exponent: exponentFor(low) };
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
    // Constant radius, so a constant step keeps the chord error in bounds.
    const sweep = Math.PI / 2 - beta;
    const arcSteps = Math.min(
      Math.max(Math.ceil(sweep / Math.sqrt((8 * MAX_SAGITTA) / radius)), MIN_SEGMENTS),
      MAX_SEGMENTS,
    );
    for (let i = 0; i <= arcSteps; i++) {
      const theta = Math.PI + (sweep * i) / arcSteps;
      points.push({ x: radius + radius * Math.cos(theta), y: r + radius * Math.sin(theta) });
    }

    if (beta <= 0) return points;

    // The lowest spread gives the transition no length at all: the arc alone
    // spans the height and meets the flat edge at a corner.
    if (q <= 0) return points;

    // Curvature ramps from 1 / radius down to 0 across the transition, which
    // the exponent makes q * beta * radius long. Vertices land where the chord
    // would otherwise drift off the curve.
    const length = q * radius * beta;
    const start = points[points.length - 1];
    const at = (k: number): Point => ({
      x: start.x + length * fresnel.cos[k],
      y: start.y - length * fresnel.sin[k],
    });
    const turnTo = (t: number): number => beta * (1 - (1 - t) ** q);

    let anchor = 0;
    for (let k = 1; k < EASE_STEPS; k++) {
      const span = length * ((k - anchor) / EASE_STEPS);
      const turn = turnTo(k / EASE_STEPS) - turnTo(anchor / EASE_STEPS);
      if (span * turn >= 8 * MAX_SAGITTA) {
        points.push(at(k));
        anchor = k;
      }
    }
    points.push(at(EASE_STEPS));

    return points;
  }

  paint(ctx: CanvasRenderingContext2D, size: PaintSize, props?: PaintProperties): void {
    const { width, height } = size;
    if (width <= 0 || height <= 0) return;

    /*
     * Opaque, always. The shape is consumed as a mask, where only the alpha
     * channel counts, and the element's own background supplies the colour.
     * Reading `color` here would mean `color: transparent` erased the element.
     */
    const stroke = this.resolveStrokeWidth(props);
    const dash = stroke > 0 ? this.resolveDash(props, stroke) : [];
    // `border-style: none` leaves nothing to draw.
    if (dash === null) return;

    if (stroke > 0) {
      ctx.strokeStyle = "#000";
      // Doubled, because the half outside the outline is clipped away below.
      ctx.lineWidth = stroke * 2;
      if (dash.length > 0) ctx.setLineDash(dash);
    } else {
      ctx.fillStyle = "#000";
    }
    ctx.beginPath();

    // Work along the pill's long axis, then transpose for a vertical pill.
    const vertical = height > width;
    const long = vertical ? height : width;
    const short = vertical ? width : height;
    const r = short / 2;
    const { beta, exponent } = this.fitEasing(
      r,
      long / 2,
      this.resolveEase(props),
      this.resolveExponent(props),
    );

    const outline = this.outline(long, short, this.quadrant(r, beta, exponent));
    for (let i = 0; i < outline.length; i++) {
      const p = outline[i];
      const x = vertical ? p.y : p.x;
      const y = vertical ? p.x : p.y;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.closePath();

    if (stroke > 0) {
      /*
       * Clip to the outline before stroking, so the band sits wholly inside it.
       * A centred stroke would spill half its width past the outline, and that
       * half is cut off by the edge of the paint canvas rather than by the
       * shape — which trims it on the flat edges, where the outline runs along
       * the canvas boundary, but not through the caps, where the outline curves
       * inward. The ring would come out flattened and uneven.
       */
      ctx.clip();
      ctx.stroke();
    } else {
      ctx.fill();
    }
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
