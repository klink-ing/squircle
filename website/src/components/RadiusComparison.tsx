import { useId } from "react";
import { correctedRadius, type Point } from "../math";

const MAGENTA = "var(--color-squircle-border)";
const BLUE = "var(--color-rounded-border)";
const MARKER_RADIUS = 3;
const LINE_DOT_DIAMETER = (MARKER_RADIUS * 2) / 3;
const TEXT_LINE_HEIGHT = 12;

// Sweep from the top tangent toward the diagonal. The blue marker stays one
// CSS radius from the reference center; the red marker follows the superellipse.
export default function RadiusComparison({
  radius,
  exponent,
  sweep,
  labelOpacity,
  apparentProgress,
  corner,
}: {
  radius: number;
  exponent: number;
  sweep: number;
  labelOpacity: number;
  apparentProgress: number;
  corner: Point;
}) {
  const sharedDotGradient = useId();
  const center = { x: corner.x - radius, y: corner.y + radius };
  const angle = (sweep * Math.PI) / 4;
  const dx = Math.sin(angle);
  const dy = Math.cos(angle);
  const visualRadius = radius / (dx ** exponent + dy ** exponent) ** (1 / exponent);
  const red = { x: center.x + dx * visualRadius, y: center.y - dy * visualRadius };
  // Invert the package's correction: this circle has the same diagonal inset
  // as the uncorrected superellipse, while sharing its top/right edges.
  const apparent = radius / correctedRadius(1, exponent);
  const blueRadius = radius + (apparent - radius) * apparentProgress;
  const blueCenter = { x: corner.x - blueRadius, y: corner.y + blueRadius };
  const blueAngle = (sweep * Math.PI) / 4;
  const blue = {
    x: blueCenter.x + Math.sin(blueAngle) * blueRadius,
    y: blueCenter.y - Math.cos(blueAngle) * blueRadius,
  };
  const redNumberX = red.x + 18 * sweep;
  const blueNumberX = blue.x + 6;
  const redNumberY = red.y - 9 + 6 * sweep;
  const blueNumberY = blue.y - 9 + 24 * sweep * (1 - apparentProgress);
  const redLabelX = red.x + 6;
  const blueLabelX = blueNumberX;
  const specified = { x: center.x, y: corner.y };
  const blueTop = { x: blueCenter.x, y: corner.y };
  const magentaDots = [
    specified,
    ...(sweep > 0 ? [red] : []),
    ...(apparentProgress > 0 ? [center] : []),
  ];
  const blueDots = sweep > 0 ? [blue, ...(apparentProgress > 0 ? [blueCenter, blueTop] : [])] : [];
  const dotPaint = (point: Point, color: string) => {
    const others = color === MAGENTA ? blueDots : magentaDots;
    // Ignore floating-point noise, without merging dots that are merely close.
    const shared = others.some((other) => Math.hypot(point.x - other.x, point.y - other.y) < 1e-6);
    return {
      fill: shared ? `url(#${sharedDotGradient})` : color,
      "data-radius-shared": shared ? "" : undefined,
    };
  };

  return (
    <g data-radius-comparison="" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id={sharedDotGradient} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="50%" stopColor={BLUE} />
          <stop offset="50%" stopColor={MAGENTA} />
        </linearGradient>
      </defs>
      {sweep > 0 && (
        <line
          data-radius-axis="origin"
          x1={center.x}
          y1={center.y}
          x2={center.x}
          y2={corner.y}
          stroke="#e4e4e7"
          strokeWidth={LINE_DOT_DIAMETER}
          strokeDasharray={`0 ${MARKER_RADIUS * 2.5}`}
          opacity={0.25}
        />
      )}
      {apparentProgress > 0 && (
        <g data-apparent-construction="" opacity={apparentProgress}>
          <circle
            data-radius-center="css"
            cx={center.x}
            cy={center.y}
            r={MARKER_RADIUS}
            {...dotPaint(center, MAGENTA)}
          />
          <g
            stroke={BLUE}
            strokeWidth={LINE_DOT_DIAMETER}
            strokeDasharray={`0 ${MARKER_RADIUS * 2.5}`}
          >
            <line
              data-radius-axis="apparent-vertical"
              x1={blueCenter.x}
              y1={blueCenter.y}
              x2={blueCenter.x}
              y2={corner.y}
            />
            <line
              data-radius-axis="apparent-diagonal"
              x1={blueCenter.x}
              y1={blueCenter.y}
              x2={blue.x}
              y2={blue.y}
            />
          </g>
          <circle
            data-radius-center="apparent"
            cx={blueCenter.x}
            cy={blueCenter.y}
            r={MARKER_RADIUS}
            {...dotPaint(blueCenter, BLUE)}
          />
          <circle
            data-radius-point="apparent-top"
            cx={blueCenter.x}
            cy={corner.y}
            r={MARKER_RADIUS}
            {...dotPaint(blueTop, BLUE)}
          />
        </g>
      )}
      <line
        data-radius-axis="visual"
        x1={center.x}
        y1={center.y}
        x2={red.x}
        y2={red.y}
        stroke="#e4e4e7"
        // Round caps make circular dots one-third of the endpoint diameter.
        strokeWidth={LINE_DOT_DIAMETER}
        strokeDasharray={`0 ${MARKER_RADIUS * 2.5}`}
        opacity={1 - 0.75 * apparentProgress}
      />

      <g data-radius-marker="specified" fill={MAGENTA}>
        <circle
          data-radius-point="specified"
          cx={center.x}
          cy={corner.y}
          r={MARKER_RADIUS}
          {...dotPaint(specified, MAGENTA)}
        />
        <text
          data-radius-number="specified"
          x={center.x}
          y={corner.y - 9}
          textAnchor="middle"
          fontSize={10}
        >
          1.00
        </text>
        <text
          data-radius-label="specified"
          x={center.x}
          y={corner.y - 23}
          textAnchor="middle"
          fontSize={10}
        >
          CSS Radius
        </text>
      </g>

      {sweep > 0 && (
        <line
          data-radius-start-tick=""
          x1={center.x}
          y1={corner.y}
          x2={center.x}
          y2={corner.y - 8 * Math.min(1, sweep * 4)}
          stroke={MAGENTA}
          strokeWidth={1.7}
        />
      )}

      {/* Blue is not mounted until the sweep actually starts. It is painted
          first so coincident markers and numbers sit underneath their red twins. */}
      {sweep > 0 && (
        <g data-radius-marker="css" fill={BLUE}>
          <path
            data-radius-outline="css"
            d={`M ${blueCenter.x} ${corner.y} A ${blueRadius} ${blueRadius} 0 0 1 ${blue.x} ${blue.y}`}
            fill="none"
            stroke={BLUE}
            strokeWidth={1.7}
          />
          <circle
            data-radius-point="css"
            cx={blue.x}
            cy={blue.y}
            r={MARKER_RADIUS}
            {...dotPaint(blue, BLUE)}
          />
          <text
            data-radius-number="blue"
            x={blueNumberX}
            y={blueNumberY}
            textAnchor="start"
            fontSize={10}
          >
            {(blueRadius / radius).toFixed(2)}
          </text>
          {labelOpacity > 0 && (
            <text
              data-radius-label="css"
              x={blueLabelX}
              y={blueNumberY + 16}
              textAnchor="start"
              fontSize={10}
              opacity={labelOpacity * (1 - apparentProgress)}
            >
              <tspan x={blueLabelX}>CSS</tspan>
              <tspan x={blueLabelX} dy={TEXT_LINE_HEIGHT}>
                radius
              </tspan>
            </text>
          )}
          {apparentProgress > 0 && (
            <text
              data-radius-label="apparent"
              x={blueLabelX}
              y={blueNumberY - 2 * TEXT_LINE_HEIGHT}
              textAnchor="start"
              fontSize={10}
              opacity={apparentProgress}
            >
              <tspan x={blueLabelX}>Apparent</tspan>
              <tspan x={blueLabelX} dy={TEXT_LINE_HEIGHT}>
                Radius
              </tspan>
            </text>
          )}
        </g>
      )}

      {sweep > 0 && (
        <g data-radius-marker="visual" fill={MAGENTA}>
          <circle
            data-radius-point="visual"
            cx={red.x}
            cy={red.y}
            r={MARKER_RADIUS}
            {...dotPaint(red, MAGENTA)}
          />
          <text
            data-radius-number="magenta"
            x={redNumberX}
            y={redNumberY}
            textAnchor="middle"
            fontSize={10}
            opacity={1 - apparentProgress}
          >
            {(visualRadius / radius).toFixed(2)}
          </text>
          {labelOpacity > 0 && (
            <text
              data-radius-label="visual"
              x={redLabelX}
              y={redNumberY - 16}
              textAnchor="start"
              fontSize={10}
              opacity={labelOpacity * (1 - apparentProgress)}
            >
              ???
            </text>
          )}
        </g>
      )}
    </g>
  );
}
