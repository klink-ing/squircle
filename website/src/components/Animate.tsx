import { createContext, useContext } from "react";
import { AnimatePresence, motion, type MotionProps } from "framer-motion";

interface SlideContext {
  step: number;
  onAmountChange?: (amount: number) => void;
  onNext?: () => void;
  onBack?: () => void;
}

const SlideStepContext = createContext<SlideContext>({ step: 0 });

export function SlideStepProvider({
  step,
  onAmountChange,
  onNext,
  onBack,
  children,
}: {
  step: number;
  onAmountChange?: (amount: number) => void;
  onNext?: () => void;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <SlideStepContext.Provider value={{ step, onAmountChange, onNext, onBack }}>
      {children}
    </SlideStepContext.Provider>
  );
}

export function useSlideStep() {
  return useContext(SlideStepContext).step;
}

export function useAmountControl() {
  return useContext(SlideStepContext).onAmountChange;
}

export function useSlideNav() {
  const ctx = useContext(SlideStepContext);
  return { onNext: ctx.onNext, onBack: ctx.onBack };
}

export function NextButton({
  children,
  initial,
  animate,
  exit,
}: {
  children: React.ReactNode;
  initial?: MotionProps["initial"];
  animate?: MotionProps["animate"];
  exit?: MotionProps["exit"];
}) {
  const { onNext } = useSlideNav();

  return (
    <motion.div
      className="flex w-full justify-end pt-4"
      initial={initial ?? { opacity: 0, x: 20 }}
      animate={animate ?? { opacity: 1, x: 0, transition: { duration: 0.3, delay: 0.3 } }}
      exit={exit ?? { opacity: 0, x: -20, transition: { duration: 0.2, delay: 0.2 } }}
    >
      <button
        onClick={onNext}
        className="type-button rounded-md bg-zinc-800 px-6 py-3 transition-colors hover:bg-zinc-700"
      >
        {children}
      </button>
    </motion.div>
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
  const currentStep = useSlideStep();
  const visible = currentStep >= inStep && (outStep == null || currentStep < outStep);

  return (
    <AnimatePresence propagate mode="popLayout">
      {visible && (
        <motion.div key={`animate-${inStep}`} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
