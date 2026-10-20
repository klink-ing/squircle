import { Easing, interpolate } from "remotion";
import type { GraphicState } from "../ExplorerGraphic";
import { CHECKPOINTS, CORRECTION, STRENGTH } from "./timeline";

function progress(frame: number, start: number, end: number) {
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
}

// Authored tracks, evaluated directly. No earlier scene needs to have played.
export function graphicAtFrame(frame: number, chosenAmount = 2): GraphicState {
  const superellipse = CHECKPOINTS[1];
  const radius = CHECKPOINTS[2];
  const strengthWeight =
    progress(frame, STRENGTH.start, STRENGTH.start + 30) *
    (1 - progress(frame, CORRECTION.start, CORRECTION.start + 60));
  const amount =
    1 +
    progress(frame, superellipse.start, superellipse.start + 60) +
    (chosenAmount - 2) * strengthWeight;
  const roundedOpacity = progress(frame, radius.start, radius.start + 48);
  return {
    arcRounded: { visible: roundedOpacity, showFill: 1, showOutline: 0 },
    arcSuperellipse: { visible: 1, showFill: 1, showOutline: 0 },
    correctionAmount: progress(frame, CORRECTION.start, CORRECTION.start + 60),
    amount,
    showRefLine: 0,
    showMeasurement: roundedOpacity,
    // At correction's start both radii coincide. Its endpoints then move with the radius.
    measureArc: frame >= CORRECTION.start ? "corrected" : "rounded",
    measureMode: "radius",
    measureAngle: "diagonal",
    zoom: 0.75,
  };
}
