/**
 * Draws the site's pills: with the paint worklet where the browser has one,
 * and with the polyfill where it doesn't. Shared by the layout and anything
 * on the page that changes a pill in a way the polyfill can't see, such as
 * an inline style set from a slider, which calls `refreshPill` after.
 */
import { registerPillWorklet } from "@klinking/squircle/pill-worklet";
import type { PillPolyfill } from "@klinking/squircle/pill-polyfill";
// Vite serves the worklet as a hashed asset, so hand its URL over rather
// than relying on the helper's default sibling lookup.
import workletUrl from "@klinking/squircle/pill-shape.worklet.js?url";

/** The polyfill, once it runs; `null` where the worklet draws the pills. */
export const pills: Promise<PillPolyfill | null> = registerPillWorklet(workletUrl)
  .catch((error: unknown) => {
    // A worklet that fails to load is a bug worth seeing, but the pills can
    // still be drawn.
    console.error("pill worklet failed to load; using the polyfill:", error);
    return false;
  })
  .then(async (loaded) => {
    if (loaded) return null;
    const { polyfillPills } = await import("@klinking/squircle/pill-polyfill");
    return polyfillPills({ force: true });
  });

/** Redraws a pill whose settings just changed; the worklet needs no telling. */
export function refreshPill(element: Element): void {
  void pills.then((polyfill) => polyfill?.refresh(element));
}
