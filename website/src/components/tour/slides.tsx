import type gsap from "gsap";
import type { ReactNode } from "react";
import StrengthControl from "./StrengthControl";
import { DEFAULT_STRENGTH, type GraphicTracks } from "./state";
import { correctedRadius } from "../../math";

import { enterText, exitText, type TextTargets } from "./text";
export { TEXT_ENTER_DISTANCE, TEXT_EXIT_DISTANCE } from "./text";

export interface SlideContentProps {
  amount: number;
  enabled: boolean;
  onAmountChange: (value: number) => void;
}

export interface TourSlide {
  id: string;
  heading: ReactNode;
  content: (props: SlideContentProps) => ReactNode;
  nextLabel: string;
  strength?: boolean;
  // Extra time after the last animation, before stopping for the reader.
  hold: number;
  transition: (
    timeline: gsap.core.Timeline,
    targets: { tracks: GraphicTracks; text: TextTargets; previousText: TextTargets },
  ) => void;
}

function Code({ children }: { children: ReactNode }) {
  return <code>{children}</code>;
}

// Each block owns one slide, including the transition INTO it. Every timeline starts at 0.
// These are native GSAP timelines: positions, labels, "<", and ">" are all local to the slide.
export const SLIDES: readonly TourSlide[] = [
  {
    id: "rounded",
    heading: "border-radius",
    content: () => (
      <p>
        The old standby. <Code>border-radius</Code> makes a circular corner. Let's make it even
        smoother with <Code>corner-shape: superellipse({DEFAULT_STRENGTH})</Code>.
      </p>
    ),
    nextLabel: "Apply it",
    hold: 0.4,
    transition(timeline, { text }) {
      enterText(timeline, text, { at: 0, duration: 0.7 });
    },
  },
  {
    id: "superellipse",
    heading: (
      <>
        Smoother curvature.
        <br />
        <i>Sharper</i> corner?
      </>
    ),
    content: () => (
      <p>
        <i>Niiiiiiiiice...</i> But WTF, now the corner sticks out more than before! Isn't the{" "}
        <Code>border-radius</Code> is the same?
      </p>
    ),
    nextLabel: "It is, but...",
    hold: 0.18,
    transition(timeline, { tracks, text, previousText }) {
      exitText(timeline, previousText, { at: 0, duration: 0.18 });
      enterText(timeline, text, { at: ">", duration: 0.7 });
      timeline.to(tracks, { baseAmount: DEFAULT_STRENGTH, duration: 1, ease: "power2.inOut" }, 0);
    },
  },
  {
    id: "radius",
    heading: "Placeholder: CSS radius",
    content: () => (
      <p>
        The radius describes the distance from the curve's center to its edge. It doesn't describe
        how rounded the corner looks. Compare the circle with the superellipse.
      </p>
    ),
    nextLabel: "Next",
    hold: 0.38,
    transition(timeline, { tracks, text, previousText }) {
      exitText(timeline, previousText, { at: 0, duration: 0.18 });
      enterText(timeline, text, { at: ">", duration: 0.7 });
      timeline.to(
        tracks,
        { roundedOpacity: 1, radiusComparison: 1, duration: 0.8, ease: "power2.inOut" },
        0,
      );
    },
  },
  {
    id: "visual-radius",
    heading: "Placeholder: visual radius",
    content: ({ amount, enabled, onAmountChange }) => (
      <div>
        <p>Higher strength makes a squarer corner. Try it.</p>
        <StrengthControl
          id="tour-strength"
          amount={amount}
          enabled={enabled}
          onAmountChange={onAmountChange}
        />
        <p>Next, we'll restore strength {DEFAULT_STRENGTH} and correct the radius.</p>
      </div>
    ),
    nextLabel: "Next",
    strength: true,
    hold: 0.23,
    transition(timeline, { tracks, text, previousText }) {
      exitText(timeline, previousText, { at: 0, duration: 0.18 });
      enterText(timeline, text, { at: ">", duration: 0.7 });
      timeline.to(tracks, { radiusSweep: 1, duration: 1, ease: "power2.inOut" }, 0);
      timeline.addLabel("labels", ">");
      timeline.to(tracks, { radiusLabels: 1, duration: 0.45, ease: "none" }, "labels");
      timeline.to(tracks, { choiceWeight: 1, duration: 0.45, ease: "power2.inOut" }, "labels");
    },
  },
  {
    id: "apparent-radius",
    heading: "Apparent radius",
    content: ({ amount, enabled, onAmountChange }) => (
      <div>
        <p>Placeholder copy.</p>
        <StrengthControl
          id="tour-apparent-strength"
          amount={amount}
          enabled={enabled}
          onAmountChange={onAmountChange}
        />
      </div>
    ),
    nextLabel: "Show the correction",
    strength: true,
    hold: 0.18,
    transition(timeline, { tracks, text, previousText }) {
      exitText(timeline, previousText, { at: 0, duration: 0.18 });
      enterText(timeline, text, { at: ">", duration: 0.7 });
      timeline.to(tracks, { apparentRadius: 1, duration: 1, ease: "power2.inOut" }, 0);
    },
  },
  {
    id: "correction",
    heading: "The correction",
    content: ({ amount, enabled, onAmountChange }) => (
      <div>
        <p>
          We can calculate a <em>corrected radius</em>. Increasing the superellipse's radius brings
          its diagonal point into alignment with the circle.
        </p>
        <StrengthControl
          id="tour-corrected-strength"
          amount={amount}
          enabled={enabled}
          onAmountChange={onAmountChange}
        />
      </div>
    ),
    nextLabel: "Next",
    strength: true,
    hold: 0.18,
    transition(timeline, { tracks, text, previousText }) {
      exitText(timeline, previousText, { at: 0, duration: 0.18 });
      enterText(timeline, text, { at: ">", duration: 0.7 });
      const approachDuration = 0.6;
      // Next restores DEFAULT_STRENGTH before this beat. CSS travels this many times farther
      // than blue, so scaling its duration matches their screen velocities at contact.
      const travelRatio = correctedRadius(1, 2 ** DEFAULT_STRENGTH);
      timeline.to(
        tracks,
        { apparentCorrection: 1, duration: approachDuration, ease: "power2.in" },
        0,
      );
      timeline.addLabel("impact", ">");
      timeline.to(
        tracks,
        { correction: 1, duration: approachDuration * travelRatio, ease: "power2.out" },
        "impact",
      );
    },
  },
  {
    id: "alignment",
    heading: "Placeholder: matching corners",
    content: () => (
      <p>
        Now the two corners have the same visual size. You get the smooth superellipse shape while
        preserving the roundness you intended.
      </p>
    ),
    nextLabel: "How do I use it?",
    hold: 0.18,
    transition(timeline, { text, previousText }) {
      exitText(timeline, previousText, { at: 0, duration: 0.18 });
      enterText(timeline, text, { at: ">", duration: 0.7 });
    },
  },
  {
    id: "utilities",
    heading: "Placeholder: using squircle",
    content: () => (
      <p>
        <Code>@klinking/squircle</Code> handles this correction automatically. Use{" "}
        <Code>squircle-*</Code> utilities just as you would <Code>rounded-*</Code>. Then explore the
        math yourself.
      </p>
    ),
    nextLabel: "Explore",
    hold: 0.58,
    transition(timeline, { text, previousText }) {
      exitText(timeline, previousText, { at: 0, duration: 0.18 });
      enterText(timeline, text, { at: ">", duration: 0.7 });
    },
  },
];
