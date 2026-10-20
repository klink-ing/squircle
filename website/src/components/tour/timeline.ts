import gsap from "gsap";

// Seconds on one native timeline. Each label is a settled reading stop.
export const CHECKPOINTS = [
  { id: "rounded", start: 0, time: 0.8, nextLabel: "Apply it" },
  { id: "superellipse", start: 0.82, time: 2, nextLabel: "What gives?" },
  { id: "radius", start: 2.02, time: 3.2, nextLabel: "Let me try" },
  { id: "strength", start: 3.22, time: 4.2, nextLabel: "Show the correction" },
  { id: "correction", start: 4.22, time: 5.4, nextLabel: "Next" },
  { id: "alignment", start: 5.42, time: 6.4, nextLabel: "How do I use it?" },
  { id: "utilities", start: 6.42, time: 7.4, nextLabel: "Explore" },
] as const;

export const DURATION = CHECKPOINTS[6].time;
export const STRENGTH = CHECKPOINTS[3];
export const CORRECTION = CHECKPOINTS[4];

export function checkpointAtTime(time: number) {
  return Math.max(
    0,
    CHECKPOINTS.findLastIndex((cue) => time >= cue.start),
  );
}

export function initialTracks() {
  return { baseAmount: 1, choiceWeight: 0, correction: 0, roundedOpacity: 0 };
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
  timeline.to(tracks, { baseAmount: 2, duration: 1, ease: "power2.inOut" }, "superellipse:enter");
  timeline.to(tracks, { roundedOpacity: 1, duration: 0.8, ease: "power2.inOut" }, "radius:enter");
  timeline.to(tracks, { choiceWeight: 1, duration: 0.5, ease: "power2.inOut" }, "strength:enter");
  timeline.to(
    tracks,
    {
      choiceWeight: 0,
      correction: 1,
      duration: 1,
      ease: "power2.inOut",
    },
    "correction:enter",
  );
  return { timeline, tracks };
}
