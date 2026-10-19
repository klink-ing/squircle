import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Player } from "@remotion/player";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { SlideStepProvider } from "./Animate";
import ExplorerGraphic, { type ArcStyle, type GraphicState } from "./ExplorerGraphic";
import FreeExplorer from "./FreeExplorer";
import { slides } from "./slides";

const FPS = 60;
const HIDDEN_ARC: ArcStyle = { visible: false, showFill: false, showOutline: false };

const INITIAL_GRAPHIC_STATE: GraphicState = {
  arcRounded: { ...HIDDEN_ARC },
  arcSuperellipse: { ...HIDDEN_ARC },
  correctionAmount: 0,
  amount: 1.5,
  showRefLine: false,
  showMeasurement: false,
  measureArc: undefined,
  zoom: 1,
};

function mergeGraphicState(state: GraphicState, partial: Partial<GraphicState>): GraphicState {
  const merged = { ...state, ...partial };
  // Deep merge arc style objects
  if (partial.arcRounded) {
    merged.arcRounded = { ...state.arcRounded, ...partial.arcRounded };
  }
  if (partial.arcSuperellipse) {
    merged.arcSuperellipse = { ...state.arcSuperellipse, ...partial.arcSuperellipse };
  }
  return merged;
}

function computeGraphicState(slideIndex: number, stepIndex: number): GraphicState {
  let state: GraphicState = {
    ...INITIAL_GRAPHIC_STATE,
    arcRounded: { ...INITIAL_GRAPHIC_STATE.arcRounded },
    arcSuperellipse: { ...INITIAL_GRAPHIC_STATE.arcSuperellipse },
  };
  for (let si = 0; si <= slideIndex; si++) {
    const slide = slides[si]!;
    const maxStep = si === slideIndex ? stepIndex : slide.steps.length - 1;
    for (let sti = 0; sti <= maxStep; sti++) {
      const step = slide.steps[sti];
      if (step?.graphic) {
        state = mergeGraphicState(state, step.graphic);
      }
    }
  }
  return state;
}

type TourFrameProps = {
  from: GraphicState;
  target: GraphicState;
  slideIndex: number;
  stepIndex: number;
  contentHost: HTMLDivElement;
  userAmount: number | null;
  onAmountChange: (amount: number) => void;
  onNext: () => void;
  onBack: () => void;
  displayed: { current: GraphicState };
  reducedMotion: boolean;
};

function TourFrame({
  from,
  target,
  slideIndex,
  stepIndex,
  contentHost,
  userAmount,
  onAmountChange,
  onNext,
  onBack,
  displayed,
  reducedMotion,
}: TourFrameProps) {
  const frame = useCurrentFrame();
  const duration = slides[slideIndex]!.steps[stepIndex]!.transition?.duration ?? 0.4;
  const progress = reducedMotion
    ? 1
    : interpolate(frame, [0, duration * FPS], [0, 1], {
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      });
  const mix = (a: number, b: number) => a + (b - a) * progress;
  const arc = (a: ArcStyle, b: ArcStyle): ArcStyle => ({
    visible: mix(Number(a.visible), Number(b.visible)),
    showFill: mix(Number(a.showFill), Number(b.showFill)),
    showOutline: mix(Number(a.showOutline), Number(b.showOutline)),
  });
  const state: GraphicState = {
    ...target,
    amount: userAmount ?? mix(from.amount, target.amount),
    correctionAmount: mix(from.correctionAmount, target.correctionAmount),
    zoom: mix(from.zoom, target.zoom),
    arcRounded: arc(from.arcRounded, target.arcRounded),
    arcSuperellipse: arc(from.arcSuperellipse, target.arcSuperellipse),
    showRefLine: mix(Number(from.showRefLine), Number(target.showRefLine)),
    showMeasurement: mix(Number(from.showMeasurement), Number(target.showMeasurement)),
  };
  // Capture the rendered frame so rapid navigation starts from the visible geometry.
  displayed.current = state;
  return (
    <>
      <ExplorerGraphic {...state} />
      {createPortal(
        <SlideStepProvider
          step={stepIndex}
          onAmountChange={onAmountChange}
          onNext={onNext}
          onBack={onBack}
        >
          {slides[slideIndex]!.content}
        </SlideStepProvider>,
        contentHost,
      )}
    </>
  );
}

export default function GuidedExplorer() {
  const [position, setPosition] = useState({ slide: 0, step: 0, revision: 0 });
  const [mode, setMode] = useState<"tour" | "explore">("tour");
  const [contentHost, setContentHost] = useState<HTMLDivElement | null>(null);
  const [userAmount, setUserAmount] = useState<number | null>(null);
  const [exploreState, setExploreState] = useState(() => computeGraphicState(0, 0));
  const [from, setFrom] = useState(() => computeGraphicState(0, 0));
  const displayed = useRef(from);
  const target = computeGraphicState(position.slide, position.step);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const navigate = useCallback((slide: number, step: number) => {
    setFrom(displayed.current);
    setUserAmount(null);
    setPosition((prev) => ({ slide, step, revision: prev.revision + 1 }));
  }, []);
  const handleNext = () => {
    if (position.step < slides[position.slide]!.steps.length - 1) {
      navigate(position.slide, position.step + 1);
    } else if (position.slide < slides.length - 1) {
      navigate(position.slide + 1, 0);
    } else {
      setExploreState({ ...target, amount: userAmount ?? target.amount });
      setMode("explore");
    }
  };
  const handleBack = () => {
    if (mode === "explore") {
      setFrom(target);
      setMode("tour");
    } else if (position.step > 0) {
      navigate(position.slide, position.step - 1);
    } else if (position.slide > 0) {
      navigate(position.slide - 1, slides[position.slide - 1]!.steps.length - 1);
    }
  };
  const duration = slides[position.slide]!.steps[position.step]!.transition?.duration ?? 0.4;
  return (
    <div className="grid gap-8 md:grid-cols-2 md:items-start">
      <div className="md:-mt-[10%]">
        {mode === "tour" ? (
          contentHost && (
            <Player
              key={position.revision}
              component={TourFrame}
              inputProps={{
                from,
                target,
                slideIndex: position.slide,
                stepIndex: position.step,
                contentHost,
                userAmount,
                onAmountChange: setUserAmount,
                onNext: handleNext,
                onBack: handleBack,
                displayed,
                reducedMotion,
              }}
              compositionWidth={440}
              compositionHeight={440}
              fps={FPS}
              durationInFrames={Math.ceil(Math.max(duration, 0.8) * FPS) + 1}
              initialFrame={reducedMotion ? Math.ceil(Math.max(duration, 0.8) * FPS) : 0}
              autoPlay={!reducedMotion}
              controls={false}
              clickToPlay={false}
              doubleClickToFullscreen={false}
              spaceKeyToPlayOrPause={false}
              moveToBeginningWhenEnded={false}
              style={{ width: "100%", maxWidth: 448, overflow: "visible" }}
            />
          )
        ) : (
          <ExplorerGraphic {...exploreState} />
        )}
      </div>
      <div className="flex min-h-[500px] flex-col">
        {/* A portal preserves Remotion context while keeping text and controls unscaled. */}
        <div ref={setContentHost} className="flex-1" />
        {mode === "explore" && (
          <div className="flex-1">
            <h2 className="text-xl font-bold text-zinc-100">Explore</h2>
            <FreeExplorer
              graphicState={exploreState}
              onGraphicStateChange={(partial) =>
                setExploreState((prev) => mergeGraphicState(prev, partial))
              }
            />
          </div>
        )}
        <div className="pt-4">
          <button
            onClick={handleBack}
            disabled={mode === "tour" && position.slide === 0 && position.step === 0}
            className="text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
          >
            {mode === "explore" ? "← Back to tour" : "← Back"}
          </button>
        </div>
      </div>
    </div>
  );
}
