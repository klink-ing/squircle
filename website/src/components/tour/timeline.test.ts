import { afterEach, describe, expect, it } from "vitest";
import gsap from "gsap";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExplorerGraphic from "../ExplorerGraphic";
import TourNarrative from "./TourNarrative";
import { graphicFromTracks } from "./graphic-state";
import {
  CHECKPOINTS,
  APPARENT_RADIUS,
  CORRECTION,
  createTourTimeline,
  DURATION,
  RADIUS_SWEEP,
  STRENGTH,
} from "./timeline";
import { createPlayback, type PlaybackState } from "./playback";
import { correctedRadius, perceivedRadius } from "../../math";

afterEach(() => {
  gsap.globalTimeline.clear();
});

function fixture() {
  const tour = createTourTimeline(() => {});
  let state: PlaybackState = { destination: 0, moving: false };
  let focusCount = 0;
  const controls = createPlayback(
    tour.timeline,
    () => {},
    (value) => {
      state = value;
    },
    () => focusCount++,
  );
  const at = (position: number | string, amount = 2) => {
    tour.timeline.seek(position);
    return graphicFromTracks(tour.tracks, tour.timeline.time(), amount);
  };
  return { ...tour, controls, at, state: () => state, focusCount: () => focusCount };
}

function finishDriver(timeline: gsap.core.Timeline, progress = 1) {
  const driver = gsap.getTweensOf(timeline).at(-1);
  expect(driver).toBeDefined();
  driver!.progress(progress);
}

describe("tour behavior on the real GSAP timeline", () => {
  it("seeks to all eight reading stops deterministically, in any order", () => {
    const f = fixture();
    const expected = CHECKPOINTS.map((cue) => f.at(cue.id, 2.7));
    [...CHECKPOINTS].reverse().forEach((cue) => f.at(cue.id, 2.7));
    expect(CHECKPOINTS.map((cue) => f.at(cue.id, 2.7))).toEqual(expected);
    CHECKPOINTS.forEach((cue) => expect(f.timeline.labels[cue.id]).toBe(cue.time));
    expect(f.at("rounded").amount).toBe(1);
    expect(f.at("utilities").correctionAmount).toBe(1);
  });

  it("keeps the chosen strength at its stop, interpolates correction, and restores it on Back", () => {
    for (const amount of [1, 2, 2.7, 3]) {
      const f = fixture();
      expect(f.at("radius", amount).amount).toBe(2);
      expect(f.at(STRENGTH.id, amount).amount).toBe(amount);
      expect(f.at(STRENGTH.id, amount).radiusComparison).toBe(1);
      expect(f.at(CORRECTION.start, amount).amount).toBe(amount);
      expect(f.at(CORRECTION.start + 0.5, amount).amount).toBeCloseTo((amount + 2) / 2);
      expect(f.at("correction", amount).amount).toBe(2);
      f.controls.checkpoint(CHECKPOINTS.indexOf(CORRECTION));
      f.controls.back();
      expect(graphicFromTracks(f.tracks, f.timeline.time(), amount).amount).toBe(amount);
      // Reset is a live input, independent of the timeline's authored values.
      expect(graphicFromTracks(f.tracks, f.timeline.time(), 2).amount).toBe(2);
    }
  });

  it("preserves the shape and viewport while fading its fill and outline from slide 2 to 3", () => {
    const f = fixture();
    const paint = (time: number) =>
      renderToStaticMarkup(createElement(ExplorerGraphic, f.at(time)));
    const shape = (markup: string) => markup.match(/<path data-radius-outline="visual"[^>]+>/g)!;
    const unchanged = (path: string) => path.replace(/ (?:fill|stroke)-opacity="[^"]+"/g, "");
    const before = paint(2);
    const original = shape(before)[0]!;
    expect(original).toContain('fill-opacity="1"');
    expect(original).toContain('stroke-opacity="0"');

    for (const time of [2.02, 2.22, 2.42, 2.62, 2.82, 3.2]) {
      const markup = paint(time);
      expect(markup.match(/viewBox="[^"]+"/)![0]).toBe(before.match(/viewBox="[^"]+"/)![0]);
      expect(shape(markup)).toHaveLength(1);
      expect(unchanged(shape(markup)[0]!)).toBe(unchanged(original));
      expect(Number(f.at(time).arcSuperellipse.showFill)).toBeCloseTo(
        1 - 0.8 * f.tracks.radiusComparison,
      );
    }
    expect(Number(f.at("radius").arcSuperellipse.showFill)).toBeCloseTo(0.2);
    expect(shape(paint(3.2))[0]).toContain('stroke-opacity="1"');
  });

  it("starts with only magenta, then draws the blue arc with the sweep before dissolving labels", () => {
    const f = fixture();
    const paint = (position: string | number) =>
      renderToStaticMarkup(createElement(ExplorerGraphic, f.at(position)));
    const vertical = paint("radius");
    expect(f.tracks.radiusSweep).toBe(0);
    expect(f.at("radius").arcRounded.visible).toBe(0);
    expect(vertical).toContain('data-radius-outline="visual"');
    expect(vertical).not.toContain('data-radius-outline="css"');
    expect(vertical).toContain('data-radius-marker="visual"');
    expect(vertical).not.toContain('data-radius-marker="css"');
    expect(vertical).not.toContain("data-radius-label=");
    expect(paint(RADIUS_SWEEP.start)).not.toContain('data-radius-marker="css"');

    const moving = paint(RADIUS_SWEEP.start + 0.5);
    expect(f.tracks.radiusSweep).toBeCloseTo(0.5);
    expect(moving).toContain('data-radius-marker="css"');
    expect(moving).toContain('data-radius-outline="css"');
    expect(moving).toContain(">1.07</text>");
    expect(moving).not.toContain("data-radius-label=");

    paint(RADIUS_SWEEP.start + 1.2);
    expect(f.tracks.radiusSweep).toBe(1);
    expect(f.tracks.radiusLabels).toBeGreaterThan(0);
    expect(f.tracks.radiusLabels).toBeLessThan(1);
    const diagonal = paint("visual-radius");
    expect(diagonal).toContain(">1.19</text>");
    expect(f.tracks.radiusLabels).toBe(1);
    expect(diagonal).toContain('data-radius-label="css"');
    expect(diagonal).toContain('data-radius-label="visual"');
    expect(paint("correction")).not.toContain("data-radius-comparison=");
    // Reverse seeking must restore the initial unpainted blue marker and labels.
    expect(paint("radius")).not.toContain('data-radius-marker="css"');
    expect(f.tracks.radiusLabels).toBe(0);
  });

  it("combines the original strength copy and controls with slide four's comparison", () => {
    expect(CHECKPOINTS).toHaveLength(8);
    expect(CHECKPOINTS[3]).toBe(STRENGTH);
    expect(CHECKPOINTS.map((cue) => cue.id)).not.toContain("strength");
    const html = renderToStaticMarkup(
      createElement(TourNarrative, {
        active: 3,
        amount: 2.7,
        strengthActive: true,
        onAmountChange: () => {},
      }),
    );
    expect(html).toContain('data-tour-panel="visual-radius"');
    expect(html).toContain("Higher strength makes a squarer corner. Try it.");
    expect(html).toContain('id="tour-strength"');
    expect(html).not.toContain('data-tour-panel="strength"');
    const f = fixture();
    f.controls.start(true);
    f.controls.checkpoint(3);
    f.controls.next();
    expect(f.timeline.time()).toBe(APPARENT_RADIUS.time);
    f.controls.next();
    expect(f.timeline.time()).toBe(CORRECTION.time);
    f.controls.back();
    expect(f.timeline.time()).toBe(APPARENT_RADIUS.time);
    f.controls.back();
    expect(f.timeline.time()).toBe(STRENGTH.time);
  });

  it("transitions to a smaller matching circle without changing the chosen magenta shape", () => {
    const f = fixture();
    const paint = (time: number | string, amount: number) =>
      renderToStaticMarkup(createElement(ExplorerGraphic, f.at(time, amount)));
    const tag = (html: string, attribute: string) =>
      html.match(new RegExp(`<[^>]+ ${attribute}[^>]*>`))![0];
    const coordinate = (element: string, name: string) =>
      Number(element.match(new RegExp(` ${name}="([^"]+)"`))![1]);

    for (const [amount, readout] of [
      [1, "1.00"],
      [2, "0.54"],
      [3, "0.28"],
    ] as const) {
      const before = paint(STRENGTH.id, amount);
      const shape = tag(before, 'data-radius-outline="visual"');
      expect(before).not.toContain("data-apparent-construction");
      for (const offset of [0, 0.25, 0.5, 0.75, 1]) {
        const html = paint(APPARENT_RADIUS.start + offset, amount);
        expect(tag(html, 'data-radius-outline="visual"')).toBe(shape);
        expect(f.at(APPARENT_RADIUS.start + offset, amount).amount).toBe(amount);
        expect(f.tracks.correction).toBe(0);
      }
      const after = paint(APPARENT_RADIUS.id, amount);
      const center = tag(after, 'data-radius-center="apparent"');
      const end = tag(after, 'data-radius-point="css"');
      const top = tag(after, 'data-radius-point="apparent-top"');
      const cx = coordinate(center, "cx"),
        cy = coordinate(center, "cy");
      const x = coordinate(end, "cx"),
        y = coordinate(end, "cy");
      const radius = cy - coordinate(top, "cy");
      expect(Math.hypot(x - cx, y - cy)).toBeCloseTo(radius);
      expect(coordinate(top, "cx")).toBe(cx);
      expect(190 - cx).toBeCloseTo(radius);
      expect(x - cx).toBeCloseTo(cy - y); // 45 degrees from the blue center.
      const cssRadius = 135;
      const n = 2 ** amount;
      expect(((x - 55) / cssRadius) ** n + ((145 - y) / cssRadius) ** n).toBeCloseTo(1);
      expect(after).toMatch(new RegExp(`data-radius-number="blue"[^>]*>${readout}</text>`));
      expect(after).toMatch(/data-radius-number="magenta"[^>]*>1.00<\/text>/);
      expect(after).toContain("CSS Radius");
      expect(after).toContain(">Apparent</tspan>");
      expect(paint(STRENGTH.id, amount)).toBe(before);
    }
  });

  it("ignores rapid Next, stops precisely, and permits interruption with Back", () => {
    const f = fixture();
    f.controls.start(false);
    f.controls.next();
    f.controls.next();
    expect(f.state()).toEqual({ destination: 0, moving: true });
    finishDriver(f.timeline);
    expect(f.timeline.time()).toBe(CHECKPOINTS[0].time);
    f.controls.next();
    f.controls.next();
    f.controls.next();
    expect(f.state()).toEqual({ destination: 1, moving: true });
    finishDriver(f.timeline, 0.5);
    f.controls.back();
    expect(f.timeline.time()).toBe(CHECKPOINTS[0].time);
    expect(f.state()).toEqual({ destination: 0, moving: false });
    expect(gsap.getTweensOf(f.timeline)).toHaveLength(0);
    f.controls.next();
    finishDriver(f.timeline);
    expect(f.timeline.time()).toBe(CHECKPOINTS[1].time);
    expect(f.timeline.paused()).toBe(true);
  });

  it("settles immediately when reduced motion changes during playback", () => {
    const f = fixture();
    f.controls.start(true);
    expect(f.timeline.time()).toBe(CHECKPOINTS[0].time);
    f.controls.setReducedMotion(false);
    f.controls.next();
    finishDriver(f.timeline, 0.4);
    f.controls.setReducedMotion(true);
    expect(f.timeline.time()).toBe(CHECKPOINTS[1].time);
    expect(f.state().moving).toBe(false);
    expect(gsap.getTweensOf(f.timeline)).toHaveLength(0);
    f.controls.next();
    expect(f.timeline.time()).toBe(CHECKPOINTS[2].time);
  });

  it("scrubs without focus theft and settles the current stop before advancing", () => {
    const f = fixture();
    f.controls.start(true);
    const focused = f.focusCount();
    f.controls.seek(STRENGTH.start + 0.1);
    expect(f.focusCount()).toBe(focused);
    f.controls.next();
    expect(f.timeline.time()).toBe(STRENGTH.time);
    expect(f.state().destination).toBe(CHECKPOINTS.indexOf(STRENGTH));
    f.controls.next();
    expect(f.timeline.time()).toBe(APPARENT_RADIUS.time);
    f.controls.next();
    expect(f.timeline.time()).toBe(CORRECTION.time);
    f.controls.seek(100);
    expect(f.timeline.time()).toBe(DURATION);
    expect(f.controls.next()).toBe(true); // Explore handoff only after final stop.
    f.controls.seek(-1);
    expect(f.timeline.time()).toBe(0);
  });

  it("pauses/resumes to the same stop and cancels all playback on disposal", () => {
    const f = fixture();
    f.controls.start(false);
    finishDriver(f.timeline, 0.5);
    f.controls.pause();
    expect(f.timeline.time()).toBeCloseTo(0.4);
    f.controls.resume();
    finishDriver(f.timeline);
    expect(f.timeline.time()).toBe(CHECKPOINTS[0].time);
    f.controls.next();
    f.controls.dispose();
    expect(gsap.getTweensOf(f.timeline)).toHaveLength(0);
    expect(f.timeline.paused()).toBe(true);
  });

  it("keeps geometry finite and continuous across time and the supported strength range", () => {
    const f = fixture();
    for (const amount of [1, 2, 3]) {
      let previous = f.at(0, amount);
      for (let t = 0; t <= DURATION; t += 0.01) {
        const state = f.at(t, amount);
        const radius = 180 * state.zoom;
        const n = 2 ** state.amount;
        const corrected = correctedRadius(radius, n);
        expect(Number.isFinite(corrected)).toBe(true);
        expect(Number.isFinite(perceivedRadius(radius, corrected, n))).toBe(true);
        expect(Math.abs(state.amount - previous.amount)).toBeLessThan(0.1);
        expect(Math.abs(state.correctionAmount - previous.correctionAmount)).toBeLessThan(0.04);
        for (const opacity of [state.arcRounded.visible, state.showMeasurement]) {
          expect(Number(opacity)).toBeGreaterThanOrEqual(0);
          expect(Number(opacity)).toBeLessThanOrEqual(1);
        }
        previous = state;
      }
    }
  });
});
