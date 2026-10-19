import { useMemo, useState } from "react";
import { correctedRadius, perceivedRadius } from "../math";
import type { GraphicState } from "./ExplorerGraphic";

interface FreeExplorerProps {
  graphicState: GraphicState;
  onGraphicStateChange: (state: Partial<GraphicState>) => void;
}

export default function FreeExplorer({ graphicState, onGraphicStateChange }: FreeExplorerProps) {
  const { amount, arcRounded, arcSuperellipse, correctionAmount } = graphicState;
  const [amountText, setAmountText] = useState(String(amount));

  const stats = useMemo(() => {
    const mathN = Math.pow(2, amount);
    const r = 100;
    const corrR = correctedRadius(r, mathN);
    const circlePerceived = perceivedRadius(r, r, 2);
    const superPerceived = perceivedRadius(r, r, mathN);
    const corrPerceived = perceivedRadius(r, corrR, mathN);
    return { mathN, r, corrR, circlePerceived, superPerceived, corrPerceived };
  }, [amount]);

  const { mathN, r, corrR, circlePerceived, superPerceived, corrPerceived } = stats;

  const circleDiff = circlePerceived - circlePerceived;
  const superDiff = superPerceived - circlePerceived;
  const corrDiff = corrPerceived - circlePerceived;

  function formatDiff(d: number) {
    const sign = d >= 0 ? "+" : "";
    return `${sign}${d.toFixed(1)}px`;
  }

  function handleTextCommit(value: string) {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      setAmountText(String(amount));
      return;
    }
    const clamped = Math.min(3, Math.max(-3, parsed));
    onGraphicStateChange({ amount: clamped });
    setAmountText(String(clamped));
  }

  return (
    <div>
      {/* Amount slider */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-zinc-400">Superellipse Amount</label>
        <input
          type="range"
          min={-3}
          max={3}
          step={0.1}
          value={amount}
          className="slider-unfilled"
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onGraphicStateChange({ amount: v });
            setAmountText(String(Math.round(v * 10) / 10));
          }}
        />
        <input
          type="text"
          value={amountText}
          className="w-10 bg-transparent text-amber-400"
          onChange={(e) => setAmountText(e.target.value)}
          onBlur={(e) => handleTextCommit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleTextCommit(e.currentTarget.value);
          }}
        />
      </div>

      {/* Checkbox toggles */}
      <div className="mb-4 flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(arcRounded.visible)}
            onChange={(e) =>
              onGraphicStateChange({ arcRounded: { ...arcRounded, visible: e.target.checked } })
            }
          />
          <span style={{ color: "var(--color-rounded-border)" }}>Circle</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(arcSuperellipse.visible)}
            onChange={(e) =>
              onGraphicStateChange({
                arcSuperellipse: { ...arcSuperellipse, visible: e.target.checked },
              })
            }
          />
          <span style={{ color: "var(--color-squircle-border)" }}>Superellipse</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={correctionAmount > 0}
            onChange={(e) => onGraphicStateChange({ correctionAmount: e.target.checked ? 1 : 0 })}
          />
          <span style={{ color: "var(--color-adjusted-border)" }}>Corrected</span>
        </label>
      </div>

      {/* Formula readout */}
      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
        <p className="font-mono text-zinc-300">
          r' = {r.toFixed(1)} &times; (1 - 2<sup>-1/2</sup>) / (1 - 2
          <sup>-1/{mathN.toFixed(2)}</sup>)
        </p>
        <p className="font-mono text-zinc-400">= {corrR.toFixed(1)}px</p>

        {/* Comparison table */}
        <table className="mt-3 w-full text-left text-xs">
          <thead>
            <tr className="text-zinc-500">
              <th className="py-1 pr-4">Curve</th>
              <th className="py-1 pr-4">Radius</th>
              <th className="py-1 pr-4">Perceived Radius</th>
              <th className="py-1">Diff</th>
            </tr>
          </thead>
          <tbody className="font-mono text-zinc-300">
            <tr>
              <td className="py-1 pr-4" style={{ color: "var(--color-rounded-border)" }}>
                Circle
              </td>
              <td className="py-1 pr-4">{r.toFixed(1)}px</td>
              <td className="py-1 pr-4">{circlePerceived.toFixed(1)}px</td>
              <td className="py-1">{formatDiff(circleDiff)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4" style={{ color: "var(--color-squircle-border)" }}>
                Superellipse
              </td>
              <td className="py-1 pr-4">{r.toFixed(1)}px</td>
              <td className="py-1 pr-4">{superPerceived.toFixed(1)}px</td>
              <td className="py-1">{formatDiff(superDiff)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4" style={{ color: "var(--color-adjusted-border)" }}>
                Corrected
              </td>
              <td className="py-1 pr-4">{corrR.toFixed(1)}px</td>
              <td className="py-1 pr-4">{corrPerceived.toFixed(1)}px</td>
              <td className="py-1">{formatDiff(corrDiff)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
