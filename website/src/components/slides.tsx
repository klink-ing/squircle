import { useState } from "react";
import { useEntranceStyle } from "./Animate";
import { Animate, NextButton, useAmountControl } from "./Animate";
import type { GraphicState } from "./ExplorerGraphic";

function AmountSlider({ min, max, initial }: { min: number; max: number; initial: number }) {
  const onAmountChange = useAmountControl();
  const [value, setValue] = useState(initial);
  return (
    <div className="mt-3 flex items-center gap-3">
      <label className="text-sm font-medium text-zinc-400">Superellipse strength:</label>
      <input
        type="range"
        min={min}
        max={max}
        step={0.1}
        value={value}
        className="slider-unfilled"
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          setValue(v);
          onAmountChange?.(v);
        }}
      />
      <span className="w-8 text-sm text-amber-400">{value.toFixed(1)}</span>
    </div>
  );
}

export type StepDef = {
  graphic?: Partial<GraphicState>;
  transition?: { duration?: number };
};

export type Slide = {
  content: React.ReactNode;
  steps: StepDef[];
};

const SlideHeading = ({ children }: { children: React.ReactNode }) => {
  return (
    <h2 className="type-step-heading pb-6" style={useEntranceStyle()}>
      {children}
    </h2>
  );
};

const SlideP = ({ children }: { children: React.ReactNode }) => {
  return (
    <p className="type-step-body" style={useEntranceStyle()}>
      {children}
    </p>
  );
};

const SlideCode = ({ children }: { children: React.ReactNode }) => {
  return <code className="rounded-md bg-zinc-800 px-1 py-0.5 text-zinc-300">{children}</code>;
};

export const slides: Slide[] = [
  // Slide 0: The Rounded Corner
  {
    content: (
      <div>
        <Animate inStep={0}>
          <SlideHeading>border-radius</SlideHeading>
          <SlideP>
            The old standby. Makes our buttons feel smooth. But we want our corners even{" "}
            <i>smoother</i>. Let's apply <SlideCode>corner-shape: squircle()</SlideCode>
          </SlideP>
          <NextButton>Apply it</NextButton>
        </Animate>
      </div>
    ),
    steps: [
      {
        graphic: {
          arcSuperellipse: { visible: true, showFill: true, showOutline: false },
          amount: 1,
          zoom: 0.75,
        },
      },
    ],
  },

  // Slide 1: The Superellipse
  {
    content: (
      <div>
        <Animate inStep={0}>
          <SlideHeading>
            Doesn't animate. why? <br />
            corner-shape: squircle
          </SlideHeading>
        </Animate>
        <Animate inStep={0}>
          <SlideHeading>Does animate!</SlideHeading>
        </Animate>
        <Animate inStep={0} outStep={1}>
          <SlideP>
            <i>Smoooooooth</i>. So nice. But notice what happened? The corner sticks out more than
            before. But the <SlideCode>border-radius</SlideCode> is the same!
          </SlideP>
          <NextButton>What gives?</NextButton>
        </Animate>
        <Animate inStep={1} outStep={2}>
          <SlideP>
            You think the radius means this. And for <code>corner-shape: round</code> that's sorta
            true. But what it actually refers to is...
          </SlideP>
          <NextButton>Tell me!</NextButton>
        </Animate>
        <Animate inStep={2} outStep={3}>
          <p className="mt-3 text-zinc-400">
            See how the superellipse strength affects the perceived radius:
          </p>
          <AmountSlider min={1} max={3} initial={2} />
          <p className="mt-3 text-zinc-400">
            Watch as we increase <em className="text-zinc-200">K</em> (the superellipse exponent).
            Higher values create an ever-squarer corner shape.
          </p>
          <NextButton>What do we care about?</NextButton>
        </Animate>
        <Animate inStep={3} outStep={4}>
          <p className="mt-3 text-zinc-400">
            The distance to the edge. But we don't care about that!
          </p>
        </Animate>
      </div>
    ),
    steps: [
      {
        graphic: {
          arcSuperellipse: { visible: true, showFill: true, showOutline: false },
          amount: 2,
        },
        transition: { duration: 1 },
      },
      {
        graphic: {
          arcRounded: { visible: true, showFill: true, showOutline: false },
          showMeasurement: true,
          measureArc: "rounded",
        },
        transition: { duration: 1 },
      },
      {},
    ],
  },

  // Slide 2: The Correction
  {
    content: (
      <div>
        <Animate inStep={0}>
          <SlideHeading>The Correction</SlideHeading>
        </Animate>
        <Animate inStep={0} outStep={1}>
          <SlideP>
            We can compute a <em className="text-zinc-200">corrected radius</em> that compensates
            for the superellipse's inward pull. By scaling up the radius, the curve's widest point
            aligns exactly with the circle arc.
          </SlideP>
          <NextButton>Next</NextButton>
        </Animate>
        <Animate inStep={1} outStep={2}>
          <SlideP>
            The corrected curve now matches the visual size of the{" "}
            <SlideCode>border-radius</SlideCode> you specified — you get the smooth superellipse
            shape without sacrificing the intended corner size.
          </SlideP>
          <NextButton>Next</NextButton>
        </Animate>
        <Animate inStep={2} outStep={3}>
          <SlideP>
            Our <SlideCode>tw-utils</SlideCode> applies this correction automatically. Just use the{" "}
            <SlideCode>squircle-*</SlideCode> utilities as you would{" "}
            <SlideCode>rounded-*</SlideCode>, and the math is handled for you.
          </SlideP>
          <NextButton>Explore</NextButton>
        </Animate>
      </div>
    ),
    steps: [
      { graphic: { correctionAmount: 1, measureArc: "corrected" } },
      { graphic: {} },
      { graphic: {} },
    ],
  },
];
