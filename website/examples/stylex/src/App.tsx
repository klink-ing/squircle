import * as stylex from "@stylexjs/stylex";
import { squircle } from "@klinking/squircle/stylex";
import { radii } from "./radii.stylex";
import { colors } from "./colors.stylex";

const swatch = stylex.create({
  plain: { backgroundColor: colors.demoPlain },
  squircle: { backgroundColor: colors.demoSquircle },
  amount: { backgroundColor: colors.demoAmount },
  corner: { backgroundColor: colors.demoCorner },
});

const plainRadius = stylex.create({
  lg: { borderRadius: radii.lg },
  "2xl": { borderRadius: radii["2xl"] },
  "3xl": { borderRadius: radii["3xl"] },
});

function Box({
  label,
  styleProps,
}: {
  label: string;
  styleProps: ReturnType<typeof stylex.props>;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`h-28 w-28 ${styleProps.className ?? ""}`}
        style={styleProps.style as React.CSSProperties | undefined}
      />
      <span className="max-w-28 text-center text-xs text-zinc-400">{label}</span>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 p-10 text-zinc-100">
      <h1 className="mb-2 text-2xl font-bold">squircle StyleX Demo</h1>
      <p className="mb-8 text-zinc-400">Squircle utilities authored as StyleX dynamic styles.</p>

      <div className="space-y-10">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-300">Small radius</h2>
          <div className="flex gap-6">
            <Box
              label="borderRadius: radii.lg"
              styleProps={stylex.props(swatch.plain, plainRadius.lg)}
            />
            <Box
              label="squircle.all(radii.lg)"
              styleProps={stylex.props(swatch.squircle, squircle.all(radii.lg))}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-300">Medium radius</h2>
          <div className="flex gap-6">
            <Box
              label="borderRadius: radii['2xl']"
              styleProps={stylex.props(swatch.plain, plainRadius["2xl"])}
            />
            <Box
              label="squircle.all(radii['2xl'])"
              styleProps={stylex.props(swatch.squircle, squircle.all(radii["2xl"]))}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-300">Large radius</h2>
          <div className="flex gap-6">
            <Box
              label="borderRadius: radii['3xl']"
              styleProps={stylex.props(swatch.plain, plainRadius["3xl"])}
            />
            <Box
              label="squircle.all(radii['3xl'])"
              styleProps={stylex.props(swatch.squircle, squircle.all(radii["3xl"]))}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-300">Squircle amount</h2>
          <p className="mb-4 text-sm text-zinc-500">Higher = more square. Default is 2.</p>
          <div className="flex flex-wrap gap-6">
            <Box
              label="squircle.all(radii['3xl'], 1)"
              styleProps={stylex.props(swatch.amount, squircle.all(radii["3xl"], 1))}
            />
            <Box
              label="squircle.all(radii['3xl'], 1.5)"
              styleProps={stylex.props(swatch.amount, squircle.all(radii["3xl"], 1.5))}
            />
            <Box
              label="squircle.all(radii['3xl'])"
              styleProps={stylex.props(swatch.amount, squircle.all(radii["3xl"]))}
            />
            <Box
              label="squircle.all(radii['3xl'], 3)"
              styleProps={stylex.props(swatch.amount, squircle.all(radii["3xl"], 3))}
            />
            <Box
              label="squircle.all(radii['3xl'], 5)"
              styleProps={stylex.props(swatch.amount, squircle.all(radii["3xl"], 5))}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-300">Per-corner squircles</h2>
          <div className="flex flex-wrap gap-6">
            <Box
              label="squircle.topLeft(radii['3xl'])"
              styleProps={stylex.props(swatch.corner, squircle.topLeft(radii["3xl"]))}
            />
            <Box
              label="squircle.topRight(radii['3xl'])"
              styleProps={stylex.props(swatch.corner, squircle.topRight(radii["3xl"]))}
            />
            <Box
              label="squircle.bottomRight(radii['3xl'])"
              styleProps={stylex.props(swatch.corner, squircle.bottomRight(radii["3xl"]))}
            />
            <Box
              label="squircle.bottomLeft(radii['3xl'])"
              styleProps={stylex.props(swatch.corner, squircle.bottomLeft(radii["3xl"]))}
            />
            <Box
              label="squircle.top(radii['3xl'])"
              styleProps={stylex.props(swatch.corner, squircle.top(radii["3xl"]))}
            />
            <Box
              label="squircle.bottom(radii['3xl'])"
              styleProps={stylex.props(swatch.corner, squircle.bottom(radii["3xl"]))}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
