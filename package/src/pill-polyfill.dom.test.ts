/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { polyfillPills, type PillPolyfill } from "./pill-polyfill";

/**
 * happy-dom observes no layout, so this stands in for the browser's
 * ResizeObserver: `resizeAll` reports every observed element at a size.
 */
let observed: { callback: ResizeObserverCallback; elements: Set<Element> }[] = [];
class FakeResizeObserver {
  elements = new Set<Element>();
  constructor(public callback: ResizeObserverCallback) {
    observed.push(this);
  }
  observe(el: Element) {
    this.elements.add(el);
  }
  unobserve(el: Element) {
    this.elements.delete(el);
  }
  disconnect() {
    this.elements.clear();
  }
}
const resizeAll = (width = 120, height = 40) => {
  for (const observer of observed) {
    const entries = [...observer.elements].map(
      (target) => ({ target, borderBoxSize: [{ inlineSize: width, blockSize: height }] }) as never,
    );
    observer.callback(entries, observer as never);
  }
};

/** Lets mutation records arrive, then runs the frame the polyfill draws in. */
const nextFrame = async () => {
  await Promise.resolve();
  vi.advanceTimersByTime(20);
};

/** How many times the polyfill has read `el`'s computed style. */
const readsOf = (spy: ReturnType<typeof vi.spyOn>, el: Element) =>
  spy.mock.calls.filter(([target]: unknown[]) => target === el).length;

describe("polyfillPills re-reading settings", () => {
  let polyfill: PillPolyfill | null = null;
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    observed = [];
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    spy = vi.spyOn(window, "getComputedStyle");
    document.body.innerHTML = `
      <div id="outside"><div class="squircle-pill" id="far"></div></div>
      <div id="group"><div class="squircle-pill squircle-pill-s" id="pill"></div></div>`;
    polyfill = polyfillPills({ force: true });
    resizeAll();
  });

  afterEach(() => {
    polyfill?.disconnect();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    spy.mockRestore();
  });

  it("reads each pill once, and not again on a resize of its own", async () => {
    await nextFrame();
    const pill = document.getElementById("pill") as Element;
    expect(readsOf(spy, pill)).toBe(1);
    resizeAll(200, 40);
    await nextFrame();
    expect(readsOf(spy, pill)).toBe(1);
  });

  it("re-reads every pill once the viewport settles, for media-query variants", async () => {
    // `sm:squircle-pill-t`, `md:squircle-pill-amt-3`: a breakpoint changes
    // what a pill's classes mean without changing its classes.
    await nextFrame();
    const pill = document.getElementById("pill") as Element;
    const far = document.getElementById("far") as Element;
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));
    await nextFrame();
    // Not on every event of a drag: once it settles.
    expect(readsOf(spy, pill)).toBe(1);
    vi.advanceTimersByTime(500);
    await nextFrame();
    expect(readsOf(spy, pill)).toBe(2);
    expect(readsOf(spy, far)).toBe(2);
  });

  it("re-reads the pills inside an element whose dir or class changes", async () => {
    // `dir="rtl"` flips `-s` and `-e`; `.dark` on an ancestor recolours a
    // `dark:border-*`.
    await nextFrame();
    const pill = document.getElementById("pill") as Element;
    const far = document.getElementById("far") as Element;
    document.getElementById("group")?.setAttribute("dir", "rtl");
    await nextFrame();
    expect(readsOf(spy, pill)).toBe(2);
    document.getElementById("group")?.classList.add("dark");
    await nextFrame();
    expect(readsOf(spy, pill)).toBe(3);
    // Pills elsewhere are left alone.
    expect(readsOf(spy, far)).toBe(1);
  });
});
