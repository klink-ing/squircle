import { css } from "../../styled-system/css";

const rect = css({
  width: "96px",
  height: "96px",
  backgroundImage:
    "linear-gradient(135deg, token(colors.indigo.400), token(colors.violet.400))",
});

const rectAlt = css({
  width: "96px",
  height: "96px",
  backgroundImage:
    "linear-gradient(135deg, token(colors.pink.400), token(colors.purple.400))",
});

const row = css({
  display: "flex",
  gap: "24px",
  flexWrap: "wrap",
  alignItems: "flex-start",
});

const cell = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
});

const label = css({
  fontSize: "12px",
  color: "zinc.400",
  fontFamily: "mono",
  textAlign: "center",
  maxWidth: "120px",
});

const heading = css({
  fontSize: "16px",
  fontWeight: 600,
  color: "zinc.300",
  marginBottom: "16px",
});

const section = css({
  marginBottom: "40px",
});

function Cell({ label: l, className }: { label: string; className: string }) {
  return (
    <div className={cell}>
      <div className={className} />
      <span className={label}>{l}</span>
    </div>
  );
}

export default function PandaDemo() {
  return (
    <div>
      <section className={section}>
        <h3 className={heading}>All-corners (`squircle`) — varying radius</h3>
        <div className={row}>
          <Cell
            label={`css({ squircle: 'sm' })`}
            className={`${rect} ${css({ squircle: "sm" })}`}
          />
          <Cell
            label={`css({ squircle: 'md' })`}
            className={`${rect} ${css({ squircle: "md" })}`}
          />
          <Cell
            label={`css({ squircle: 'lg' })`}
            className={`${rect} ${css({ squircle: "lg" })}`}
          />
          <Cell
            label={`css({ squircle: '2xl' })`}
            className={`${rect} ${css({ squircle: "2xl" })}`}
          />
        </div>
      </section>

      <section className={section}>
        <h3 className={heading}>
          Varying superellipse exponent via{" "}
          <code className={css({ fontFamily: "mono" })}>squircleAmt</code>
        </h3>
        <div className={row}>
          <Cell
            label={`squircle: 'xl', squircleAmt: 1.5`}
            className={`${rectAlt} ${css({ squircle: "xl", squircleAmt: "1.5" })}`}
          />
          <Cell
            label={`squircle: 'xl', squircleAmt: 2`}
            className={`${rectAlt} ${css({ squircle: "xl", squircleAmt: "2" })}`}
          />
          <Cell
            label={`squircle: 'xl', squircleAmt: 3`}
            className={`${rectAlt} ${css({ squircle: "xl", squircleAmt: "3" })}`}
          />
          <Cell
            label={`squircle: 'xl', squircleAmt: 5`}
            className={`${rectAlt} ${css({ squircle: "xl", squircleAmt: "5" })}`}
          />
        </div>
      </section>

      <section className={section}>
        <h3 className={heading}>Per-side variants</h3>
        <div className={row}>
          <Cell
            label={`css({ squircleTop: '2xl' })`}
            className={`${rect} ${css({ squircleTop: "2xl" })}`}
          />
          <Cell
            label={`css({ squircleRight: '2xl' })`}
            className={`${rect} ${css({ squircleRight: "2xl" })}`}
          />
          <Cell
            label={`css({ squircleBottom: '2xl' })`}
            className={`${rect} ${css({ squircleBottom: "2xl" })}`}
          />
          <Cell
            label={`css({ squircleLeft: '2xl' })`}
            className={`${rect} ${css({ squircleLeft: "2xl" })}`}
          />
        </div>
      </section>

      <section className={section}>
        <h3 className={heading}>Per-corner variants</h3>
        <div className={row}>
          <Cell
            label={`css({ squircleTopLeft: '3xl' })`}
            className={`${rect} ${css({ squircleTopLeft: "3xl" })}`}
          />
          <Cell
            label={`css({ squircleTopRight: '3xl' })`}
            className={`${rect} ${css({ squircleTopRight: "3xl" })}`}
          />
          <Cell
            label={`css({ squircleBottomRight: '3xl' })`}
            className={`${rect} ${css({ squircleBottomRight: "3xl" })}`}
          />
          <Cell
            label={`css({ squircleBottomLeft: '3xl' })`}
            className={`${rect} ${css({ squircleBottomLeft: "3xl" })}`}
          />
        </div>
      </section>
    </div>
  );
}
