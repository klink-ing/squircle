import "./shadows.css";
import { registerPillWorklet, refreshPillShadows } from "../src/pill-worklet";
import { polyfillPills } from "../src/pill-polyfill";

// Open /tests/shadows.html?mode=worklet|polyfill|native&zoom=0.5|1|1.5.
// Each row compares a literal, its variable equivalent, and an oversized
// reference canvas. The browser suite compares their outer shadow pixels.
const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "worklet";
const zoom = Number(params.get("zoom") ?? 1);
const fixture = document.querySelector<HTMLElement>("#fixture")!;
fixture.style.zoom = String(zoom);
const result = document.querySelector("#result")!;
const results: string[] = [];
const assert = (ok: boolean, message: string) => {
  if (!ok) throw new Error(message);
  results.push(message);
};
const settle = () =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 40))),
  );
const shadow = (el: Element) =>
  getComputedStyle(el).getPropertyValue("--squircle-pill-resolved-shadow").trim();
const reach = (el: Element) =>
  parseFloat(getComputedStyle(el).getPropertyValue("--squircle-pill-shadow-reach"));
let polyfill: ReturnType<typeof polyfillPills>;
function pair(literal: string, variable: string) {
  const row = document.createElement("div");
  row.className = "row";
  for (const utility of [literal, variable, variable]) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.innerHTML = `<button class="squircle-pill bg-teal-600 ${utility}" aria-label="Shadow test"></button>`;
    row.append(cell);
  }
  fixture.append(row);
  const pills = [...row.querySelectorAll("button")];
  // Deliberately oversized only in the test reference, to detect clipping.
  // Extra space is an even number of CSS pixels so all tested zooms keep
  // the reference canvas on the same device-pixel phase as the real one.
  pills[2]!.style.setProperty(
    "--squircle-pill-reach",
    "calc(var(--squircle-pill-shadow-reach) + 64px)",
    "important",
  );
  return pills as [HTMLButtonElement, HTMLButtonElement, HTMLButtonElement];
}
async function equivalent(pills: HTMLButtonElement[], label: string) {
  await settle();
  const [literal, variable] = pills as [HTMLButtonElement, HTMLButtonElement];
  assert(shadow(literal) === shadow(variable), `${label}: resolved lists match`);
  assert(reach(literal) === reach(variable), `${label}: reaches match`);
  const expected = reach(variable);
  assert(
    parseFloat(getComputedStyle(variable, "::after").left) <= -expected,
    `${label}: painting box covers reach`,
  );
}

async function run() {
  const simple = pair("shadow-[0_1px_2px_0_rgb(0_0_0/0.1)]", "shadow-(--button-shadow)");
  const nested = pair("shadow-[-6px_4px_8px_-2px_rgb(0_0_0/0.8)]", "shadow-(--nested)");
  fixture.style.setProperty(
    "--alias",
    "var(--missing, var(--fallback, -6px 4px 8px -2px rgb(0 0 0 / .8)))",
  );
  fixture.style.setProperty("--nested", "var(--alias)");
  const relative = pair(
    "shadow-[-12px_20px_8px_-2px_black,4px_-6px_4px_2px_red]",
    "shadow-(--relative)",
  );
  fixture.style.setProperty(
    "--relative",
    "-.5em 1rem calc(.2rem + 4px) -2px black, 4px -6px 4px 2px red",
  );
  if (mode === "polyfill") polyfill = polyfillPills({ force: true });
  else if (mode === "worklet")
    assert(await registerPillWorklet("/dist/pill-shape.worklet.mjs"), "paint worklet available");
  else {
    await settle();
    assert(
      !document.documentElement.hasAttribute("data-squircle-pill-polyfill"),
      "native fallback stays enabled",
    );
    assert(getComputedStyle(simple[1]).boxShadow !== "none", "native shadow remains visible");
    return;
  }
  assert(
    !document.documentElement.hasAttribute(
      mode === "worklet" ? "data-squircle-pill-polyfill" : "data-squircle-pill-worklet",
    ),
    "only requested renderer enabled",
  );
  await equivalent(simple, "reproducer");
  assert(reach(simple[1]) >= 4, "reproducer reserves the blur tail");
  await equivalent(nested, "nested fallbacks and negative spread");
  await equivalent(relative, "relative units, calc and multiple shadows");
  fixture.style.fontSize = "28px";
  relative[0].className =
    "squircle-pill bg-teal-600 shadow-[-14px_20px_8px_-2px_black,4px_-6px_4px_2px_red]";
  await equivalent(relative, "inherited font-size changes relative shadows");
  fixture.style.fontSize = "24px";
  relative[0].className =
    "squircle-pill bg-teal-600 shadow-[-12px_20px_8px_-2px_black,4px_-6px_4px_2px_red]";
  fixture.style.zoom = String(zoom === 0.5 ? 1.5 : 0.5);
  await equivalent(relative, "zoom changes after initialization");
  fixture.style.zoom = String(zoom);

  // Inherited inline values and data-theme changes, without manual refresh.
  fixture.dataset["theme"] = "dark";
  simple[0].className = nested[0].className;
  await equivalent(simple, "theme attribute");
  fixture.style.setProperty("--button-shadow", "0 0 0 5px blue");
  simple[0].className = "squircle-pill bg-teal-600 shadow-[0_0_0_5px_blue]";
  await equivalent(simple, "inherited inline variable");
  // Real focus state, rather than dispatching an event that cannot set :focus.
  simple[1].classList.add("focus:shadow-[0_0_0_9px_red]");
  simple[1].focus();
  await settle();
  assert(
    reach(simple[1]) === 9,
    `focus utility overrides variable shadow (focus: ${document.hasFocus()}, matches: ${simple[1].matches(":focus")}, reach: ${reach(simple[1])})`,
  );
  simple[1].blur();
  await equivalent(simple, "focus reset");
  const added = pair("shadow-[0_0_0_5px_blue]", "shadow-(--button-shadow)");
  await equivalent(added, "newly inserted pills");
  added[1].className = "squircle-pill bg-teal-600 shadow-none";
  await settle();
  assert(reach(added[1]) === 0, "shadow-none clears reach");
  added[1].className = "squircle-pill bg-teal-600 shadow-(--button-shadow)";
  fixture.style.setProperty("--button-shadow", "inset 0 20px 40px 10px black");
  await settle();
  assert(reach(added[1]) === 0, "inset shadows add no outer reach");
  fixture.style.setProperty("--button-shadow", "0 1px 2px 0 rgb(0 0 0 / .1)");
  simple[0].className = "squircle-pill bg-teal-600 shadow-[0_1px_2px_0_rgb(0_0_0/0.1)]";
  fixture.removeAttribute("data-theme");
  added[0].parentElement!.parentElement!.remove();
  await equivalent(simple, "reset after changes");
  // No continuous polling or mutation-observer feedback after settling.
  let writes = 0;
  const observer = new MutationObserver((records) => (writes += records.length));
  observer.observe(fixture, { attributes: true, subtree: true });
  await new Promise((resolve) => setTimeout(resolve, 400));
  observer.disconnect();
  assert(writes === 0, "idle pills cause no style writes");
  // CSSOM changes have an explicit refresh hook on both renderers.
  const sheet = new CSSStyleSheet();
  sheet.replaceSync("#fixture { --button-shadow: 0 0 0 7px red !important; }");
  document.adoptedStyleSheets = [sheet];
  if (polyfill) polyfill.refresh();
  else refreshPillShadows();
  assert(reach(simple[1]) === 7, "explicit refresh handles CSSOM changes");
  document.adoptedStyleSheets = [];
  if (polyfill) polyfill.refresh();
  else refreshPillShadows();
  fixture.style.removeProperty("--button-shadow");
  await settle();
}
document.querySelector("#run")!.addEventListener(
  "click",
  () => {
    result.textContent = "Running…";
    run()
      .then(() => {
        result.textContent = `${results.length} checks passed (${mode}, zoom ${zoom}). Literal / variable / oversized reference.`;
        Object.assign(window, { shadowTests: { passed: true, results, mode, zoom } });
      })
      .catch((error) => {
        result.textContent = String(error);
        Object.assign(window, { shadowTests: { passed: false, results, error: String(error) } });
        console.error(error);
      });
  },
  { once: true },
);
