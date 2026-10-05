#!/usr/bin/env node
/**
 * Runs the pill resize benchmark headlessly and prints the results.
 *
 *   pnpm --filter website exec astro build && pnpm --filter website exec astro preview &
 *   node website/scripts/bench-pills.mjs [--url http://localhost:4321] [--counts 10,100,1000]
 *                                        [--modes none,worklet,polyfill] [--chrome /path/to/chrome]
 *
 * Talks to Chrome over the DevTools protocol with Node's built-in WebSocket, so
 * it needs nothing installed beyond Chrome itself. Headless frame timing is
 * not a real display's, so compare runs from the same machine against each
 * other rather than reading the numbers as absolutes.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:4321" },
    counts: { type: "string", default: "10,100,500,1000" },
    modes: { type: "string", default: "none,worklet,polyfill" },
    chrome: { type: "string", default: process.env.CHROME ?? "google-chrome" },
    port: { type: "string", default: "9333" },
    timeout: { type: "string", default: "600" },
  },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), "pill-bench-"));

const chrome = spawn(
  values.chrome,
  [
    "--headless=new",
    `--remote-debugging-port=${values.port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-sandbox",
    "--window-size=1280,900",
    // Keep the page rendering at full rate while nobody is looking at it.
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function target() {
  for (let i = 0; i < 100; i++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${values.port}/json`)).json();
      const page = pages.find((p) => p.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Not listening yet.
    }
    await sleep(100);
  }
  throw new Error("Chrome did not start");
}

function connect(url) {
  const socket = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const messageId = ++id;
      pending.set(messageId, resolve);
      socket.send(JSON.stringify({ id: messageId, method, params }));
    });
  return new Promise((resolve) => socket.addEventListener("open", () => resolve({ send, socket })));
}

try {
  const { send, socket } = await connect(await target());
  const counts = values.counts.split(",");
  const modes = values.modes.split(",");
  const page = `${values.url.replace(/\/$/, "")}/bench/pills/`;
  await send("Page.enable");
  await send("Page.navigate", { url: page });
  await sleep(1500);
  // Tick exactly the requested runs, then submit.
  await send("Runtime.evaluate", {
    expression: `(() => {
      const counts = ${JSON.stringify(counts)}, modes = ${JSON.stringify(modes)};
      for (const box of document.querySelectorAll('input[name=count]')) box.checked = counts.includes(box.value);
      for (const box of document.querySelectorAll('input[name=mode]')) box.checked = modes.includes(box.value);
      document.getElementById('config').requestSubmit();
    })()`,
  });

  const deadline = Date.now() + Number(values.timeout) * 1000;
  let state;
  while (Date.now() < deadline) {
    await sleep(1000);
    const { result } = await send("Runtime.evaluate", {
      expression: "JSON.stringify(window.__pillBench ?? null)",
      returnByValue: true,
    });
    state = JSON.parse(result?.result?.value ?? "null");
    if (state?.done) break;
    if (state) process.stderr.write(`\r${state.results.length} runs done…  `);
  }
  process.stderr.write("\n");
  socket.close();

  if (!state?.done) throw new Error("benchmark did not finish in time");
  const header = "| mode | pills | setup ms | mean | p50 | p95 | max | >20ms frames |";
  console.log(header);
  console.log("|---|--:|--:|--:|--:|--:|--:|--:|");
  for (const r of state.results) {
    if (r.error) {
      console.log(`| error | | ${r.error} | | | | | |`);
      continue;
    }
    console.log(
      `| ${r.mode} | ${r.count} | ${r.setupMs} | ${r.meanFrameMs.toFixed(1)} | ${r.p50FrameMs.toFixed(1)} | ${r.p95FrameMs.toFixed(1)} | ${r.maxFrameMs.toFixed(1)} | ${r.slowFrames} |`,
    );
  }
} finally {
  // Wait for Chrome to exit before removing its profile: it is still writing
  // to it as it shuts down.
  const exited = new Promise((resolve) => chrome.once("exit", resolve));
  chrome.kill();
  await Promise.race([exited, sleep(5000)]);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
