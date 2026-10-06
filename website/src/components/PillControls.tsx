import { PILL_SHAPE_PROPERTIES as SHAPE } from "@klinking/squircle/pill-worklet";

/** The pill's shape settings, as the controls hold them. */
export interface PillShapeSettings {
  amt: number;
  ease: number;
  continuity: number;
}

/** The package's own defaults, so every preview opens on the pill you get. */
export const DEFAULT_SHAPE: PillShapeSettings = {
  amt: SHAPE.amt.default,
  ease: SHAPE.ease.default,
  continuity: SHAPE.continuity.default,
};

/** The settings as the custom properties a pill reads, for a `style`. */
export const shapeStyle = (shape: PillShapeSettings): Record<string, number> => ({
  [SHAPE.amt.name]: shape.amt,
  [SHAPE.ease.name]: shape.ease,
  [SHAPE.continuity.name]: shape.continuity,
});

/**
 * Pinned to the top of the screen on small screens, where the pills scroll
 * out from under the controls otherwise; in the flow from `md` up.
 */
export const PINNED =
  "sticky top-0 z-10 -mx-4 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none";

export function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <>
      <label htmlFor={id} className="whitespace-nowrap text-zinc-400">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="slider-filled min-w-0"
      />
      <code className="text-right text-zinc-300">{format(value)}</code>
    </>
  );
}

/**
 * The three things a pill's shape can be told: how much of each cap is
 * eased, how far the easing runs along the edge, and its continuity. The
 * labels are the utilities that set them, and each control marks the
 * package's default.
 */
export function PillShapeControls({
  shape,
  onChange,
  idPrefix = "pill",
}: {
  shape: PillShapeSettings;
  onChange: (shape: PillShapeSettings) => void;
  idPrefix?: string;
}) {
  const isDefault =
    shape.amt === DEFAULT_SHAPE.amt &&
    shape.ease === DEFAULT_SHAPE.ease &&
    shape.continuity === DEFAULT_SHAPE.continuity;
  const defaultLabel = (value: number) => (value === DEFAULT_SHAPE.continuity ? " (default)" : "");
  return (
    <div className="grid content-start grid-cols-[auto_minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1 text-xs">
      <label htmlFor={`${idPrefix}-continuity`} className="text-zinc-400">
        continuity
      </label>
      <select
        id={`${idPrefix}-continuity`}
        value={shape.continuity}
        onChange={(e) => onChange({ ...shape, continuity: +e.target.value })}
        className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-zinc-200"
      >
        <option value={3}>G3 — squircle-pill-g3{defaultLabel(3)}</option>
        <option value={2}>G2 — squircle-pill-g2{defaultLabel(2)}</option>
      </select>
      <button
        type="button"
        onClick={() => onChange(DEFAULT_SHAPE)}
        disabled={isDefault}
        className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300 hover:border-indigo-500 disabled:opacity-40 disabled:hover:border-zinc-700"
      >
        reset
      </button>
      <Slider
        id={`${idPrefix}-amt`}
        label="squircle-pill-amt"
        value={shape.amt}
        min={1}
        max={4}
        step={0.05}
        format={(v) => v.toFixed(2)}
        onChange={(amt) => onChange({ ...shape, amt })}
      />
      <Slider
        id={`${idPrefix}-ease`}
        label="squircle-pill-ease"
        value={shape.ease}
        min={0}
        max={8}
        step={0.05}
        format={(v) => v.toFixed(2)}
        onChange={(ease) => onChange({ ...shape, ease })}
      />
    </div>
  );
}
