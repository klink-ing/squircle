import type { GraphicState } from "../ExplorerGraphic";

// Motion owns these numeric tracks. React alone owns SVG attributes and geometry.
export function graphicFromTracks(
  baseAmount: number,
  choiceWeight: number,
  comparison: number,
  correction: number,
  chosenAmount: number,
): GraphicState {
  return {
    arcRounded: { visible: comparison, showFill: 1, showOutline: 0 },
    arcSuperellipse: { visible: 1, showFill: 1, showOutline: 0 },
    amount: baseAmount + (chosenAmount - 2) * choiceWeight,
    correctionAmount: correction,
    showRefLine: 0,
    showMeasurement: comparison,
    // Both radii coincide before correction, so this also seeks continuously.
    measureArc: "corrected",
    measureMode: "radius",
    measureAngle: "diagonal",
    zoom: 0.75,
  };
}
