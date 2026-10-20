import { Sequence, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import ExplorerGraphic from "../ExplorerGraphic";
import { graphicAtFrame } from "./graphic-state";
import { CHECKPOINTS, checkpointAtFrame, DURATION, STRENGTH } from "./timeline";

export interface TourCompositionProps {
  amount?: number;
  moving?: boolean;
  navigationDestination?: number;
  onAmountChange?: (amount: number) => void;
  onNext?: () => void;
  onBack?: () => void;
}

const buttonStyle: CSSProperties = {
  minHeight: 64,
  padding: "12px 20px",
  borderRadius: 8,
  background: "#27272a",
  color: "#f4f4f5",
  fontSize: 22,
  fontWeight: 500,
  cursor: "pointer",
  border: 0,
};

// Native sequences own content lifetimes. Local frame zero is each reveal's entrance.
function Reveal({ children, length }: { children: ReactNode; length: number }) {
  const frame = useCurrentFrame();
  const entrance = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const exit = interpolate(frame, [length - 18, length - 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      inert={entrance === 0 || frame >= length - 18}
      aria-hidden={entrance === 0 || frame >= length - 18}
      style={{
        gridArea: "1 / 1",
        opacity: entrance * exit,
        transform: `translateX(${24 * (1 - entrance) - 16 * (1 - exit)}px)`,
      }}
    >
      {children}
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code
      style={{ fontSize: "0.87em", background: "#27272a", padding: "1px 4px", borderRadius: 4 }}
    >
      {children}
    </code>
  );
}

export default function TourComposition({
  amount = 2,
  moving = false,
  navigationDestination,
  onAmountChange,
  onNext,
  onBack,
}: TourCompositionProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const compact = height > width;
  const active = checkpointAtFrame(frame);
  const checkpoint = CHECKPOINTS[active]!;
  const headingStyle: CSSProperties = {
    margin: 0,
    fontSize: compact ? 40 : 44,
    lineHeight: 1.1,
    fontWeight: 700,
  };
  const end = DURATION + 24; // Keep the last text fully visible at the final reading frame.
  const strengthActive = frame === STRENGTH.frame && !moving;

  return (
    <div
      data-tour-composition
      data-tour-frame={frame}
      data-tour-moving={moving}
      data-tour-checkpoint={checkpoint.id}
      style={{
        width,
        height,
        padding: 24,
        boxSizing: "border-box",
        display: "grid",
        gridTemplateColumns: compact ? "1fr" : "360px minmax(0, 1fr)",
        gridTemplateRows: compact ? "220px minmax(0, 1fr)" : "1fr",
        gap: compact ? 24 : 40,
        color: "#f4f4f5",
        background: "#09090b",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: compact ? 220 : 360,
          justifySelf: "center",
          alignSelf: compact ? "start" : "center",
        }}
      >
        <ExplorerGraphic {...graphicAtFrame(frame, amount)} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          gap: 20,
          minWidth: 0,
        }}
      >
        <div data-tour-heading tabIndex={-1} style={{ display: "grid", outline: "none" }}>
          <Sequence
            from={0}
            durationInFrames={CHECKPOINTS[1].start + 18}
            name="Heading · Rounded corner"
            layout="none"
          >
            <Reveal length={CHECKPOINTS[1].start + 18}>
              <h2 style={headingStyle}>border-radius</h2>
            </Reveal>
          </Sequence>
          <Sequence
            from={CHECKPOINTS[1].start}
            durationInFrames={CHECKPOINTS[4].start + 18 - CHECKPOINTS[1].start}
            name="Heading · Superellipse"
            layout="none"
          >
            <Reveal length={CHECKPOINTS[4].start + 18 - CHECKPOINTS[1].start}>
              <h2 style={headingStyle}>
                Same radius.
                <br />
                Smoother corner.
              </h2>
            </Reveal>
          </Sequence>
          <Sequence
            from={CHECKPOINTS[4].start}
            durationInFrames={end - CHECKPOINTS[4].start}
            name="Heading · Correction"
            layout="none"
          >
            <Reveal length={end - CHECKPOINTS[4].start}>
              <h2 style={headingStyle}>The correction</h2>
            </Reveal>
          </Sequence>
        </div>
        <div
          data-tour-copy
          style={{
            display: "grid",
            alignContent: "start",
            fontSize: compact ? 24 : 22,
            lineHeight: 1.5,
          }}
        >
          <Sequence
            name="Text · rounded"
            from={CHECKPOINTS[0].start}
            durationInFrames={CHECKPOINTS[1].start + 18 - CHECKPOINTS[0].start}
            layout="none"
          >
            <Reveal length={CHECKPOINTS[1].start + 18 - CHECKPOINTS[0].start}>
              <p>
                The old standby. <Code>border-radius</Code> makes a circular corner. Let's make it
                even smoother with <Code>corner-shape: superellipse(2)</Code>.
              </p>
            </Reveal>
          </Sequence>
          <Sequence
            name="Text · superellipse"
            from={CHECKPOINTS[1].start}
            durationInFrames={CHECKPOINTS[2].start + 18 - CHECKPOINTS[1].start}
            layout="none"
          >
            <Reveal length={CHECKPOINTS[2].start + 18 - CHECKPOINTS[1].start}>
              <p>
                <i>Smoooooooth.</i> But notice what happened? The corner sticks out more than
                before—even though the <Code>border-radius</Code> is the same.
              </p>
            </Reveal>
          </Sequence>
          <Sequence
            name="Text · radius"
            from={CHECKPOINTS[2].start}
            durationInFrames={CHECKPOINTS[3].start + 18 - CHECKPOINTS[2].start}
            layout="none"
          >
            <Reveal length={CHECKPOINTS[3].start + 18 - CHECKPOINTS[2].start}>
              <p>
                The radius describes the distance from the curve's center to its edge. It doesn't
                describe how rounded the corner looks. Compare the circle with the superellipse.
              </p>
            </Reveal>
          </Sequence>
          <Sequence
            name="Text · strength"
            from={CHECKPOINTS[3].start}
            durationInFrames={CHECKPOINTS[4].start + 18 - CHECKPOINTS[3].start}
            layout="none"
          >
            <Reveal length={CHECKPOINTS[4].start + 18 - CHECKPOINTS[3].start}>
              <div>
                <p>Higher strength makes a squarer corner. Try it.</p>
                <div
                  style={{
                    margin: "12px 0",
                    padding: 12,
                    border: "1px solid #3f3f46",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <label htmlFor="tour-strength" style={{ fontSize: 24, fontWeight: 500 }}>
                      Strength{" "}
                      <output htmlFor="tour-strength" style={{ color: "#fbbf24" }}>
                        {amount.toFixed(1)}
                      </output>
                    </label>
                    <button
                      type="button"
                      disabled={!strengthActive || !onAmountChange}
                      onClick={() => onAmountChange?.(2)}
                      style={{ ...buttonStyle, padding: "8px 12px", fontSize: 22 }}
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
                    style={{ display: "block", width: "100%", height: 64, margin: 0 }}
                  />
                </div>
                <p>Next, we'll restore strength 2 and correct the radius.</p>
              </div>
            </Reveal>
          </Sequence>
          <Sequence
            name="Text · correction"
            from={CHECKPOINTS[4].start}
            durationInFrames={CHECKPOINTS[5].start + 18 - CHECKPOINTS[4].start}
            layout="none"
          >
            <Reveal length={CHECKPOINTS[5].start + 18 - CHECKPOINTS[4].start}>
              <p>
                We can calculate a <em>corrected radius</em>. Increasing the superellipse's radius
                brings its diagonal point into alignment with the circle.
              </p>
            </Reveal>
          </Sequence>
          <Sequence
            name="Text · alignment"
            from={CHECKPOINTS[5].start}
            durationInFrames={CHECKPOINTS[6].start + 18 - CHECKPOINTS[5].start}
            layout="none"
          >
            <Reveal length={CHECKPOINTS[6].start + 18 - CHECKPOINTS[5].start}>
              <p>
                Now the two corners have the same visual size. You get the smooth superellipse shape
                while preserving the roundness you intended.
              </p>
            </Reveal>
          </Sequence>
          <Sequence
            name="Text · utilities"
            from={CHECKPOINTS[6].start}
            durationInFrames={end - CHECKPOINTS[6].start}
            layout="none"
          >
            <Reveal length={end - CHECKPOINTS[6].start}>
              <p>
                <Code>@klinking/squircle</Code> handles this correction automatically. Use{" "}
                <Code>squircle-*</Code> utilities just as you would <Code>rounded-*</Code>. Then
                explore the math yourself.
              </p>
            </Reveal>
          </Sequence>
        </div>
        <nav
          aria-label="Tour navigation"
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={onBack}
            disabled={!onBack || (navigationDestination ?? active) === 0}
            style={{ ...buttonStyle, background: "transparent", paddingLeft: 0 }}
          >
            ← Back
          </button>
          <span
            aria-label={`Scene ${active + 1} of ${CHECKPOINTS.length}`}
            style={{ fontSize: 16, color: "#a1a1aa" }}
          >
            {active + 1} / {CHECKPOINTS.length}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={moving || !onNext}
            style={{ ...buttonStyle, maxWidth: 220 }}
          >
            {checkpoint.nextLabel}
          </button>
        </nav>
      </div>
    </div>
  );
}
