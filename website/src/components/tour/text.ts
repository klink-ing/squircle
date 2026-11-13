import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { Children, Fragment, isValidElement, type ReactNode } from "react";
import type { TourSlide } from "./slides";
import { DEFAULT_STRENGTH } from "./state";

export const TEXT_ENTER_DISTANCE = 64;
export const TEXT_EXIT_DISTANCE = 48;
export const HEADLINE_LINE_STAGGER = 0.08;
export const PARAGRAPH_DELAY = 0.12;
export const PARAGRAPH_STAGGER = 0.1;

export interface TextProxy {
  opacity: number;
  x: number;
}
export type TextTarget = HTMLElement | TextProxy;
export interface TextTargets {
  heading: TextTarget;
  lines: TextTarget[];
  paragraphs: TextTarget[];
}

const proxy = (): TextProxy => ({ opacity: 0, x: TEXT_ENTER_DISTANCE });

function countBeats(node: ReactNode, heading = false): number {
  return Children.toArray(node).reduce<number>((count, child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return count;
    if (heading) return count + (child.type === "br" ? 1 : countBeats(child.props.children, true));
    if (child.type === "p" || (typeof child.type !== "string" && child.type !== Fragment)) {
      return count + 1;
    }
    return count + countBeats(child.props.children);
  }, 0);
}

// Headless targets follow the same content order and durations as mounted narrative.
export function createTextTargets(slide: TourSlide, panel?: HTMLElement): TextTargets {
  return {
    heading: panel?.querySelector<HTMLElement>("h2") ?? { opacity: 1, x: 0 },
    lines: Array.from({ length: countBeats(slide.heading, true) + 1 }, proxy),
    paragraphs: panel
      ? Array.from(panel.querySelectorAll<HTMLElement>(".tour-copy p, .tour-strength"))
      : Array.from(
          {
            length: countBeats(
              slide.content({ amount: DEFAULT_STRENGTH, enabled: false, onAmountChange() {} }),
            ),
          },
          proxy,
        ),
  };
}

type EntranceTiming = {
  at: gsap.Position;
  duration: number;
  lineStagger?: number;
  paragraphDelay?: number;
  paragraphStagger?: number;
};

export function enterText(
  timeline: gsap.core.Timeline,
  text: TextTargets,
  {
    at,
    duration,
    lineStagger = HEADLINE_LINE_STAGGER,
    paragraphDelay = PARAGRAPH_DELAY,
    paragraphStagger = PARAGRAPH_STAGGER,
  }: EntranceTiming,
) {
  timeline.addLabel("text:enter", at);
  timeline.set(text.heading, { opacity: 1, x: 0 }, "text:enter");
  const headline = gsap.timeline();
  const animateLines = () => {
    const time = headline.time();
    headline.clear();
    const stagger = Math.min(lineStagger, duration / text.lines.length);
    headline.fromTo(
      text.lines,
      { opacity: 0, x: TEXT_ENTER_DISTANCE },
      {
        opacity: 1,
        x: 0,
        duration: duration - stagger * (text.lines.length - 1),
        stagger,
        ease: "power3.out",
      },
      0,
    );
    headline.time(time, true);
  };
  if (typeof HTMLElement !== "undefined" && text.heading instanceof HTMLElement) {
    gsap.registerPlugin(SplitText);
    SplitText.create(text.heading, {
      type: "lines",
      linesClass: "tour-headline-line",
      autoSplit: true,
      onSplit(split) {
        text.lines = split.lines as HTMLElement[];
        // Rebuild this fixed-duration child in place, preserving its parent and playhead.
        // Responsive wrapping never moves the slide's body cue or reading stop.
        animateLines();
      },
    });
  } else animateLines();
  timeline.add(headline, "text:enter");
  timeline.addLabel("text:body", `text:enter+=${duration + paragraphDelay}`);
  timeline.fromTo(
    text.paragraphs,
    { opacity: 0, x: TEXT_ENTER_DISTANCE },
    {
      opacity: 1,
      x: 0,
      duration,
      stagger: paragraphStagger,
      ease: "power3.out",
    },
    "text:body",
  );
}

export function exitText(
  timeline: gsap.core.Timeline,
  text: TextTargets,
  { at, duration }: { at: gsap.Position; duration: number },
) {
  timeline.fromTo(
    [text.heading, ...text.paragraphs],
    { opacity: 1, x: 0 },
    { opacity: 0, x: -TEXT_EXIT_DISTANCE, duration, ease: "power1.in", immediateRender: false },
    at,
  );
}
