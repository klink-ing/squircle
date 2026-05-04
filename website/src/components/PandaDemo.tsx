import { css, cx } from "../../styled-system/css";

const boxBase = css({
  width: "112px",
  height: "112px",
});

const cellLayout = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
});

const labelStyle = css({
  maxWidth: "112px",
  textAlign: "center",
  fontSize: "12px",
  color: "zinc.400",
});

function Box({ label, className }: { label: string; className: string }) {
  return (
    <div className={cellLayout}>
      <div className={cx(boxBase, className)} />
      <span className={labelStyle}>{label}</span>
    </div>
  );
}

export default function PandaDemo() {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Small radius</h2>
        <div className="flex gap-6">
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
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Medium radius</h2>
        <div className="flex gap-6">
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
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Large radius</h2>
        <div className="flex gap-6">
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
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">
          Squircle amount via squircleAmt
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Controls the superellipse exponent. Higher = more square. Default is 2.
        </p>
        <div className="flex flex-wrap gap-6">
          <Box
            label="squircle: '3xl', squircleAmt: '1'"
            className={css({
              backgroundColor: "demoAmount",
              squircle: "3xl",
              squircleAmt: "1",
            })}
          />
          <Box
            label="squircle: '3xl', squircleAmt: '1.5'"
            className={css({
              backgroundColor: "demoAmount",
              squircle: "3xl",
              squircleAmt: "1.5",
            })}
          />
          <Box
            label="squircle: '3xl' (default 2)"
            className={css({ backgroundColor: "demoAmount", squircle: "3xl" })}
          />
          <Box
            label="squircle: '3xl', squircleAmt: '3'"
            className={css({
              backgroundColor: "demoAmount",
              squircle: "3xl",
              squircleAmt: "3",
            })}
          />
          <Box
            label="squircle: '3xl', squircleAmt: '5'"
            className={css({
              backgroundColor: "demoAmount",
              squircle: "3xl",
              squircleAmt: "5",
            })}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Per-corner squircles</h2>
        <div className="flex flex-wrap gap-6">
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

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Logical-side squircles</h2>
        <div className="flex flex-wrap gap-6">
          <Box
            label="squircleStart: '3xl'"
            className={css({ backgroundColor: "demoCorner", squircleStart: "3xl" })}
          />
          <Box
            label="squircleEnd: '3xl'"
            className={css({ backgroundColor: "demoCorner", squircleEnd: "3xl" })}
          />
          <Box
            label="squircleStartStart: '3xl'"
            className={css({ backgroundColor: "demoCorner", squircleStartStart: "3xl" })}
          />
          <Box
            label="squircleStartEnd: '3xl'"
            className={css({ backgroundColor: "demoCorner", squircleStartEnd: "3xl" })}
          />
          <Box
            label="squircleEndStart: '3xl'"
            className={css({ backgroundColor: "demoCorner", squircleEndStart: "3xl" })}
          />
          <Box
            label="squircleEndEnd: '3xl'"
            className={css({ backgroundColor: "demoCorner", squircleEndEnd: "3xl" })}
          />
        </div>
      </section>
    </div>
  );
}
