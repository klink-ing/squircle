import { useId, useMemo } from "react";
import RadiusComparison from "./RadiusComparison";
import {
  circleArcPoints,
  correctedRadius,
  perceivedRadius,
  pointsToPath,
  superellipsePoints,
} from "../math";

// Visibility values may be fractional opacities during transitions.
export interface ArcStyle {
  visible: boolean | number;
  showFill: boolean | number;
  showOutline: boolean | number;
}

export interface GraphicState {
  arcRounded: ArcStyle;
  arcSuperellipse: ArcStyle;
  correctionAmount: number; // 0 = uncorrected superellipse, 1 = fully corrected
  amount: number;
  showRefLine: boolean | number;
  showMeasurement: boolean | number;
  measureArc?: "rounded" | "superellipse" | "corrected";
  measureMode?: "perceived" | "radius";
  measureAngle?: "diagonal" | "edge"; // default: "diagonal"
  zoom: number;
  radiusComparison?: number;
  radiusSweep?: number;
  radiusLabels?: number;
  apparentRadius?: number;
}

const BOX = 180;
const PAD = 10;
const PAD_EXTRA = 40; // reserve room for serifs and radius labels in every scene
const cornerX = PAD + BOX; // 190
const cornerY = PAD; // 10
const DASH = "4 3";
const DASH_PERIOD = 7;
const SERIF_LEN = 14;
const SERIF_W = 1;

function arcToSvg(mathX: number, mathY: number, arcR: number) {
  return { x: cornerX - arcR + mathX, y: cornerY + arcR - mathY };
}

function buildCurvePath(points: { x: number; y: number }[]) {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return (
    `M ${cornerX} ${Math.max(PAD + BOX, first.y)} L ${first.x} ${first.y} ` +
    pointsToPath(points).slice(2) +
    ` L ${Math.min(PAD, last.x)} ${cornerY}`
  );
}

function closeCurvePath(path: string, points: { x: number; y: number }[]) {
  // Once the tangent points pass the box edges, close the fill outside the box.
  // Returning to the original corners would reverse the visible stroke.
  return `${path} L ${Math.min(PAD, points[points.length - 1]!.x)} ${Math.max(PAD + BOX, points[0]!.y)} Z`;
}

export default function ExplorerGraphic({
  arcRounded,
  arcSuperellipse,
  amount,
  showRefLine,
  showMeasurement,
  measureArc,
  measureMode = "radius",
  measureAngle = "diagonal",
  correctionAmount,
  zoom,
  radiusComparison = 0,
  radiusSweep = 0,
  radiusLabels = 0,
  apparentRadius = 0,
}: GraphicState) {
  const id = useId();
  const clipCircle = `${id}-clip-circle`;
  const clipSuper = `${id}-clip-super`;
  const clipBox = `${id}-clip-box`;

  const data = useMemo(() => {
    const mathN = Math.pow(2, amount);
    const r = BOX * zoom;
    const corrR = correctedRadius(r, mathN);

    // Interpolated superellipse radius based on correction amount
    const superR = r + correctionAmount * (corrR - r);

    // Circle arc points
    const circleRaw = circleArcPoints(r);
    const circleSvg = circleRaw.map((p) => arcToSvg(p.x, p.y, r));

    // Superellipse points (interpolated between uncorrected and corrected)
    const superRaw = superellipsePoints(superR, mathN);
    const superSvg = superRaw.map((p) => arcToSvg(p.x, p.y, superR));

    // Paths
    const circlePath = buildCurvePath(circleSvg);
    const superPath = buildCurvePath(superSvg);
    const circleFillPath = closeCurvePath(circlePath, circleSvg);
    const superFillPath = closeCurvePath(superPath, superSvg);
    const superOutlineLength =
      Math.max(0, PAD + BOX - superSvg[0]!.y) +
      superSvg.slice(1).reduce((length, point, index) => {
        const previous = superSvg[index]!;
        return length + Math.hypot(point.x - previous.x, point.y - previous.y);
      }, 0) +
      Math.max(0, superSvg[superSvg.length - 1]!.x - PAD);
    const superOutlineGap =
      Math.max(PAD + BOX, superSvg[0]!.y) -
      cornerY +
      cornerX -
      Math.min(PAD, superSvg[superSvg.length - 1]!.x) +
      1;

    // Interior clip: same shape as the curve path, closed
    const circleClip = circlePath + " Z";
    const superClip = superPath + " Z";

    // Determine z-order: superellipse above circle when its perceived radius
    // is smaller (curve closer to corner), below when larger (curve past circle)
    const circlePerceived = perceivedRadius(r, r, 2);
    const superPerceived = perceivedRadius(r, superR, mathN);
    const superAboveCircle = superPerceived <= circlePerceived;

    // Measurement line data
    let measure: {
      x1: number;
      y1: number;
      endX: number;
      endY: number;
      ratio: number;
      cssVar: string;
    } | null = null;
    if (measureArc) {
      const arcR = measureArc === "corrected" ? superR : r;
      const n = measureArc === "rounded" ? 2 : mathN;
      let x1: number, y1: number, endX: number, endY: number, lineLen: number;
      const centerX = cornerX - arcR;
      const centerY = cornerY + arcR;
      if (measureMode === "radius") {
        x1 = centerX;
        y1 = centerY;
        if (measureAngle === "edge") {
          // Horizontal: from arc center to right edge
          endX = centerX + arcR;
          endY = centerY;
        } else {
          // Diagonal: from arc center outward along 45°
          endX = centerX + arcR / Math.SQRT2;
          endY = centerY - arcR / Math.SQRT2;
        }
        lineLen = arcR;
      } else {
        // Perceived mode
        const d = arcR * (1 - Math.pow(2, -1 / n));
        if (measureAngle === "edge") {
          // Horizontal: from right edge inward by the junction offset
          const junctionX = cornerX - arcR + superellipsePoints(arcR, n, 1)[0]!.x;
          x1 = cornerX;
          y1 = cornerY + arcR;
          endX = junctionX;
          endY = cornerY + arcR;
          lineLen = cornerX - junctionX;
        } else {
          // Diagonal: from corner to curve apex
          x1 = cornerX;
          y1 = cornerY;
          endX = cornerX - d;
          endY = cornerY + d;
          lineLen = Math.sqrt(2) * d;
        }
      }
      const ratio = lineLen / r;
      const cssVar =
        measureArc === "rounded"
          ? "--color-rounded-border"
          : measureArc === "superellipse"
            ? "--color-squircle-border"
            : "--color-adjusted-border";
      measure = { x1, y1, endX, endY, ratio, cssVar };
    }

    return {
      mathN,
      r,
      superR,
      circleSvg,
      superSvg,
      circlePath,
      superPath,
      circleFillPath,
      superFillPath,
      superOutlineLength,
      superOutlineGap,
      circleClip,
      superClip,
      superAboveCircle,
      measure,
      // Reference line: circle arc center outward at 45° toward corner (length = r)
      refLine: {
        x1: cornerX - r,
        y1: cornerY + r,
        x2: cornerX - r + r / Math.SQRT2,
        y2: cornerY + r - r / Math.SQRT2,
      },
    };
  }, [amount, measureArc, measureMode, measureAngle, zoom, correctionAmount]);

  const {
    circleSvg,
    superSvg,
    circlePath,
    superPath,
    circleFillPath,
    superFillPath,
    superOutlineLength,
    superOutlineGap,
    circleClip,
    superClip,
    superAboveCircle,
    measure,
    refLine,
    r,
    superR,
    mathN,
  } = data;

  return (
    <svg
      role="img"
      aria-label={
        radiusComparison > 0
          ? apparentRadius > 0
            ? "A smaller blue circular corner matches the magenta superellipse at 45 degrees, comparing CSS and apparent radii."
            : radiusSweep === 0
              ? "A vertical dotted radius with a magenta endpoint labeled 1.00."
              : "CSS and visual radius markers sweeping from vertical to the diagonal."
          : "Comparison of rounded and superellipse corners"
      }
      viewBox={`${PAD} ${PAD - PAD_EXTRA} ${BOX + PAD_EXTRA} ${BOX + PAD_EXTRA}`}
      className="w-full max-w-md"
      // Preserve annotation space above/right, but crop at the shape's left/bottom edges.
      style={{ overflow: "visible", clipPath: "inset(-100% -100% 0 0)" }}
    >
      <defs>
        <clipPath id={clipBox}>
          <rect x={PAD - 0.85} y={PAD - 0.85} width={BOX + 1.7} height={BOX + 1.7} />
        </clipPath>
        <clipPath id={clipCircle}>
          <path d={circleClip} />
        </clipPath>
        <clipPath id={clipSuper}>
          <path d={superClip} />
        </clipPath>
      </defs>

      {/* Superellipse and circle — z-order swaps when superellipse crosses circle */}
      {(() => {
        const correctionPercent =
          Math.min(1, Math.max(0, correctionAmount)) * (1 - radiusComparison) * 100;
        const superFillColor = `color-mix(in srgb, var(--color-adjusted-fill) ${correctionPercent}%, var(--color-squircle-fill))`;
        const superStrokeColor = `color-mix(in srgb, var(--color-adjusted-border) ${correctionPercent}%, var(--color-squircle-border))`;

        const superellipseGroup = (
          <g key="super" opacity={Number(arcSuperellipse.visible)}>
            <g style={{ color: superStrokeColor }}>
              {/* One persistent shape: fade its fill and solid outline independently. */}
              <path
                data-radius-outline="visual"
                d={superFillPath}
                style={{ fill: superFillColor }}
                fillOpacity={Number(arcSuperellipse.showFill)}
                stroke="currentColor"
                strokeWidth={1.7}
                // Keep the fill closed, but leave the left/bottom closure unstroked.
                strokeDasharray={`${superOutlineLength} ${superOutlineGap}`}
                strokeOpacity={radiusComparison}
                strokeLinejoin="round"
                clipPath={`url(#${clipBox})`}
              />
              {/* Stroke — crossfades in/out */}
              <g opacity={Number(arcSuperellipse.showOutline)}>
                <path
                  d={superPath}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeDasharray={DASH}
                  strokeDashoffset={-DASH_PERIOD / 3}
                  clipPath={`url(#${clipSuper})`}
                />
                <line
                  x1={superSvg[0]!.x}
                  y1={superSvg[0]!.y - SERIF_W / 2}
                  x2={superSvg[0]!.x + SERIF_LEN}
                  y2={superSvg[0]!.y - SERIF_W / 2}
                  stroke="currentColor"
                  strokeWidth={SERIF_W}
                />
                <line
                  x1={superSvg[superSvg.length - 1]!.x + SERIF_W / 2}
                  y1={superSvg[superSvg.length - 1]!.y}
                  x2={superSvg[superSvg.length - 1]!.x + SERIF_W / 2}
                  y2={superSvg[superSvg.length - 1]!.y - SERIF_LEN}
                  stroke="currentColor"
                  strokeWidth={SERIF_W}
                />
              </g>
            </g>
          </g>
        );

        const circleGroup = (
          <g key="circle" opacity={Number(arcRounded.visible)}>
            {/* Fill — crossfades in/out */}
            <path
              d={circleFillPath}
              style={{ fill: "var(--color-rounded-fill)" }}
              stroke="none"
              opacity={Number(arcRounded.showFill)}
            />
            {/* Stroke — crossfades in/out */}
            <g opacity={Number(arcRounded.showOutline)}>
              <path
                d={circlePath}
                fill="none"
                style={{ stroke: "var(--color-rounded-border)" }}
                strokeWidth={3}
                strokeDasharray={DASH}
                strokeDashoffset={0}
                clipPath={`url(#${clipCircle})`}
              />
              <line
                x1={circleSvg[0]!.x}
                y1={circleSvg[0]!.y - SERIF_W / 2}
                x2={circleSvg[0]!.x - SERIF_LEN}
                y2={circleSvg[0]!.y - SERIF_W / 2}
                style={{ stroke: "var(--color-rounded-border)" }}
                strokeWidth={SERIF_W}
              />
              <line
                x1={circleSvg[circleSvg.length - 1]!.x + SERIF_W / 2}
                y1={circleSvg[circleSvg.length - 1]!.y}
                x2={circleSvg[circleSvg.length - 1]!.x + SERIF_W / 2}
                y2={circleSvg[circleSvg.length - 1]!.y + SERIF_LEN}
                style={{ stroke: "var(--color-rounded-border)" }}
                strokeWidth={SERIF_W}
              />
            </g>
          </g>
        );

        return superAboveCircle ? (
          <>
            {circleGroup}
            {superellipseGroup}
          </>
        ) : (
          <>
            {superellipseGroup}
            {circleGroup}
          </>
        );
      })()}

      {/* Animated diagonal line — morphs between reference line and measurement line */}
      {(() => {
        const visible = Math.max(Number(showRefLine), measure ? Number(showMeasurement) : 0);
        // When measurement is active, use measurement coords; otherwise use reference line
        const useMeasure = showMeasurement && measure;
        const x1 = useMeasure ? measure!.x1 : refLine.x1;
        const y1 = useMeasure ? measure!.y1 : refLine.y1;
        const x2 = useMeasure ? measure!.endX : refLine.x2;
        const y2 = useMeasure ? measure!.endY : refLine.y2;
        const serifLen = useMeasure ? 24 : 5;
        const label = useMeasure ? measure!.ratio.toFixed(2) : "1";

        // Compute perpendicular direction for serif
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const perpX = -dy / len; // perpendicular unit vector
        const perpY = dx / len;

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const svgW = PAD * 2 + BOX;
        const nearTop = midY - 6 < 12;
        const nearRight = midX + 6 + 24 > svgW;
        const lx = nearRight ? midX - 28 : midX + 6;
        const ly = nearTop ? midY + 12 : midY - 6;

        const correctionPercent = Math.min(1, Math.max(0, correctionAmount)) * 100;
        const strokeColor =
          useMeasure && measureArc === "corrected"
            ? `color-mix(in srgb, var(--color-adjusted-border) ${correctionPercent}%, var(--color-rounded-border))`
            : useMeasure
              ? `var(${measure!.cssVar})`
              : "var(--color-rounded-border)";

        return (
          <g opacity={Number(visible)}>
            <g style={{ color: strokeColor }}>
              {/* Main diagonal line */}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth={0.75}
                strokeDasharray="1 4"
                strokeLinecap="round"
              />
              {/* Perpendicular serif at the end point */}
              <line
                x1={x2 - serifLen * perpX}
                y1={y2 - serifLen * perpY}
                x2={x2 + serifLen * perpX}
                y2={y2 + serifLen * perpY}
                stroke="currentColor"
                strokeWidth={0.75}
              />
              {/* Label */}
              <text x={lx} y={ly} fill="currentColor" fontSize={9} className="text-zinc-400">
                {label}
              </text>
            </g>
          </g>
        );
      })()}
      {radiusComparison > 0 && (
        <g opacity={radiusComparison} aria-hidden="true">
          <RadiusComparison
            radius={r}
            cssRadius={superR}
            labelMinX={PAD}
            exponent={mathN}
            sweep={radiusSweep}
            labelOpacity={radiusLabels}
            apparentProgress={apparentRadius}
            corner={{ x: cornerX, y: cornerY }}
          />
        </g>
      )}
    </svg>
  );
}
