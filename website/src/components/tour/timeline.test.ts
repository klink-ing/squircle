import { describe, expect, it } from "vitest";
import { graphicAtFrame } from "./graphic-state";
import { CHECKPOINTS, checkpointAtFrame, CORRECTION, DURATION, STRENGTH } from "./timeline";
import { correctedRadius, perceivedRadius } from "../../math";

describe("continuous tour timeline", () => {
  it("has contiguous scene ranges and an in-bounds settled frame for every scene", () => {
    CHECKPOINTS.forEach((cue, index) => {
      expect(cue.frame).toBeGreaterThan(cue.start + 24);
      expect(cue.frame).toBeLessThan(DURATION);
      expect(checkpointAtFrame(cue.frame)).toBe(index);
      if (index > 0) expect(cue.start).toBe(CHECKPOINTS[index - 1]!.frame + 1);
    });
  });

  it("renders the same scene after direct seeks, reverse traversal, and replay", () => {
    const first = CHECKPOINTS.map((cue) => graphicAtFrame(cue.frame, 2.7));
    [...CHECKPOINTS].reverse().forEach((cue) => graphicAtFrame(cue.frame, 2.7));
    expect(CHECKPOINTS.map((cue) => graphicAtFrame(cue.frame, 2.7))).toEqual(first);
    expect(graphicAtFrame(CHECKPOINTS[0].frame).amount).toBe(1);
    expect(graphicAtFrame(DURATION - 1).correctionAmount).toBe(1);
  });

  it("shows the remembered slider value at rest and smoothly returns to the authored amount", () => {
    for (const amount of [1, 2, 2.7, 3]) {
      expect(graphicAtFrame(STRENGTH.frame, amount).amount).toBeCloseTo(amount);
      expect(graphicAtFrame(STRENGTH.frame + 1, amount).amount).toBeCloseTo(amount);
      expect(graphicAtFrame(CORRECTION.frame, amount).amount).toBe(2);
      expect(graphicAtFrame(CHECKPOINTS[2].frame, amount).amount).toBe(2);
      expect(graphicAtFrame(STRENGTH.frame, amount).amount).toBeCloseTo(amount);
    }
  });

  it("keeps geometry finite and continuous throughout the timeline and supported slider range", () => {
    for (const amount of [1, 2, 3]) {
      let previous = graphicAtFrame(0, amount);
      for (let frame = 0; frame < DURATION; frame++) {
        const state = graphicAtFrame(frame, amount);
        const n = 2 ** state.amount;
        const radius = 180 * state.zoom;
        const corrected = correctedRadius(radius, n);
        expect(Number.isFinite(corrected)).toBe(true);
        expect(Number.isFinite(perceivedRadius(radius, corrected, n))).toBe(true);
        expect(Math.abs(state.amount - previous.amount)).toBeLessThan(0.1);
        expect(Math.abs(state.correctionAmount - previous.correctionAmount)).toBeLessThan(0.06);
        for (const opacity of [
          state.arcRounded.visible,
          state.arcSuperellipse.visible,
          state.showMeasurement,
        ]) {
          expect(Number(opacity)).toBeGreaterThanOrEqual(0);
          expect(Number(opacity)).toBeLessThanOrEqual(1);
        }
        previous = state;
      }
    }
  });
});
