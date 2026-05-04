import { css, cx } from "../styled-system/css";

function Box({ label, className }: { label: string; className: string }) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
      })}
    >
      <div className={cx(css({ width: "112px", height: "112px" }), className)} />
      <span
        className={css({
          maxWidth: "112px",
          textAlign: "center",
          fontSize: "12px",
          color: "zinc.400",
        })}
      >
        {label}
      </span>
    </div>
  );
}

const root = css({
  minHeight: "100vh",
  backgroundColor: "zinc.950",
  padding: "40px",
  color: "zinc.100",
});

const heading = css({
  marginBottom: "8px",
  fontSize: "24px",
  fontWeight: 700,
});

const lead = css({
  marginBottom: "32px",
  color: "zinc.400",
});

const stack = css({ display: "flex", flexDirection: "column", gap: "40px" });
const sectionH = css({
  marginBottom: "16px",
  fontSize: "18px",
  fontWeight: 600,
  color: "zinc.300",
});
const row = css({ display: "flex", gap: "24px", flexWrap: "wrap" });

export default function App() {
  return (
    <div className={root}>
      <h1 className={heading}>squircle Panda Demo</h1>
      <p className={lead}>Squircle utilities consumed via the Panda preset.</p>

      <div className={stack}>
        <section>
          <h2 className={sectionH}>Small radius</h2>
          <div className={row}>
            <Box
              label="css({ borderRadius: 'lg' })"
              className={css({ backgroundColor: "demoPlain", borderRadius: "lg" })}
            />
            <Box
              label="css({ squircle: 'lg' })"
              className={css({ backgroundColor: "demoSquircle", squircle: "lg" })}
            />
          </div>
        </section>

        <section>
          <h2 className={sectionH}>Medium radius</h2>
          <div className={row}>
            <Box
              label="css({ borderRadius: '2xl' })"
              className={css({ backgroundColor: "demoPlain", borderRadius: "2xl" })}
            />
            <Box
              label="css({ squircle: '2xl' })"
              className={css({ backgroundColor: "demoSquircle", squircle: "2xl" })}
            />
          </div>
        </section>

        <section>
          <h2 className={sectionH}>Large radius</h2>
          <div className={row}>
            <Box
              label="css({ borderRadius: '3xl' })"
              className={css({ backgroundColor: "demoPlain", borderRadius: "3xl" })}
            />
            <Box
              label="css({ squircle: '3xl' })"
              className={css({ backgroundColor: "demoSquircle", squircle: "3xl" })}
            />
          </div>
        </section>

        <section>
          <h2 className={sectionH}>Squircle amount via squircleAmt</h2>
          <p className={css({ marginBottom: "16px", fontSize: "14px", color: "zinc.500" })}>
            Higher = more square. Default is 2.
          </p>
          <div className={row}>
            <Box
              label="squircleAmt: '1'"
              className={css({
                backgroundColor: "demoAmount",
                squircle: "3xl",
                squircleAmt: "1",
              })}
            />
            <Box
              label="squircleAmt: '1.5'"
              className={css({
                backgroundColor: "demoAmount",
                squircle: "3xl",
                squircleAmt: "1.5",
              })}
            />
            <Box
              label="default (2)"
              className={css({ backgroundColor: "demoAmount", squircle: "3xl" })}
            />
            <Box
              label="squircleAmt: '3'"
              className={css({
                backgroundColor: "demoAmount",
                squircle: "3xl",
                squircleAmt: "3",
              })}
            />
            <Box
              label="squircleAmt: '5'"
              className={css({
                backgroundColor: "demoAmount",
                squircle: "3xl",
                squircleAmt: "5",
              })}
            />
          </div>
        </section>

        <section>
          <h2 className={sectionH}>Per-corner squircles</h2>
          <div className={row}>
            <Box
              label="squircleTopLeft: '3xl'"
              className={css({ backgroundColor: "demoCorner", squircleTopLeft: "3xl" })}
            />
            <Box
              label="squircleTopRight: '3xl'"
              className={css({ backgroundColor: "demoCorner", squircleTopRight: "3xl" })}
            />
            <Box
              label="squircleBottomRight: '3xl'"
              className={css({ backgroundColor: "demoCorner", squircleBottomRight: "3xl" })}
            />
            <Box
              label="squircleBottomLeft: '3xl'"
              className={css({ backgroundColor: "demoCorner", squircleBottomLeft: "3xl" })}
            />
            <Box
              label="squircleTop: '3xl'"
              className={css({ backgroundColor: "demoCorner", squircleTop: "3xl" })}
            />
            <Box
              label="squircleBottom: '3xl'"
              className={css({ backgroundColor: "demoCorner", squircleBottom: "3xl" })}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
