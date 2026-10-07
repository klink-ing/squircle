/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { paintDef } from "./pill-shape.worklet";
import {
  PILL_AMT_VAR_NAME,
  PILL_ATTRIBUTE,
  PILL_BORDER_COLOR_VAR_NAME,
  PILL_BORDER_STYLE_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_BOX_SHADOW_VAR_NAME,
  PILL_CLIP_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
  PILL_DECORATION_CLIP_VAR_NAME,
  PILL_DECORATION_VAR_NAME,
  PILL_EASE_VAR_NAME,
  PILL_INSET_RING_COLOR_VAR_NAME,
  PILL_INSET_RING_WIDTH_VAR_NAME,
  PILL_OUTLINE_COLOR_VAR_NAME,
  PILL_OUTLINE_OFFSET_VAR_NAME,
  PILL_OUTLINE_STYLE_VAR_NAME,
  PILL_OUTLINE_WIDTH_VAR_NAME,
  PILL_POLYFILL_ATTRIBUTE,
  PILL_REACH_VAR_NAME,
  PILL_RING_COLOR_VAR_NAME,
  PILL_RING_OFFSET_COLOR_VAR_NAME,
  PILL_RING_OFFSET_WIDTH_VAR_NAME,
  PILL_RING_WIDTH_VAR_NAME,
  PILL_SIDE_VAR_NAME,
} from "./variants";

export { PILL_POLYFILL_ATTRIBUTE };

interface Point {
  x: number;
  y: number;
}

/** The custom-property values that shape one pill, as computed strings. */
export interface PillShapeInput {
  amt?: string;
  ease?: string;
  continuity?: string;
  side?: string;
}

interface PillGeometry {
  boxOutline(width: number, height: number, props: Lookup): Point[];
  offsetOutline(points: Point[], distance: number): Point[];
  resolveLength(props: Lookup, name: string): number;
  decorationOutset(props: Lookup): number;
  decorationBands(props: Lookup): { from: number; to: number; color: string; dash: number[] }[];
  decorationShadows(
    props: Lookup,
  ): { x: number; y: number; blur: number; spread: number; color: string }[];
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
 * The pill's outline in box coordinates, in the order the worklet draws it,
 * which is the worklet's own `boxOutline`.
 */
export function pillOutlinePoints(
  width: number,
  height: number,
  shape: PillShapeInput = {},
): Point[] {
  if (width <= 0 || height <= 0) return [];
  const props = lookup({
    [PILL_AMT_VAR_NAME]: shape.amt,
    [PILL_EASE_VAR_NAME]: shape.ease,
    [PILL_CONTINUITY_VAR_NAME]: shape.continuity,
    [PILL_SIDE_VAR_NAME]: shape.side,
  });
  const out: Point[] = [];
  for (const q of geometry.boxOutline(width, height, props)) {
    // The pieces of the outline meet at shared points; drop the repeats,
    // which have no direction to offset along.
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

/**
 * The `clip-path` for the copy of the element's background the pill shows:
 * the pill's outline, pulled in by `inset`. `null` for a square pill that
 * needs no pulling in, whose stadium `border-radius` is already the circle it
 * has to be; a square capped at one end is an arch, and needs its clip.
 */
export function pillClipPath(
  width: number,
  height: number,
  shape?: PillShapeInput,
  inset = 0,
): string | null {
  const auto = !shape?.side?.trim() || shape.side.trim() === "auto";
  if (width <= 0 || height <= 0 || (width === height && inset <= 0 && auto)) return null;
  if (inset <= 0) return `path("${pillOutlinePath(width, height, shape)}")`;
  return `path("${subpath(geometry.offsetOutline(pillOutlinePoints(width, height, shape), -inset))}")`;
}

/**
 * How far the copy of the background pulls back from the outline: half a
 * pixel under a border or an inset ring touching it, so the two never share
 * an anti-aliased edge; the stylesheet works out the same for the
 * worklet.
 */
export function pillBackgroundInset(decoration: PillDecorationInput): number {
  const props = lookup(decoration);
  const covered =
    geometry.resolveLength(props, PILL_BORDER_WIDTH_VAR_NAME) +
    geometry.resolveLength(props, PILL_INSET_RING_WIDTH_VAR_NAME);
  return Math.min(Math.max(covered, 0), 0.5);
}

/** What the pill draws around itself, as computed property values. */
export type PillDecorationInput = Record<string, string | undefined>;

/** The properties `PillDecorationInput` is keyed by. */
export const PILL_DECORATION_PROPERTIES: readonly string[] = [
  PILL_REACH_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_BORDER_COLOR_VAR_NAME,
  PILL_BORDER_STYLE_VAR_NAME,
  PILL_OUTLINE_WIDTH_VAR_NAME,
  PILL_OUTLINE_OFFSET_VAR_NAME,
  PILL_OUTLINE_COLOR_VAR_NAME,
  PILL_OUTLINE_STYLE_VAR_NAME,
  PILL_RING_WIDTH_VAR_NAME,
  PILL_RING_COLOR_VAR_NAME,
  PILL_RING_OFFSET_WIDTH_VAR_NAME,
  PILL_RING_OFFSET_COLOR_VAR_NAME,
  PILL_INSET_RING_WIDTH_VAR_NAME,
  PILL_INSET_RING_COLOR_VAR_NAME,
  PILL_BOX_SHADOW_VAR_NAME,
  // What `currentColor` in any of them stands for.
  "color",
];

/**
 * Everything the pill draws around its outline — box shadows, border, inset
 * ring, ring, outline — as an SVG image for `::after`, which the stylesheet
 * sizes to the border box grown by the decoration's reach on every side;
 * `null` where there is nothing to draw. The same bands and shadows the
 * worklet draws, from the same geometry: each band a stroke along the
 * outline moved out to its middle, each shadow the outline grown by its
 * spread, blurred, offset, and drawn only outside the outline. An image
 * rather than a clip because they come in several colours; it is only
 * rebuilt when the pill changes size or decoration.
 */
export function pillDecorationImage(
  width: number,
  height: number,
  decoration: PillDecorationInput,
  shape: PillShapeInput = {},
): string | null {
  if (width <= 0 || height <= 0) return null;
  const props = lookup(decoration);
  const bands = geometry.decorationBands(props);
  const shadows = geometry.decorationShadows(props);
  if (bands.length === 0 && shadows.length === 0) return null;
  const outset = geometry.decorationOutset(props);
  const outline = pillOutlinePoints(width, height, shape).map((p) => ({
    x: p.x + outset,
    y: p.y + outset,
  }));
  const w = round(width + 2 * outset);
  const h = round(height + 2 * outset);
  const pill = subpath(outline);
  let defs = "";
  let body = "";
  if (shadows.length > 0) {
    defs += `<clipPath id="o"><path clip-rule="evenodd" d="M0 0H${w}V${h}H0Z${pill}"/></clipPath>`;
    let layers = "";
    // Last first, as CSS stacks them.
    [...shadows].reverse().forEach((shadow, i) => {
      const id = `s${i}`;
      // CSS blurs a shadow with a standard deviation of half its blur radius.
      if (shadow.blur > 0) {
        defs += `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><feGaussianBlur stdDeviation="${round(shadow.blur / 2)}"/></filter>`;
      }
      const shifted = geometry
        .offsetOutline(outline, shadow.spread)
        .map((p) => ({ x: p.x + shadow.x, y: p.y + shadow.y }));
      const filter = shadow.blur > 0 ? ` filter="url(#${id})"` : "";
      layers += `<path d="${subpath(shifted)}"${filter} style="fill:${shadow.color}"/>`;
    });
    body += `<g clip-path="url(#o)">${layers}</g>`;
  }
  for (const band of bands) {
    const d = subpath(geometry.offsetOutline(outline, (band.from + band.to) / 2));
    const dash = band.dash.length > 0 ? ` stroke-dasharray="${band.dash.join(" ")}"` : "";
    body += `<path d="${d}" fill="none" stroke-width="${round(band.to - band.from)}" stroke-linejoin="miter"${dash} style="stroke:${band.color}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** One band's outline, its two edges and its centre line, point for point. */
interface BandEdges {
  outer: Point[];
  inner: Point[];
  centre: Point[];
}

/** Where `along` falls on `points`, measured by `lengths`: the segment, and how far into it. */
function locate(lengths: number[], along: number): { index: number; t: number } {
  let i = 1;
  while (i < lengths.length - 1 && (lengths[i] as number) < along) i++;
  const span = (lengths[i] as number) - (lengths[i - 1] as number) || 1;
  return { index: i, t: (along - (lengths[i - 1] as number)) / span };
}

const lerpOn = (points: Point[], { index, t }: { index: number; t: number }): Point => {
  const a = points[(index - 1) % points.length] as Point;
  const b = points[index % points.length] as Point;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

/**
 * A band's `clip-path`: the region between its two edges, cut into dashes the
 * way the canvas dashes a stroke — measured along its centre line from the
 * first point.
 */
function bandClipPath({ outer, inner, centre }: BandEdges, dash: number[]): string {
  if (dash.length === 0) {
    // One edge, then the other the other way round: with even-odd fill the
    // inner one is a hole, leaving the band.
    return `path(evenodd, "${subpath(outer)}${subpath([...inner].reverse())}")`;
  }
  const n = centre.length;
  const lengths = [0];
  for (let i = 1; i <= n; i++) {
    const a = centre[i - 1] as Point;
    const b = centre[i % n] as Point;
    lengths.push((lengths[i - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = lengths[n] as number;
  const [on, off] = dash as [number, number];
  let d = "";
  for (let start = 0; start < total; start += on + off) {
    const from = locate(lengths, start);
    const to = locate(lengths, Math.min(start + on, total));
    const outerRun: Point[] = [lerpOn(outer, from)];
    const innerRun: Point[] = [lerpOn(inner, from)];
    for (let i = from.index; i < to.index; i++) {
      outerRun.push(outer[i % n] as Point);
      innerRun.push(inner[i % n] as Point);
    }
    outerRun.push(lerpOn(outer, to));
    innerRun.push(lerpOn(inner, to));
    d += subpath([...outerRun, ...innerRun.reverse()]);
  }
  return `path("${d}")`;
}

/** What `::after` shows: an image, and the clip it is shown through, if any. */
export interface PillDecorationDrawing {
  image: string;
  clip: string | null;
}

/**
 * Everything the pill draws around its outline, the cheapest way it can be
 * drawn; `null` where there is nothing to draw.
 *
 * A single band and no shadow — a border, a ring or an outline alone, which
 * is most decorated pills — is its colour, clipped to the band: a clip is
 * redrawn on resize for next to nothing, where an image is decoded and
 * rasterised again, several times slower across many pills. Anything more is
 * the image from `pillDecorationImage`.
 */
export function pillDecoration(
  width: number,
  height: number,
  decoration: PillDecorationInput,
  shape: PillShapeInput = {},
): PillDecorationDrawing | null {
  if (width <= 0 || height <= 0) return null;
  const props = lookup(decoration);
  const bands = geometry.decorationBands(props);
  const shadows = geometry.decorationShadows(props);
  if (bands.length === 0 && shadows.length === 0) return null;
  const band = bands[0];
  if (bands.length > 1 || shadows.length > 0 || !band) {
    const image = pillDecorationImage(width, height, decoration, shape);
    return image ? { image, clip: null } : null;
  }
  const outset = geometry.decorationOutset(props);
  const outline = pillOutlinePoints(width, height, shape).map((p) => ({
    x: p.x + outset,
    y: p.y + outset,
  }));
  // A band reaching in past the middle would cross itself; it ends there.
  const deepest = -(Math.min(width, height) / 2 - 0.01);
  const edges: BandEdges = {
    outer: geometry.offsetOutline(outline, Math.max(band.to, deepest)),
    inner: geometry.offsetOutline(outline, Math.max(band.from, deepest)),
    centre: geometry.offsetOutline(outline, Math.max((band.from + band.to) / 2, deepest)),
  };
  return {
    image: `linear-gradient(${band.color}, ${band.color})`,
    clip: bandClipPath(edges, band.dash),
  };
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
const drawingCache = new Map<string, PillDecorationDrawing | null>();
const cachedDrawing = (
  key: string,
  make: () => PillDecorationDrawing | null,
): PillDecorationDrawing | null => {
  if (drawingCache.has(key)) return drawingCache.get(key) as PillDecorationDrawing | null;
  const value = make();
  if (drawingCache.size >= CLIP_CACHE_SIZE) {
    drawingCache.delete(drawingCache.keys().next().value as string);
  }
  drawingCache.set(key, value);
  return value;
};

/**
 * Draws pills without the paint worklet, for browsers that lack one.
 *
 * Every pill is watched with a `ResizeObserver`; on each size it computes the
 * outline with the worklet's own geometry and sets it, as a `clip-path` for
 * the copy of the background the pill shows and as a drawing of everything
 * around it, on the custom properties the pill styles read where
 * `<html>` carries the polyfill attribute. Until they are computed the
 * background shows as a stadium.
 *
 * Shape and decoration properties are read when the polyfill first sees a
 * pill, whenever its `class` changes, and when it
 * gains or loses focus, hover or a press; call `refresh()` after anything
 * else that changes them, such as an inline style, a stylesheet change or a
 * media query.
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
    decoration: PillDecorationInput;
    decorationKey: string;
    inset: number;
  }
  const settings = new WeakMap<Element, Settings>();
  const read = (el: Element): Settings => {
    const known = settings.get(el);
    if (known) return known;
    const style = getComputedStyle(el);
    const values: PillDecorationInput = {};
    for (const name of PILL_DECORATION_PROPERTIES) values[name] = style.getPropertyValue(name);
    // Most pills have none, and are spared working it out on every resize.
    const props = lookup(values);
    const decorated =
      geometry.decorationBands(props).length > 0 || geometry.decorationShadows(props).length > 0;
    const fresh: Settings = {
      shape: {
        amt: style.getPropertyValue(PILL_AMT_VAR_NAME),
        ease: style.getPropertyValue(PILL_EASE_VAR_NAME),
        continuity: style.getPropertyValue(PILL_CONTINUITY_VAR_NAME),
        side: style.getPropertyValue(PILL_SIDE_VAR_NAME),
      },
      decoration: decorated ? values : {},
      decorationKey: decorated ? Object.values(values).join("|") : "",
      inset: pillBackgroundInset(values),
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
    // All reads first, then all writes, so no read forces a style recalc
    // that an earlier write invalidated.
    const updates: [HTMLElement, string | null, PillDecorationDrawing | null][] = [];
    for (const el of pending) {
      if (performance.now() > deadline && updates.length > 0) break;
      pending.delete(el);
      const size = sizes.get(el);
      if (!size) continue;
      const { width, height } = size;
      const { shape, decoration, decorationKey, inset } = read(el);
      const shapeKey = `${width},${height},${shape.amt},${shape.ease},${shape.continuity},${shape.side}`;
      const key = `${shapeKey},${inset},${decorationKey}`;
      if (lastKey.get(el) === key) continue;
      lastKey.set(el, key);
      updates.push([
        el as HTMLElement,
        cached(`m:${shapeKey},${inset}`, () => pillClipPath(width, height, shape, inset)),
        decorationKey
          ? cachedDrawing(`d:${key}`, () => pillDecoration(width, height, decoration, shape))
          : null,
      ]);
    }
    for (const [el, clip, decorated] of updates) {
      if (clip) el.style.setProperty(PILL_CLIP_VAR_NAME, clip);
      else el.style.removeProperty(PILL_CLIP_VAR_NAME);
      if (decorated) el.style.setProperty(PILL_DECORATION_VAR_NAME, decorated.image);
      else el.style.removeProperty(PILL_DECORATION_VAR_NAME);
      if (decorated?.clip) el.style.setProperty(PILL_DECORATION_CLIP_VAR_NAME, decorated.clip);
      else el.style.removeProperty(PILL_DECORATION_CLIP_VAR_NAME);
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

  /*
   * State a class change doesn't reveal — `focus-visible:ring-2`,
   * `hover:outline-*`, `active:…` — is picked up from the events that change
   * it: each pill the event passes through is re-read on the next frame, once
   * the new state's styles apply.
   */
  const reread = (event: Event) => {
    let el = event.target instanceof Element ? event.target.closest(selector) : null;
    while (el) {
      if (watched.has(el)) {
        settings.delete(el);
        pending.add(el);
      }
      el = el.parentElement?.closest(selector) ?? null;
    }
    schedule();
  };
  const STATE_EVENTS = [
    "focusin",
    "focusout",
    "pointerover",
    "pointerout",
    "pointerdown",
    "pointerup",
  ];
  for (const type of STATE_EVENTS)
    root.addEventListener(type, reread, { capture: true, passive: true });

  doc.documentElement.setAttribute(PILL_POLYFILL_ATTRIBUTE, "");
  scan(root instanceof Document ? root.documentElement : root);
  mutations.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    // Not `style`: the clips are written there, so watching it would re-read
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
      for (const type of STATE_EVENTS) root.removeEventListener(type, reread, { capture: true });
      mutations.disconnect();
      resizes.disconnect();
      for (const el of watched) {
        (el as HTMLElement).style.removeProperty(PILL_CLIP_VAR_NAME);
        (el as HTMLElement).style.removeProperty(PILL_DECORATION_VAR_NAME);
        (el as HTMLElement).style.removeProperty(PILL_DECORATION_CLIP_VAR_NAME);
      }
      watched.clear();
      doc.documentElement.removeAttribute(PILL_POLYFILL_ATTRIBUTE);
    },
  };
}
