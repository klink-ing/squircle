/**
 * Draws the pill gallery (src/pages/demos/pill-gallery.astro) in the mode its
 * URL asks for. Each mode is a page load of its own, because a registered
 * paint worklet can never be unregistered.
 */
import { registerPillWorklet } from "@klinking/squircle/pill-worklet";
import { polyfillPills } from "@klinking/squircle/pill-polyfill";
import workletUrl from "@klinking/squircle/pill-shape.worklet.js?url";

type Mode = "auto" | "worklet" | "polyfill" | "none";
const MODES: Mode[] = ["auto", "worklet", "polyfill", "none"];

const asked = new URLSearchParams(location.search).get("mode") as Mode | null;
const mode: Mode = asked && MODES.includes(asked) ? asked : "auto";

for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-mode]")) {
  const current = link.dataset.mode === mode;
  link.classList.toggle("bg-indigo-600", current);
  link.classList.toggle("text-white", current);
  if (current) link.setAttribute("aria-current", "page");
}

const status = document.getElementById("drawn-by") as HTMLElement;

async function start() {
  let drawnBy = "the plain stadium fallback";
  if (mode === "auto" || mode === "worklet") {
    if (await registerPillWorklet(workletUrl)) drawnBy = "the paint worklet";
    else if (mode === "auto") {
      polyfillPills();
      drawnBy = "the polyfill (this browser has no paint worklet)";
    } else drawnBy = "the plain stadium fallback (this browser has no paint worklet)";
  } else if (mode === "polyfill") {
    polyfillPills({ force: true });
    drawnBy = "the polyfill";
  }
  status.textContent = drawnBy;
}

void start();
