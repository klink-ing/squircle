/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

/**
 * Prefix for the custom properties this worklet reads, inlined at build time
 * from the same value `variants.ts` uses, so the two cannot disagree. See
 * SQUIRCLE_CSS_NAMESPACE in vite.config.ts.
 *
 * This module stays import-free — a paint worklet is loaded as a standalone
 * module script — so it takes the value from the define rather than importing
 * the constants.
 */
declare const __SQUIRCLE_CSS_NAMESPACE__: string | undefined;

const NS = `--${typeof __SQUIRCLE_CSS_NAMESPACE__ === "string" ? __SQUIRCLE_CSS_NAMESPACE__ : "squircle"}-pill`;
const AMT_VAR = `${NS}-amt`;
const EASE_SPREAD_VAR = `${NS}-ease-spread`;
const STROKE_WIDTH_VAR = `${NS}-stroke-width`;
const BORDER_STYLE_VAR = `${NS}-border-style`;
const CONTINUITY_VAR = `${NS}-continuity`;

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

interface FresnelTotals {
  totalCos: number;
  totalSin: number;
}

interface Fresnel extends FresnelTotals {
  cos: Float64Array;
  sin: Float64Array;
}

/**
 * How curvature falls across the transition, sampled at `EASE_STEPS + 1`
 * evenly spaced points of its length.
 *
 * `remaining[i]` is the share of the transition's turn still to come at that
 * point, from 1 where it leaves the arc to 0 where it meets the flat edge.
 * `lambda` sets the transition's length, `lambda * beta * R`: curvature
 * starts at `1 / R`, so a profile that sheds it sooner needs longer to turn
 * the same `beta`.
 */
interface Profile {
  remaining: Float64Array;
  lambda: number;
}

/**
 * The geometric continuity the transition keeps at both of its ends.
 *
 * `2` matches curvature: `k(t) = (1 / R) * (1 - t)^(q - 1)`, which leaves the
 * arc already shedding curvature at a finite rate. `3` also matches the rate
 * curvature changes, `dk/ds`, with `k(t) = (1 / R) * (1 - t^2)^(q - 1)`: flat
 * where it leaves the arc, and, for any exponent above 2, flat where it meets
 * the edge. The spread keeps its meaning — it is the same exponent — but G3
 * floors it at 0, the lowest spread that still arrives at the edge at all.
 */
type Continuity = 2 | 3;
const DEFAULT_CONTINUITY: Continuity = 2;

const QUADRANT_CACHE_SIZE = 64;
const quadrantCache = new Map<string, Point[]>();

/**
 * The narrowest pill, as half-length over half-height, that fits a requested
 * easing unchanged, keyed by the request. Wider pills skip the fit entirely,
 * which is most of them: the boundary depends only on the request, not on the
 * element's size.
 */
const fitsAsAskedCache = new Map<string, number>();
/** Fitted easings for narrower pills, keyed by aspect ratio and request. */
const FIT_CACHE_SIZE = 256;
/**
 * How closely the fit pins down the easing angle, relative to the request.
 * Whatever it settles on fits the box; this only decides how much of the
 * requested easing is kept, and 1e-4 of it is far below anything visible.
 */
const FIT_TOLERANCE = 1e-4;
const fitCache = new Map<string, { beta: number; exponent: number }>();

/**
 * The transition for one easing — its profile, the running integrals that
 * place its points, and the cap radius over the half-height — keyed by the
 * easing. It depends on no size at all, so every pill wide enough for its
 * requested easing shares one, and a new size only has to scale and sample it.
 */
interface Transition {
  profile: Profile;
  fresnel: Fresnel;
  radiusRatio: number;
}
const TRANSITION_CACHE_SIZE = 64;
const transitionCache = new Map<string, Transition>();

const remember = <V>(cache: Map<string, V>, size: number, key: string, value: V): V => {
  if (cache.size >= size) cache.delete(cache.keys().next().value as string);
  cache.set(key, value);
  return value;
};

/**
 * The pill amount sets how soft the easing is: how much of each cap is
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
 * The ease spread smooths the join into the flat edge: it draws the
 * transition further along that edge without spending any more of the arc, so
 * a softer join no longer costs you a rounder cap. Raising it lets
 * the amount come down.
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
 * `log(1 - t)` and `log(1 - t^2)` at every integration node. Both profiles
 * raise one of these fixed bases to a varying power at each node, and
 * `exp(p * log(b))` with the logarithm looked up is several times cheaper
 * than `b ** p`, which recomputes it.
 */
const LOG_ONE_MINUS_T = new Float64Array(EASE_STEPS + 1);
const LOG_ONE_MINUS_T2 = new Float64Array(EASE_STEPS + 1);
for (let i = 0; i <= EASE_STEPS; i++) {
  const t = i / EASE_STEPS;
  LOG_ONE_MINUS_T[i] = Math.log(1 - t);
  LOG_ONE_MINUS_T2[i] = Math.log(1 - t * t);
}

/** `base ** power` from the base's logarithm, with `0 ** 0` kept at 1. */
const powFromLog = (logBase: number, power: number): number =>
  power === 0 ? 1 : Math.exp(power * logBase);

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
    return [AMT_VAR, EASE_SPREAD_VAR, CONTINUITY_VAR, STROKE_WIDTH_VAR, BORDER_STYLE_VAR];
  }

  /**
   * Dash pattern for the stroke, in multiples of its width, for
   * the border style. `none` and `hidden` suppress the ring entirely,
   * matching what those keywords do to a real border.
   *
   * The worklet keeps its own vocabulary rather than reading a framework's
   * variables directly; the Tailwind layer maps `--tw-border-style` onto this.
   */
  resolveDash(props: PaintProperties | undefined, width: number): number[] | null {
    const style = props?.get(BORDER_STYLE_VAR)?.toString().trim();
    if (style === "none" || style === "hidden") return null;
    if (style === "dashed") return [width * 3, width * 2];
    if (style === "dotted") return [width, width * 2];
    return [];
  }

  /**
   * Stroke width, in pixels, or `null` when this paint is a fill.
   *
   * The ring pseudo is the only thing that sets the stroke-width property, so
   * its mere presence is what selects stroke mode; the element itself never
   * carries it and is always filled. A ring of zero width draws nothing at
   * all — a `border-2`-less pill has no border, not a full-face one — while
   * anything larger draws an inset band of exactly that width, hugging the
   * inside of the outline. The value arrives in px, resolved by the registered
   * border-width property it is fed from.
   */
  resolveStrokeWidth(props?: PaintProperties): number | null {
    const raw = props?.get(STROKE_WIDTH_VAR)?.toString().trim() ?? "";
    if (raw === "") return null;
    const width = Number.parseFloat(raw);
    return Number.isFinite(width) && width > 0 ? width : 0;
  }

  /** The requested easing angle, in radians, before it is fitted to the box. */
  resolveEase(props?: PaintProperties): number {
    const raw = Number.parseFloat(props?.get(AMT_VAR)?.toString() ?? "");
    const amt = Number.isFinite(raw) ? raw : DEFAULT_AMOUNT;
    return Math.min(Math.max(amt - 1, 0) * EASE_PER_AMOUNT, MAX_EASE);
  }

  /**
   * How far the join is spread along the flat edge, as the curvature exponent
   * it offsets; see `DEFAULT_SPREAD`.
   */
  resolveExponent(props?: PaintProperties): number {
    const raw = Number.parseFloat(props?.get(EASE_SPREAD_VAR)?.toString() ?? "");
    const spread = Number.isFinite(raw) ? raw : DEFAULT_SPREAD;
    return Math.max(spread, MIN_SPREAD) + CLOTHOID_EXPONENT;
  }

  /** `3` for G3, anything else the G2 default; see `Continuity`. */
  resolveContinuity(props?: PaintProperties): Continuity {
    const raw = Number.parseFloat(props?.get(CONTINUITY_VAR)?.toString() ?? "");
    return Number.isFinite(raw) && raw >= 2.5 ? 3 : DEFAULT_CONTINUITY;
  }

  /** The transition's curvature profile for exponent `q`; see `Profile`. */
  profile(q: number, continuity: Continuity): Profile {
    const h = 1 / EASE_STEPS;
    const remaining = new Float64Array(EASE_STEPS + 1);
    if (continuity === 2) {
      for (let i = 0; i <= EASE_STEPS; i++) remaining[i] = powFromLog(LOG_ONE_MINUS_T[i], q);
      return { remaining, lambda: q };
    }

    // Curvature (1 - t^2)^e, integrated for the turn taken so far; the running
    // total is kept in `remaining` and normalised in place.
    const e = Math.max(q - 1, 1);
    let k0 = 1;
    for (let i = 1; i <= EASE_STEPS; i++) {
      const k1 = powFromLog(LOG_ONE_MINUS_T2[i], e);
      remaining[i] = remaining[i - 1] + ((k0 + k1) / 2) * h;
      k0 = k1;
    }
    const total = remaining[EASE_STEPS];
    for (let i = 0; i <= EASE_STEPS; i++) remaining[i] = 1 - remaining[i] / total;
    return { remaining, lambda: 1 / total };
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
   *
   * Only the totals are needed to size a cap, so `fresnelTotals` runs the same
   * quadrature without keeping the running values; the fit probes it many
   * times over and would otherwise allocate two arrays per probe.
   */
  fresnel(beta: number, { remaining }: Profile): Fresnel {
    const cos = new Float64Array(EASE_STEPS + 1);
    const sin = new Float64Array(EASE_STEPS + 1);
    const h = 1 / EASE_STEPS;
    let c = 0;
    let s = 0;
    // Each node's cosine and sine serve both segments it bounds.
    let c0 = Math.cos(beta * remaining[0]);
    let s0 = Math.sin(beta * remaining[0]);

    for (let i = 1; i <= EASE_STEPS; i++) {
      const c1 = Math.cos(beta * remaining[i]);
      const s1 = Math.sin(beta * remaining[i]);
      c += ((c0 + c1) / 2) * h;
      s += ((s0 + s1) / 2) * h;
      cos[i] = c;
      sin[i] = s;
      c0 = c1;
      s0 = s1;
    }

    return { cos, sin, totalCos: c, totalSin: s };
  }

  fresnelTotals(beta: number, profile: Profile): FresnelTotals {
    const { totalCos, totalSin } = this.fresnel(beta, profile);
    return { totalCos, totalSin };
  }

  /**
   * Where the easing meets the flat edge, over the cap's half-height, for a
   * cap easing through `beta` with exponent `q`. The fit evaluates this many
   * times over, so it computes the profile and its quadrature in one pass,
   * allocating nothing; it matches `capMetrics` over `profile` and `fresnel`.
   */
  junctionRatio(beta: number, q: number, continuity: Continuity): number {
    const h = 1 / EASE_STEPS;
    let e = 0;
    let lambda = q;
    if (continuity === 3) {
      // G3 needs the profile's total before it can be normalised.
      e = Math.max(q - 1, 1);
      let total = 0;
      let k0 = 1;
      for (let i = 1; i <= EASE_STEPS; i++) {
        const k1 = powFromLog(LOG_ONE_MINUS_T2[i], e);
        total += ((k0 + k1) / 2) * h;
        k0 = k1;
      }
      lambda = 1 / total;
    }

    let c = 0;
    let s = 0;
    let taken = 0;
    let k0 = 1;
    let c0 = Math.cos(beta);
    let s0 = Math.sin(beta);
    for (let i = 1; i <= EASE_STEPS; i++) {
      let remaining: number;
      if (continuity === 2) {
        remaining = powFromLog(LOG_ONE_MINUS_T[i], q);
      } else {
        const k1 = powFromLog(LOG_ONE_MINUS_T2[i], e);
        taken += ((k0 + k1) / 2) * h;
        k0 = k1;
        remaining = 1 - taken * lambda;
      }
      const c1 = Math.cos(beta * remaining);
      const s1 = Math.sin(beta * remaining);
      c += ((c0 + c1) / 2) * h;
      s += ((s0 + s1) / 2) * h;
      c0 = c1;
      s0 = s1;
    }

    return this.capMetrics(1, beta, lambda, { totalCos: c, totalSin: s }).junction;
  }

  /**
   * Cap radius, and the coordinate where the easing meets the flat edge, for a
   * cap of half-height `r` easing through `beta`.
   *
   * The cap still has to span the full height, so the arc's rise
   * (`R cos beta`) plus the transition's rise (`lambda R beta * S`) must equal
   * `r`.
   */
  capMetrics(
    r: number,
    beta: number,
    lambda: number,
    { totalCos, totalSin }: FresnelTotals,
  ): { radius: number; junction: number } {
    const radius = r / (Math.cos(beta) + lambda * beta * totalSin);
    const junction = radius * (1 - Math.sin(beta) + lambda * beta * totalCos);
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
    continuity: Continuity = DEFAULT_CONTINUITY,
  ): { beta: number; exponent: number } {
    if (wantedBeta <= 0) return { beta: 0, exponent: wantedExponent };

    // The fit depends on the box only through its aspect ratio: the whole
    // shape scales with the half-height.
    const ratio = half / r;
    const request = `${wantedBeta},${wantedExponent},${continuity}`;
    const fitsAsAsked =
      fitsAsAskedCache.get(request) ??
      remember(
        fitsAsAskedCache,
        FIT_CACHE_SIZE,
        request,
        this.junctionRatio(wantedBeta, wantedExponent, continuity),
      );
    if (ratio >= fitsAsAsked) return { beta: wantedBeta, exponent: wantedExponent };

    const key = `${ratio},${request}`;
    const cached = fitCache.get(key);
    if (cached) return cached;

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

    // How far past the box's centre the easing lands, in half-heights. No
    // easing at all is a bare semicircle, which lands at 1 and fits any pill.
    const overrun = (beta: number): number =>
      this.junctionRatio(beta, exponentFor(beta), continuity) - ratio;

    // Regula falsi with the Illinois modification: the overrun is smooth and
    // monotone in beta, so it converges in a handful of steps where bisection
    // takes two dozen. `low` always fits, so it is what is returned.
    let low = 0;
    let high = wantedBeta;
    let fLow = 1 - ratio;
    let fHigh = fitsAsAsked - ratio;
    let side = 0;
    for (let i = 0; i < 40 && high - low > FIT_TOLERANCE * wantedBeta; i++) {
      const mid = high - (fHigh * (high - low)) / (fHigh - fLow);
      const fMid = overrun(mid);
      if (fMid <= 0) {
        low = mid;
        fLow = fMid;
        if (side === -1) fHigh /= 2;
        side = -1;
      } else {
        high = mid;
        fHigh = fMid;
        if (side === 1) fLow /= 2;
        side = 1;
      }
    }
    return remember(fitCache, FIT_CACHE_SIZE, key, { beta: low, exponent: exponentFor(low) });
  }

  /**
   * One quadrant of the outline: from the leftmost point of the cap, round the
   * arc, and through the easing to where it becomes the flat top edge.
   */
  quadrant(
    r: number,
    beta: number,
    q: number,
    continuity: Continuity = DEFAULT_CONTINUITY,
  ): Point[] {
    const { profile, fresnel, radiusRatio } = this.transition(beta, q, continuity);
    const radius = radiusRatio * r;
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
    if (profile.lambda <= 0) return points;

    // Curvature ramps from 1 / radius down to 0 across the transition, which
    // the profile makes lambda * beta * radius long. Vertices land where the
    // chord would otherwise drift off the curve.
    const length = profile.lambda * radius * beta;
    const start = points[points.length - 1];
    const at = (k: number): Point => ({
      x: start.x + length * fresnel.cos[k],
      y: start.y - length * fresnel.sin[k],
    });
    const turnTo = (k: number): number => beta * (1 - profile.remaining[k]);

    let anchor = 0;
    for (let k = 1; k < EASE_STEPS; k++) {
      const span = length * ((k - anchor) / EASE_STEPS);
      const turn = turnTo(k) - turnTo(anchor);
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
    // A ring with no width, or with `border-style: none`, leaves nothing to draw.
    if (stroke !== null && stroke <= 0) return;
    const dash = stroke !== null ? this.resolveDash(props, stroke) : [];
    if (dash === null) return;

    if (stroke !== null) {
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

    const outline = this.outline(
      long,
      short,
      this.fittedQuadrant(
        long,
        short,
        this.resolveEase(props),
        this.resolveExponent(props),
        this.resolveContinuity(props),
      ),
    );
    for (let i = 0; i < outline.length; i++) {
      const p = outline[i];
      const x = vertical ? p.y : p.x;
      const y = vertical ? p.x : p.y;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.closePath();

    if (stroke !== null) {
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

  /** The size-independent transition for an easing; see `Transition`. */
  transition(beta: number, q: number, continuity: Continuity): Transition {
    const key = `${beta},${q},${continuity}`;
    const cached = transitionCache.get(key);
    if (cached) return cached;
    const profile = this.profile(q, continuity);
    const fresnel = this.fresnel(beta, profile);
    const { radius } = this.capMetrics(1, beta, profile.lambda, fresnel);
    return remember(transitionCache, TRANSITION_CACHE_SIZE, key, {
      profile,
      fresnel,
      radiusRatio: radius,
    });
  }

  /**
   * The quadrant for a box, with the easing fitted to it.
   *
   * Memoised, because the same shape is painted at least twice — once as the
   * element's mask and once as its ring — and again on every repaint that
   * changes nothing about it, such as a hover. The quadrant is the expensive
   * part, and it depends only on these five values.
   */
  fittedQuadrant(
    long: number,
    short: number,
    ease: number,
    exponent: number,
    continuity: Continuity = DEFAULT_CONTINUITY,
  ): Point[] {
    const key = `${long},${short},${ease},${exponent},${continuity}`;
    const cached = quadrantCache.get(key);
    if (cached) return cached;

    const r = short / 2;
    const fitted = this.fitEasing(r, long / 2, ease, exponent, continuity);
    const points = this.quadrant(r, fitted.beta, fitted.exponent, continuity);

    if (quadrantCache.size >= QUADRANT_CACHE_SIZE) {
      quadrantCache.delete(quadrantCache.keys().next().value as string);
    }
    quadrantCache.set(key, points);
    return points;
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
