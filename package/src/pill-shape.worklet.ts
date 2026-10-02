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
const BORDER_WIDTH_VAR = `${NS}-border-width`;
const OUTLINE_WIDTH_VAR = `${NS}-outline-width`;
const OUTLINE_OFFSET_VAR = `${NS}-outline-offset`;
const OUTLINE_COLOR_VAR = `${NS}-outline-color`;
const OUTLINE_STYLE_VAR = `${NS}-outline-style`;
const RING_WIDTH_VAR = `${NS}-ring-width`;
const RING_COLOR_VAR = `${NS}-ring-color`;
const RING_OFFSET_WIDTH_VAR = `${NS}-ring-offset-width`;
const RING_OFFSET_COLOR_VAR = `${NS}-ring-offset-color`;
const INSET_RING_WIDTH_VAR = `${NS}-inset-ring-width`;
const INSET_RING_COLOR_VAR = `${NS}-inset-ring-color`;
const MASK_BANDS_VAR = `${NS}-mask-bands`;
/** What the element itself might paint outside the stadium; see `paintsOutside`. */
const OUTER_PAINT_INPUTS = ["box-shadow", "filter", "outline-style"];
/** What decides the decoration's bands; see `decorationBands`. */
const DECORATION_INPUTS = [
  BORDER_WIDTH_VAR,
  OUTLINE_WIDTH_VAR,
  OUTLINE_OFFSET_VAR,
  OUTLINE_COLOR_VAR,
  OUTLINE_STYLE_VAR,
  RING_WIDTH_VAR,
  RING_COLOR_VAR,
  RING_OFFSET_WIDTH_VAR,
  RING_OFFSET_COLOR_VAR,
  INSET_RING_WIDTH_VAR,
  INSET_RING_COLOR_VAR,
];

/** One band of a decoration; see `decorationBands`. */
interface Band {
  from: number;
  to: number;
  color: string;
  dash: number[];
}

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
 * How far the easing reaches, sampled across the angles a request can be
 * fitted down to, keyed by the request. The reach grows smoothly and steadily
 * with the angle and depends on nothing but the request, so one table, built
 * the first time a pill is too narrow for its request, gives every narrower
 * pill a starting angle within a few tolerances of its fit; one or two exact
 * evaluations then settle it, where searching from scratch takes four to ten.
 * Pages usually share one request across all their pills, so the table is
 * paid for once.
 */
interface FitTable {
  betas: number[];
  ratios: number[];
  /** `dbeta/dratio` at each node, for each of the two segments it bounds. */
  slopesIn: number[];
  slopesOut: number[];
}
const FIT_TABLE_STEPS = 24;
const FIT_TABLE_CACHE_SIZE = 16;
const fitTableCache = new Map<string, FitTable>();

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
  /*
   * As few as it can do with: every input is gathered for every pill on every
   * resize, which adds up over hundreds of them. The decoration's bands
   * arrive packed into one; see `maskBands`.
   */
  static get inputProperties() {
    return [AMT_VAR, EASE_SPREAD_VAR, CONTINUITY_VAR, MASK_BANDS_VAR, ...OUTER_PAINT_INPUTS];
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
    // A square, or anything no longer than it is tall, has no flat edge to
    // ease into: only a circle fits, so there is nothing to search for.
    if (wantedBeta <= 0 || half <= r) return { beta: 0, exponent: wantedExponent };

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
    const reach = (beta: number): number => this.junctionRatio(beta, exponentFor(beta), continuity);
    // Where the exponent stops being held at the clothoid, the reach has a
    // kink that the table has to sample exactly.
    const kink = tradeable ? 1 / (2 * rate) : 0;
    const table =
      fitTableCache.get(request) ??
      remember(
        fitTableCache,
        FIT_TABLE_CACHE_SIZE,
        request,
        this.fitTable(wantedBeta, fitsAsAsked, kink, reach),
      );

    // Start from the table: its segment brackets the answer, and its guess
    // lands within a few tolerances of it. `low` always fits, so it is what is
    // returned; each step aims a little short so it is usually the next `low`,
    // and the search stops once the root is estimated within the tolerance.
    const tolerance = FIT_TOLERANCE * wantedBeta;
    const { segment, beta: guess } = this.fitGuess(table, ratio);
    let low = table.betas[segment] as number;
    let high = table.betas[segment + 1] as number;
    let fLow = (table.ratios[segment] as number) - ratio;
    let fHigh = (table.ratios[segment + 1] as number) - ratio;
    let next = guess - tolerance / 2;
    for (let i = 0; i < 40; i++) {
      // Out of the bracket, or still searching after a few steps: bisect.
      if (!(next > low && next < high) || i > 3) next = (low + high) / 2;
      const f = reach(next) - ratio;
      if (f <= 0) {
        low = next;
        fLow = f;
      } else {
        high = next;
        fHigh = f;
      }
      const gap = (-fLow * (high - low)) / (fHigh - fLow);
      if (gap <= tolerance || high - low <= tolerance) break;
      next = low + gap - tolerance / 2;
    }
    return remember(fitCache, FIT_CACHE_SIZE, key, { beta: low, exponent: exponentFor(low) });
  }

  /**
   * Samples the reach at evenly spaced angles up to the request, plus the
   * kink, with the slopes `fitGuess` interpolates along: harmonic means of the
   * neighbouring secants (Fritsch–Carlson, which keeps the interpolant
   * monotone), one-sided at the ends and either side of the kink.
   */
  fitTable(
    wantedBeta: number,
    fitsAsAsked: number,
    kink: number,
    reach: (beta: number) => number,
  ): FitTable {
    const betas: number[] = [];
    for (let i = 0; i <= FIT_TABLE_STEPS; i++) betas.push((wantedBeta * i) / FIT_TABLE_STEPS);
    const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * wantedBeta;
    if (kink > 0 && kink < wantedBeta && !betas.some((b) => near(b, kink))) {
      betas.push(kink);
      betas.sort((a, b) => a - b);
    }
    const n = betas.length - 1;
    const ratios = betas.map((b, i) => (i === 0 ? 1 : i === n ? fitsAsAsked : reach(b)));
    const secants: number[] = [];
    for (let i = 0; i < n; i++) {
      secants.push(
        ((betas[i + 1] as number) - (betas[i] as number)) /
          ((ratios[i + 1] as number) - (ratios[i] as number)),
      );
    }
    const slopesIn: number[] = [];
    const slopesOut: number[] = [];
    for (let i = 0; i <= n; i++) {
      const before = secants[i - 1];
      const after = secants[i];
      const smooth =
        before !== undefined && after !== undefined && !near(betas[i] as number, kink)
          ? before * after <= 0
            ? 0
            : 2 / (1 / before + 1 / after)
          : undefined;
      slopesIn.push(smooth ?? before ?? 0);
      slopesOut.push(smooth ?? after ?? 0);
    }
    return { betas, ratios, slopesIn, slopesOut };
  }

  /**
   * The table's estimate of the angle reaching `ratio`, and the segment that
   * brackets it.
   *
   * Nearly square boxes fall in the first segment, where the reach grows
   * linearly from 1 and bends only gently: `ratio - 1 = a beta + b beta^2`,
   * fitted through the first two samples, gives the angle straight from the
   * quadratic formula. Elsewhere it is a monotone cubic through the samples.
   */
  fitGuess(table: FitTable, ratio: number): { segment: number; beta: number } {
    const { betas, ratios, slopesIn, slopesOut } = table;
    const last = betas.length - 2;
    let segment = 0;
    while (segment < last && (ratios[segment + 1] as number) < ratio) segment++;

    if (segment === 0) {
      const b1 = betas[1] as number;
      const b2 = betas[2] ?? b1;
      const y1 = (ratios[1] as number) - 1;
      const y2 = ((ratios[2] ?? ratios[1]) as number) - 1;
      const b = b2 === b1 ? 0 : (y2 / b2 - y1 / b1) / (b2 - b1);
      const a = y1 / b1 - b * b1;
      const y = ratio - 1;
      // The root of b beta^2 + a beta - y, written to stay exact as b -> 0.
      const disc = a * a + 4 * b * y;
      return { segment, beta: disc > 0 ? (2 * y) / (a + Math.sqrt(disc)) : y / a };
    }

    const r0 = ratios[segment] as number;
    const h = (ratios[segment + 1] as number) - r0;
    const t = (ratio - r0) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      segment,
      beta:
        (2 * t3 - 3 * t2 + 1) * (betas[segment] as number) +
        (t3 - 2 * t2 + t) * h * (slopesOut[segment] as number) +
        (-2 * t3 + 3 * t2) * (betas[segment + 1] as number) +
        (t3 - t2) * h * (slopesIn[segment + 1] as number),
    };
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
    // No easing is a bare circular cap of the full half-height: nothing to
    // integrate.
    const eased = beta > 0 ? this.transition(beta, q, continuity) : null;
    const radius = eased ? eased.radiusRatio * r : r;
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

    if (!eased) return points;
    const { profile, fresnel } = eased;

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
    const outline = this.boxOutline(width, height, props);
    for (let i = 0; i < outline.length; i++) {
      const p = outline[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
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
      return;
    }
    ctx.fill();
    const bands = this.maskBands(props);
    if (bands.length > 0 || this.paintsOutside(props)) {
      this.surround(ctx, width, height, outline, bands);
    }
  }

  /**
   * As the element's mask, what else to leave open inside the border box: the
   * box's corners outside the stadium `border-radius`, and the decoration's
   * bands, dashes and all.
   *
   * The background paints only inside the stadium, so outside it there is
   * nothing to hide — only what is drawn around the pill, a shadow or a ring,
   * which near the caps falls inside the box. Between the stadium and the
   * pill the background does paint, and stays hidden, except under the bands,
   * which cover it.
   */
  surround(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    outline: Point[],
    bands: Band[],
  ): void {
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    const r = Math.min(width, height) / 2;
    if (width >= height) {
      ctx.moveTo(r, 0);
      ctx.lineTo(width - r, 0);
      ctx.arc(width - r, r, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(r, height);
      ctx.arc(r, r, r, Math.PI / 2, (3 * Math.PI) / 2);
    } else {
      ctx.moveTo(width, r);
      ctx.lineTo(width, height - r);
      ctx.arc(r, height - r, r, 0, Math.PI);
      ctx.lineTo(0, r);
      ctx.arc(r, r, r, Math.PI, 2 * Math.PI);
    }
    ctx.closePath();
    ctx.fill("evenodd");

    if (bands.length === 0) return;
    ctx.strokeStyle = "#000";
    ctx.lineJoin = "round";
    for (const band of bands) {
      const path = this.offsetOutline(outline, (band.from + band.to) / 2);
      ctx.beginPath();
      path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.lineWidth = band.to - band.from;
      ctx.setLineDash(band.dash);
      ctx.stroke();
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

  /**
   * The pill's outline in the coordinates of a `width` by `height` box: worked
   * out along the long axis, then transposed for a tall pill, which leaves a
   * tall pill's outline running the other way round.
   */
  boxOutline(width: number, height: number, props?: PaintProperties): Point[] {
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
    return vertical ? outline.map((p) => ({ x: p.y, y: p.x })) : outline;
  }

  /**
   * The outline moved `distance` outwards (inwards where negative), each
   * point along the average of its two edges' outward normals. Exact enough
   * for a convex outline sampled this densely, out to any distance and in to
   * well past any decoration's width; the points where the quadrants meet,
   * repeated, are dropped first, having no direction of their own.
   */
  offsetOutline(points: Point[], distance: number): Point[] {
    const ring: Point[] = [];
    for (const p of points) {
      const last = ring[ring.length - 1];
      if (!last || Math.abs(last.x - p.x) > 1e-6 || Math.abs(last.y - p.y) > 1e-6) ring.push(p);
    }
    const first = ring[0];
    const end = ring[ring.length - 1];
    if (ring.length > 1 && Math.abs(first.x - end.x) < 1e-6 && Math.abs(first.y - end.y) < 1e-6) {
      ring.pop();
    }
    if (distance === 0) return ring;
    // Clockwise in screen coordinates, an edge (dx, dy)'s outward normal is
    // (dy, -dx); anticlockwise, its opposite.
    let twiceArea = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      twiceArea += p.x * q.y - q.x * p.y;
    }
    const out = twiceArea > 0 ? distance : -distance;
    const n = ring.length;
    return ring.map((p, i) => {
      const prev = ring[(i - 1 + n) % n];
      const next = ring[(i + 1) % n];
      const normal = (a: Point, b: Point) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy) || 1;
        return { x: dy / length, y: -dx / length };
      };
      const a = normal(prev, p);
      const b = normal(p, next);
      const mx = a.x + b.x;
      const my = a.y + b.y;
      const length = Math.hypot(mx, my) || 1;
      return { x: p.x + (mx / length) * out, y: p.y + (my / length) * out };
    });
  }

  /**
   * Whether the element paints anything of its own outside the stadium — a
   * shadow, a filter, an outline such as the browser's focus ring — which the
   * mask then has to leave open. Most pills paint nothing there, and are
   * spared drawing it.
   */
  paintsOutside(props?: PaintProperties): boolean {
    const value = (name: string) => props?.get(name)?.toString().trim() ?? "";
    const shadow = value("box-shadow");
    const filter = value("filter");
    const outline = value("outline-style");
    return (
      (shadow !== "" && shadow !== "none") ||
      (filter !== "" && filter !== "none") ||
      (outline !== "" && outline !== "none")
    );
  }

  /**
   * The bands the decoration draws outside the pill, which is all the mask
   * needs to leave open for them: what lies inside the pill is open already,
   * and colour doesn't matter. Packed by the stylesheet into one property —
   * the outline's offset and width, the ring's offset and width, the
   * outline's style — to spare the mask ten inputs.
   */
  maskBands(props?: PaintProperties): Band[] {
    const [outlineOffset, outline, ringOffset, ring, style = "solid"] = (
      props?.get(MASK_BANDS_VAR)?.toString().trim() ?? ""
    ).split(/\s+/);
    const px = (value: string | undefined) => {
      const n = Number.parseFloat(value ?? "");
      return Number.isFinite(n) ? n : 0;
    };
    const bands: Band[] = [];
    if (px(ring) > 0) {
      bands.push({ from: 0, to: Math.max(px(ringOffset), 0) + px(ring), color: "", dash: [] });
    }
    const width = px(outline);
    if (width > 0 && style !== "none" && style !== "hidden") {
      const from = px(outlineOffset);
      const dash =
        style === "dashed" ? [width * 3, width * 2] : style === "dotted" ? [width, width * 2] : [];
      bands.push({ from, to: from + width, color: "", dash });
    }
    return bands;
  }

  /** A length property in px, or 0 where it is unset or not a number. */
  resolveLength(props: PaintProperties | undefined, name: string): number {
    const value = Number.parseFloat(props?.get(name)?.toString() ?? "");
    return Number.isFinite(value) ? value : 0;
  }

  /**
   * How far the outline and the ring reach beyond the border box, which is
   * how much larger than it the decoration's box is. Matches the `inset` the
   * stylesheet gives that box, term for term.
   */
  decorationOutset(props?: PaintProperties): number {
    const outline =
      this.resolveLength(props, OUTLINE_OFFSET_VAR) + this.resolveLength(props, OUTLINE_WIDTH_VAR);
    const ring =
      this.resolveLength(props, RING_OFFSET_WIDTH_VAR) + this.resolveLength(props, RING_WIDTH_VAR);
    return Math.max(0, outline, ring);
  }

  /**
   * The bands to draw around and inside the outline, bottom first, as
   * distances out from it (negative is inwards), each with its colour and
   * dash pattern. They mean what their CSS namesakes do, measured from the
   * pill's own outline instead of the stadium: an inset ring inside the
   * border, a ring outside the border box beyond its offset band, an outline
   * on top beyond its offset.
   */
  decorationBands(props?: PaintProperties): Band[] {
    const color = (name: string) => props?.get(name)?.toString().trim() ?? "";
    const visible = (c: string) => c !== "" && c !== "transparent" && !/^rgba\(.*,\s*0\)$/.test(c);
    const bands: Band[] = [];
    const border = this.resolveLength(props, BORDER_WIDTH_VAR);

    const insetRing = this.resolveLength(props, INSET_RING_WIDTH_VAR);
    const insetRingColor = color(INSET_RING_COLOR_VAR);
    if (insetRing > 0 && visible(insetRingColor)) {
      bands.push({ from: -border - insetRing, to: -border, color: insetRingColor, dash: [] });
    }

    const ring = this.resolveLength(props, RING_WIDTH_VAR);
    if (ring > 0) {
      const offset = Math.max(this.resolveLength(props, RING_OFFSET_WIDTH_VAR), 0);
      const offsetColor = color(RING_OFFSET_COLOR_VAR);
      if (offset > 0 && visible(offsetColor)) {
        bands.push({ from: 0, to: offset, color: offsetColor, dash: [] });
      }
      const ringColor = color(RING_COLOR_VAR);
      if (visible(ringColor)) {
        bands.push({ from: offset, to: offset + ring, color: ringColor, dash: [] });
      }
    }

    const outline = this.resolveLength(props, OUTLINE_WIDTH_VAR);
    const outlineColor = color(OUTLINE_COLOR_VAR);
    const style = props?.get(OUTLINE_STYLE_VAR)?.toString().trim() || "solid";
    if (outline > 0 && visible(outlineColor) && style !== "none" && style !== "hidden") {
      const offset = this.resolveLength(props, OUTLINE_OFFSET_VAR);
      const dash =
        style === "dashed"
          ? [outline * 3, outline * 2]
          : style === "dotted"
            ? [outline, outline * 2]
            : [];
      bands.push({ from: offset, to: offset + outline, color: outlineColor, dash });
    }
    return bands;
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

/** The border ring, on `::after`: the shape in stroke mode. */
export const ringDef = class PillRing extends paintDef {
  static override get inputProperties() {
    return [AMT_VAR, EASE_SPREAD_VAR, CONTINUITY_VAR, STROKE_WIDTH_VAR, BORDER_STYLE_VAR];
  }
};

/**
 * The pill's outline, ring and inset ring, painted on `::before` over a box
 * larger than the element's border box by `decorationOutset` on every side.
 * Each band is a stroke along the outline moved out to the band's middle, as
 * wide as the band: the outline is convex, so that is exactly the region
 * between the band's two edges.
 */
export const decorationDef = class PillDecoration extends paintDef {
  static override get inputProperties() {
    return [AMT_VAR, EASE_SPREAD_VAR, CONTINUITY_VAR, ...DECORATION_INPUTS];
  }

  override paint(ctx: CanvasRenderingContext2D, size: PaintSize, props?: PaintProperties): void {
    const bands = this.decorationBands(props);
    if (bands.length === 0) return;
    const outset = this.decorationOutset(props);
    const width = size.width - 2 * outset;
    const height = size.height - 2 * outset;
    if (width <= 0 || height <= 0) return;
    const outline = this.boxOutline(width, height, props).map((p) => ({
      x: p.x + outset,
      y: p.y + outset,
    }));
    ctx.lineJoin = "round";
    for (const band of bands) {
      const path = this.offsetOutline(outline, (band.from + band.to) / 2);
      ctx.beginPath();
      path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.strokeStyle = band.color;
      ctx.lineWidth = band.to - band.from;
      ctx.setLineDash(band.dash);
      ctx.stroke();
    }
  }
};

if (typeof registerPaint !== "undefined") {
  registerPaint("pill-shape", paintDef);
  registerPaint("pill-ring", ringDef);
  registerPaint("pill-decoration", decorationDef);
}
