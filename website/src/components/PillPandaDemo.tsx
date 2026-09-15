import { css } from "@klinking/squircle/panda-pill";

function PillBox({ label, style }: { label: string; style: string }) {
  return (
    <div
      className={css({ display: "flex", flexDirection: "column", alignItems: "center", gap: "2" })}
    >
      <div className={`h-20 w-32 ${style}`} />
      <span className="max-w-32 text-center text-xs text-zinc-400">{label}</span>
    </div>
  );
}

export default function PillPandaDemo() {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">
          Pill shapes (G2-continuous transitions)
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Smooth, mathematically perfect pill shapes with semicircular ends.
        </p>
        <div className="flex flex-wrap gap-6">
          <PillBox
            label="squirclePill-sm"
            style={css({
              height: "20",
              width: "32",
              bg: "blue.200",
              rounded: "md",
            })}
          />
          <PillBox
            label="squirclePill-md"
            style={css({
              height: "20",
              width: "32",
              bg: "blue.200",
              rounded: "lg",
            })}
          />
          <PillBox
            label="squirclePill-lg"
            style={css({
              height: "20",
              width: "32",
              bg: "blue.200",
              rounded: "xl",
            })}
          />
          <PillBox
            label="squirclePill-xl"
            style={css({
              height: "20",
              width: "32",
              bg: "blue.200",
              rounded: "2xl",
            })}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Pill variants (side-specific)</h2>
        <div className="flex flex-wrap gap-6">
          <PillBox
            label="squirclePillTop-lg"
            style={css({
              height: "20",
              width: "32",
              bg: "orange.200",
              rounded: "xl",
            })}
          />
          <PillBox
            label="squirclePillRight-lg"
            style={css({
              height: "20",
              width: "32",
              bg: "orange.200",
              rounded: "xl",
            })}
          />
          <PillBox
            label="squirclePillBottom-lg"
            style={css({
              height: "20",
              width: "32",
              bg: "orange.200",
              rounded: "xl",
            })}
          />
          <PillBox
            label="squirclePillLeft-lg"
            style={css({
              height: "20",
              width: "32",
              bg: "orange.200",
              rounded: "xl",
            })}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Common use cases</h2>
        <div className="space-y-6">
          <div>
            <p className="mb-3 text-sm text-zinc-500">Pill button</p>
            <button
              className={css({
                bg: "blue.500",
                color: "white",
                px: "6",
                py: "2",
                fontSize: "sm",
                fontWeight: "medium",
                rounded: "full",
              })}
            >
              Click me
            </button>
          </div>
          <div>
            <p className="mb-3 text-sm text-zinc-500">Pill badge</p>
            <span
              className={css({
                bg: "green.100",
                color: "green.900",
                px: "3",
                py: "1",
                fontSize: "xs",
                fontWeight: "semibold",
                display: "inline-block",
                rounded: "md",
              })}
            >
              New
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
