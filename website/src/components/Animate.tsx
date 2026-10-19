import { createContext, useContext } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface SlideContext {
  step: number;
  onAmountChange?: (amount: number) => void;
  onNext?: () => void;
  onBack?: () => void;
}
const SlideStepContext = createContext<SlideContext>({ step: 0 });
export function SlideStepProvider({
  children,
  ...value
}: SlideContext & { children: React.ReactNode }) {
  return <SlideStepContext.Provider value={value}>{children}</SlideStepContext.Provider>;
}
export function useSlideStep() {
  return useContext(SlideStepContext).step;
}
export function useAmountControl() {
  return useContext(SlideStepContext).onAmountChange;
}
export function useSlideNav() {
  const { onNext, onBack } = useContext(SlideStepContext);
  return { onNext, onBack };
}
export function useEntranceStyle(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(frame, [delay * fps, (delay + 0.5) * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return { opacity: progress, transform: `translateX(${24 * (1 - progress)}px)` };
}
export function NextButton({ children }: { children: React.ReactNode }) {
  const { onNext } = useSlideNav();
  return (
    <div className="flex w-full justify-end pt-4" style={useEntranceStyle(0.3)}>
      <button
        onClick={onNext}
        className="type-button rounded-md bg-zinc-800 px-6 py-3 transition-colors hover:bg-zinc-700"
      >
        {children}
      </button>
    </div>
  );
}
export function Animate({
  inStep,
  outStep,
  children,
}: {
  inStep: number;
  outStep?: number;
  children: React.ReactNode;
}) {
  const step = useSlideStep();
  return step >= inStep && (outStep == null || step < outStep) ? <>{children}</> : null;
}
