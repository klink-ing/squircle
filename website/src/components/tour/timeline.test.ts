// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import GuidedExplorer from "../GuidedExplorer";
import { CHECKPOINTS, checkpointAtTime, DURATION, nextCheckpoint } from "./timeline";

let reduced = false;
const listeners = new Set<() => void>();
beforeAll(() => vi.useFakeTimers());
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  reduced = false;
  vi.stubGlobal("matchMedia", () => ({
    matches: reduced,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  listeners.clear();
});
async function advance(ms = 1400) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
function setup() {
  const view = render(createElement(GuidedExplorer));
  const root = () => view.container.querySelector<HTMLElement>("[data-tour-composition]")!;
  const next = () => fireEvent.click(view.container.querySelector("nav button:last-child")!);
  const back = () => fireEvent.click(view.container.querySelector("nav button:first-child")!);
  return { ...view, root, next, back };
}

describe("shared Motion tour runtime", () => {
  it("has seven reading stops with consistent seeking boundaries", () => {
    expect(CHECKPOINTS).toHaveLength(7);
    CHECKPOINTS.forEach((cue, index) => {
      expect(cue.time - cue.start).toBeGreaterThanOrEqual(0.4);
      expect(checkpointAtTime(cue.time)).toBe(index);
      expect(nextCheckpoint(cue.time)).toBe(Math.min(6, index + 1));
    });
    expect(DURATION).toBe(CHECKPOINTS[6].time);
  });
  it("pauses at every checkpoint, guards rapid Next, and interrupts with Back", async () => {
    const { root, next, back } = setup();
    await advance();
    expect(root().dataset.tourTime).toBe("0.8000");
    next();
    next();
    next();
    await advance();
    expect(root().dataset.tourTime).toBe("2.0000");
    expect(root().dataset.tourAmount).toBe("2");
    next();
    await advance(200);
    back();
    await advance();
    expect(root().dataset.tourTime).toBe("2.0000");
    expect(root().dataset.tourMoving).toBe("false");
  });
  it("keeps slider focus and choice through correction, Back, and Reset", async () => {
    const { root, next, back, container, getByText } = setup();
    await advance();
    for (let index = 0; index < 3; index++) {
      next();
      await advance();
    }
    const slider = container.querySelector<HTMLInputElement>("#tour-strength")!;
    slider.focus();
    fireEvent.change(slider, { target: { value: "2.7" } });
    expect(document.activeElement).toBe(slider);
    expect(Number(root().dataset.tourAmount)).toBeCloseTo(2.7);
    next();
    await advance(500);
    expect(Number(root().dataset.tourAmount)).toBeLessThan(2.7);
    expect(Number(root().dataset.tourAmount)).toBeGreaterThan(2);
    await advance();
    expect(Number(root().dataset.tourAmount)).toBeCloseTo(2);
    expect(root().dataset.tourCorrection).toBe("1");
    back();
    await advance(30);
    expect(Number(root().dataset.tourAmount)).toBeCloseTo(2.7);
    fireEvent.click(getByText("Reset"));
    expect(Number(root().dataset.tourAmount)).toBeCloseTo(2);
  });
  it("settles immediately when reduced motion changes during playback", async () => {
    const { root, next } = setup();
    await advance();
    next();
    await advance(200);
    act(() => {
      reduced = true;
      listeners.forEach((listener) => listener());
    });
    await advance(30);
    expect(root().dataset.tourTime).toBe("2.0000");
    expect(root().dataset.tourMoving).toBe("false");
    next();
    await advance(30);
    expect(root().dataset.tourTime).toBe("3.2000");
  });
  it("seeks directly and isolates Explore edits from remembered tour choices", async () => {
    const { root, container, next, back, getByText, getByLabelText } = setup();
    await advance();
    const scrub = container.querySelector<HTMLInputElement>("#tour-time")!;
    scrub.focus();
    fireEvent.change(scrub, { target: { value: "4.2" } });
    await advance(30);
    expect(document.activeElement).toBe(scrub);
    fireEvent.change(container.querySelector("#tour-strength")!, { target: { value: "3" } });
    fireEvent.change(scrub, { target: { value: "7.4" } });
    await advance(30);
    next();
    fireEvent.change(getByLabelText("Superellipse Amount"), { target: { value: "1.2" } });
    fireEvent.click(getByText("← Back to tour"));
    expect(root().dataset.tourTime).toBe("7.4000");
    expect(Number(root().dataset.tourAmount)).toBeCloseTo(2);
    back();
    back();
    back();
    await advance(30);
    expect(Number(root().dataset.tourAmount)).toBeCloseTo(3);
    expect(container.querySelectorAll("section:not([hidden])")).toHaveLength(1);
    expect(container.querySelectorAll("section[hidden]:not([inert])")).toHaveLength(0);
  });
  it("resumes animation after reduced motion is switched off and cleans up on unmount", async () => {
    const { root, next, unmount } = setup();
    await advance();
    act(() => {
      reduced = true;
      listeners.forEach((listener) => listener());
    });
    next();
    await advance(30);
    expect(root().dataset.tourTime).toBe("2.0000");
    act(() => {
      reduced = false;
      listeners.forEach((listener) => listener());
    });
    next();
    await advance(250);
    expect(root().dataset.tourMoving).toBe("true");
    expect(Number(root().dataset.tourTime)).toBeGreaterThan(2);
    expect(Number(root().dataset.tourTime)).toBeLessThan(3.2);
    unmount();
    await advance();
    expect(listeners.size).toBe(0);
  });
  it("starts at a fully visible checkpoint when reduced motion is already enabled", async () => {
    reduced = true;
    const { root, next, container } = setup();
    await advance(30);
    expect(root().dataset.tourTime).toBe("0.8000");
    expect(root().dataset.tourMoving).toBe("false");
    next();
    await advance(30);
    expect(root().dataset.tourTime).toBe("2.0000");
    expect(root().dataset.tourAmount).toBe("2");
    expect(container.querySelector<HTMLElement>("section:not([hidden])")!.style.opacity).toBe("1");
  });
});
