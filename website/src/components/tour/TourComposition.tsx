import type { ReactNode } from "react";
import { CHECKPOINTS } from "./timeline";

function Code({ children }: { children: ReactNode }) {
  return <code>{children}</code>;
}

export default function TourComposition({
  active,
  amount,
  strengthActive,
  onAmountChange,
}: {
  active: number;
  amount: number;
  strengthActive: boolean;
  onAmountChange: (amount: number) => void;
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
    <div key="strength">
      <p>Higher strength makes a squarer corner. Try it.</p>
      <div style={{ margin: "12px 0", padding: 12, border: "1px solid #3f3f46", borderRadius: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <label htmlFor="tour-strength">
            Strength{" "}
            <output htmlFor="tour-strength" style={{ color: "#fbbf24" }}>
              {amount.toFixed(1)}
            </output>
          </label>
          <button
            type="button"
            disabled={!strengthActive || !onAmountChange}
            onClick={() => onAmountChange?.(2)}
          >
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
          disabled={!strengthActive || !onAmountChange}
          onChange={(event) => onAmountChange?.(Number(event.target.value))}
          className="slider-unfilled"
          style={{ display: "block", width: "100%", minHeight: 48, margin: 0 }}
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

  return (
    <div className="tour-scenes">
      {CHECKPOINTS.map((cue, index) => (
        <section
          key={cue.id}
          data-scene={cue.id}
          hidden={active !== index}
          inert={active !== index}
          aria-hidden={active !== index}
        >
          <h2 data-tour-heading tabIndex={-1}>
            {index === 0 ? (
              "border-radius"
            ) : index < 4 ? (
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
      ))}
    </div>
  );
}
