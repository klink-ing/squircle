import gsap from "gsap";

export const DEFAULT_STRENGTH = 2;

// Seconds on one native timeline. Each label is a settled reading stop.
export const CHECKPOINTS = [
  { id: "rounded", start: 0, time: 0.8, nextLabel: "Apply it" },
  { id: "superellipse", start: 0.82, time: 2, nextLabel: "What gives?" },
  { id: "radius", start: 2.02, time: 3.2, nextLabel: "Next" },
  { id: "visual-radius", start: 3.22, time: 4.9, nextLabel: "Next" },
  { id: "apparent-radius", start: 4.92, time: 6.1, nextLabel: "Show the correction" },
  { id: "correction", start: 6.12, time: 7.3, nextLabel: "Next" },
  { id: "alignment", start: 7.32, time: 8.3, nextLabel: "How do I use it?" },
  { id: "utilities", start: 8.32, time: 9.3, nextLabel: "Explore" },
] as const;

export const DURATION = CHECKPOINTS.at(-1)!.time;
export const RADIUS_SWEEP = CHECKPOINTS.find((cue) => cue.id === "visual-radius")!;
// The strength interaction shares the comparison's reading stop.
export const STRENGTH = RADIUS_SWEEP;
export const APPARENT_RADIUS = CHECKPOINTS.find((cue) => cue.id === "apparent-radius")!;
export const CORRECTION = CHECKPOINTS.find((cue) => cue.id === "correction")!;

export function checkpointAtTime(time: number) {
  return Math.max(
    0,
    CHECKPOINTS.findLastIndex((cue) => time >= cue.start),
  );
}

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

// GSAP exclusively owns the proxy and narrative opacity/transform. React owns SVG attributes.
export function createTourTimeline(onUpdate: () => void, panels: HTMLElement[] = []) {
  const tracks = initialTracks();
  const timeline = gsap.timeline({ paused: true, onUpdate });
  timeline.to({}, { duration: DURATION }, 0); // Include the final reading hold.
  CHECKPOINTS.forEach((cue, index) => {
    timeline.addLabel(cue.id, cue.time);
    timeline.addLabel(`${cue.id}:enter`, cue.start);
    if (panels[index]) {
      timeline.fromTo(
        panels[index]!,
        { opacity: 0, x: 16 },
        {
          opacity: 1,
          x: 0,
          duration: 0.4,
          ease: "power2.out",
          immediateRender: false,
        },
        `${cue.id}:enter`,
      );
    }
  });
  timeline.to(
    tracks,
    { baseAmount: DEFAULT_STRENGTH, duration: 1, ease: "power2.inOut" },
    "superellipse:enter",
  );
  timeline.to(tracks, { roundedOpacity: 1, duration: 0.8, ease: "power2.inOut" }, "radius:enter");
  timeline.to(tracks, { radiusComparison: 1, duration: 0.8, ease: "power2.inOut" }, "radius:enter");
  timeline.to(tracks, { radiusSweep: 1, duration: 1, ease: "power2.inOut" }, "visual-radius:enter");
  timeline.to(tracks, { radiusLabels: 1, duration: 0.45, ease: "none" }, "visual-radius:enter+=1");
  timeline.to(
    tracks,
    { choiceWeight: 1, duration: 0.45, ease: "power2.inOut" },
    "visual-radius:enter+=1",
  );
  timeline.to(
    tracks,
    { apparentRadius: 1, duration: 1, ease: "power2.inOut" },
    "apparent-radius:enter",
  );
  timeline.to(tracks, { radiusComparison: 0, duration: 0.3 }, "alignment:enter");
  timeline.to(
    tracks,
    {
      correction: 1,
      duration: 1,
      ease: "power2.inOut",
    },
    "correction:enter",
  );
  timeline.to(tracks, { choiceWeight: 0, duration: 0.8, ease: "power2.inOut" }, "alignment:enter");
  return { timeline, tracks };
}
