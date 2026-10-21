import gsap from "gsap";
import { SLIDES, type TourSlide } from "./slides";
import { initialTracks } from "./state";

export interface Checkpoint {
  id: string;
  start: number;
  duration: number;
  time: number;
}

export function checkpointAtTime(time: number, checkpoints: readonly Checkpoint[]) {
  return Math.max(
    0,
    checkpoints.findLastIndex((cue) => time >= cue.start),
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
  const transitions = slides.map((slide, index) => {
    const transition = gsap.timeline();
    // The proxy gives headless timelines the same text duration as mounted timelines.
    slide.transition(transition, { tracks, text: panels[index] ?? { opacity: 0, x: 16 } });
    transition.to({}, { duration: slide.hold });
    const start = index === 0 ? 0 : Number((timeline.duration() + SLIDE_GAP).toFixed(7));
    timeline.add(transition, start);
    const time = timeline.duration();
    timeline.addLabel(`${slide.id}:enter`, start);
    timeline.addLabel(slide.id, time);
    checkpoints.push({ id: slide.id, start, duration: transition.duration(), time });
    return transition;
  });
  return { timeline, tracks, checkpoints, transitions };
}
