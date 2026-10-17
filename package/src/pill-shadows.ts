/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { shadowReach } from "./shadow-reach";
import {
  PILL_ATTRIBUTE,
  PILL_CLIP_VAR_NAME,
  PILL_DECORATION_VAR_NAME,
  PILL_DECORATION_CLIP_VAR_NAME,
  PILL_POLYFILL_BORDER_VAR_NAME,
  PILL_POLYFILL_REACH_VAR_NAME,
  PILL_RESOLVED_SHADOW_VAR_NAME,
  PILL_SHADOW_REACH_VAR_NAME,
} from "./variants";

// Both observers ignore only their own output, not consumer inline styles.
const OUTPUTS = [
  PILL_CLIP_VAR_NAME,
  PILL_DECORATION_VAR_NAME,
  PILL_DECORATION_CLIP_VAR_NAME,
  PILL_POLYFILL_BORDER_VAR_NAME,
  PILL_POLYFILL_REACH_VAR_NAME,
  PILL_RESOLVED_SHADOW_VAR_NAME,
  PILL_SHADOW_REACH_VAR_NAME,
];
export function pillStyleInputs(doc: Document, cssText: string): string {
  const style = doc.createElement("span").style;
  style.cssText = cssText;
  for (const name of OUTPUTS) style.removeProperty(name);
  return style.cssText;
}

export interface PillShadowOptions {
  /** Match the Tailwind plugins' prefix (default: "squircle-pill"). */
  prefix?: string;
  /** Where to look for pills (default: document). Ancestors can still restyle them. */
  root?: Document | Element;
}
export interface PillShadows {
  /** Re-read after CSSOM edits or other style changes without a DOM event. */
  refresh(): void;
  /** Stop observing and restore the inline properties this observer owns. */
  disconnect(): void;
}

/**
 * Resolve the shadow through ::before's real box-shadow property. The browser
 * substitutes var() (including inherited values and fallbacks), evaluates CSS
 * math and converts relative units in the pill's own font/container context.
 * The source property stays untouched, so subsequent changes remain visible.
 * Only event-driven frames are scheduled; unchanged pills cause no writes.
 */
export function observePillShadows(
  options: PillShadowOptions = {},
  changed?: (element: Element) => void,
): PillShadows {
  const root = options.root ?? document;
  const doc = root.nodeType === 9 ? (root as Document) : (root.ownerDocument as Document);
  const view = doc.defaultView!;
  const selector = `.${options.prefix ?? "squircle-pill"}, [${PILL_ATTRIBUTE}]`;
  type Saved = { value: string; priority: string };
  const watched = new Map<HTMLElement, { original: Saved[]; shadow?: string }>();
  let frame = 0;
  let stopped = false;
  const names = [PILL_RESOLVED_SHADOW_VAR_NAME, PILL_SHADOW_REACH_VAR_NAME];
  const restore = (el: HTMLElement, original: Saved[]) => {
    names.forEach((name, i) => {
      const saved = original[i]!;
      if (saved.value) el.style.setProperty(name, saved.value, saved.priority);
      else el.style.removeProperty(name);
    });
  };
  const resizes = new view.ResizeObserver(() => schedule());
  const refresh = () => {
    if (stopped) return;
    const found = new Set(root.querySelectorAll<HTMLElement>(selector));
    if (root.nodeType === 1 && (root as Element).matches(selector)) found.add(root as HTMLElement);
    for (const [el, state] of watched) {
      if (found.has(el)) continue;
      resizes.unobserve(el);
      watched.delete(el);
      restore(el, state.original);
    }
    for (const el of found) {
      if (watched.has(el)) continue;
      watched.set(el, {
        original: names.map((name) => ({
          value: el.style.getPropertyValue(name),
          priority: el.style.getPropertyPriority(name),
        })),
      });
      resizes.observe(el);
    }
    // All reads before writes. In particular, never feed the resolved output
    // back into ::before: it must always compute the live CSS shadow source.
    const updates: [HTMLElement, string][] = [];
    for (const [el, state] of watched) {
      const shadow = view.getComputedStyle(el, "::before").boxShadow || "none";
      if (shadow !== state.shadow) {
        state.shadow = shadow;
        updates.push([el, shadow]);
      }
    }
    for (const [el, shadow] of updates) {
      el.style.setProperty(PILL_RESOLVED_SHADOW_VAR_NAME, shadow);
      el.style.setProperty(PILL_SHADOW_REACH_VAR_NAME, `${shadowReach(shadow)}px`);
    }
    for (const [el] of updates) changed?.(el);
  };
  function schedule() {
    if (stopped || frame) return;
    frame = view.requestAnimationFrame(() => {
      frame = 0;
      refresh();
    });
  }
  const mutations = new view.MutationObserver((records) => {
    if (
      records.some((record) => {
        if (record.type !== "attributes" || record.attributeName !== "style") return true;
        const el = record.target as HTMLElement;
        return (
          pillStyleInputs(doc, record.oldValue ?? "") !== pillStyleInputs(doc, el.style.cssText)
        );
      })
    )
      schedule();
  });
  // Observe ancestors too: inherited variables, data-theme and group/peer/:has
  // selectors can change a pill without changing any of its own attributes.
  mutations.observe(doc, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeOldValue: true,
  });
  const events = [
    "focusin",
    "focusout",
    "pointerover",
    "pointerout",
    "pointerdown",
    "pointerup",
    "keydown",
    "keyup",
    "input",
    "change",
    "transitionend",
    "transitioncancel",
    "animationend",
    "load",
  ];
  for (const event of events) doc.addEventListener(event, schedule, true);
  view.addEventListener("resize", schedule);
  doc.fonts?.addEventListener("loadingdone", schedule);
  const theme = view.matchMedia("(prefers-color-scheme: dark)");
  theme.addEventListener("change", schedule);
  refresh();
  return {
    refresh,
    disconnect() {
      stopped = true;
      view.cancelAnimationFrame(frame);
      mutations.disconnect();
      resizes.disconnect();
      for (const event of events) doc.removeEventListener(event, schedule, true);
      view.removeEventListener("resize", schedule);
      doc.fonts?.removeEventListener("loadingdone", schedule);
      theme.removeEventListener("change", schedule);
      for (const [el, state] of watched) restore(el, state.original);
      watched.clear();
    },
  };
}
