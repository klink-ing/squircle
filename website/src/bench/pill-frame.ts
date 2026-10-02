/**
 * One run of the pill resize benchmark; see src/pages/bench/pill-frame.astro.
 */
import { registerPillWorklet } from "@klinking/squircle/pill-worklet";
import { polyfillPills } from "@klinking/squircle/pill-polyfill";
import workletUrl from "@klinking/squircle/pill-shape.worklet.js?url";

type Mode = "worklet" | "polyfill" | "none";

const params = new URLSearchParams(location.search);
const count = Number(params.get("count") ?? 100);
const mode = (params.get("mode") ?? "worklet") as Mode;
const frames = Number(params.get("frames") ?? 120);
const seed = Number(params.get("seed") ?? 1);
// `masked` puts a Tailwind mask utility on every other pill, to see the pill
// shape and Tailwind's masks combine, and what that costs.
const masked = params.has("masked");
// `clipped` puts a clip-path of its own on every third pill, to see the
// polyfill fold it into the pill's: Tailwind has no clip-path utilities of
// its own beyond `sr-only`, so these are arbitrary properties.
const clipped = params.has("clipped");
const OWN_CLIPS = [
  "[clip-path:inset(0_0_0_50%)]",
  "[clip-path:polygon(0_0,100%_0,0_100%)]",
  "[clip-path:circle(40%_at_100%_50%)]",
];

const stage = document.getElementById("stage") as HTMLElement;
const status = document.getElementById("status") as HTMLElement;
const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

/** Deterministic, so every mode resizes exactly the same pills. */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Spelled out in full so Tailwind finds and generates every class.
const FILLS = ["bg-pink-600", "bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-sky-500"];
const HEIGHTS = [20, 28, 36, 48, 64, 96];

function build() {
  const random = mulberry32(seed);
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const pill = document.createElement("div");
    const fill = FILLS[Math.floor(random() * FILLS.length)];
    const classes = ["squircle-pill", fill];
    // A share with borders and a share at G3, so the ring and the more
    // expensive profile are both exercised.
    if (random() < 0.25) classes.push("border-2", "border-zinc-100");
    if (random() < 0.25) classes.push("squircle-pill-g3");
    if (masked && i % 2 === 0) classes.push("mask-b-from-20%");
    if (clipped && i % 3 === 0) classes.push(OWN_CLIPS[(i / 3) % OWN_CLIPS.length] as string);
    pill.className = classes.join(" ");
    // Widths are a share of the stage, so every pill resizes, and its
    // aspect ratio changes, as the stage does.
    pill.style.width = `${(4 + random() * 28).toFixed(2)}%`;
    pill.style.height = `${HEIGHTS[Math.floor(random() * HEIGHTS.length)]}px`;
    fragment.append(pill);
  }
  stage.append(fragment);
}

const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

async function run() {
  const t0 = performance.now();
  build();

  if (mode === "worklet") {
    await registerPillWorklet(workletUrl);
  } else if (mode === "polyfill") {
    polyfillPills({ force: true });
  }
  // Settled once two frames have rendered with the shapes in place; for
  // the polyfill, once every pill has had its clip computed.
  const pills = [...stage.children] as HTMLElement[];
  for (let i = 0; i < 600; i++) {
    await nextFrame();
    if (mode !== "polyfill" || pills.every((p) => p.style.length > 2)) break;
  }
  await nextFrame();
  await nextFrame();
  const setupMs = performance.now() - t0;

  // Long tasks, where the browser reports them.
  let longTasks = 0;
  let longTaskMs = 0;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks++;
        longTaskMs += entry.duration;
      }
    }).observe({ type: "longtask", buffered: false });
  } catch {
    // Not supported; frame times still tell the story.
  }

  status.textContent = `${mode} · ${count} pills · resizing…`;
  const full = stage.parentElement!.clientWidth - 16;
  const deltas: number[] = [];
  let last = await nextFrame();
  const resizeStart = last;
  for (let i = 1; i <= frames; i++) {
    // Down to 45% of the width and back, once, eased.
    const t = (1 - Math.cos((2 * Math.PI * i) / frames)) / 2;
    stage.style.width = `${(full * (1 - 0.55 * t)).toFixed(1)}px`;
    const now = await nextFrame();
    deltas.push(now - last);
    last = now;
  }
  const resizeMs = last - resizeStart;

  // `frames=0` measures setup alone.
  const sorted = deltas.length > 0 ? [...deltas].sort((a, b) => a - b) : [0];
  const result = {
    mode,
    count,
    frames,
    setupMs: Math.round(setupMs),
    meanFrameMs: +(resizeMs / frames).toFixed(2),
    p50FrameMs: +percentile(sorted, 50).toFixed(2),
    p95FrameMs: +percentile(sorted, 95).toFixed(2),
    maxFrameMs: +sorted[sorted.length - 1].toFixed(2),
    slowFrames: deltas.filter((d) => d > 20).length,
    longTasks,
    longTaskMs: Math.round(longTaskMs),
  };
  status.textContent = JSON.stringify(result);
  (window as unknown as { __pillBench: unknown }).__pillBench = result;
  window.parent?.postMessage({ type: "pill-bench", result }, "*");
}

run().catch((error) => {
  status.textContent = `failed: ${error}`;
  window.parent?.postMessage({ type: "pill-bench", error: String(error), mode, count }, "*");
});
