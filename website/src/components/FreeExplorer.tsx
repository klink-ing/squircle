import { useId, useMemo, useState } from "react";
import { apparentRadius, correctedRadius } from "../math";
import type { GraphicState } from "./ExplorerGraphic";
import { Switch } from "./ui/switch";

interface FreeExplorerProps {
  graphicState: GraphicState;
  onGraphicStateChange: (state: Partial<GraphicState>) => void;
}

export default function FreeExplorer({ graphicState, onGraphicStateChange }: FreeExplorerProps) {
  const { amount, correctionAmount } = graphicState;
  const amountId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const amountText = draft ?? String(amount);

  const stats = useMemo(() => {
    const mathN = Math.pow(2, amount);
    const r = 1; // Match the normalized reference radius in the diagram.
    const corrR = correctedRadius(r, mathN);
    const superApparent = apparentRadius(r, mathN);
    const corrApparent = apparentRadius(corrR, mathN);
    return { mathN, r, corrR, superApparent, corrApparent };
  }, [amount]);

  const { mathN, r, corrR, superApparent, corrApparent } = stats;

  const corrected = correctionAmount > 0;
  const drawnCircleRadius = superApparent + (corrApparent - superApparent) * correctionAmount;
  const circleDiff = 0;
  const superDiff = superApparent - drawnCircleRadius;
  const corrDiff = corrApparent - drawnCircleRadius;

  function formatDiff(d: number) {
    const rounded = Number(d.toFixed(2));
    const sign = rounded >= 0 ? "+" : "";
    return `${sign}${rounded.toFixed(2)}`;
  }

  function handleTextCommit(value: string) {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      setDraft(null);
      return;
    }
    const clamped = Math.min(3, Math.max(-3, parsed));
    onGraphicStateChange({ amount: clamped });
    setDraft(null);
  }

  return (
    <div>
      {/* Amount slider */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor={amountId} className="w-full text-sm font-medium text-zinc-400 sm:w-auto">
          Superellipse Amount
        </label>
        <input
          id={amountId}
          type="range"
          min={-3}
          max={3}
          step={0.1}
          value={amount}
          className="slider-unfilled min-w-0"
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onGraphicStateChange({ amount: v });
            setDraft(null);
          }}
        />
        <input
          aria-label="Superellipse amount value"
          type="text"
          value={amountText}
          className="w-10 bg-transparent text-amber-400"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => handleTextCommit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleTextCommit(e.currentTarget.value);
          }}
        />
      </div>

      <label className="mb-4 flex min-h-12 w-fit cursor-pointer items-center gap-3 text-sm">
        <Switch
          checked={correctionAmount > 0}
          onCheckedChange={(checked) => onGraphicStateChange({ correctionAmount: checked ? 1 : 0 })}
        />
        <span>Correction</span>
      </label>

      {/* Formula readout */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
        <p className="font-mono text-zinc-300">
          r' = {r.toFixed(2)} &times; (1 - 2<sup>-1/2</sup>) / (1 - 2
          <sup>-1/{mathN.toFixed(2)}</sup>)
        </p>
        <p className="font-mono text-zinc-400">= {corrR.toFixed(2)}</p>

        {/* Comparison table */}
        <table className="mt-3 w-full text-left text-xs">
          <caption className="sr-only">
            The highlighted superellipse row matches the diagram. Differences compare apparent radii
            with the blue circle.
          </caption>
          <thead>
            <tr className="text-zinc-500">
              <th className="py-1 pr-4">Curve</th>
              <th className="py-1 pr-4">CSS Radius</th>
              <th className="py-1 pr-4">Apparent Radius</th>
              <th className="py-1">Diff</th>
            </tr>
          </thead>
          <tbody className="font-mono text-zinc-300">
            <tr>
              <td className="py-1 pr-4" style={{ color: "var(--color-rounded-border)" }}>
                Circle
              </td>
              <td className="py-1 pr-4">{drawnCircleRadius.toFixed(2)}</td>
              <td className="py-1 pr-4">{drawnCircleRadius.toFixed(2)}</td>
              <td className="py-1">{formatDiff(circleDiff)}</td>
            </tr>
            <tr aria-current={!corrected ? "true" : undefined}>
              <td className="py-1 pr-4" style={{ color: "var(--color-squircle-border)" }}>
                Uncorrected Superellipse
              </td>
              <td className="py-1 pr-4">{r.toFixed(2)}</td>
              <td className="py-1 pr-4">{superApparent.toFixed(2)}</td>
              <td className="py-1">{formatDiff(superDiff)}</td>
            </tr>
            <tr aria-current={corrected ? "true" : undefined}>
              <td className="py-1 pr-4" style={{ color: "var(--color-squircle-border)" }}>
                Corrected superellipse
              </td>
              <td className="py-1 pr-4">{corrR.toFixed(2)}</td>
              <td className="py-1 pr-4">{corrApparent.toFixed(2)}</td>
              <td className="py-1">{formatDiff(corrDiff)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
