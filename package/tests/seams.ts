import "./shadows.css";
import { registerPillWorklet } from "../src/pill-worklet";
import { pillOutlinePoints, polyfillPills } from "../src/pill-polyfill";

const params = new URLSearchParams(location.search);
const fixture = document.querySelector<HTMLElement>("#fixture")!;
fixture.style.zoom = params.get("zoom") ?? "1";
// Matching black fill and shadow make light pixels at their join a seam.
// The blurred case has enough spread to be opaque all along that join.
fixture.style.setProperty(
  "--button-shadow",
  params.has("blur") ? "0 0 2px 8px black" : "0 0 0 4px black",
);
fixture.innerHTML = `<div class="cell"><button class="squircle-pill shadow-(--button-shadow)" style="background:black" aria-label="Seam test"></button></div>`;
const reference = document.createElement("div");
reference.className = "cell";
const path = pillOutlinePoints(120, 40)
  .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`)
  .join("");
// One filled silhouette, without a separate background mask/shadow cutout.
// For the blurred case this reference lies inside the shadow's opaque area.
reference.innerHTML = `<svg width="136" height="56" viewBox="-8 -8 136 56"><path d="${path}Z" fill="black" stroke="black" stroke-width="8"/></svg>`;
fixture.append(reference);
if (params.get("mode") === "polyfill") polyfillPills({ force: true });
else if (!(await registerPillWorklet("/dist/pill-shape.worklet.mjs")))
  throw new Error("Paint worklet unavailable");
await new Promise((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 40))),
);
document.documentElement.dataset["ready"] = "true";
