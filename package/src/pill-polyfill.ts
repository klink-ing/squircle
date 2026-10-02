/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { paintDef } from "./pill-shape.worklet";
import {
  PILL_AMT_VAR_NAME,
  PILL_ATTRIBUTE,
  PILL_BORDER_STYLE_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
  PILL_EASE_SPREAD_VAR_NAME,
  PILL_MASK_VAR_NAME,
  PILL_POLYFILL_ATTRIBUTE,
  PILL_RING_MASK_VAR_NAME,
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
 * The pill's outline as an SVG path, in the coordinates of a `width` ×
 * `height` box. Two decimals is a hundredth of a pixel, well under what any
 * mask can resolve.
 */
export function pillOutlinePath(width: number, height: number, shape: PillShapeInput = {}): string {
  if (width <= 0 || height <= 0) return "";
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
  const points = geometry.outline(long, short, quadrant);
  let d = "";
  for (let i = 0; i < points.length; i++) {
    const p = points[i] as Point;
    const x = vertical ? p.y : p.x;
    const y = vertical ? p.x : p.y;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

const svgUrl = (width: number, height: number, body: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${body}</svg>`,
  )}")`;

/**
 * The outline as an SVG shape element: a `<circle>` for a square, which is
 * all a square pill can be, and a traced `<path>` for anything else.
 */
function outlineElement(
  width: number,
  height: number,
  shape: PillShapeInput | undefined,
  attrs = "",
) {
  if (width === height) {
    const r = width / 2;
    return `<circle cx="${r}" cy="${r}" r="${r}"${attrs}/>`;
  }
  return `<path d="${pillOutlinePath(width, height, shape)}"${attrs}/>`;
}

/** The element's mask: the outline, filled. */
export function pillMaskImage(width: number, height: number, shape?: PillShapeInput): string {
  return svgUrl(width, height, outlineElement(width, height, shape));
}

/**
 * The ring's mask: a band `strokeWidth` wide along the inside of the
 * outline, dashed the way the worklet dashes it for `borderStyle`. `null`
 * where there is nothing to draw — no width, or `none`/`hidden`.
 */
export function pillRingMaskImage(
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
  // Doubled and clipped to the outline, so the band sits wholly inside it.
  const dashAttr = dash.length > 0 ? ` stroke-dasharray="${dash.join(" ")}"` : "";
  const stroked = ` fill="none" stroke="#000" stroke-width="${strokeWidth * 2}"${dashAttr} clip-path="url(#c)"`;
  return svgUrl(
    width,
    height,
    `<clipPath id="c">${outlineElement(width, height, shape)}</clipPath>${outlineElement(width, height, shape, stroked)}`,
  );
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
  /** Stop watching, and drop the masks it set. */
  disconnect(): void;
}

const MASK_CACHE_SIZE = 512;
const maskCache = new Map<string, string | null>();
const cached = (key: string, make: () => string | null): string | null => {
  if (maskCache.has(key)) return maskCache.get(key) as string | null;
  const value = make();
  if (maskCache.size >= MASK_CACHE_SIZE) maskCache.delete(maskCache.keys().next().value as string);
  maskCache.set(key, value);
  return value;
};

/**
 * Draws pills without the paint worklet, for browsers that lack one.
 *
 * Every pill is watched with a `ResizeObserver`; on each size it computes the
 * outline with the worklet's own geometry and sets it, as an SVG mask, on the
 * custom properties the pill styles read where `<html>` carries the polyfill
 * attribute. Until a pill's mask is computed it shows its stadium fallback.
 *
 * Shape properties are read when the pill resizes or its `class` changes;
 * call `refresh()` after anything else that reshapes it, such as an inline
 * style or a stylesheet change.
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

  const apply = (elements: Iterable<Element>) => {
    // All reads first, then all writes, so no read forces a layout that an
    // earlier write invalidated.
    const updates: [HTMLElement, string | null, string | null][] = [];
    for (const element of elements) {
      const el = element as HTMLElement;
      const size = sizes.get(el);
      if (!size) continue;
      const { width, height } = size;
      const style = getComputedStyle(el);
      const shape: PillShapeInput = {
        amt: style.getPropertyValue(PILL_AMT_VAR_NAME),
        spread: style.getPropertyValue(PILL_EASE_SPREAD_VAR_NAME),
        continuity: style.getPropertyValue(PILL_CONTINUITY_VAR_NAME),
      };
      const stroke = Number.parseFloat(style.getPropertyValue(PILL_BORDER_WIDTH_VAR_NAME)) || 0;
      const borderStyle =
        stroke > 0
          ? getComputedStyle(el, "::after").getPropertyValue(PILL_BORDER_STYLE_VAR_NAME)
          : "";
      const shapeKey = `${width},${height},${shape.amt},${shape.spread},${shape.continuity}`;
      const key = `${shapeKey},${stroke},${borderStyle}`;
      if (lastKey.get(el) === key) continue;
      lastKey.set(el, key);
      updates.push([
        el,
        cached(`m:${shapeKey}`, () => pillMaskImage(width, height, shape)),
        cached(`r:${key}`, () => pillRingMaskImage(width, height, stroke, borderStyle, shape)),
      ]);
    }
    for (const [el, mask, ring] of updates) {
      if (mask) el.style.setProperty(PILL_MASK_VAR_NAME, mask);
      if (ring) el.style.setProperty(PILL_RING_MASK_VAR_NAME, ring);
      else el.style.removeProperty(PILL_RING_MASK_VAR_NAME);
    }
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
      for (const el of targets) lastKey.delete(el);
      apply(targets);
    },
    disconnect() {
      mutations.disconnect();
      resizes.disconnect();
      for (const el of watched) {
        (el as HTMLElement).style.removeProperty(PILL_MASK_VAR_NAME);
        (el as HTMLElement).style.removeProperty(PILL_RING_MASK_VAR_NAME);
      }
      watched.clear();
      doc.documentElement.removeAttribute(PILL_POLYFILL_ATTRIBUTE);
    },
  };
}
