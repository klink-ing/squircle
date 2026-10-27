import gsap from "gsap";
import { SLIDES, type TourSlide } from "./slides";
import { createTextTargets } from "./text";
import { initialTracks } from "./state";

export interface Checkpoint {
  id: string;
  start: number;
  duration: number;
  textStart: number;
  strengthReturn: "before" | "with-transition";
  strengthReturnStart?: number;
  strengthReturnEnd?: number;
  strengthReturnEase?: gsap.EaseString | gsap.EaseFunction;
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
  const texts = slides.map((slide, index) => createTextTargets(slide, panels[index]));
  const transitions = slides.map((slide, index) => {
    const transition = gsap.timeline();
    // The proxy gives headless timelines the same text duration as mounted timelines.
    slide.transition(transition, {
      tracks,
      text: texts[index]!,
      previousText: texts[index - 1] ?? {
        heading: { opacity: 1, x: 0 },
        lines: [],
        paragraphs: [],
      },
    });
    transition.to({}, { duration: slide.hold });
    const start = index === 0 ? 0 : Number((timeline.duration() + SLIDE_GAP).toFixed(7));
    timeline.add(transition, start);
    const time = timeline.duration();
    timeline.addLabel(`${slide.id}:enter`, start);
    timeline.addLabel(slide.id, time);
    const textStart = Number((start + (transition.labels["text:enter"] ?? 0)).toFixed(7));
    const strengthTween = slide.strengthReturnWith
      ? transition.getTweensOf(tracks).find((tween) => slide.strengthReturnWith! in tween.vars)
      : undefined;
    if (slide.strengthReturnWith && !strengthTween) {
      throw new Error(`Slide ${slide.id} has no tween for ${slide.strengthReturnWith}`);
    }
    checkpoints.push({
      id: slide.id,
      start,
      duration: transition.duration(),
      textStart,
      time,
      strengthReturn: slide.strengthReturn ?? "before",
      strengthReturnStart: strengthTween?.startTime(),
      strengthReturnEnd: strengthTween?.endTime(),
      strengthReturnEase: strengthTween?.vars.ease ?? (strengthTween ? "power1.out" : undefined),
    });
    return transition;
  });
  return { timeline, tracks, checkpoints, transitions, texts };
}
