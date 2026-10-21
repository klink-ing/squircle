import gsap from "gsap";
import { SLIDES, type TourSlide } from "./slides";
import { initialTracks } from "./state";

export interface Checkpoint {
  id: string;
  start: number;
  duration: number;
  textStart: number;
  time: number;
}

export function checkpointAtTime(time: number, checkpoints: readonly Checkpoint[]) {
  return Math.max(
    0,
    checkpoints.findLastIndex((cue) => time >= cue.start),
  );
}

export function narrativeAtTime(time: number, checkpoints: readonly Checkpoint[]) {
  return Math.max(
    0,
    checkpoints.findLastIndex((cue) => time >= cue.textStart),
  );
}

// A small boundary gap keeps a settled reading stop on its own slide when seeking.
const SLIDE_GAP = 0.02;

// GSAP owns proxy/DOM animation; React owns SVG attributes and narrative layout.
// No absolute times are authored here: child durations determine all reading stops.
export function createTourTimeline(
  onUpdate: () => void,
  panels: HTMLElement[] = [],
  slides: readonly TourSlide[] = SLIDES,
) {
  const tracks = initialTracks();
  const timeline = gsap.timeline({ paused: true, onUpdate });
  const checkpoints: Checkpoint[] = [];
  // Controllers never participate in the text entrance or exit.
  const texts = slides.map((_, index) =>
    panels[index]
      ? Array.from(panels[index]!.querySelectorAll("h2, .tour-copy p"))
      : { opacity: 0, x: 12 },
  );
  const transitions = slides.map((slide, index) => {
    const transition = gsap.timeline();
    // The proxy gives headless timelines the same text duration as mounted timelines.
    slide.transition(transition, {
      tracks,
      text: texts[index]!,
      previousText: texts[index - 1] ?? [],
    });
    transition.to({}, { duration: slide.hold });
    const start = index === 0 ? 0 : Number((timeline.duration() + SLIDE_GAP).toFixed(7));
    timeline.add(transition, start);
    const time = timeline.duration();
    timeline.addLabel(`${slide.id}:enter`, start);
    timeline.addLabel(slide.id, time);
    const textStart = Number((start + (transition.labels["text:enter"] ?? 0)).toFixed(7));
    checkpoints.push({ id: slide.id, start, duration: transition.duration(), textStart, time });
    return transition;
  });
  return { timeline, tracks, checkpoints, transitions };
}
