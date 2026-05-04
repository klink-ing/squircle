import * as stylex from "@stylexjs/stylex";
import { squircle } from "@klinking/squircle/stylex";

const styles = stylex.create({
  rect: {
    width: 96,
    height: 96,
    backgroundImage: "linear-gradient(135deg, #818cf8, #a78bfa)",
  },
  rectAlt: {
    width: 96,
    height: 96,
    backgroundImage: "linear-gradient(135deg, #f472b6, #c084fc)",
  },
  row: {
    display: "flex",
    gap: 24,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  cell: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 12,
    color: "#a1a1aa",
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
    textAlign: "center",
    maxWidth: 120,
  },
  section: {
    marginBottom: 40,
  },
  heading: {
    fontSize: 16,
    fontWeight: 600,
    color: "#d4d4d8",
    marginBottom: 16,
  },
});

function Cell({
  label,
  styleProps,
}: {
  label: string;
  styleProps: Readonly<Record<string, unknown>>;
}) {
  return (
    <div {...stylex.props(styles.cell)}>
      <div {...(styleProps as ReturnType<typeof stylex.props>)} />
      <span {...stylex.props(styles.label)}>{label}</span>
    </div>
  );
}

export default function StyleXDemo() {
  return (
    <div>
      <section {...stylex.props(styles.section)}>
        <h3 {...stylex.props(styles.heading)}>All-corners variant — varying radius</h3>
        <div {...stylex.props(styles.row)}>
          <Cell
            label={`squircle.all('0.5rem')`}
            styleProps={stylex.props(styles.rect, squircle.all("0.5rem"))}
          />
          <Cell
            label={`squircle.all('1rem')`}
            styleProps={stylex.props(styles.rect, squircle.all("1rem"))}
          />
          <Cell
            label={`squircle.all('1.5rem')`}
            styleProps={stylex.props(styles.rect, squircle.all("1.5rem"))}
          />
          <Cell
            label={`squircle.all('2.5rem')`}
            styleProps={stylex.props(styles.rect, squircle.all("2.5rem"))}
          />
        </div>
      </section>

      <section {...stylex.props(styles.section)}>
        <h3 {...stylex.props(styles.heading)}>
          Varying superellipse exponent (amt)
        </h3>
        <div {...stylex.props(styles.row)}>
          <Cell
            label={`squircle.all('1.25rem', 1.5)`}
            styleProps={stylex.props(styles.rectAlt, squircle.all("1.25rem", 1.5))}
          />
          <Cell
            label={`squircle.all('1.25rem', 2)`}
            styleProps={stylex.props(styles.rectAlt, squircle.all("1.25rem", 2))}
          />
          <Cell
            label={`squircle.all('1.25rem', 3)`}
            styleProps={stylex.props(styles.rectAlt, squircle.all("1.25rem", 3))}
          />
          <Cell
            label={`squircle.all('1.25rem', 5)`}
            styleProps={stylex.props(styles.rectAlt, squircle.all("1.25rem", 5))}
          />
        </div>
      </section>

      <section {...stylex.props(styles.section)}>
        <h3 {...stylex.props(styles.heading)}>Per-side variants</h3>
        <div {...stylex.props(styles.row)}>
          <Cell
            label={`squircle.top('1.5rem')`}
            styleProps={stylex.props(styles.rect, squircle.top("1.5rem"))}
          />
          <Cell
            label={`squircle.right('1.5rem')`}
            styleProps={stylex.props(styles.rect, squircle.right("1.5rem"))}
          />
          <Cell
            label={`squircle.bottom('1.5rem')`}
            styleProps={stylex.props(styles.rect, squircle.bottom("1.5rem"))}
          />
          <Cell
            label={`squircle.left('1.5rem')`}
            styleProps={stylex.props(styles.rect, squircle.left("1.5rem"))}
          />
        </div>
      </section>

      <section {...stylex.props(styles.section)}>
        <h3 {...stylex.props(styles.heading)}>Per-corner variants</h3>
        <div {...stylex.props(styles.row)}>
          <Cell
            label={`squircle.topLeft('2rem')`}
            styleProps={stylex.props(styles.rect, squircle.topLeft("2rem"))}
          />
          <Cell
            label={`squircle.topRight('2rem')`}
            styleProps={stylex.props(styles.rect, squircle.topRight("2rem"))}
          />
          <Cell
            label={`squircle.bottomRight('2rem')`}
            styleProps={stylex.props(styles.rect, squircle.bottomRight("2rem"))}
          />
          <Cell
            label={`squircle.bottomLeft('2rem')`}
            styleProps={stylex.props(styles.rect, squircle.bottomLeft("2rem"))}
          />
        </div>
      </section>
    </div>
  );
}
