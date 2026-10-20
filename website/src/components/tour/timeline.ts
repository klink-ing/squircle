export const FPS = 60;

// Each stop is a settled reading frame. The following frame starts the next reveal.
export const CHECKPOINTS = [
  { id: "rounded", start: 0, frame: 48, nextLabel: "Apply it" },
  { id: "superellipse", start: 49, frame: 120, nextLabel: "What gives?" },
  { id: "radius", start: 121, frame: 192, nextLabel: "Let me try" },
  { id: "strength", start: 193, frame: 252, nextLabel: "Show the correction" },
  { id: "correction", start: 253, frame: 324, nextLabel: "Next" },
  { id: "alignment", start: 325, frame: 384, nextLabel: "How do I use it?" },
  { id: "utilities", start: 385, frame: 444, nextLabel: "Explore" },
] as const;

export const DURATION = CHECKPOINTS[CHECKPOINTS.length - 1]!.frame + 1;
export const STRENGTH = CHECKPOINTS[3];
export const CORRECTION = CHECKPOINTS[4];
export const FORMATS = {
  compact: { width: 400, height: 840, maxWidth: 440 },
  wide: { width: 960, height: 560, maxWidth: 992 },
} as const;
export const WIDE_QUERY = "(min-width: 960px)";

export function checkpointAtFrame(frame: number) {
  return Math.max(
    0,
    CHECKPOINTS.findLastIndex((checkpoint) => frame >= checkpoint.start),
  );
}

export function previousCheckpoint(destination: number) {
  return Math.max(0, destination - 1);
}
