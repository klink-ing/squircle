import { afterEach, describe, expect, it } from "vitest";
import gsap from "gsap";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExplorerGraphic from "../ExplorerGraphic";
import TourNarrative from "./TourNarrative";
import { graphicFromTracks } from "./graphic-state";
import { checkpointAtTime, createTourTimeline } from "./timeline";
import { DEFAULT_STRENGTH } from "./state";
import { SLIDES, type TourSlide } from "./slides";
import { createPlayback, type PlaybackState } from "./playback";
import { correctedRadius, perceivedRadius } from "../../math";

const authored = createTourTimeline(() => {});
const CHECKPOINTS = authored.checkpoints;
const DURATION = authored.timeline.duration();
const RADIUS_SWEEP = CHECKPOINTS.find((cue) => cue.id === "visual-radius")!;
const STRENGTH = RADIUS_SWEEP;
const APPARENT_RADIUS = CHECKPOINTS.find((cue) => cue.id === "apparent-radius")!;
const CORRECTION = CHECKPOINTS.find((cue) => cue.id === "correction")!;
authored.timeline.kill();

afterEach(() => {
  gsap.globalTimeline.clear();
});

function fixture() {
  const tour = createTourTimeline(() => {});
  let state: PlaybackState = { destination: 0, moving: false };
  let focusCount = 0;
  const controls = createPlayback(
    tour,
    () => {},
    (value) => {
      state = value;
    },
    () => focusCount++,
  );
  const at = (position: number | string, amount = DEFAULT_STRENGTH) => {
    tour.timeline.seek(position);
    return graphicFromTracks(tour.tracks, amount);
  };
  return { ...tour, controls, at, state: () => state, focusCount: () => focusCount };
}

function finishDriver(timeline: gsap.core.Timeline, progress = 1) {
  const driver = gsap.getTweensOf(timeline).at(-1);
  expect(driver).toBeDefined();
  driver!.progress(progress);
}

describe("tour behavior on the real GSAP timeline", () => {
  it("nests each slide's text and graphic animation on a local timeline starting at zero", () => {
    const f = fixture();
    expect(f.timeline.getChildren(false, false, true)).toEqual(f.transitions);
    f.transitions.forEach((transition, index) => {
      const cue = f.checkpoints[index]!;
      expect(transition.parent).toBe(f.timeline);
      expect(transition.startTime()).toBe(cue.start);
      expect(transition.getChildren()[0]!.startTime()).toBe(0);
      expect(transition.duration()).toBeCloseTo(cue.time - cue.start);
      expect(f.timeline.labels[cue.id]).toBe(cue.time);
      expect(checkpointAtTime(cue.time, f.checkpoints)).toBe(index);
      expect(checkpointAtTime(cue.start, f.checkpoints)).toBe(index);
    });
    expect(f.transitions[3]!.labels.labels).toBe(1);
  });

  it.each(["text", "geometry"] as const)(
    "automatically moves navigation stops when a slide's %s animation is extended",
    (target) => {
      const original = SLIDES[1]!;
      const edited: TourSlide = {
        ...original,
        transition(timeline, targets) {
          original.transition(timeline, targets);
          if (target === "text") timeline.to(targets.text, { opacity: 1, duration: 2 }, 0);
          else timeline.to(targets.tracks, { baseAmount: DEFAULT_STRENGTH, duration: 2 }, 0);
        },
      };
      const tour = createTourTimeline(() => {}, [], [SLIDES[0]!, edited, ...SLIDES.slice(2)]);
      expect(tour.checkpoints[0]).toEqual(CHECKPOINTS[0]);
      expect(tour.checkpoints[1]!.time).toBeCloseTo(CHECKPOINTS[1]!.time + 1);
      tour.checkpoints.slice(2).forEach((cue, offset) => {
        const index = offset + 2;
        expect(cue.start).toBeCloseTo(CHECKPOINTS[index]!.start + 1);
        expect(cue.time).toBeCloseTo(CHECKPOINTS[index]!.time + 1);
        // Later slides' local choreography is unchanged by an earlier edit.
        expect(tour.transitions[index]!.duration()).toBe(authored.transitions[index]!.duration());
        expect(tour.transitions[index]!.labels).toEqual(authored.transitions[index]!.labels);
      });
      const controls = createPlayback(
        tour,
        () => {},
        () => {},
        () => {},
      );
      controls.start(true);
      controls.next();
      expect(tour.timeline.time()).toBe(tour.checkpoints[1]!.time);
      controls.next();
      expect(tour.timeline.time()).toBe(tour.checkpoints[2]!.time);
      controls.back();
      expect(tour.timeline.time()).toBe(tour.checkpoints[1]!.time);
      controls.seek(100);
      expect(tour.timeline.time()).toBeCloseTo(DURATION + 1);
      expect(controls.next()).toBe(true);
    },
  );

  it("removes nested timelines and an interrupted playhead driver when the GSAP context reverts", () => {
    let dispose: (() => void) | undefined;
    const context = gsap.context(() => {
      const tour = createTourTimeline(() => {});
      const controls = createPlayback(
        tour,
        () => {},
        () => {},
        () => {},
      );
      controls.start(false);
      finishDriver(tour.timeline, 0.5);
      dispose = controls.dispose;
    });
    dispose!();
    context.revert();
    expect(gsap.globalTimeline.getChildren()).toHaveLength(0);
  });

  it("seeks to all eight reading stops deterministically, in any order", () => {
    const f = fixture();
    const expected = CHECKPOINTS.map((cue) => f.at(cue.id, 2.7));
    [...CHECKPOINTS].reverse().forEach((cue) => f.at(cue.id, 2.7));
    expect(CHECKPOINTS.map((cue) => f.at(cue.id, 2.7))).toEqual(expected);
    CHECKPOINTS.forEach((cue) => expect(f.timeline.labels[cue.id]).toBe(cue.time));
    expect(f.at("rounded").amount).toBe(1);
    expect(f.at("rounded").zoom).toBe(0.5); // A 1.00 radius spans half the fixed box.
    expect(f.at("utilities").correctionAmount).toBe(1);
  });

  it("restores transition boundaries and intermediate frames after reverse seeking", () => {
    const f = fixture();
    const times = CHECKPOINTS.flatMap((cue) => [cue.start, cue.start + cue.duration / 2, cue.time]);
    const expected = times.map((time) => f.at(time, 2.7));
    [...times].reverse().forEach((time, index) => {
      expect(f.at(time, 2.7)).toEqual(expected[times.length - 1 - index]);
    });
  });

  it("keeps the chosen strength at its stop, interpolates correction, and restores it on Back", () => {
    for (const amount of [1, 1.5, DEFAULT_STRENGTH, 2.7, 3]) {
      const f = fixture();
      expect(f.at("radius", amount).amount).toBe(DEFAULT_STRENGTH);
      expect(f.at(STRENGTH.id, amount).amount).toBe(amount);
      expect(f.at(STRENGTH.id, amount).radiusComparison).toBe(1);
      expect(f.at(CORRECTION.start, amount).amount).toBe(amount);
      expect(f.at(CORRECTION.start + 0.5, amount).amount).toBe(amount);
      expect(f.at("correction", amount).amount).toBe(amount);
      const alignment = CHECKPOINTS.find((cue) => cue.id === "alignment")!;
      expect(f.at(alignment.start + 0.4, amount).amount).toBeCloseTo(
        (amount + DEFAULT_STRENGTH) / 2,
      );
      expect(f.at("alignment", amount).amount).toBe(DEFAULT_STRENGTH);
      f.controls.checkpoint(CHECKPOINTS.indexOf(CORRECTION));
      f.controls.back();
      expect(graphicFromTracks(f.tracks, amount).amount).toBe(amount);
      // Reset is a live input, independent of the timeline's authored values.
      expect(graphicFromTracks(f.tracks, DEFAULT_STRENGTH).amount).toBe(DEFAULT_STRENGTH);
    }
  });

  it("preserves the shape and viewport while fading its fill and outline from slide 2 to 3", () => {
    const f = fixture();
    const paint = (time: number) =>
      renderToStaticMarkup(createElement(ExplorerGraphic, f.at(time)));
    const shape = (markup: string) => markup.match(/<path data-radius-outline="visual"[^>]+>/g)!;
    const unchanged = (path: string) => path.replace(/ (?:fill|stroke)-opacity="[^"]+"/g, "");
    const before = paint(CHECKPOINTS[1]!.time);
    const original = shape(before)[0]!;
    expect(original).toContain('fill-opacity="1"');
    expect(original).toContain('stroke-opacity="0"');

    for (const time of [0, 0.2, 0.4, 0.6, 0.8].map((offset) => CHECKPOINTS[2]!.start + offset)) {
      const markup = paint(time);
      expect(markup.match(/viewBox="[^"]+"/)![0]).toBe(before.match(/viewBox="[^"]+"/)![0]);
      expect(shape(markup)).toHaveLength(1);
      expect(unchanged(shape(markup)[0]!)).toBe(unchanged(original));
      expect(Number(f.at(time).arcSuperellipse.showFill)).toBeCloseTo(
        1 - 0.8 * f.tracks.radiusComparison,
      );
    }
    expect(Number(f.at("radius").arcSuperellipse.showFill)).toBeCloseTo(0.2);
    expect(shape(paint(CHECKPOINTS[2]!.time))[0]).toContain('stroke-opacity="1"');
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
    expect(vertical).toContain('data-radius-marker="specified"');
    expect(vertical).not.toContain('data-radius-marker="visual"');
    expect(vertical).not.toContain('data-radius-marker="css"');
    expect(vertical).toContain('data-radius-label="specified"');
    expect(vertical).toContain("CSS Radius");
    expect(paint(RADIUS_SWEEP.start)).not.toContain('data-radius-marker="css"');

    const moving = paint(RADIUS_SWEEP.start + 0.5);
    expect(f.tracks.radiusSweep).toBeCloseTo(0.5);
    expect(moving).toContain('data-radius-marker="css"');
    expect(moving).toContain('data-radius-outline="css"');
    expect(moving).toMatch(/data-radius-number="magenta"[^>]*>\d+\.\d{2}<\/text>/);
    expect(moving).not.toContain('data-radius-label="css"');
    expect(moving).not.toContain('data-radius-label="visual"');

    paint(RADIUS_SWEEP.start + 1.2);
    expect(f.tracks.radiusSweep).toBe(1);
    expect(f.tracks.radiusLabels).toBeGreaterThan(0);
    expect(f.tracks.radiusLabels).toBeLessThan(1);
    const diagonal = paint("visual-radius");
    expect(diagonal).toMatch(
      new RegExp(
        `data-radius-number="magenta"[^>]*>${perceivedRadius(1, 1, 2 ** DEFAULT_STRENGTH).toFixed(2)}</text>`,
      ),
    );
    expect(f.tracks.radiusLabels).toBe(1);
    expect(diagonal).toContain('data-radius-label="css"');
    expect(diagonal).toContain('data-radius-label="visual"');
    expect(diagonal).toContain(">???</text>");
    expect(paint("correction")).toContain("data-radius-comparison=");
    expect(paint("alignment")).not.toContain("data-radius-comparison=");
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
      const fixedMarker = tag(before, 'data-radius-point="specified"');
      const fixedNumber = tag(before, 'data-radius-number="specified"');
      const fixedLabel = tag(before, 'data-radius-label="specified"');
      const movingNumber = tag(before, 'data-radius-number="magenta"');
      expect(before).not.toContain("data-apparent-construction");
      for (const offset of [0, 0.25, 0.5, 0.75, 1]) {
        const html = paint(APPARENT_RADIUS.start + offset, amount);
        expect(tag(html, 'data-radius-outline="visual"')).toBe(shape);
        const withoutPaint = (marker: string) =>
          marker.replace(/ fill="[^"]+"| data-radius-shared=""/g, "");
        expect(withoutPaint(tag(html, 'data-radius-point="specified"'))).toBe(
          withoutPaint(fixedMarker),
        );
        expect(tag(html, 'data-radius-number="specified"')).toBe(fixedNumber);
        expect(tag(html, 'data-radius-label="specified"')).toBe(fixedLabel);
        expect(tag(html, 'data-radius-number="magenta"').replace(/ opacity="[^"]+"/, "")).toBe(
          movingNumber.replace(/ opacity="[^"]+"/, ""),
        );
        expect(f.at(APPARENT_RADIUS.start + offset, amount).amount).toBe(amount);
        expect(f.tracks.correction).toBe(0);
      }
      const after = paint(APPARENT_RADIUS.id, amount);
      const center = tag(after, 'data-radius-center="apparent"');
      const end = tag(after, 'data-radius-point="css"');
      const top = tag(after, 'data-radius-point="apparent-top"');
      expect(end).toContain('data-radius-shared=""');
      expect(tag(after, 'data-radius-point="visual"')).toContain('data-radius-shared=""');
      if (amount === 1) {
        expect(top).toContain('data-radius-shared=""');
        expect(center).toContain('data-radius-shared=""');
        expect(tag(before, 'data-radius-point="css"')).toContain('data-radius-shared=""');
      } else {
        expect(top).not.toContain("data-radius-shared");
        expect(center).not.toContain("data-radius-shared");
        expect(tag(before, 'data-radius-point="css"')).not.toContain("data-radius-shared");
      }
      expect(after).toContain(
        '<stop offset="50%" stop-color="var(--color-rounded-border)"></stop><stop offset="50%" stop-color="var(--color-squircle-border)"></stop>',
      );
      const cx = coordinate(center, "cx"),
        cy = coordinate(center, "cy");
      const x = coordinate(end, "cx"),
        y = coordinate(end, "cy");
      const radius = cy - coordinate(top, "cy");
      expect(Math.hypot(x - cx, y - cy)).toBeCloseTo(radius);
      expect(coordinate(top, "cx")).toBe(cx);
      expect(190 - cx).toBeCloseTo(radius);
      expect(x - cx).toBeCloseTo(cy - y); // 45 degrees from the blue center.
      const cssRadius = 90;
      const n = 2 ** amount;
      expect(((x - 100) / cssRadius) ** n + ((100 - y) / cssRadius) ** n).toBeCloseTo(1);
      expect(after).toMatch(new RegExp(`data-radius-number="blue"[^>]*>${readout}</text>`));
      expect(after).toMatch(/data-radius-number="specified"[^>]*>1.00<\/text>/);
      expect(tag(after, 'data-radius-number="magenta"')).toContain('opacity="0"');
      expect(tag(after, 'data-radius-label="visual"')).toContain('opacity="0"');
      expect(after).toContain("CSS Radius");
      expect(after).toContain(">Apparent</tspan>");
      expect(paint(STRENGTH.id, amount)).toBe(before);
    }
  });

  it("grows the apparent radius to one while the CSS radius can leave the fixed box", () => {
    const f = fixture();
    const paint = (position: string | number) =>
      renderToStaticMarkup(createElement(ExplorerGraphic, f.at(position)));
    const tag = (html: string, attribute: string) =>
      html.match(new RegExp(`<[^>]+ ${attribute}[^>]*>`))![0];
    const coordinate = (element: string, name: string) =>
      Number(element.match(new RegExp(` ${name}="([^"]+)"`))![1]);
    const before = paint(APPARENT_RADIUS.id);
    const viewBox = before.match(/viewBox="[^"]+"/)![0];
    const box = before.match(/<rect [^>]+>/)![0];
    let lastRadius = 0;
    for (let offset = 0; offset <= 1; offset += 0.1) {
      const html = paint(CORRECTION.start + offset);
      const center = tag(html, 'data-radius-center="apparent"');
      const top = tag(html, 'data-radius-point="apparent-top"');
      const apparent = coordinate(center, "cy") - coordinate(top, "cy");
      expect(apparent).toBeGreaterThanOrEqual(lastRadius);
      expect(html.match(/viewBox="[^"]+"/)![0]).toBe(viewBox);
      expect(html.match(/<rect [^>]+>/)![0]).toBe(box);
      expect(f.tracks.radiusComparison).toBe(1);
      lastRadius = apparent;
    }
    const after = paint(CORRECTION.id);
    const cssTop = tag(after, 'data-radius-point="specified"');
    const center = tag(after, 'data-radius-center="apparent"');
    const top = tag(after, 'data-radius-point="apparent-top"');
    const end = tag(after, 'data-radius-point="css"');
    const cx = coordinate(center, "cx"),
      cy = coordinate(center, "cy");
    expect(coordinate(cssTop, "cx")).toBeLessThanOrEqual(coordinate(top, "cx"));
    const larger = renderToStaticMarkup(createElement(ExplorerGraphic, f.at(CORRECTION.id, 3)));
    expect(coordinate(tag(larger, 'data-radius-point="specified"'), "cx")).toBeLessThan(10);
    expect(coordinate(top, "cx")).toBeCloseTo(100);
    expect(cy - coordinate(top, "cy")).toBeCloseTo(90);
    expect(Math.hypot(coordinate(end, "cx") - cx, coordinate(end, "cy") - cy)).toBeCloseTo(90);
    expect(after).toMatch(/data-radius-number="blue"[^>]*>1.00<\/text>/);
    expect(after).toMatch(
      new RegExp(
        `data-radius-number="specified"[^>]*>${correctedRadius(1, 2 ** DEFAULT_STRENGTH).toFixed(2)}</text>`,
      ),
    );
    f.controls.checkpoint(CHECKPOINTS.indexOf(CORRECTION));
    f.controls.back();
    expect(renderToStaticMarkup(createElement(ExplorerGraphic, graphicFromTracks(f.tracks)))).toBe(
      before,
    );
  });

  it("lets enlarged strokes leave the box without reversing into hooks at its corners", () => {
    const f = fixture();
    for (const amount of [1, 2, 2.7, 3]) {
      for (const offset of [0, 0.25, 0.5, 0.75, 1]) {
        const html = renderToStaticMarkup(
          createElement(ExplorerGraphic, f.at(CORRECTION.start + offset, amount)),
        );
        const path = html.match(/<path data-radius-outline="visual"[^>]+>/)![0];
        const d = path.match(/ d="([^"]+)"/)![1]!;
        const numbers = d.match(/-?(?:\d*\.)?\d+(?:e[+-]?\d+)?/gi)!.map(Number);
        const points = Array.from({ length: numbers.length / 2 }, (_, index) => ({
          x: numbers[index * 2]!,
          y: numbers[index * 2 + 1]!,
        }));
        const stroke = points.slice(0, -1); // The final point closes only the fill.
        for (let index = 1; index < stroke.length; index++) {
          expect(stroke[index]!.x).toBeLessThanOrEqual(stroke[index - 1]!.x + 1e-8);
          expect(stroke[index]!.y).toBeLessThanOrEqual(stroke[index - 1]!.y + 1e-8);
        }
        const last = stroke.at(-1)!,
          corner = points.at(-1)!,
          first = stroke[0]!;
        const closingLength =
          Math.hypot(corner.x - last.x, corner.y - last.y) +
          Math.hypot(first.x - corner.x, first.y - corner.y);
        const gap = Number(path.match(/ stroke-dasharray="[^ ]+ ([^"]+)"/)![1]);
        expect(gap).toBeGreaterThan(closingLength);
      }
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
    expect(f.timeline.time()).toBeCloseTo(CHECKPOINTS[0]!.time / 2);
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
        // Allow the full 1→3 span across the shortest strength tween (10 ms steps).
        expect(Math.abs(state.amount - previous.amount)).toBeLessThan(0.15);
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
