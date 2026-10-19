import "./shadows.css";
import { registerPillWorklet } from "../src/pill-worklet";
import { pillOutlinePoints, polyfillPills } from "../src/pill-polyfill";

const params = new URLSearchParams(location.search);
const mode = params.get("mode");
const continuity = params.get("continuity") ?? "3";
const fixture = document.querySelector<HTMLElement>("#fixture")!;
fixture.style.zoom = "1.5";
// Rasterize each comparison at the same page position. Chromium's edge
// antialiasing can otherwise differ even between identical native circles.
fixture.style.position = "relative";
fixture.style.setProperty("--squircle-pill-continuity", continuity);
fixture.innerHTML = `<div class="cell"><button class="squircle-pill squircle-pill-arc-setback-(--arc) squircle-pill-edge-setback-(--edge)" style="background:black"></button></div>
<div class="cell"><button class="squircle-pill squircle-pill-arc-setback-30 squircle-pill-edge-setback-1" style="background:black"></button></div>
<div class="cell"><svg width="120" height="40" viewBox="0 0 120 40"></svg></div>`;
for (const cell of fixture.querySelectorAll<HTMLElement>(".cell")) {
  Object.assign(cell.style, { position: "absolute", top: "0", left: "0", visibility: "hidden" });
}
const literal = fixture.querySelectorAll("button")[1]!;
const reference = fixture.querySelector("svg")!;
async function setSetbacks(
  arc: string,
  edge: string,
  degrees: number,
  width = 120,
  height = 40,
  max = "",
) {
  if (max) fixture.style.setProperty("--squircle-pill-max-radius", max);
  else fixture.style.removeProperty("--squircle-pill-max-radius");
  fixture.style.setProperty("--arc", arc);
  fixture.style.setProperty("--edge", edge);
  literal.style.setProperty("--squircle-pill-arc-setback", `${degrees}deg`);
  literal.style.setProperty("--squircle-pill-edge-setback", edge);
  for (const button of fixture.querySelectorAll("button")) {
    button.style.width = `${width}px`;
    button.style.height = `${height}px`;
  }
  reference.setAttribute("width", String(width));
  reference.setAttribute("height", String(height));
  reference.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const points = pillOutlinePoints(width, height, {
    arcSetback: `${degrees}deg`,
    edgeSetback: edge,
    continuity,
    maxRadius: max || undefined,
  });
  const path = points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("");
  reference.innerHTML =
    mode === "native"
      ? `<rect width="${width}" height="${height}" rx="${Math.min(max ? parseFloat(max) : Infinity, height / 2)}"/>`
      : `<path d="${path}Z"/>`;
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 40))),
  );
}
await setSetbacks("30deg", "1", 30);
if (mode === "polyfill") polyfillPills({ force: true });
else if (mode === "worklet" && !(await registerPillWorklet("/dist/pill-shape.worklet.mjs")))
  throw Error("Paint worklet unavailable");
Object.assign(window, { setSetbacks });
document.documentElement.dataset["ready"] = "true";
