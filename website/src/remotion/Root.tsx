import { Composition } from "remotion";
import { useEffect, useState } from "react";
import TourComposition from "../components/tour/TourComposition";
import { DURATION, FORMATS, FPS } from "../components/tour/timeline";

// Live controls in Studio are preview-only; renders use the serialized default amount.
function StudioTour({ amount: initialAmount }: { amount: number }) {
  const [amount, setAmount] = useState(initialAmount);
  useEffect(() => setAmount(initialAmount), [initialAmount]);
  return <TourComposition amount={amount} onAmountChange={setAmount} />;
}

export function RemotionRoot() {
  // Literal registrations let Studio locate and edit each composition's default props.
  return (
    <>
      <Composition
        id="Tour-compact"
        component={StudioTour}
        width={FORMATS.compact.width}
        height={FORMATS.compact.height}
        fps={FPS}
        durationInFrames={DURATION}
        defaultProps={{ amount: 2 }}
      />
      <Composition
        id="Tour-wide"
        component={StudioTour}
        width={FORMATS.wide.width}
        height={FORMATS.wide.height}
        fps={FPS}
        durationInFrames={DURATION}
        defaultProps={{ amount: 2 }}
      />
    </>
  );
}
