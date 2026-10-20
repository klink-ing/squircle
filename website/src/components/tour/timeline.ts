// Seconds on one shared Motion sequence. Every reading stop follows a completed entrance.
export const CHECKPOINTS = [
  { id: "rounded", start: 0, time: 0.8, nextLabel: "Apply it" },
  { id: "superellipse", start: 0.8, time: 2, nextLabel: "What gives?" },
  { id: "radius", start: 2, time: 3.2, nextLabel: "Let me try" },
  { id: "strength", start: 3.2, time: 4.2, nextLabel: "Show the correction" },
  { id: "correction", start: 4.2, time: 5.4, nextLabel: "Next" },
  { id: "alignment", start: 5.4, time: 6.4, nextLabel: "How do I use it?" },
  { id: "utilities", start: 6.4, time: 7.4, nextLabel: "Explore" },
] as const;
export const DURATION = CHECKPOINTS[CHECKPOINTS.length - 1]!.time;
export const STRENGTH = CHECKPOINTS[3];
// Boundary belongs to the settled scene. Moving just beyond it reveals the next scene.
export function checkpointAtTime(time: number) {
  const index = CHECKPOINTS.findIndex((cue) => time <= cue.time + 0.00001);
  return index < 0 ? CHECKPOINTS.length - 1 : index;
}
export function nextCheckpoint(time: number) {
  const index = CHECKPOINTS.findIndex((cue) => cue.time > time + 0.00001);
  return index < 0 ? CHECKPOINTS.length - 1 : index;
}
export function previousCheckpoint(destination: number) {
  return Math.max(0, destination - 1);
}
