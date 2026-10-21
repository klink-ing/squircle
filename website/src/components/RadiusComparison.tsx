import { perceivedRadius, pointsToPath, type Point } from "../math";

// Both measurements use the circle's reference center. A superellipse has no
// single circular radius: its diagonal intersection can lie beyond its axis extent.
export default function RadiusComparison({
  radius,
  superRadius,
  exponent,
  corner,
  circle,
  superellipse,
}: {
  radius: number;
  superRadius: number;
  exponent: number;
  corner: Point;
  circle: Point[];
  superellipse: Point[];
}) {
  const center = { x: corner.x - radius, y: corner.y + radius };
  const circleReach = perceivedRadius(radius, radius, 2);
  const superReach = perceivedRadius(radius, superRadius, exponent);
  const circleApex = {
    x: center.x + circleReach / Math.SQRT2,
    y: center.y - circleReach / Math.SQRT2,
  };
  const superApex = {
    x: center.x + superReach / Math.SQRT2,
    y: center.y - superReach / Math.SQRT2,
  };
  const label = { x: center.x + radius * 0.4, y: center.y - radius * 0.4 + 12 };

  return (
    <g data-radius-comparison="" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={pointsToPath(circle)} stroke="var(--color-rounded-border)" strokeWidth={1.7} />
      <path
        d={pointsToPath(superellipse)}
        stroke="var(--color-squircle-border)"
        strokeWidth={1.7}
      />

      <g stroke="#a1a1aa" strokeWidth={0.8} strokeDasharray="1 4">
        <line x1={center.x} y1={center.y} x2={center.x} y2={corner.y} />
        <line data-radius-axis="css" x1={center.x} y1={center.y} x2={corner.x} y2={center.y} />
      </g>
      <line
        data-radius-axis="visual"
        x1={center.x}
        y1={center.y}
        x2={superApex.x}
        y2={superApex.y}
        stroke="#e4e4e7"
        strokeWidth={1}
        strokeDasharray="1 4"
      />

      <g fill="#e4e4e7">
        <circle cx={center.x} cy={corner.y} r={2.5} />
        <circle cx={corner.x} cy={center.y} r={2.5} />
        <circle cx={center.x} cy={center.y} r={2} />
      </g>
      <circle
        data-radius-point="circle"
        cx={circleApex.x}
        cy={circleApex.y}
        r={3}
        fill="var(--color-rounded-border)"
        stroke="#18181b"
        strokeWidth={1}
      />
      <circle
        data-radius-point="superellipse"
        cx={superApex.x}
        cy={superApex.y}
        r={3}
        fill="var(--color-squircle-border)"
        stroke="#18181b"
        strokeWidth={1}
      />

      <g fontSize={10} fill="#e4e4e7" fontFamily="inherit">
        <text x={center.x} y={corner.y - 9}>
          Curve starts here
        </text>
        <path d={`M ${center.x} ${corner.y - 6} v 3`} stroke="#e4e4e7" strokeWidth={0.8} />
        <text x={(center.x + corner.x) / 2} y={center.y + 17} textAnchor="middle">
          CSS radius · 1.00
        </text>
        <text
          x={label.x}
          y={label.y}
          transform={`rotate(-45 ${label.x} ${label.y})`}
          textAnchor="middle"
        >
          Visual radius
        </text>
        <text
          x={circleApex.x - 5}
          y={circleApex.y + 15}
          textAnchor="end"
          fill="var(--color-rounded-border)"
        >
          1.00
        </text>
        <text x={superApex.x + 5} y={superApex.y + 3} fill="var(--color-squircle-border)">
          {(superReach / radius).toFixed(2)}
        </text>
      </g>
    </g>
  );
}
