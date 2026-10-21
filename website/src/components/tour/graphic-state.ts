import type { GraphicState } from "../ExplorerGraphic";
import { DEFAULT_STRENGTH, type GraphicTracks } from "./state";

// Pure bridge: no previous rendered geometry and no DOM mutation.
export function graphicFromTracks(
  tracks: GraphicTracks,
  chosenAmount = DEFAULT_STRENGTH,
): GraphicState {
  return {
    arcRounded: {
      visible: tracks.roundedOpacity - tracks.radiusComparison,
      showFill: 1,
      showOutline: 0,
    },
    arcSuperellipse: { visible: 1, showFill: 1 - 0.8 * tracks.radiusComparison, showOutline: 0 },
    amount: tracks.baseAmount + (chosenAmount - DEFAULT_STRENGTH) * tracks.choiceWeight,
    correctionAmount: tracks.correction,
    apparentCorrection: tracks.apparentCorrection,
    showRefLine: 0,
    showMeasurement: tracks.roundedOpacity - tracks.radiusComparison,
    radiusComparison: tracks.radiusComparison,
    radiusSweep: tracks.radiusSweep,
    radiusLabels: tracks.radiusLabels,
    apparentRadius: tracks.apparentRadius,
    measureArc: tracks.correction > 0 ? "corrected" : "rounded",
    measureMode: "radius",
    measureAngle: "diagonal",
    zoom: 0.5,
  };
}
