import type { GraphicState } from "../ExplorerGraphic";
import { CORRECTION, type GraphicTracks } from "./timeline";

// Pure bridge: no previous rendered geometry and no DOM mutation.
export function graphicFromTracks(
  tracks: GraphicTracks,
  time: number,
  chosenAmount = 2,
): GraphicState {
  return {
    arcRounded: {
      visible: tracks.roundedOpacity,
      showFill: 1 - 0.8 * tracks.radiusComparison,
      showOutline: 0,
    },
    arcSuperellipse: { visible: 1, showFill: 1 - 0.8 * tracks.radiusComparison, showOutline: 0 },
    amount: tracks.baseAmount + (chosenAmount - 2) * tracks.choiceWeight,
    correctionAmount: tracks.correction,
    showRefLine: 0,
    showMeasurement: tracks.roundedOpacity - tracks.radiusComparison,
    radiusComparison: tracks.radiusComparison,
    radiusSweep: tracks.radiusSweep,
    radiusLabels: tracks.radiusLabels,
    measureArc: time >= CORRECTION.start ? "corrected" : "rounded",
    measureMode: "radius",
    measureAngle: "diagonal",
    zoom: 0.75,
  };
}
