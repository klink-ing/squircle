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
const EASE_VAR = `${NS}-ease`;
const BORDER_STYLE_VAR = `${NS}-border-style`;
const CONTINUITY_VAR = `${NS}-continuity`;
const SIDE_VAR = `${NS}-side`;
const BORDER_WIDTH_VAR = `${NS}-border-width`;
const BORDER_COLOR_VAR = `${NS}-border-color`;
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
const BOX_SHADOW_VAR = `${NS}-box-shadow`;
const RESOLVED_SHADOW_VAR = `${NS}-resolved-shadow`;
const PAINT_ZOOM_VAR = `${NS}-paint-zoom`;
const REACH_VAR = `${NS}-reach`;
const BACKGROUND_INSET_VAR = `${NS}-background-inset`;
/** What decides the decoration; see `decorationBands` and `decorationShadows`. */
const DECORATION_INPUTS = [
  REACH_VAR,
  BORDER_WIDTH_VAR,
  BORDER_COLOR_VAR,
  BORDER_STYLE_VAR,
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
  BOX_SHADOW_VAR,
  RESOLVED_SHADOW_VAR,
  PAINT_ZOOM_VAR,
  // What `currentColor` stands for: a registered colour keeps the keyword as
  // its computed value, which a canvas has no element to resolve against.
  "color",
];

/** Overlap at independently antialiased edges; see `closeSeams` and `shadowCutout`. */
const SEAM = 0.5;

/** One band of a decoration; see `decorationBands`. */
interface Band {
  from: number;
  to: number;
  color: string;
  dash: number[];
}

/** One outer box shadow, in px; see `decorationShadows`. */
interface Shadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}

/** Splits at top-level `separator`s, leaving parentheses whole. */
function splitTopLevel(value: string, separator: "," | " "): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0 && (separator === "," ? ch === "," : /\s/.test(ch))) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * A shadow's length in px, or `null` for a token that isn't one. A custom
 * property hands the list over as written, so `rem` and `em` are taken at
 * the default 16px.
 */
function lengthInPx(token: string): number | null {
  const m = /^(-?(?:\d+\.?\d*|\.\d+))(px|rem|em)?$/.exec(token);
  if (!m) return null;
  const value = Number(m[1]);
  if (!m[2]) return value === 0 ? 0 : null;
  return m[2] === "px" ? value : value * 16;
}

/** `color` with any `currentColor` in it replaced by the element's own colour. */
function resolveCurrentColor(color: string, props?: PaintProperties): string {
  if (!/currentcolor/i.test(color)) return color;
  const current = props?.get("color")?.toString().trim() || "#000";
  return color.replace(/currentcolor/gi, current);
}

/** Whether a colour as written could show at all. */
function isVisible(color: string): boolean {
  const c = color.trim().toLowerCase();
  return !(
    c === "transparent" ||
    c === "#0000" ||
    c === "#00000000" ||
    /^rgba\(.*,\s*0\)$/.test(c) ||
    /\/\s*0%?\s*\)$/.test(c)
  );
}

interface PaintSize {
  width: number;
  height: number;
}

interface PaintProperties {
  get(name: string): { toString(): string } | undefined;
}

/** The paint callback contract; the DOM library does not define paint worklets. */
interface PaintWorklet {
  paint(ctx: CanvasRenderingContext2D, size: PaintSize, props?: PaintProperties): void;
}

interface Point {
  x: number;
  y: number;
}

/** An end a pill can cap alone; see `sideOutline`. */
type Side = "t" | "r" | "b" | "l";

interface FresnelTotals {
  totalCos: number;
  totalSin: number;
}

/**
 * The running integrals at each sample (see `SAMPLES`), and the integrands
 * there, which are their slopes: what `hermite` needs to place a point at
 * any node between them.
 */
interface Fresnel extends FresnelTotals {
  cos: number[];
  sin: number[];
  dcos: number[];
  dsin: number[];
}

/**
 * The profile at the samples alone, which is all the integrals need:
 * `remaining` there, its slope (for G3, where the nodes between are
 * interpolated), and `lambda`.
 */
interface Samples {
  remaining: number[];
  slope: number[];
  lambda: number;
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
  samples: Samples;
}

/**
 * The geometric continuity the transition keeps at both of its ends.
 *
 * `2` matches curvature: `k(t) = (1 / R) * (1 - t)^(q - 1)`, which leaves the
 * arc already shedding curvature at a finite rate. `3` also matches the rate
 * curvature changes, `dk/ds`, with `k(t) = (1 / R) * (1 - t^2)^(q - 1)`: flat
 * where it leaves the arc, and, for any exponent above 2, flat where it meets
 * the edge. The ease keeps its meaning — it is the same exponent — but G3
 * floors it at 0, the lowest ease that still arrives at the edge at all.
 *
 * G3 is the default: with the default ease it is flat at both ends, which
 * reads as the smoothest join. Kept in step with DEFAULT_PILL_CONTINUITY in
 * variants.ts by a test.
 */
type Continuity = 2 | 3;
const DEFAULT_CONTINUITY: Continuity = 3;

/**
 * Sized for a page full of pills: an entry is a few dozen points, and with
 * fewer entries than distinct sizes on the page each is evicted before it is
 * reused, so every repaint — a hover, say — works every shape out again.
 */
const QUADRANT_CACHE_SIZE = 1024;
const quadrantCache = new Map<string, Point[]>();

/**
 * The narrowest pill, as half-length over half-height, that fits a requested
 * easing unchanged, keyed by the request. Wider pills skip the fit entirely,
 * which is most of them: the boundary depends only on the request, not on the
 * element's size.
 */
const fitsAsAskedCache = new Map<string, number>();
/** Fitted easings for narrower pills, keyed by aspect ratio and request. */
const FIT_CACHE_SIZE = 1024;
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
  samples: Samples;
  fresnel: Fresnel;
  radiusRatio: number;
}
const TRANSITION_CACHE_SIZE = 1024;
/** The curvature profile depends on the exponent alone, not on the angle or the size. */
const PROFILE_CACHE_SIZE = 64;
const profileCache = new Map<string, Profile>();
const samplesCache = new Map<string, Samples>();
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
 * fit; see `fitEasing`.
 */
// Kept in step with DEFAULT_PILL_AMT in variants.ts by a test; this module is
// deliberately import-free so the worklet stays a standalone module script.
const DEFAULT_AMOUNT = 2;
const EASE_PER_AMOUNT = Math.PI / 6;
const MAX_EASE = Math.PI / 3;

/**
 * The ease smooths the join into the flat edge: it draws the transition
 * further along that edge without spending any more of the arc, so a softer
 * join no longer costs you a rounder cap. Raising it lets the amount come
 * down.
 *
 * `0` is a clothoid, where curvature falls linearly from the arc to the edge.
 * The ease offsets the exponent that governs that fall,
 * `k(t) = (1 / R) * (1 - t)^(q - 1)` with `q = ease + 2`, which makes the
 * transition `q * beta * R` long. Any ease above -1 still starts at `1 / R`
 * and ends at `0`, so G2 holds throughout.
 *
 * The default sits two steps above the clothoid, which reads as a soft join
 * without noticeably flattening the cap. Kept in step with DEFAULT_PILL_EASE
 * in variants.ts by a test.
 */
const DEFAULT_EASE = 2;
/** The exponent an ease of 0 means: curvature falling linearly, a clothoid. */
const CLOTHOID_EXPONENT = 2;
/**
 * 0 is the sane floor for real use. Below it the curvature still reaches zero,
 * but `dk/ds` diverges as it arrives; at -1 curvature never decays at all,
 * leaving the same corner a bare stadium has; and at -2 the transition has no
 * length. Those are still honoured so the effect can be seen. Lower would need
 * a negative exponent, where `u ** q` blows up at `u = 0`.
 */
const MIN_EASE = -CLOTHOID_EXPONENT;

/**
 * Nodes along one transition, where its vertices may land. Placement wants
 * them this fine — the last vertex before the flat edge lands on one, and
 * the angle it arrives at follows — but the integrals do not.
 */
const EASE_STEPS = 512;

/**
 * Intervals the integrals are taken over: every fourth node. Each is a
 * running integral of a smooth function, sampled with a rule exact for
 * cubics (`integrate`) and read between samples by cubic Hermite
 * interpolation (`hermite`), both fourth order. That is more accurate than a
 * trapezoid over every node, for a quarter of the `cos`, `sin` and `exp`.
 */
const SAMPLE_STRIDE = 4;
const SAMPLES = EASE_STEPS / SAMPLE_STRIDE;

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
 * The integral of `f`, given at `SAMPLES + 1` evenly spaced points of
 * `[0, 1]`, from 0 to each of them, into `out`; returns the whole. Each
 * interval takes the cubic through its four nearest samples, one-sided at the
 * ends.
 */
function integrate(f: number[], out: number[] | null): number {
  // Callers fill SAMPLES + 1 entries; the one-sided formulas stay in those bounds.
  const m = SAMPLES;
  const h = 1 / (24 * m);
  let total = 0;
  if (out) out[0] = 0;
  for (let j = 0; j < m; j++) {
    const weighted =
      j === 0
        ? 9 * f[0]! + 19 * f[1]! - 5 * f[2]! + f[3]!
        : j === m - 1
          ? f[m - 3]! - 5 * f[m - 2]! + 19 * f[m - 1]! + 9 * f[m]!
          : 13 * (f[j]! + f[j + 1]!) - f[j - 1]! - f[j + 2]!;
    total += weighted * h;
    if (out) out[j + 1] = total;
  }
  return total;
}

/**
 * A function given at the samples, with its slope there, at node `k` of the
 * `EASE_STEPS`: the cubic Hermite interpolant, exact at the samples.
 */
function hermite(values: number[], slopes: number[], k: number): number {
  // k is in [0, EASE_STEPS], so j and j + 1 address the populated samples.
  const j = Math.min(Math.floor(k / SAMPLE_STRIDE), SAMPLES - 1);
  const s = k / SAMPLE_STRIDE - j;
  if (s === 0) return values[j]!;
  const s2 = s * s;
  const s3 = s2 * s;
  const h = 1 / SAMPLES;
  return (
    (2 * s3 - 3 * s2 + 1) * values[j]! +
    (s3 - 2 * s2 + s) * h * slopes[j]! +
    (3 * s2 - 2 * s3) * values[j + 1]! +
    (s3 - s2) * h * slopes[j + 1]!
  );
}

/** The integrands at the samples, reused by every probe of the fit. */
/**
 * A plain array of `length` numbers, which is many times cheaper to allocate
 * than a `Float64Array` of a few hundred: that gets a buffer of its own
 * outside the heap, and every new shape allocates several. Filled with a
 * fraction, so it holds doubles from the start rather than switching to them
 * on the first write.
 */
const numbers = (length: number): number[] =>
  // Sized up front: twice as fast as pushing, and this is the hot path.
  // eslint-disable-next-line unicorn/no-new-array
  new Array<number>(length).fill(0.5);
const sampleArray = (): number[] => numbers(SAMPLES + 1);

const scratchCos = sampleArray();
const scratchSin = sampleArray();

/** Running integrals and integrands, without their totals; see `Fresnel`. */
type Integrals = Omit<Fresnel, keyof FresnelTotals>;
const integralArrays = (): Integrals => {
  return { cos: sampleArray(), sin: sampleArray(), dcos: sampleArray(), dsin: sampleArray() };
};
/** Two sets for the fit's probes, which take turns holding the best so far. */
const probeArrays: [Integrals, Integrals] = [integralArrays(), integralArrays()];

/**
 * How far the emitted polyline may sit from the true curve, in pixels.
 *
 * A chord spanning arc length `ds` while the curve turns `dphi` misses it by
 * about `ds * dphi / 8`, so bounding that product places vertices densely where
 * the outline turns hardest and sparsely down the near-straight tail. Sampling
 * at a fixed rate instead starves the start of the transition, which is exactly
 * where a wide ease piles up all of the curvature.
 */
const MAX_SAGITTA = 0.03;
const MIN_SEGMENTS = 4;
const MAX_SEGMENTS = 256;

export const paintDef = class PillShape implements PaintWorklet {
  /*
   * As few as it can do with: every input is gathered for every pill on every
   * resize, which adds up over hundreds of them.
   */
  static get inputProperties() {
    return [AMT_VAR, EASE_VAR, CONTINUITY_VAR, SIDE_VAR, BACKGROUND_INSET_VAR];
  }

  /**
   * Dash pattern for a band `width` wide drawn in a border or outline
   * `style`, in multiples of its width; `null` for `none` and `hidden`, which
   * draw nothing, as those keywords do to a real border.
   *
   * The worklet keeps its own vocabulary rather than reading a framework's
   * variables directly; the Tailwind layer maps `--tw-border-style` onto this.
   */
  resolveDash(style: string | undefined, width: number): number[] | null {
    const value = style?.trim() || "solid";
    if (value === "none" || value === "hidden") return null;
    if (value === "dashed") return [width * 3, width * 2];
    if (value === "dotted") return [width, width * 2];
    return [];
  }

  /** The requested easing angle, in radians, before it is fitted to the box. */
  resolveAngle(props?: PaintProperties): number {
    const raw = Number.parseFloat(props?.get(AMT_VAR)?.toString() ?? "");
    const amt = Number.isFinite(raw) ? raw : DEFAULT_AMOUNT;
    return Math.min(Math.max(amt - 1, 0) * EASE_PER_AMOUNT, MAX_EASE);
  }

  /**
   * How far the join is eased along the flat edge, as the curvature exponent
   * it offsets; see `DEFAULT_EASE`.
   */
  resolveExponent(props?: PaintProperties): number {
    const raw = Number.parseFloat(props?.get(EASE_VAR)?.toString() ?? "");
    const ease = Number.isFinite(raw) ? raw : DEFAULT_EASE;
    return Math.max(ease, MIN_EASE) + CLOTHOID_EXPONENT;
  }

  /** `2` for G2, anything else the G3 default; see `Continuity`. */
  resolveContinuity(props?: PaintProperties): Continuity {
    const raw = Number.parseFloat(props?.get(CONTINUITY_VAR)?.toString() ?? "");
    return Number.isFinite(raw) && raw < 2.5 ? 2 : DEFAULT_CONTINUITY;
  }

  /** The end the pill caps alone, or `auto` for both short ends. */
  resolveSide(props?: PaintProperties): Side | "auto" {
    const value = props?.get(SIDE_VAR)?.toString().trim();
    return value === "t" || value === "r" || value === "b" || value === "l" ? value : "auto";
  }

  /**
   * The transition's curvature profile for exponent `q` at every node; see
   * `Profile`. Only drawing needs every node, to place vertices; the fit makes
   * do with `samples`.
   */
  profile(q: number, continuity: Continuity): Profile {
    const key = `${q},${continuity}`;
    const known = profileCache.get(key);
    if (known) return known;
    const samples = this.samples(q, continuity);
    const remaining = new Float64Array(EASE_STEPS + 1);
    for (let k = 0; k <= EASE_STEPS; k++) {
      remaining[k] = this.remainingAt(samples, q, continuity, k);
    }
    return remember(profileCache, PROFILE_CACHE_SIZE, key, {
      remaining,
      lambda: samples.lambda,
      samples,
    });
  }

  /**
   * `remaining` at node `k`: the sample itself where there is one. Between
   * them, G2's is in closed form and G3's interpolated, with the slope the
   * curvature gives it; G2's slope diverges at the edge below an ease of -1,
   * where interpolating would fail.
   */
  remainingAt(samples: Samples, q: number, continuity: Continuity, k: number): number {
    if (k % SAMPLE_STRIDE === 0) return samples.remaining[k / SAMPLE_STRIDE]!;
    return continuity === 2
      ? powFromLog(LOG_ONE_MINUS_T[k]!, q)
      : hermite(samples.remaining, samples.slope, k);
  }

  /** The profile at the samples; see `Samples`. */
  samples(q: number, continuity: Continuity): Samples {
    const key = `${q},${continuity}`;
    const known = samplesCache.get(key);
    if (known) return known;
    const remaining = sampleArray();
    const slope = sampleArray();
    let lambda = q;
    if (continuity === 2) {
      for (let j = 0; j <= SAMPLES; j++) {
        remaining[j] = powFromLog(LOG_ONE_MINUS_T[j * SAMPLE_STRIDE]!, q);
      }
    } else {
      // Curvature (1 - t^2)^e, integrated for the turn taken so far, and
      // normalised: the curvature, scaled by the same total, is the slope.
      const e = Math.max(q - 1, 1);
      for (let j = 0; j <= SAMPLES; j++) {
        slope[j] = powFromLog(LOG_ONE_MINUS_T2[j * SAMPLE_STRIDE]!, e);
      }
      const total = integrate(slope, remaining);
      for (let j = 0; j <= SAMPLES; j++) {
        remaining[j] = 1 - remaining[j]! / total;
        slope[j] = -slope[j]! / total;
      }
      lambda = 1 / total;
    }
    return remember(samplesCache, PROFILE_CACHE_SIZE, key, { remaining, slope, lambda });
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
  fresnel(beta: number, samples: Samples): Fresnel {
    const into = integralArrays();
    const { totalCos, totalSin } = this.integrals(beta, samples, into);
    return { ...into, totalCos, totalSin };
  }

  /**
   * The totals of `fresnel`, and with `into` its running integrals and
   * integrands too; the fit probes this many times over, and keeps nothing
   * from most of them.
   */
  integrals(beta: number, { remaining }: Samples, into?: Integrals): FresnelTotals {
    const dcos = into ? into.dcos : scratchCos;
    const dsin = into ? into.dsin : scratchSin;
    for (let j = 0; j <= SAMPLES; j++) {
      const angle = beta * remaining[j]!;
      dcos[j] = Math.cos(angle);
      dsin[j] = Math.sin(angle);
    }
    return {
      totalCos: integrate(dcos, into ? into.cos : null),
      totalSin: integrate(dsin, into ? into.sin : null),
    };
  }

  /**
   * Where the easing meets the flat edge, over the cap's half-height, for a
   * cap easing through `beta` with exponent `q`; `capMetrics` over the
   * samples and their integrals, with `into` keeping the integrals.
   */
  junctionRatio(beta: number, q: number, continuity: Continuity, into?: Integrals): number {
    const samples = this.samples(q, continuity);
    const totals = this.integrals(beta, samples, into);
    return this.capMetrics(1, beta, samples.lambda, totals).junction;
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
   * The softest easing that still fits, backing off the amount and the ease
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
    const reach = (beta: number, into?: Integrals): number =>
      this.junctionRatio(beta, exponentFor(beta), continuity, into);
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
    // The probe that became `low` has just integrated the very transition the
    // quadrant is about to draw, so its running integrals are kept for
    // `transition` rather than worked out again.
    let kept: Integrals | null = null;
    let spare = probeArrays[0];
    for (let i = 0; i < 40; i++) {
      // Out of the bracket, or still searching after a few steps: bisect.
      if (!(next > low && next < high) || i > 3) next = (low + high) / 2;
      const f = reach(next, spare) - ratio;
      if (f <= 0) {
        low = next;
        fLow = f;
        [kept, spare] = [spare, kept ?? probeArrays[1]];
      } else {
        high = next;
        fHigh = f;
      }
      const gap = (-fLow * (high - low)) / (fHigh - fLow);
      if (gap <= tolerance || high - low <= tolerance) break;
      next = low + gap - tolerance / 2;
    }
    const fitted = { beta: low, exponent: exponentFor(low) };
    if (kept) this.keepTransition(fitted.beta, fitted.exponent, continuity, kept);
    return remember(fitCache, FIT_CACHE_SIZE, key, fitted);
  }

  /** Files a transition whose integrals the fit has just computed; see `transition`. */
  keepTransition(beta: number, q: number, continuity: Continuity, probed: Integrals): void {
    const key = `${beta},${q},${continuity}`;
    if (transitionCache.has(key)) return;
    const samples = this.samples(q, continuity);
    // The probe's arrays are the fit's to reuse; the transition keeps a copy.
    const integrals = {
      cos: probed.cos.slice(),
      sin: probed.sin.slice(),
      dcos: probed.dcos.slice(),
      dsin: probed.dsin.slice(),
    };
    const fresnel = {
      ...integrals,
      totalCos: integrals.cos[SAMPLES] as number,
      totalSin: integrals.sin[SAMPLES] as number,
    };
    const { radius } = this.capMetrics(1, beta, samples.lambda, fresnel);
    remember(transitionCache, TRANSITION_CACHE_SIZE, key, {
      samples,
      fresnel,
      radiusRatio: radius,
    });
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
    const { samples, fresnel } = eased;

    // The lowest ease gives the transition no length at all: the arc alone
    // spans the height and meets the flat edge at a corner.
    if (samples.lambda <= 0) return points;

    // Curvature ramps from 1 / radius down to 0 across the transition, which
    // the profile makes lambda * beta * radius long. Vertices land where the
    // chord would otherwise drift off the curve: at the first node past the
    // last vertex where it would drift too far.
    const length = samples.lambda * radius * beta;
    const start = points[points.length - 1]!;
    const at = (k: number): Point => ({
      x: start.x + length * hermite(fresnel.cos, fresnel.dcos, k),
      y: start.y - length * hermite(fresnel.sin, fresnel.dsin, k),
    });
    const remainingAt = (k: number) => this.remainingAt(samples, q, continuity, k);

    let anchor = 0;
    let anchorRemaining = remainingAt(0);
    // The drift only grows along the curve, so the first node where it is too
    // much is found from the samples, where the profile is known for free,
    // then among the nodes just before the first sample past it.
    const drifts = (k: number) =>
      length * ((k - anchor) / EASE_STEPS) * beta * (anchorRemaining - remainingAt(k)) >=
      8 * MAX_SAGITTA;
    for (;;) {
      let past = (Math.floor(anchor / SAMPLE_STRIDE) + 1) * SAMPLE_STRIDE;
      while (past < EASE_STEPS && !drifts(past)) past += SAMPLE_STRIDE;
      let k = Math.max(anchor + 1, past - SAMPLE_STRIDE + 1);
      while (k < past && !drifts(k)) k++;
      if (k >= EASE_STEPS) break;
      points.push(at(k));
      anchor = k;
      anchorRemaining = remainingAt(k);
    }
    points.push(at(EASE_STEPS));

    return points;
  }

  /**
   * Fills the pill, opaque. It is consumed as a mask — of the copy of the
   * element's background that the pill shows — where only the alpha channel
   * counts and the background supplies the colour. Reading `color` here would
   * mean `color: transparent` erased the pill.
   */
  paint(ctx: CanvasRenderingContext2D, size: PaintSize, props?: PaintProperties): void {
    const { width, height } = size;
    if (width <= 0 || height <= 0) return;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    // Pulled in under a border; see the stylesheet's background inset.
    const inset = Math.max(this.resolveLength(props, BACKGROUND_INSET_VAR), 0);
    if (inset <= 0 && this.resolveSide(props) === "auto") {
      // Most pills: the outline is the quadrant four times over, traced as
      // `boxOutline` would list it without building the list.
      this.traceBox(ctx, width, height, props);
      ctx.closePath();
      ctx.fill();
      return;
    }
    const outline =
      inset > 0
        ? this.offsetOutline(this.boxOutline(width, height, props), -inset)
        : this.boxOutline(width, height, props);
    for (let i = 0; i < outline.length; i++) {
      const p = outline[i]!;
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
  }

  /** The size-independent transition for an easing; see `Transition`. */
  transition(beta: number, q: number, continuity: Continuity): Transition {
    const key = `${beta},${q},${continuity}`;
    const cached = transitionCache.get(key);
    if (cached) return cached;
    const samples = this.samples(q, continuity);
    const fresnel = this.fresnel(beta, samples);
    const { radius } = this.capMetrics(1, beta, samples.lambda, fresnel);
    return remember(transitionCache, TRANSITION_CACHE_SIZE, key, {
      samples,
      fresnel,
      radiusRatio: radius,
    });
  }

  /**
   * The quadrant for a box, with the easing fitted to it.
   *
   * Memoised, because the same shape is painted at least twice — once as the
   * background's mask and once as its decoration — and again on every repaint that
   * changes nothing about it, such as a hover. The quadrant is the expensive
   * part, and it depends only on the height and the fitted easing — not the
   * length, so a pill long enough for its easing keeps one quadrant however
   * it is resized.
   */
  fittedQuadrant(
    long: number,
    short: number,
    ease: number,
    exponent: number,
    continuity: Continuity = DEFAULT_CONTINUITY,
  ): Point[] {
    const r = short / 2;
    const fitted = this.fitEasing(r, long / 2, ease, exponent, continuity);
    const key = `${short},${fitted.beta},${fitted.exponent},${continuity}`;
    const cached = quadrantCache.get(key);
    if (cached) return cached;

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
    const side = this.resolveSide(props);
    if (side !== "auto") return this.sideOutline(width, height, side, props);
    const vertical = height > width;
    const long = vertical ? height : width;
    const short = vertical ? width : height;
    const outline = this.outline(
      long,
      short,
      this.fittedQuadrant(
        long,
        short,
        this.resolveAngle(props),
        this.resolveExponent(props),
        this.resolveContinuity(props),
      ),
    );
    return vertical ? outline.map((p) => ({ x: p.y, y: p.x })) : outline;
  }

  /**
   * `boxOutline` for a pill capped at both ends, traced into `ctx` point for
   * point, without the four mirrored copies of the quadrant it would build
   * (and a fifth, transposed, for a tall pill) only to walk them once.
   */
  traceBox(ctx: CanvasRenderingContext2D, width: number, height: number, props?: PaintProperties) {
    const vertical = height > width;
    const long = vertical ? height : width;
    const short = vertical ? width : height;
    const quadrant = this.fittedQuadrant(
      long,
      short,
      this.resolveAngle(props),
      this.resolveExponent(props),
      this.resolveContinuity(props),
    );
    const n = quadrant.length;
    let first = true;
    const to = (x: number, y: number) => {
      const px = vertical ? y : x;
      const py = vertical ? x : y;
      if (first) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      first = false;
    };
    // In `outline`'s order: the quadrant, then mirrored in x, in both, in y.
    for (let i = 0; i < n; i++) to(quadrant[i]!.x, quadrant[i]!.y);
    for (let i = n - 1; i >= 0; i--) to(long - quadrant[i]!.x, quadrant[i]!.y);
    for (let i = 0; i < n; i++) to(long - quadrant[i]!.x, short - quadrant[i]!.y);
    for (let i = n - 1; i >= 0; i--) to(quadrant[i]!.x, short - quadrant[i]!.y);
  }

  /**
   * The outline of a pill capped at `side` alone, square at the other end.
   * Built for the left end, then turned into place: `r` mirrored, `t`
   * transposed, `b` transposed and mirrored. Which way round it runs doesn't
   * matter; `offsetOutline` works out either.
   *
   * Each capped corner gets the largest radius both its edges can give it:
   * half the left edge, which the two caps share, or the whole top edge,
   * which the cap has to itself. Whichever is smaller is used up entirely, so
   * the corner is exactly a pill's quadrant. Its cap meets its mirror image
   * halfway down the left edge, or the square corner at the far end of the
   * top one, and its easing runs along the other edge.
   */
  sideOutline(width: number, height: number, side: Side, props?: PaintProperties): Point[] {
    const across = side === "t" || side === "b";
    // The box seen from the capped end: `w` along the square edges, `h` along the capped one.
    const w = across ? height : width;
    const h = across ? width : height;
    const ease = this.resolveAngle(props);
    const exponent = this.resolveExponent(props);
    const continuity = this.resolveContinuity(props);

    // The top-left corner, from the left edge round to the top edge.
    const corner =
      h / 2 <= w
        ? // The left edge binds: the caps meet halfway down it, and each eases
          // along the whole top edge.
          this.fittedQuadrant(2 * w, h, ease, exponent, continuity)
        : // The top edge binds: the cap spans it, meeting the square corner,
          // and eases down half the left edge.
          this.fittedQuadrant(h, 2 * w, ease, exponent, continuity)
            .map((p) => ({ x: p.y, y: p.x }))
            .reverse();
    const left: Point[] = [
      ...corner,
      { x: w, y: 0 },
      { x: w, y: h },
      ...[...corner].reverse().map((p) => ({ x: p.x, y: h - p.y })),
    ];

    if (side === "l") return left;
    if (side === "r") return left.map((p) => ({ x: w - p.x, y: p.y }));
    if (side === "t") return left.map((p) => ({ x: p.y, y: p.x }));
    return left.map((p) => ({ x: p.y, y: w - p.x }));
  }

  /** The shadow's inner cutout, with a small overlap at the background edge. */
  shadowCutout(points: Point[]): Point[] {
    // A cutout exactly on the background mask's edge leaves both partially
    // transparent there. Move only the cutout inward, keeping the caster and
    // its blur/spread unchanged and the rest of a transparent pill clear.
    return this.offsetOutline(points, -SEAM);
  }

  /**
   * The outline moved `distance` outwards (inwards where negative): each
   * point of a curve along the average of its two edges' outward normals, and
   * each real corner along its miter. Exact enough for a convex outline
   * sampled this densely, out to any distance and in to well past any
   * decoration's width; the points where the pieces meet, repeated, are
   * dropped first, having no direction of their own.
   */
  offsetOutline(points: Point[], distance: number): Point[] {
    const ring: Point[] = [];
    for (const p of points) {
      const last = ring[ring.length - 1];
      if (!last || Math.abs(last.x - p.x) > 1e-6 || Math.abs(last.y - p.y) > 1e-6) ring.push(p);
    }
    const first = ring[0];
    const end = ring[ring.length - 1];
    if (
      first &&
      end &&
      ring.length > 1 &&
      Math.abs(first.x - end.x) < 1e-6 &&
      Math.abs(first.y - end.y) < 1e-6
    ) {
      ring.pop();
    }
    if (distance === 0) return ring;
    // Clockwise in screen coordinates, an edge (dx, dy)'s outward normal is
    // (dy, -dx); anticlockwise, its opposite.
    let twiceArea = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i]!;
      const q = ring[(i + 1) % ring.length]!;
      twiceArea += p.x * q.y - q.x * p.y;
    }
    const out = twiceArea > 0 ? distance : -distance;
    const n = ring.length;
    // Each edge's unit normal, once: a point uses the two edges that meet at it.
    const nx = numbers(n);
    const ny = numbers(n);
    for (let i = 0; i < n; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % n]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.sqrt(dx * dx + dy * dy) || 1;
      nx[i] = dy / length;
      ny[i] = -dx / length;
    }
    const moved: Point[] = [];
    for (let i = 0; i < n; i++) {
      const before = (i - 1 + n) % n;
      const mx = nx[before]! + nx[i]!;
      const my = ny[before]! + ny[i]!;
      // Where the outline turns a real corner — a side pill's square end —
      // along the miter, so both edges move the full distance and the corner
      // stays square. Elsewhere the outline samples a curve, and the average
      // normal is the curve's own.
      const cos = nx[before]! * nx[i]! + ny[before]! * ny[i]!;
      const scale =
        cos < Math.SQRT1_2 ? out / (1 + cos) : out / (Math.sqrt(mx * mx + my * my) || 1);
      const p = ring[i]!;
      moved.push({ x: p.x + mx * scale, y: p.y + my * scale });
    }
    return moved;
  }

  /** A length property in px, or 0 where it is unset or not a number. */
  resolveLength(props: PaintProperties | undefined, name: string): number {
    const value = Number.parseFloat(props?.get(name)?.toString() ?? "");
    return Number.isFinite(value) ? value : 0;
  }

  /**
   * How far the decoration reaches beyond the border box — the outline, the
   * ring, the shadows — which is how much larger than it the decoration's box
   * is on every side. The stylesheet works it out, and sizes that box by it.
   */
  decorationOutset(props?: PaintProperties): number {
    return Math.max(this.resolveLength(props, REACH_VAR), 0);
  }

  /**
   * The outer shadows in a `box-shadow` list, in px, first on top as CSS
   * paints them. Inset shadows are left to the copy of the background, which
   * paints them itself; invisible ones are dropped.
   */
  decorationShadows(props?: PaintProperties): Shadow[] {
    const value =
      (props?.get(RESOLVED_SHADOW_VAR)?.toString().trim() ||
        props?.get(BOX_SHADOW_VAR)?.toString().trim()) ??
      "";
    if (value === "" || value === "none") return [];
    const shadows: Shadow[] = [];
    for (const layer of splitTopLevel(value, ",")) {
      const tokens = splitTopLevel(layer, " ");
      if (tokens.includes("inset")) continue;
      const lengths: number[] = [];
      const color: string[] = [];
      for (const token of tokens) {
        const length = lengthInPx(token);
        if (length === null) color.push(token);
        else lengths.push(length);
      }
      const [x = 0, y = 0, blur = 0, spread = 0] = lengths;
      const paint = resolveCurrentColor(color.join(" ") || "currentColor", props);
      if (lengths.length < 2 || !isVisible(paint)) continue;
      shadows.push({ x, y, blur: Math.max(blur, 0), spread, color: paint });
    }
    return shadows;
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
    const color = (name: string) =>
      resolveCurrentColor(props?.get(name)?.toString().trim() ?? "", props);
    const visible = (c: string) => c !== "" && isVisible(c);
    const bands: Band[] = [];
    const border = this.resolveLength(props, BORDER_WIDTH_VAR);
    const borderColor = color(BORDER_COLOR_VAR);
    const borderDash = this.resolveDash(props?.get(BORDER_STYLE_VAR)?.toString(), border);
    if (border > 0 && visible(borderColor) && borderDash !== null) {
      bands.push({ from: -border, to: 0, color: borderColor, dash: borderDash });
    }

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
    const outlineDash = this.resolveDash(props?.get(OUTLINE_STYLE_VAR)?.toString(), outline);
    if (outline > 0 && visible(outlineColor) && outlineDash !== null) {
      const offset = this.resolveLength(props, OUTLINE_OFFSET_VAR);
      bands.push({ from: offset, to: offset + outline, color: outlineColor, dash: outlineDash });
    }
    return this.closeSeams(bands);
  }

  /**
   * Two shapes anti-aliased along the same edge each leave the pixels there
   * partly uncovered, so whatever is behind shows through as a hairline. So
   * where two bands meet, the lower one runs `SEAM` on under the upper one,
   * where it is hidden; not under a dashed one, whose gaps would show it. A
   * band meeting the background's edge from outside runs on over the
   * background instead, unless a band already covers that edge from inside —
   * in which case the background is what pulls back; see the stylesheet's
   * background inset and the polyfill's background clip.
   */
  closeSeams(bands: Band[]): Band[] {
    const meets = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    const edgeCovered = bands.some((b) => b.from < 0 && meets(b.to, 0));
    return bands.map((band, i) => {
      let { from, to } = band;
      for (const upper of bands.slice(i + 1)) {
        if (upper.dash.length > 0) continue;
        if (meets(upper.from, band.to)) to = band.to + SEAM;
        if (meets(upper.to, band.from)) from = band.from - SEAM;
      }
      if (!edgeCovered && meets(band.from, 0)) from = -SEAM;
      return { ...band, from, to };
    });
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

/**
 * Everything the pill draws around its outline, on `::after`, over a box
 * larger than the element's border box by `decorationOutset` on every side:
 * its box shadows, then its border, inset ring, ring and outline.
 *
 * Each band is a stroke along the outline moved out to the band's middle, as
 * wide as the band: the outline is convex, so that is exactly the region
 * between the band's two edges. The shadows are cast by the outline itself,
 * grown by their spread. The inner cutout overlaps the background edge by
 * half a CSS pixel so independently antialiased edges cannot leave a seam.
 */
export const decorationDef = class PillDecoration extends paintDef {
  static override get inputProperties() {
    return [AMT_VAR, EASE_VAR, CONTINUITY_VAR, SIDE_VAR, ...DECORATION_INPUTS];
  }

  override paint(ctx: CanvasRenderingContext2D, size: PaintSize, props?: PaintProperties): void {
    const bands = this.decorationBands(props);
    const shadows = this.decorationShadows(props);
    if (bands.length === 0 && shadows.length === 0) return;
    const outset = this.decorationOutset(props);
    const width = size.width - 2 * outset;
    const height = size.height - 2 * outset;
    if (width <= 0 || height <= 0) return;
    const outline = this.boxOutline(width, height, props).map((p) => ({
      x: p.x + outset,
      y: p.y + outset,
    }));
    const trace = (path: Point[], dx = 0, dy = 0) => {
      ctx.beginPath();
      path.forEach((p, i) =>
        i === 0 ? ctx.moveTo(p.x + dx, p.y + dy) : ctx.lineTo(p.x + dx, p.y + dy),
      );
      ctx.closePath();
    };

    if (shadows.length > 0) {
      ctx.save();
      // Outside the outline, with a small overlap at the background's edge.
      ctx.beginPath();
      ctx.rect(0, 0, size.width, size.height);
      this.shadowCutout(outline).forEach((p, i) =>
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
      );
      ctx.closePath();
      ctx.clip("evenodd");
      // Last first, as CSS stacks them. Blur the shifted caster directly
      // where canvas filters are available. Canvas filter lengths need the
      // effective CSS zoom, while path coordinates are scaled by the browser.
      const away = size.width + size.height + 1000;
      const filters = typeof ctx.filter === "string";
      const zoom = this.resolveLength(props, PAINT_ZOOM_VAR) || 1;
      for (const shadow of [...shadows].reverse()) {
        if (shadow.blur === 0 || filters) {
          if (filters)
            ctx.filter = shadow.blur > 0 ? `blur(${(shadow.blur * zoom) / 2}px)` : "none";
          ctx.shadowColor = "transparent";
          ctx.fillStyle = shadow.color;
          trace(this.offsetOutline(outline, shadow.spread), shadow.x, shadow.y);
          ctx.fill();
          continue;
        }
        // Older contexts without filters: cast an off-canvas source back
        // onto the canvas so only its shadow lands.
        ctx.fillStyle = "#000";
        ctx.shadowColor = shadow.color;
        ctx.shadowBlur = shadow.blur;
        ctx.shadowOffsetX = shadow.x + away;
        ctx.shadowOffsetY = shadow.y;
        trace(this.offsetOutline(outline, shadow.spread), -away);
        ctx.fill();
      }
      ctx.restore();
    }

    // Mitred, so a band keeps a side pill's square corners square.
    ctx.lineJoin = "miter";
    for (const band of bands) {
      trace(this.offsetOutline(outline, (band.from + band.to) / 2));
      ctx.strokeStyle = band.color;
      ctx.lineWidth = band.to - band.from;
      ctx.setLineDash(band.dash);
      ctx.stroke();
    }
  }
};

if (typeof registerPaint !== "undefined") {
  registerPaint("pill-shape", paintDef);
  registerPaint("pill-decoration", decorationDef);
}
