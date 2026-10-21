import type { Point } from "../math";

const MAGENTA = "var(--color-squircle-border)";
const BLUE = "var(--color-rounded-border)";
const MARKER_RADIUS = 3;
const LINE_DOT_DIAMETER = (MARKER_RADIUS * 2) / 3;

// Sweep from the top tangent toward the diagonal. The blue marker stays one
// CSS radius from the reference center; the red marker follows the superellipse.
export default function RadiusComparison({
  radius,
  exponent,
  sweep,
  labelOpacity,
  corner,
}: {
  radius: number;
  exponent: number;
  sweep: number;
  labelOpacity: number;
  corner: Point;
}) {
  const center = { x: corner.x - radius, y: corner.y + radius };
  const angle = (sweep * Math.PI) / 4;
  const dx = Math.sin(angle);
  const dy = Math.cos(angle);
  const visualRadius = radius / (dx ** exponent + dy ** exponent) ** (1 / exponent);
  const red = { x: center.x + dx * visualRadius, y: center.y - dy * visualRadius };
  const blue = { x: center.x + dx * radius, y: center.y - dy * radius };
  const redNumberX = red.x + 18 * sweep;
  const blueNumberX = blue.x + 18 * sweep;
  const redNumberY = red.y - 9 + 6 * sweep;
  const blueNumberY = blue.y - 9 + 24 * sweep;
  const redLabelX = red.x + 6;
  const blueLabelX = blue.x + 6;

  return (
    <g data-radius-comparison="" fill="none" strokeLinecap="round" strokeLinejoin="round">
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
      />

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
            d={`M ${center.x} ${corner.y} A ${radius} ${radius} 0 0 1 ${blue.x} ${blue.y}`}
            fill="none"
            stroke={BLUE}
            strokeWidth={1.7}
          />
          <circle data-radius-point="css" cx={blue.x} cy={blue.y} r={MARKER_RADIUS} />
          <text x={blueNumberX} y={blueNumberY} textAnchor="middle" fontSize={10}>
            1.00
          </text>
          {labelOpacity > 0 && (
            <text
              data-radius-label="css"
              x={blueLabelX}
              y={blueNumberY + 16}
              textAnchor="start"
              fontSize={10}
              opacity={labelOpacity}
            >
              <tspan x={blueLabelX}>CSS</tspan>
              <tspan x={blueLabelX} dy={12}>
                radius
              </tspan>
            </text>
          )}
        </g>
      )}

      <g data-radius-marker="visual" fill={MAGENTA}>
        <circle data-radius-point="visual" cx={red.x} cy={red.y} r={MARKER_RADIUS} />
        <text x={redNumberX} y={redNumberY} textAnchor="middle" fontSize={10}>
          {(visualRadius / radius).toFixed(2)}
        </text>
        {labelOpacity > 0 && (
          <text
            data-radius-label="visual"
            x={redLabelX}
            y={redNumberY - 28}
            textAnchor="start"
            fontSize={10}
            opacity={labelOpacity}
          >
            <tspan x={redLabelX}>Visual</tspan>
            <tspan x={redLabelX} dy={12}>
              “radius”
            </tspan>
          </text>
        )}
      </g>
    </g>
  );
}
