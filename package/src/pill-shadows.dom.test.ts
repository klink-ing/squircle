/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observePillShadows, type PillShadows } from "./pill-shadows";
import { registerPillWorklet } from "./pill-worklet";
import {
  PILL_DECORATION_VAR_NAME,
  PILL_RESOLVED_SHADOW_VAR_NAME,
  PILL_SHADOW_REACH_VAR_NAME,
  PILL_WORKLET_ATTRIBUTE,
} from "./variants";

const settle = async () => {
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(40);
};

describe("resolved pill shadows", () => {
  let controller: PillShadows | undefined;
  let source: string;
  let spy: ReturnType<typeof vi.spyOn>;
  let pill: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    document.body.innerHTML = '<section><button class="squircle-pill"></button></section>';
    pill = document.querySelector("button")!;
    source = "rgba(0, 0, 0, 0.1) 0px 1px 2px 0px";
    spy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation(() => ({ boxShadow: source }) as CSSStyleDeclaration);
  });
  afterEach(() => {
    controller?.disconnect();
    controller = undefined;
    spy.mockRestore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.documentElement.removeAttribute(PILL_WORKLET_ATTRIBUTE);
  });
  const reach = (el: HTMLElement) => el.style.getPropertyValue(PILL_SHADOW_REACH_VAR_NAME);

  it("uses the browser's resolved list for both drawing and reach", () => {
    source =
      "rgb(0, 0, 0) -12px 20px 8px -2px, inset red 0px 100px 200px 50px, blue 4px -6px 4px 2px";
    controller = observePillShadows();
    expect(pill.style.getPropertyValue(PILL_RESOLVED_SHADOW_VAR_NAME)).toBe(source);
    expect(reach(pill)).toBe("30px");
    expect(spy).toHaveBeenCalledWith(pill, "::before");
  });

  it("ignores its own output and the polyfill's writes, and never polls idle pills", async () => {
    controller = observePillShadows();
    await settle();
    spy.mockClear();
    pill.style.setProperty(PILL_DECORATION_VAR_NAME, 'url("drawing.svg")');
    await settle();
    await vi.advanceTimersByTimeAsync(2000);
    expect(spy).not.toHaveBeenCalled();
    const writes = vi.spyOn(pill.style, "setProperty");
    controller.refresh();
    expect(writes).not.toHaveBeenCalled();
    writes.mockRestore();
  });

  it("picks up inherited inline variables and arbitrary theme attributes", async () => {
    controller = observePillShadows();
    await settle();
    source = "black 0px 0px 0px 7px";
    pill.parentElement!.style.setProperty("--consumer-shadow", "0 0 0 7px black");
    await settle();
    expect(reach(pill)).toBe("7px");
    source = "black 0px 0px 0px 9px";
    pill.parentElement!.setAttribute("data-theme", "dark");
    await settle();
    expect(reach(pill)).toBe("9px");
  });

  it("picks up state on ancestors and siblings, and resets to none or inset only", async () => {
    controller = observePillShadows();
    source = "black 0px 0px 0px 11px";
    pill.parentElement!.dispatchEvent(new Event("pointerover", { bubbles: true }));
    await settle();
    expect(reach(pill)).toBe("11px");
    source = "none";
    pill.dispatchEvent(new Event("focusout", { bubbles: true }));
    await settle();
    expect(reach(pill)).toBe("0px");
    expect(pill.style.getPropertyValue(PILL_RESOLVED_SHADOW_VAR_NAME)).toBe("none");
    source = "inset black 0px 100px 200px 50px";
    pill.dispatchEvent(new Event("focusin", { bubbles: true }));
    await settle();
    expect(reach(pill)).toBe("0px");
  });

  it("finds inserted pills and restores properties when the utility is removed", async () => {
    controller = observePillShadows();
    const added = document.createElement("button");
    added.className = "squircle-pill";
    document.body.append(added);
    await settle();
    expect(reach(added)).toBe("4px");
    added.className = "";
    await settle();
    expect(reach(added)).toBe("");
    expect(added.style.getPropertyValue(PILL_RESOLVED_SHADOW_VAR_NAME)).toBe("");
  });

  it("restores existing inline values and cancels queued work on disconnect", async () => {
    pill.style.setProperty(PILL_SHADOW_REACH_VAR_NAME, "2px", "important");
    controller = observePillShadows();
    document.body.className = "new-theme";
    controller.disconnect();
    await settle();
    expect(reach(pill)).toBe("2px");
    expect(pill.style.getPropertyPriority(PILL_SHADOW_REACH_VAR_NAME)).toBe("important");
    expect(pill.style.getPropertyValue(PILL_RESOLVED_SHADOW_VAR_NAME)).toBe("");
  });

  it("does not initialize anything on unsupported or failed worklet loads", async () => {
    vi.stubGlobal("CSS", {});
    expect(await registerPillWorklet("pill.js")).toBe(false);
    const addModule = vi.fn().mockRejectedValue(new Error("blocked"));
    vi.stubGlobal("CSS", { paintWorklet: { addModule } });
    await expect(registerPillWorklet("pill.js")).rejects.toThrow("blocked");
    expect(document.documentElement.hasAttribute(PILL_WORKLET_ATTRIBUTE)).toBe(false);
    expect(reach(pill)).toBe("");
    expect(spy).not.toHaveBeenCalled();
  });
});
