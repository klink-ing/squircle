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
  className,
  style,
}: {
  label: string;
  className: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`h-28 w-28 ${className}`} style={style} />
      <span className="max-w-28 text-center text-xs text-zinc-400">{label}</span>
    </div>
  );
}

function StylexBox({
  label,
  styleProps,
}: {
  label: string;
  styleProps: ReturnType<typeof stylex.props>;
}) {
  return (
    <Box
      label={label}
      className={styleProps.className ?? ""}
      style={styleProps.style as React.CSSProperties | undefined}
    />
  );
}

export default function StyleXDemo() {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Small radius</h2>
        <div className="flex gap-6">
          <StylexBox
            label="borderRadius: radii.lg"
            styleProps={stylex.props(swatch.plain, plainRadius.lg)}
          />
          <StylexBox
            label="squircle.all(radii.lg)"
            styleProps={stylex.props(swatch.squircle, squircle.all(radii.lg))}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Medium radius</h2>
        <div className="flex gap-6">
          <StylexBox
            label="borderRadius: radii['2xl']"
            styleProps={stylex.props(swatch.plain, plainRadius["2xl"])}
          />
          <StylexBox
            label="squircle.all(radii['2xl'])"
            styleProps={stylex.props(swatch.squircle, squircle.all(radii["2xl"]))}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Large radius</h2>
        <div className="flex gap-6">
          <StylexBox
            label="borderRadius: radii['3xl']"
            styleProps={stylex.props(swatch.plain, plainRadius["3xl"])}
          />
          <StylexBox
            label="squircle.all(radii['3xl'])"
            styleProps={stylex.props(swatch.squircle, squircle.all(radii["3xl"]))}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">
          Squircle amount (the superellipse exponent)
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Controls the superellipse exponent. Higher = more square. Default is 2.
        </p>
        <div className="flex flex-wrap gap-6">
          <StylexBox
            label="squircle.all(radii['3xl'], 1)"
            styleProps={stylex.props(swatch.amount, squircle.all(radii["3xl"], 1))}
          />
          <StylexBox
            label="squircle.all(radii['3xl'], 1.5)"
            styleProps={stylex.props(swatch.amount, squircle.all(radii["3xl"], 1.5))}
          />
          <StylexBox
            label="squircle.all(radii['3xl'])"
            styleProps={stylex.props(swatch.amount, squircle.all(radii["3xl"]))}
          />
          <StylexBox
            label="squircle.all(radii['3xl'], 3)"
            styleProps={stylex.props(swatch.amount, squircle.all(radii["3xl"], 3))}
          />
          <StylexBox
            label="squircle.all(radii['3xl'], 5)"
            styleProps={stylex.props(swatch.amount, squircle.all(radii["3xl"], 5))}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Per-corner squircles</h2>
        <div className="flex flex-wrap gap-6">
          <StylexBox
            label="squircle.topLeft(radii['3xl'])"
            styleProps={stylex.props(swatch.corner, squircle.topLeft(radii["3xl"]))}
          />
          <StylexBox
            label="squircle.topRight(radii['3xl'])"
            styleProps={stylex.props(swatch.corner, squircle.topRight(radii["3xl"]))}
          />
          <StylexBox
            label="squircle.bottomRight(radii['3xl'])"
            styleProps={stylex.props(swatch.corner, squircle.bottomRight(radii["3xl"]))}
          />
          <StylexBox
            label="squircle.bottomLeft(radii['3xl'])"
            styleProps={stylex.props(swatch.corner, squircle.bottomLeft(radii["3xl"]))}
          />
          <StylexBox
            label="squircle.top(radii['3xl'])"
            styleProps={stylex.props(swatch.corner, squircle.top(radii["3xl"]))}
          />
          <StylexBox
            label="squircle.bottom(radii['3xl'])"
            styleProps={stylex.props(swatch.corner, squircle.bottom(radii["3xl"]))}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Logical-side squircles</h2>
        <div className="flex flex-wrap gap-6">
          <StylexBox
            label="squircle.start(radii['3xl'])"
            styleProps={stylex.props(swatch.corner, squircle.start(radii["3xl"]))}
          />
          <StylexBox
            label="squircle.end(radii['3xl'])"
            styleProps={stylex.props(swatch.corner, squircle.end(radii["3xl"]))}
          />
          <StylexBox
            label="squircle.startStart(radii['3xl'])"
            styleProps={stylex.props(swatch.corner, squircle.startStart(radii["3xl"]))}
          />
          <StylexBox
            label="squircle.startEnd(radii['3xl'])"
            styleProps={stylex.props(swatch.corner, squircle.startEnd(radii["3xl"]))}
          />
          <StylexBox
            label="squircle.endStart(radii['3xl'])"
            styleProps={stylex.props(swatch.corner, squircle.endStart(radii["3xl"]))}
          />
          <StylexBox
            label="squircle.endEnd(radii['3xl'])"
            styleProps={stylex.props(swatch.corner, squircle.endEnd(radii["3xl"]))}
          />
        </div>
      </section>
    </div>
  );
}
