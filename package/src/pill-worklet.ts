/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import {
  DEFAULT_PILL_AMT,
  DEFAULT_PILL_CONTINUITY,
  DEFAULT_PILL_EASE,
  DEFAULT_PILL_SIDE,
  PILL_AMT_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
  PILL_EASE_VAR_NAME,
  PILL_SIDE_VAR_NAME,
  PILL_WORKLET_ATTRIBUTE,
} from "./variants";

export { PILL_WORKLET_ATTRIBUTE };

/**
 * The pill's shape settings — the custom properties `squircle-pill-amt-*`,
 * `squircle-pill-ease-*`, `squircle-pill-g2`/`-g3` and the side utilities
 * (`squircle-pill-t`, …) set — and the values
 * they start at, for scripts that set or show them: a settings panel, a
 * preview. The same constants the stylesheet's registrations and the
 * worklet's own fallbacks come from, so they never disagree.
 */
export const PILL_SHAPE_PROPERTIES = {
  amt: { name: PILL_AMT_VAR_NAME, default: DEFAULT_PILL_AMT },
  ease: { name: PILL_EASE_VAR_NAME, default: DEFAULT_PILL_EASE },
  continuity: { name: PILL_CONTINUITY_VAR_NAME, default: DEFAULT_PILL_CONTINUITY },
  side: { name: PILL_SIDE_VAR_NAME, default: DEFAULT_PILL_SIDE },
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
 * their fallback. A load that fails — a wrong URL, a CSP that blocks it —
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
): Promise<boolean> {
  const paintWorklet = (globalThis.CSS as { paintWorklet?: Worklet } | undefined)?.paintWorklet;
  if (!paintWorklet) return false;
  await paintWorklet.addModule(String(moduleUrl));
  root.documentElement.setAttribute(PILL_WORKLET_ATTRIBUTE, "");
  return true;
}
