import { useEffect, useMemo, useRef, useState } from "react";
import { paintDef as PillShape } from "@klinking/squircle/pill-shape.worklet";
import { filletQuadrant, readParams } from "../lib/pill-fillet.worklet.js";
import filletWorkletUrl from "../lib/pill-fillet.worklet.js?url";

const W = 320;
const H = 80;
const R = H / 2;
const NS = "--squircle-pill";
const FILLET_ATTRIBUTE = "data-pill-fillet";

type Point = { x: number; y: number };

/** A quadrant of an outline, from the leftmost point to the flat top edge. */
interface Quadrant {
  points: Point[];
  /** Index of the last vertex on the circular arc. */
  join: number;
  capRadius: number;
  edgeStart: number;
}

const propsFrom = (values: Record<string, string | number>) => ({
  get: (name: string) =>
    values[name] === undefined ? undefined : { toString: () => String(values[name]) },
});

// ── Measurement ─────────────────────────────────────────────────

/** Menger curvature at b. */
function menger(a: Point, b: Point, c: Point): number {
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const bc = Math.hypot(c.x - b.x, c.y - b.y);
  const ca = Math.hypot(a.x - c.x, a.y - c.y);
  if (ab === 0 || bc === 0 || ca === 0) return 0;
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return (2 * Math.abs(cross)) / (ab * bc * ca);
}

function profile({ points }: Quadrant): { s: number[]; k: number[] } {
  const s = [0];
  for (let i = 1; i < points.length; i++) {
    s.push(s[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const k = points.map((_, i) =>
    i === 0 || i === points.length - 1 ? 0 : menger(points[i - 1], points[i], points[i + 1]),
  );
  k[0] = k[1];
  return { s, k };
}

function stats(q: Quadrant): Record<string, string> {
  const { points, join } = q;
  const { s, k } = profile(q);
  let peakRate = 0;
  for (let i = join + 1; i + 1 < points.length - 1; i++) {
    const ds = s[i + 1] - s[i];
    if (ds > 1e-9) peakRate = Math.max(peakRate, Math.abs(k[i + 1] - k[i]) / ds);
  }
  const last = points[points.length - 1];
  const before = points[points.length - 2];
  const arrival = Math.abs((Math.atan2(last.y - before.y, last.x - before.x) * 180) / Math.PI);
  const jump = join + 1 < k.length ? Math.abs(k[join] - k[join + 1]) : 0;
  const overshoot = Math.max(0, ...points.map((p) => Math.max(-p.y, -p.x, p.x - W / 2)));
  return {
    "cap radius / r": (q.capRadius / R).toFixed(3),
    "flat edge starts at x / r": (q.edgeStart / R).toFixed(2),
    "Δκ·R at arc join": (jump * R).toFixed(3),
    "peak |dκ/ds|·R² in join": (peakRate * R * R).toFixed(2),
    "arrives at edge at": `${arrival.toFixed(2)}°`,
    "leaves the box by": overshoot > 0.01 ? `${overshoot.toFixed(2)}px` : "0 (fits)",
  };
}

// ── Geometry, from the worklets themselves ──────────────────────

function spiralQuadrant(amt: number, spread: number, continuity: number): Quadrant {
  const worklet = new PillShape();
  const props = propsFrom({
    [`${NS}-amt`]: amt,
    [`${NS}-ease-spread`]: spread,
    [`${NS}-continuity`]: continuity,
  });
  const points = worklet.fittedQuadrant(
    W,
    H,
    worklet.resolveEase(props),
    worklet.resolveExponent(props),
    worklet.resolveContinuity(props),
  );
  // The arc is the run of vertices on one circle from the start.
  const k0 = menger(points[0], points[1], points[2]);
  let join = points.length - 1;
  for (let i = 1; i + 1 < points.length; i++) {
    if (Math.abs(menger(points[i - 1], points[i], points[i + 1]) - k0) > 0.01 * k0) {
      join = i - 1;
      break;
    }
  }
  return { points, join, capRadius: 1 / k0, edgeStart: points[points.length - 1].x };
}

function hermiteQuadrant(values: Record<string, string | number>): Quadrant {
  const { arc, blend, edgeStart, capRadius } = filletQuadrant(
    R,
    W / 2,
    readParams(propsFrom(values)),
  );
  return { points: [...arc, ...blend], join: arc.length - 1, capRadius, edgeStart };
}

// ── Drawing ─────────────────────────────────────────────────────

const polyline = (pts: Point[]) => pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

function Comb({ q, colour }: { q: Quadrant; colour: string }) {
  const { points, join } = q;
  const { k } = profile(q);
  const combScale = 0.7 * R;
  const right = Math.min(Math.max(q.edgeStart + 0.6 * R, 2 * R), W / 2);
  const teeth: string[] = [];
  for (let i = 1; i + 1 < points.length; i++) {
    const t = { x: points[i + 1].x - points[i - 1].x, y: points[i + 1].y - points[i - 1].y };
    const len = Math.hypot(t.x, t.y) || 1;
    const n = { x: t.y / len, y: -t.x / len };
    const h = k[i] * R * combScale;
    teeth.push(
      `M${points[i].x.toFixed(2)},${points[i].y.toFixed(2)}l${(n.x * h).toFixed(2)},${(n.y * h).toFixed(2)}`,
    );
  }
  const mirrored = [...points].reverse().map((p) => ({ x: p.x, y: H - p.y }));
  const j = points[join];
  return (
    <svg
      className="block h-auto w-full"
      viewBox={`${-combScale - 4} ${-combScale - 4} ${right + combScale + 8} ${H + combScale + 8}`}
      aria-label="curvature comb"
    >
      <rect
        x={0}
        y={0}
        width={right}
        height={H}
        fill="none"
        stroke="#3f3f46"
        strokeDasharray="3 3"
      />
      <path d={teeth.join("")} stroke={colour} opacity={0.55} strokeWidth={0.6} fill="none" />
      <polyline
        points={polyline([...points, ...mirrored])}
        fill="none"
        stroke="#f4f4f5"
        strokeWidth={1.2}
      />
      <circle cx={j.x} cy={j.y} r={1.8} fill={colour} />
      <circle cx={j.x} cy={H - j.y} r={1.8} fill={colour} />
    </svg>
  );
}

function Plot({ q, colour }: { q: Quadrant; colour: string }) {
  const { s, k } = profile(q);
  const total = s[s.length - 1] || 1;
  const PW = 320;
  const PH = 90;
  const pad = 6;
  const x = (v: number) => pad + ((PW - 2 * pad) * v) / total;
  const y = (v: number) => PH - pad - ((PH - 2 * pad) * Math.min(v * R, 1.15)) / 1.15;
  const pts = s.map((v, i) => ({ x: x(v), y: y(k[i]) }));
  return (
    <svg
      className="block h-auto w-full"
      viewBox={`0 0 ${PW} ${PH}`}
      aria-label="curvature against arc length"
    >
      <line x1={x(0)} y1={y(1)} x2={x(total)} y2={y(1)} stroke="#3f3f46" />
      <line x1={x(0)} y1={y(0)} x2={x(total)} y2={y(0)} stroke="#71717a" />
      <line
        x1={x(s[q.join])}
        y1={y(0)}
        x2={x(s[q.join])}
        y2={y(1.15)}
        stroke={colour}
        strokeDasharray="2 2"
      />
      <polyline points={polyline(pts)} fill="none" stroke={colour} strokeWidth={1.5} />
      <text x={x(0) + 2} y={y(1) - 2} fontSize={8} fill="#a1a1aa">
        κ·R = 1 (the arc)
      </text>
      <text x={x(total) - 2} y={y(0) - 2} fontSize={8} fill="#a1a1aa" textAnchor="end">
        arc length → 0 = flat edge
      </text>
    </svg>
  );
}

function Stats({ values }: { values: Record<string, string> }) {
  return (
    <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-xs">
      {Object.entries(values).map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="text-zinc-500">{name}</dt>
          <dd className="text-right font-mono text-zinc-300">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Slider({
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
      <label htmlFor={id} className="text-zinc-400">
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
        className="slider-filled"
      />
      <code className="text-right text-zinc-300">{format(value)}</code>
    </>
  );
}

// ── The page ────────────────────────────────────────────────────

export default function PillAlgorithmsDemo() {
  const [amt, setAmt] = useState(2);
  const [spread, setSpread] = useState(1);
  const [spiralContinuity, setSpiralContinuity] = useState(2);
  const [continuity, setContinuity] = useState(2);
  const [fit, setFit] = useState(true);
  const [arcSetback, setArcSetback] = useState(30);
  const [edgeSetback, setEdgeSetback] = useState(1);
  const [bulgeStart, setBulgeStart] = useState(1);
  const [bulgeEnd, setBulgeEnd] = useState(1);

  // The demo worklet is registered here rather than in the layout: it is
  // this page's alone. Gated on its own attribute, like the shipped one.
  const registered = useRef(false);
  useEffect(() => {
    if (registered.current || !("paintWorklet" in CSS)) return;
    registered.current = true;
    CSS.paintWorklet
      .addModule(filletWorkletUrl)
      .then(() => document.documentElement.setAttribute(FILLET_ATTRIBUTE, ""))
      .catch((error: unknown) => console.error("pill-fillet worklet failed to load:", error));
  }, []);

  const filletValues = useMemo(
    () => ({
      "--fillet-continuity": continuity,
      "--fillet-arc-setback": arcSetback,
      "--fillet-edge-setback": edgeSetback,
      "--fillet-bulge-start": bulgeStart,
      "--fillet-bulge-end": bulgeEnd,
      "--fillet-fit": fit ? 1 : 0,
    }),
    [continuity, arcSetback, edgeSetback, bulgeStart, bulgeEnd, fit],
  );

  const spiral = useMemo(
    () => spiralQuadrant(amt, spread, spiralContinuity),
    [amt, spread, spiralContinuity],
  );
  const hermite = useMemo(() => hermiteQuadrant(filletValues), [filletValues]);

  const spiralStyle = {
    [`${NS}-amt`]: amt,
    [`${NS}-ease-spread`]: spread,
    [`${NS}-continuity`]: spiralContinuity,
  } as React.CSSProperties;
  const filletStyle = filletValues as unknown as React.CSSProperties;

  return (
    <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-zinc-200">
          Power-law spiral easing — this package
        </h3>
        <p className="mb-3 text-xs text-zinc-500">
          Curvature falls from <code>1/R</code> to <code>0</code> as{" "}
          <code>
            u<sup>q−1</sup>
          </code>{" "}
          along the arc length — a clothoid at <code>q = 2</code> — and the cap radius is solved so
          the outline fits the box exactly. The G3 profile,{" "}
          <code>
            (1 − t²)<sup>q−1</sup>
          </code>
          , also leaves the arc with curvature flat, and arrives flat at the edge for any spread
          above 0.
        </p>
        <div className="grid grid-cols-[auto_1fr_3.5rem] items-center gap-x-3 gap-y-1 text-xs">
          <label htmlFor="s-continuity" className="text-zinc-400">
            continuity
          </label>
          <select
            id="s-continuity"
            value={spiralContinuity}
            onChange={(e) => setSpiralContinuity(+e.target.value)}
            className="col-span-2 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-zinc-200"
          >
            <option value={2}>G2 — squircle-pill-g2 (default)</option>
            <option value={3}>G3 — squircle-pill-g3</option>
          </select>
          <Slider
            id="s-amt"
            label="squircle-pill-amt"
            value={amt}
            min={1}
            max={4}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={setAmt}
          />
          <Slider
            id="s-spread"
            label="squircle-pill-spread"
            value={spread}
            min={-2}
            max={8}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={setSpread}
          />
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-zinc-200">
          Hermite blend — CAD-style fillet
        </h3>
        <p className="mb-3 text-xs text-zinc-500">
          The construction behind SolidWorks and Onshape's "curvature continuous", Fusion's G2 and
          Rhino's <code>BlendCrv</code>: a polynomial with position, tangent and curvature
          prescribed at both ends. Fitted, the cap radius is shrunk until the blend stays inside the
          box, as the spiral's is, so the two differ only in the transition. Unfitted, the cap keeps
          its full radius, as a dimensioned CAD fillet would — and since an easing turns more slowly
          than the arc it leaves, it has to bow out past the box to finish turning.
        </p>
        <div className="grid grid-cols-[auto_1fr_3.5rem] items-center gap-x-3 gap-y-1 text-xs">
          <label htmlFor="f-continuity" className="text-zinc-400">
            continuity
          </label>
          <select
            id="f-continuity"
            value={continuity}
            onChange={(e) => setContinuity(+e.target.value)}
            className="col-span-2 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-zinc-200"
          >
            <option value={1}>G1 — cubic (tangent only; SolidWorks/Onshape "circular")</option>
            <option value={2}>G2 — quintic (curvature; "curvature continuous")</option>
            <option value={3}>G3 — septic (curvature rate; Rhino BlendCrv G3)</option>
          </select>
          <label htmlFor="f-fit" className="text-zinc-400">
            fit to box
          </label>
          <input
            id="f-fit"
            type="checkbox"
            checked={fit}
            onChange={(e) => setFit(e.target.checked)}
            className="col-span-2 h-4 w-4 justify-self-start accent-indigo-500"
          />
          <Slider
            id="f-arc"
            label="arc setback°"
            value={arcSetback}
            min={0}
            max={89}
            step={1}
            format={(v) => String(v)}
            onChange={setArcSetback}
          />
          <Slider
            id="f-edge"
            label="edge setback ×r"
            value={edgeSetback}
            min={0}
            max={3}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={setEdgeSetback}
          />
          <Slider
            id="f-bulge0"
            label="bulge, arc end"
            value={bulgeStart}
            min={0.2}
            max={3}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={setBulgeStart}
          />
          <Slider
            id="f-bulge1"
            label="bulge, edge end"
            value={bulgeEnd}
            min={0.2}
            max={3}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={setBulgeEnd}
          />
        </div>
      </div>

      <div
        className="squircle-pill bg-demo-squircle"
        style={{ ...spiralStyle, width: W, height: H }}
      />
      <div className="pill-fillet bg-demo-plain" style={{ ...filletStyle, width: W, height: H }} />

      <Comb q={spiral} colour="#db2777" />
      <Comb q={hermite} colour="#818cf8" />

      <Plot q={spiral} colour="#db2777" />
      <Plot q={hermite} colour="#818cf8" />

      <Stats values={stats(spiral)} />
      <Stats values={stats(hermite)} />
    </div>
  );
}
