import type { Point } from "../math";

const MAGENTA = "var(--color-squircle-border)";
const BLUE = "var(--color-rounded-border)";
const MARKER_RADIUS = 3;

// Sweep from the top tangent toward the diagonal. The blue marker stays one
// CSS radius from the reference center; the red marker follows the superellipse.
export default function RadiusComparison({
  radius,
  exponent,
  sweep,
  labelOpacity,
  corner,
  superellipsePath,
}: {
  radius: number;
  exponent: number;
  sweep: number;
  labelOpacity: number;
  corner: Point;
  superellipsePath: string;
}) {
  const center = { x: corner.x - radius, y: corner.y + radius };
  const angle = (sweep * Math.PI) / 4;
  const dx = Math.sin(angle);
  const dy = Math.cos(angle);
  const visualRadius = radius / (dx ** exponent + dy ** exponent) ** (1 / exponent);
  const red = { x: center.x + dx * visualRadius, y: center.y - dy * visualRadius };
  const blue = { x: center.x + dx * radius, y: center.y - dy * radius };
  const redNumberY = red.y - 9;
  const blueNumberY = blue.y - 9 + 24 * sweep;

  return (
    <g data-radius-comparison="" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path
        data-radius-outline="visual"
        d={superellipsePath}
        stroke={MAGENTA}
        fill={MAGENTA}
        fillOpacity={0.2}
        strokeWidth={1.7}
      />
      <line
        data-radius-axis="visual"
        x1={center.x}
        y1={center.y}
        x2={red.x}
        y2={red.y}
        stroke="#e4e4e7"
        // Zero-length round-capped dashes are circles, half the marker diameter.
        strokeWidth={MARKER_RADIUS}
        strokeDasharray={`0 ${MARKER_RADIUS * 2.5}`}
      />

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
          <text x={blue.x} y={blueNumberY} textAnchor="middle" fontSize={10}>
            1.00
          </text>
          {labelOpacity > 0 && (
            <text
              data-radius-label="css"
              x={blue.x}
              y={blueNumberY + 16}
              textAnchor="middle"
              fontSize={10}
              opacity={labelOpacity}
            >
              <tspan x={blue.x}>CSS</tspan>
              <tspan x={blue.x} dy={12}>
                radius
              </tspan>
            </text>
          )}
        </g>
      )}

      <g data-radius-marker="visual" fill={MAGENTA}>
        <circle data-radius-point="visual" cx={red.x} cy={red.y} r={MARKER_RADIUS} />
        <text x={red.x} y={redNumberY} textAnchor="middle" fontSize={10}>
          1.00
        </text>
        {labelOpacity > 0 && (
          <text
            data-radius-label="visual"
            x={red.x}
            y={redNumberY - 28}
            textAnchor="middle"
            fontSize={10}
            opacity={labelOpacity}
          >
            <tspan x={red.x}>Visual</tspan>
            <tspan x={red.x} dy={12}>
              “radius”
            </tspan>
          </text>
        )}
      </g>
    </g>
  );
}
