import { DEFAULT_STRENGTH } from "./state";

export default function StrengthControl({
  id,
  amount,
  enabled,
  onAmountChange,
}: {
  id: string;
  amount: number;
  enabled: boolean;
  onAmountChange: (value: number) => void;
}) {
  return (
    <div className="tour-strength">
      <div className="tour-strength-label">
        <label htmlFor={id}>
          Strength <output htmlFor={id}>{amount.toFixed(1)}</output>
        </label>
        <button type="button" disabled={!enabled} onClick={() => onAmountChange(DEFAULT_STRENGTH)}>
          Reset
        </button>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={3}
        step={0.1}
        value={amount}
        disabled={!enabled}
        onChange={(e) => onAmountChange(Number(e.target.value))}
        className="slider-unfilled"
      />
    </div>
  );
}
