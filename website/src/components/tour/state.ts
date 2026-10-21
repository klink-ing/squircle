// Change only this value to update the tour default, Reset, and numeric copy (1–3).
export const DEFAULT_STRENGTH = 2;

export function initialTracks() {
  return {
    baseAmount: 1,
    choiceWeight: 0,
    correction: 0,
    roundedOpacity: 0,
    radiusComparison: 0,
    radiusSweep: 0,
    radiusLabels: 0,
    apparentRadius: 0,
  };
}

export type GraphicTracks = ReturnType<typeof initialTracks>;
