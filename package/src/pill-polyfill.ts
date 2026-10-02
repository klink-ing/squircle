/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { type BoxEdges, clipShape, clipToConvex, needsBoxEdges } from "./clip-shape";
import { paintDef } from "./pill-shape.worklet";
import {
  PILL_AMT_VAR_NAME,
  PILL_ATTRIBUTE,
  PILL_BORDER_STYLE_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
  PILL_EASE_SPREAD_VAR_NAME,
  PILL_CLIP_VAR_NAME,
  PILL_CLIPPED_ATTRIBUTE,
  PILL_POLYFILL_ATTRIBUTE,
  PILL_RING_CLIP_VAR_NAME,
} from "./variants";

export { PILL_POLYFILL_ATTRIBUTE };

interface Point {
  x: number;
  y: number;
}

/** The custom-property values that shape one pill, as computed strings. */
export interface PillShapeInput {
  amt?: string;
  spread?: string;
  continuity?: string;
}

interface PillGeometry {
  resolveEase(props: Lookup): number;
  resolveExponent(props: Lookup): number;
  resolveContinuity(props: Lookup): 2 | 3;
  resolveDash(props: Lookup, width: number): number[] | null;
  fittedQuadrant(
    long: number,
    short: number,
    ease: number,
    exponent: number,
    continuity: 2 | 3,
  ): Point[];
  outline(long: number, short: number, quadrant: Point[]): Point[];
}

interface Lookup {
  get(name: string): { toString(): string } | undefined;
}

// The worklet's own geometry, so the polyfill draws exactly the same shape.
const geometry = new (paintDef as unknown as new () => PillGeometry)();

const lookup = (values: Record<string, string | undefined>): Lookup => ({
  get: (name) => {
    const value = values[name];
    return value === undefined || value === "" ? undefined : { toString: () => value };
  },
});

/**
 * The pill's outline in box coordinates, in the order the worklet draws it:
 * clockwise from the leftmost point for a wide pill, and that mirrored —
 * anticlockwise from the topmost — for a tall one.
 */
export function pillOutlinePoints(
  width: number,
  height: number,
  shape: PillShapeInput = {},
): Point[] {
  if (width <= 0 || height <= 0) return [];
  const props = lookup({
    [PILL_AMT_VAR_NAME]: shape.amt,
    [PILL_EASE_SPREAD_VAR_NAME]: shape.spread,
    [PILL_CONTINUITY_VAR_NAME]: shape.continuity,
  });
  const vertical = height > width;
  const long = vertical ? height : width;
  const short = vertical ? width : height;
  const quadrant = geometry.fittedQuadrant(
    long,
    short,
    geometry.resolveEase(props),
    geometry.resolveExponent(props),
    geometry.resolveContinuity(props),
  );
  const out: Point[] = [];
  for (const p of geometry.outline(long, short, quadrant)) {
    const q = vertical ? { x: p.y, y: p.x } : p;
    // The mirrored quadrants meet at shared points; drop the repeats, which
    // have no direction to offset along.
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - q.x) > 1e-6 || Math.abs(last.y - q.y) > 1e-6) out.push(q);
  }
  // The outline returns to where it began; `Z` closes it instead.
  const first = out[0];
  const last = out[out.length - 1];
  if (
    first &&
    last &&
    out.length > 1 &&
    Math.abs(first.x - last.x) < 1e-6 &&
    Math.abs(first.y - last.y) < 1e-6
  ) {
    out.pop();
  }
  return out;
}

/**
 * Two decimals is a hundredth of a pixel, well under anything a clip can
 * resolve.
 */
const round = (v: number) => Math.round(v * 100) / 100;
const subpath = (points: Point[]): string => {
  // Rounding by hand is several times cheaper than `toFixed`, and this runs
  // for every point of every pill on every resize.
  const first = points[0] as Point;
  let d = `M${round(first.x)} ${round(first.y)}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i] as Point;
    d += `L${round(p.x)} ${round(p.y)}`;
  }
  return `${d}Z`;
};

/** The pill's outline as SVG path data, in the coordinates of its box. */
export function pillOutlinePath(width: number, height: number, shape: PillShapeInput = {}): string {
  const points = pillOutlinePoints(width, height, shape);
  return points.length > 0 ? subpath(points) : "";
}

/** The `clip-path` the element had of its own, which the pill's has to keep. */
export interface OwnClip {
  /** Its computed value. */
  value: string;
  /** Border, padding and margin widths, for a clip against one of those boxes. */
  edges?: BoxEdges;
}

/** Clips everything: what an empty intersection leaves. */
const CLIP_ALL = "inset(50%)";

/**
 * The element's `clip-path`: the pill's outline, cut to the element's own
 * clip if it has one. `null` where the element's own clip should stand as it
 * is — a square without one, whose stadium `border-radius` is already the
 * circle a square pill has to be, or a clip that can't be expressed as
 * polygons, such as a `url()` reference.
 */
export function pillClipPath(
  width: number,
  height: number,
  shape?: PillShapeInput,
  own?: OwnClip,
): string | null {
  if (width <= 0 || height <= 0) return null;
  const theirs = own ? clipShape(own.value, width, height, own.edges) : null;
  if (theirs === undefined) return null;
  if (theirs === null) {
    return width === height ? null : `path("${pillOutlinePath(width, height, shape)}")`;
  }
  const drawn = pillOutlinePoints(width, height, shape);
  const outline = isClockwise(drawn) ? drawn : [...drawn].reverse();
  let d = "";
  for (const ring of theirs.rings) {
    const cut = clipToConvex(ring, outline);
    if (cut.length > 2) d += subpath(cut);
  }
  if (!d) return CLIP_ALL;
  return theirs.rule === "evenodd" ? `path(evenodd, "${d}")` : `path("${d}")`;
}

/** Whether the outline runs clockwise in screen coordinates, as a wide pill's does. */
function isClockwise(points: Point[]): boolean {
  let twiceArea = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length] as Point;
    twiceArea += p.x * q.y - q.x * p.y;
  });
  return twiceArea > 0;
}

/**
 * Each outline point moved `distance` towards the inside, along the average
 * of its two edges' inward normals. The outline is convex; running clockwise
 * in screen coordinates, the inward normal of an edge (dx, dy) is (-dy, dx),
 * and a tall pill's, which runs the other way, is its opposite.
 */
function inset(points: Point[], distance: number): Point[] {
  const n = points.length;
  if (!isClockwise(points)) distance = -distance;
  return points.map((p, i) => {
    const prev = points[(i - 1 + n) % n] as Point;
    const next = points[(i + 1) % n] as Point;
    const normal = (a: Point, b: Point) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy) || 1;
      return { x: -dy / length, y: dx / length };
    };
    const a = normal(prev, p);
    const b = normal(p, next);
    const mx = a.x + b.x;
    const my = a.y + b.y;
    const length = Math.hypot(mx, my) || 1;
    return { x: p.x + (mx / length) * distance, y: p.y + (my / length) * distance };
  });
}

/** The point `along` the closed outline, by arc length, and the segment it is on. */
function pointAt(
  points: Point[],
  lengths: number[],
  along: number,
): { point: Point; index: number } {
  let i = 1;
  while (i < lengths.length - 1 && (lengths[i] as number) < along) i++;
  const a = points[(i - 1) % points.length] as Point;
  const b = points[i % points.length] as Point;
  const span = (lengths[i] as number) - (lengths[i - 1] as number) || 1;
  const t = (along - (lengths[i - 1] as number)) / span;
  return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, index: i };
}

/**
 * The ring's `clip-path`: the band `strokeWidth` wide along the inside of
 * the outline, cut into dashes the way the worklet dashes it for
 * `borderStyle`. `null` where there is nothing to draw — no width, or
 * `none`/`hidden`.
 */
export function pillRingClipPath(
  width: number,
  height: number,
  strokeWidth: number,
  borderStyle: string,
  shape?: PillShapeInput,
): string | null {
  if (!(strokeWidth > 0)) return null;
  const dash = geometry.resolveDash(
    lookup({ [PILL_BORDER_STYLE_VAR_NAME]: borderStyle.trim() }),
    strokeWidth,
  );
  if (dash === null) return null;
  const outer = pillOutlinePoints(width, height, shape);
  if (outer.length < 3) return null;
  // A band wider than the half-height would cross itself; it is all ring.
  const band = Math.min(strokeWidth, Math.min(width, height) / 2 - 0.01);
  const inner = inset(outer, band);

  if (dash.length === 0) {
    // Outline, then the inset copy the other way round: with even-odd fill
    // the inset area is a hole, leaving the band.
    return `path(evenodd, "${subpath(outer)}${subpath([...inner].reverse())}")`;
  }

  // Dashes are measured along the outline from its first point, as the
  // canvas measures them along the path it strokes.
  const n = outer.length;
  const lengths = [0];
  for (let i = 1; i <= n; i++) {
    const a = outer[i - 1] as Point;
    const b = outer[i % n] as Point;
    lengths.push((lengths[i - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = lengths[n] as number;
  const [on, off] = dash as [number, number];
  let d = "";
  for (let start = 0; start < total; start += on + off) {
    const end = Math.min(start + on, total);
    const from = pointAt(outer, lengths, start);
    const to = pointAt(outer, lengths, end);
    const fromInner = pointAt(inner, lengths, start);
    const toInner = pointAt(inner, lengths, end);
    const outerRun: Point[] = [from.point];
    const innerRun: Point[] = [fromInner.point];
    for (let i = from.index; i < to.index; i++) {
      outerRun.push(outer[i % n] as Point);
      innerRun.push(inner[i % n] as Point);
    }
    outerRun.push(to.point);
    innerRun.push(toInner.point);
    d += subpath([...outerRun, ...innerRun.reverse()]);
  }
  return `path("${d}")`;
}

export interface PillPolyfillOptions {
  /** Class name of the pill utility (default: "squircle-pill"). */
  prefix?: string;
  /** Where to look for pills (default: `document`). */
  root?: Document | Element;
  /** Run even where paint worklets are supported, e.g. to compare the two. */
  force?: boolean;
}

export interface PillPolyfill {
  /** Recompute one pill, or all of them, after a change no resize reveals. */
  refresh(element?: Element): void;
  /** Stop watching, and drop the clips it set. */
  disconnect(): void;
}

const CLIP_CACHE_SIZE = 512;
const clipCache = new Map<string, string | null>();
const cached = (key: string, make: () => string | null): string | null => {
  if (clipCache.has(key)) return clipCache.get(key) as string | null;
  const value = make();
  if (clipCache.size >= CLIP_CACHE_SIZE) clipCache.delete(clipCache.keys().next().value as string);
  clipCache.set(key, value);
  return value;
};

/**
 * Draws pills without the paint worklet, for browsers that lack one.
 *
 * Every pill is watched with a `ResizeObserver`; on each size it computes the
 * outline with the worklet's own geometry and sets it, as a `clip-path`, on
 * the custom properties the pill styles read where `<html>` carries the
 * polyfill attribute. Until a pill's clip is computed it shows its stadium
 * fallback.
 *
 * The element's own `clip-path` — `sr-only`, an arbitrary `[clip-path:…]` —
 * is kept: it is cut to the pill's outline and the two set as one clip.
 *
 * Shape properties and the element's own clip are read when the polyfill
 * first sees a pill and whenever its `class` changes; call `refresh()` after
 * anything else that changes them, such as an inline style, a stylesheet
 * change or a media query.
 *
 * Returns `null` without doing anything where paint worklets are supported,
 * unless `force` is set.
 */
export function polyfillPills(options: PillPolyfillOptions = {}): PillPolyfill | null {
  const supported = (globalThis.CSS as { paintWorklet?: unknown } | undefined)?.paintWorklet;
  if (supported && !options.force) return null;

  const root = options.root ?? document;
  const doc = root instanceof Document ? root : root.ownerDocument;
  const selector = `.${options.prefix ?? "squircle-pill"}, [${PILL_ATTRIBUTE}]`;
  const lastKey = new WeakMap<Element, string>();
  const watched = new Set<Element>();
  const sizes = new WeakMap<Element, { width: number; height: number }>();

  /**
   * Each pill's shape settings, read once and kept until its class changes or
   * `refresh()` is called. A resize never changes them, and re-reading
   * computed style for every pill on every frame of one costs more than the
   * geometry does.
   */
  interface Settings {
    shape: PillShapeInput;
    stroke: number;
    borderStyle: string;
    own: OwnClip;
  }
  const settings = new WeakMap<Element, Settings>();
  const read = (el: Element): Settings => {
    const known = settings.get(el);
    if (known) return known;
    const style = getComputedStyle(el);
    const stroke = Number.parseFloat(style.getPropertyValue(PILL_BORDER_WIDTH_VAR_NAME)) || 0;
    // Read without the pill's own clip in force; see `flush`.
    const value = style.clipPath;
    const px = (side: string) => Number.parseFloat(style.getPropertyValue(side)) || 0;
    const sides = (name: (side: string) => string) =>
      ["top", "right", "bottom", "left"].map((side) => px(name(side))) as BoxEdges["border"];
    const fresh: Settings = {
      shape: {
        amt: style.getPropertyValue(PILL_AMT_VAR_NAME),
        spread: style.getPropertyValue(PILL_EASE_SPREAD_VAR_NAME),
        continuity: style.getPropertyValue(PILL_CONTINUITY_VAR_NAME),
      },
      stroke,
      borderStyle:
        stroke > 0
          ? getComputedStyle(el, "::after").getPropertyValue(PILL_BORDER_STYLE_VAR_NAME)
          : "",
      own: {
        value,
        edges: needsBoxEdges(value)
          ? {
              border: sides((side) => `border-${side}-width`),
              padding: sides((side) => `padding-${side}`),
              margin: sides((side) => `margin-${side}`),
            }
          : undefined,
      },
    };
    settings.set(el, fresh);
    return fresh;
  };

  /**
   * Pills waiting for their shape. A large resize can change more pills than
   * fit in one frame; those over the budget keep their previous clip for a
   * frame and are picked up on the next, rather than the whole page dropping
   * frames while every one is recomputed.
   */
  const pending = new Set<Element>();
  const FRAME_BUDGET_MS = 6;
  let scheduled = false;
  const schedule = () => {
    if (scheduled || pending.size === 0) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      flush();
    });
  };

  const flush = () => {
    const deadline = performance.now() + FRAME_BUDGET_MS;
    // A pill's own clip is read with the one it was given lifted, all of them
    // at once so the reads share one style recalc. Those that end up with no
    // new clip get theirs back below.
    const lifted: Element[] = [];
    for (const el of pending) {
      if (!settings.has(el) && el.hasAttribute(PILL_CLIPPED_ATTRIBUTE)) {
        el.removeAttribute(PILL_CLIPPED_ATTRIBUTE);
        lifted.push(el);
      }
    }
    // All reads first, then all writes, so no read forces a style recalc
    // that an earlier write invalidated.
    const updates: [HTMLElement, string | null, string | null][] = [];
    for (const el of pending) {
      if (performance.now() > deadline && updates.length > 0) break;
      pending.delete(el);
      const size = sizes.get(el);
      if (!size) continue;
      const { width, height } = size;
      const { shape, stroke, borderStyle, own } = read(el);
      const shapeKey = `${width},${height},${shape.amt},${shape.spread},${shape.continuity}`;
      const ownKey = `${own.value}|${own.edges ? Object.values(own.edges).join() : ""}`;
      const key = `${shapeKey},${stroke},${borderStyle},${ownKey}`;
      if (lastKey.get(el) === key) continue;
      lastKey.set(el, key);
      updates.push([
        el as HTMLElement,
        cached(`m:${shapeKey},${ownKey}`, () => pillClipPath(width, height, shape, own)),
        cached(`r:${shapeKey},${stroke},${borderStyle}`, () =>
          pillRingClipPath(width, height, stroke, borderStyle, shape),
        ),
      ]);
    }
    const updated = new Set(updates.map(([el]) => el as Element));
    for (const el of lifted) if (!updated.has(el)) el.setAttribute(PILL_CLIPPED_ATTRIBUTE, "");
    for (const [el, clip, ring] of updates) {
      if (clip) {
        el.style.setProperty(PILL_CLIP_VAR_NAME, clip);
        el.setAttribute(PILL_CLIPPED_ATTRIBUTE, "");
      } else {
        el.style.removeProperty(PILL_CLIP_VAR_NAME);
        el.removeAttribute(PILL_CLIPPED_ATTRIBUTE);
      }
      if (ring) el.style.setProperty(PILL_RING_CLIP_VAR_NAME, ring);
      else el.style.removeProperty(PILL_RING_CLIP_VAR_NAME);
    }
    schedule();
  };

  const apply = (elements: Iterable<Element>) => {
    for (const el of elements) pending.add(el);
    flush();
  };

  const resizes = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const box = entry.borderBoxSize?.[0];
      const rect = box ? null : entry.target.getBoundingClientRect();
      sizes.set(entry.target, {
        width: box ? box.inlineSize : (rect as DOMRect).width,
        height: box ? box.blockSize : (rect as DOMRect).height,
      });
    }
    apply(entries.map((entry) => entry.target));
  });

  const watch = (el: Element) => {
    if (watched.has(el)) return;
    watched.add(el);
    resizes.observe(el, { box: "border-box" });
  };
  const unwatch = (el: Element) => {
    if (!watched.delete(el)) return;
    resizes.unobserve(el);
  };
  const scan = (node: ParentNode) => {
    if (node instanceof Element && node.matches(selector)) watch(node);
    for (const el of node.querySelectorAll(selector)) watch(el);
  };

  const mutations = new MutationObserver((records) => {
    const changed = new Set<Element>();
    for (const record of records) {
      if (record.type === "attributes") {
        const el = record.target as Element;
        if (el.matches(selector)) {
          watch(el);
          changed.add(el);
        } else unwatch(el);
        continue;
      }
      for (const node of record.addedNodes) if (node instanceof Element) scan(node);
      for (const node of record.removedNodes) {
        if (!(node instanceof Element)) continue;
        unwatch(node);
        for (const el of node.querySelectorAll(selector)) unwatch(el);
      }
    }
    for (const el of changed) settings.delete(el);
    if (changed.size > 0) apply(changed);
  });

  doc.documentElement.setAttribute(PILL_POLYFILL_ATTRIBUTE, "");
  scan(root instanceof Document ? root.documentElement : root);
  mutations.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    // Not `style`: the masks are written there, so watching it would re-read
    // every pill after every write.
    attributeFilter: ["class", PILL_ATTRIBUTE],
  });

  return {
    refresh(element) {
      const targets = element ? [element] : [...watched];
      for (const el of targets) {
        lastKey.delete(el);
        settings.delete(el);
      }
      apply(targets);
    },
    disconnect() {
      pending.clear();
      mutations.disconnect();
      resizes.disconnect();
      for (const el of watched) {
        (el as HTMLElement).style.removeProperty(PILL_CLIP_VAR_NAME);
        (el as HTMLElement).style.removeProperty(PILL_RING_CLIP_VAR_NAME);
        el.removeAttribute(PILL_CLIPPED_ATTRIBUTE);
      }
      watched.clear();
      doc.documentElement.removeAttribute(PILL_POLYFILL_ATTRIBUTE);
    },
  };
}
