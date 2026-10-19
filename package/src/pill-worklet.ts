/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { observePillShadows, type PillShadowOptions, type PillShadows } from "./pill-shadows";
export { observePillShadows, type PillShadowOptions, type PillShadows } from "./pill-shadows";

const shadowObservers = new WeakMap<Document, PillShadows>();

import {
  DEFAULT_PILL_ARC_SETBACK,
  DEFAULT_PILL_CONTINUITY,
  DEFAULT_PILL_EDGE_SETBACK,
  DEFAULT_PILL_MAX_RADIUS,
  DEFAULT_PILL_SIDE,
  PILL_ARC_SETBACK_VAR_NAME,
  PILL_EDGE_SETBACK_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
  PILL_MAX_RADIUS_VAR_NAME,
  PILL_SIDE_VAR_NAME,
  PILL_WORKLET_ATTRIBUTE,
} from "./variants";

export { PILL_WORKLET_ATTRIBUTE };

/**
 * The pill's shape settings — the custom properties `squircle-pill-arc-setback-*`,
 * `squircle-pill-edge-setback-*`, `squircle-pill-g2`/`-g3`, `squircle-pill-max-*` and the side utilities
 * (`squircle-pill-t`, …) set — and the values
 * they start at, for scripts that set or show them: a settings panel, a
 * preview. The same constants the stylesheet's registrations and the
 * worklet's own fallbacks come from, so they never disagree.
 */
export const PILL_SHAPE_PROPERTIES = {
  /** The numeric default is in degrees; write CSS values with an angle unit. */
  arcSetback: { name: PILL_ARC_SETBACK_VAR_NAME, default: DEFAULT_PILL_ARC_SETBACK },
  /** Distance in multiples of the cap's half-height. */
  edgeSetback: { name: PILL_EDGE_SETBACK_VAR_NAME, default: DEFAULT_PILL_EDGE_SETBACK },
  continuity: { name: PILL_CONTINUITY_VAR_NAME, default: DEFAULT_PILL_CONTINUITY },
  side: { name: PILL_SIDE_VAR_NAME, default: DEFAULT_PILL_SIDE },
  /** Longest cap radius in px; `Infinity` is no limit. Write CSS values with a length unit. */
  maxRadius: { name: PILL_MAX_RADIUS_VAR_NAME, default: DEFAULT_PILL_MAX_RADIUS },
} as const;

/**
 * Loads the pill-shape paint worklet and, once it is in, marks the document so
 * the pill styles switch from their stadium fallback to the drawn shape.
 *
 * That mark is the whole reason to go through here rather than calling
 * `CSS.paintWorklet.addModule()` directly: `@supports (mask-image:
 * paint(pill-shape))` is true in a browser with the Paint API whether or not
 * a worklet by that name ever loaded, so a mask gated on it alone would erase
 * every pill the moment the worklet failed to load. Gated on the mark, a pill
 * stays a plain stadium until the shape is really there to draw.
 *
 * Resolves to `false` where paint worklets are unsupported, and the pills keep
 * their fallback. Once loaded, starts event-driven shadow resolution, without
 * enabling the polyfill. Pass a custom utility prefix in the third argument.
 * A load that fails — a wrong URL, a CSP that blocks it —
 * rejects, so it surfaces in the console as the error it is; the pills still
 * keep their fallback.
 *
 * @param moduleUrl Where the worklet script is served from. The default
 *   points at the copy shipped next to this module, which bundlers that
 *   understand `new URL(…, import.meta.url)` — Vite, webpack 5, Parcel — will
 *   emit as an asset. Pass a URL where that is not the case, e.g. Vite's
 *   `import url from "@klinking/squircle/pill-shape.worklet.js?url"`.
 */
export async function registerPillWorklet(
  moduleUrl: string | URL = new URL("./pill-shape.worklet.mjs", import.meta.url),
  root: Document = document,
  options: Omit<PillShadowOptions, "root"> = {},
): Promise<boolean> {
  const paintWorklet = (globalThis.CSS as { paintWorklet?: Worklet } | undefined)?.paintWorklet;
  if (!paintWorklet) return false;
  await paintWorklet.addModule(String(moduleUrl));
  root.documentElement.setAttribute(PILL_WORKLET_ATTRIBUTE, "");
  shadowObservers.get(root)?.disconnect();
  shadowObservers.set(root, observePillShadows({ ...options, root }));
  return true;
}

/** Re-read shadows after CSSOM edits without a DOM event. */
export function refreshPillShadows(root: Document = document): void {
  shadowObservers.get(root)?.refresh();
}
