import "./shadows.css";
import { registerPillWorklet } from "../src/pill-worklet";
import { pillOutlinePoints, polyfillPills } from "../src/pill-polyfill";

const params = new URLSearchParams(location.search);
const mode = params.get("mode");
const fixture = document.querySelector<HTMLElement>("#fixture")!;
fixture.style.zoom = params.get("zoom") ?? "1";
fixture.innerHTML = `<div class="cell"><button class="squircle-pill" style="background:black;filter:drop-shadow(0 2px 2px black)" aria-label="Drop shadow test"></button></div>`;
const path = pillOutlinePoints(120, 40)
  .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`)
  .join("");
const silhouette =
  mode === "native" ? '<rect width="120" height="40" rx="20"/>' : `<path d="${path}Z"/>`;
// A single SVG silhouette is the browser-filtered reference; the unfiltered
// copy identifies its edge so antialiasing there isn't mistaken for a shadow.
for (const filter of ["drop-shadow(0 2px 2px black)", "none"]) {
  const cell = document.createElement("div");
  cell.className = "cell";
  cell.innerHTML = `<svg width="120" height="40" viewBox="0 0 120 40" style="overflow:visible;filter:${filter}">${silhouette}</svg>`;
  fixture.append(cell);
}
if (mode === "polyfill") polyfillPills({ force: true });
else if (mode === "worklet" && !(await registerPillWorklet("/dist/pill-shape.worklet.mjs")))
  throw new Error("Paint worklet unavailable");
await new Promise((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 40))),
);
document.documentElement.dataset["ready"] = "true";
