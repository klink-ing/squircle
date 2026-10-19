import { useEffect, useState } from "react";
import { PILL_SHAPE_PROPERTIES as SHAPE } from "@klinking/squircle/pill-worklet";
import { refreshPills } from "../lib/pill-gallery";
import {
  DEFAULT_SHAPE,
  PINNED,
  PillShapeControls,
  Slider,
  shapeStyle,
  type PillShapeSettings,
} from "./PillControls";

/** What `squircle-pill-max-none` writes: no limit at all. */
const NO_LIMIT = "calc(infinity * 1px)";

/**
 * The controls for the max radius demo: the max radius, the pill's shape, and
 * whether to outline the fallback's rounded rectangle over each composer. All
 * of it is set on `<html>`, and every composer inherits it.
 */
export default function PillMaxRadiusControls() {
  const [max, setMax] = useState(25);
  const [none, setNone] = useState(false);
  const [shape, setShape] = useState<PillShapeSettings>(DEFAULT_SHAPE);
  const [showFallback, setShowFallback] = useState(false);

  // Open at half the one-line composer's height, so it looks as it always has.
  useEffect(() => {
    const oneLine = document.querySelector<HTMLElement>("[data-one-line]");
    if (oneLine) setMax(Math.round(oneLine.offsetHeight / 2));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(SHAPE.maxRadius.name, none ? NO_LIMIT : `${max}px`);
    for (const [name, value] of Object.entries(shapeStyle(shape))) {
      root.style.setProperty(name, String(value));
    }
    root.toggleAttribute("data-show-fallback", showFallback);
    refreshPills();
  }, [max, none, shape, showFallback]);

  return (
    <div className={`${PINNED} mb-10 grid max-w-xl gap-3`}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1 text-xs">
        <Slider
          id="max-radius"
          label="max radius"
          value={max}
          min={8}
          max={80}
          step={1}
          format={(v) => (none ? "none" : `${v}px`)}
          onChange={(v) => {
            setMax(v);
            setNone(false);
          }}
        />
        <span />
        <div className="col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-zinc-400">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={none} onChange={(e) => setNone(e.target.checked)} />
            None (squircle-pill-max-none)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showFallback}
              onChange={(e) => setShowFallback(e.target.checked)}
            />
            Show fallback
          </label>
        </div>
      </div>
      <PillShapeControls shape={shape} onChange={setShape} idPrefix="max-radius" />
    </div>
  );
}
