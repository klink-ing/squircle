import type { ReactNode } from "react";
import { CHECKPOINTS } from "./timeline";

function Code({ children }: { children: ReactNode }) {
  return <code>{children}</code>;
}

export default function TourNarrative({
  active,
  amount,
  strengthActive,
  onAmountChange,
}: {
  active: number;
  amount: number;
  strengthActive: boolean;
  onAmountChange: (value: number) => void;
}) {
  const paragraphs = [
    <p key="rounded">
      The old standby. <Code>border-radius</Code> makes a circular corner. Let's make it even
      smoother with <Code>corner-shape: superellipse(2)</Code>.
    </p>,
    <p key="superellipse">
      <i>Smoooooooth.</i> But notice what happened? The corner sticks out more than before—even
      though the <Code>border-radius</Code> is the same.
    </p>,
    <p key="radius">
      The radius describes the distance from the curve's center to its edge. It doesn't describe how
      rounded the corner looks. Compare the circle with the superellipse.
    </p>,
    <div key="visual-radius">
      <p>Higher strength makes a squarer corner. Try it.</p>
      <div className="tour-strength">
        <div className="tour-strength-label">
          <label htmlFor="tour-strength">
            Strength <output htmlFor="tour-strength">{amount.toFixed(1)}</output>
          </label>
          <button type="button" disabled={!strengthActive} onClick={() => onAmountChange(2)}>
            Reset
          </button>
        </div>
        <input
          id="tour-strength"
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={amount}
          disabled={!strengthActive}
          onChange={(e) => onAmountChange(Number(e.target.value))}
          className="slider-unfilled"
        />
      </div>
      <p>Next, we'll restore strength 2 and correct the radius.</p>
    </div>,
    <p key="correction">
      We can calculate a <em>corrected radius</em>. Increasing the superellipse's radius brings its
      diagonal point into alignment with the circle.
    </p>,
    <p key="alignment">
      Now the two corners have the same visual size. You get the smooth superellipse shape while
      preserving the roundness you intended.
    </p>,
    <p key="utilities">
      <Code>@klinking/squircle</Code> handles this correction automatically. Use{" "}
      <Code>squircle-*</Code> utilities just as you would <Code>rounded-*</Code>. Then explore the
      math yourself.
    </p>,
  ];
  return CHECKPOINTS.map((cue, index) => (
    <section
      key={cue.id}
      data-tour-panel={cue.id}
      hidden={active !== index}
      inert={active !== index}
      aria-labelledby={`heading-${cue.id}`}
    >
      <h2 id={`heading-${cue.id}`} tabIndex={-1}>
        {cue.id === "rounded" ? (
          "border-radius"
        ) : cue.id === "superellipse" || cue.id === "radius" || cue.id === "visual-radius" ? (
          <>
            Same radius.
            <br />
            Smoother corner.
          </>
        ) : (
          "The correction"
        )}
      </h2>
      <div className="tour-copy">{paragraphs[index]}</div>
    </section>
  ));
}
