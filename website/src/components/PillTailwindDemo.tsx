function PillBox({
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
      <div className={`h-16 w-40 ${className}`} style={style} />
      <span className="max-w-40 text-center text-xs text-zinc-400">{label}</span>
    </div>
  );
}

export default function PillTailwindDemo() {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">One utility, any size</h2>
        <p className="mb-4 text-sm text-zinc-500">
          <code className="text-zinc-300">squircle-pill</code> derives the caps from the element's
          own size, so there is nothing to configure per size. Next to it, the plain{" "}
          <code className="text-zinc-300">rounded-full</code> stadium the pill falls back to where
          paint worklets are unsupported.
        </p>
        <div className="flex flex-wrap items-end gap-6">
          <PillBox label="squircle-pill" className="squircle-pill bg-demo-squircle" />
          <PillBox label="rounded-full" className="rounded-full bg-demo-plain" />
          <PillBox
            label="squircle-pill h-10 w-10"
            className="squircle-pill !h-10 !w-10 bg-demo-squircle"
          />
          <PillBox
            label="squircle-pill h-24 w-12"
            className="squircle-pill !h-24 !w-12 bg-demo-squircle"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Arc and edge setbacks</h2>
        <p className="mb-4 text-sm text-zinc-500">
          <code className="text-zinc-300">squircle-pill-arc-setback-*</code> selects how many
          degrees of the circular cap the transition replaces.{" "}
          <code className="text-zinc-300">squircle-pill-edge-setback-*</code>
          selects how far past the arc's top it finishes, in multiples of half the pill's height. G3
          is the default; <code>squircle-pill-g2</code> remains available.
        </p>
        <div className="flex flex-wrap gap-6">
          <PillBox
            label="arc-setback-0 (stadium)"
            className="squircle-pill bg-demo-amount squircle-pill-arc-setback-0"
          />
          <PillBox label="default: 45°, edge 0.75r, G3" className="squircle-pill bg-demo-amount" />
          <PillBox
            label="arc-setback-60 edge-setback-1"
            className="squircle-pill bg-demo-amount squircle-pill-arc-setback-60 squircle-pill-edge-setback-1"
          />
          <PillBox
            label="arc-setback-30 edge-setback-2 G2"
            className="squircle-pill bg-demo-amount squircle-pill-arc-setback-30 squircle-pill-edge-setback-2 squircle-pill-g2"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Borders, the usual way</h2>
        <p className="mb-4 text-sm text-zinc-500">
          With <code className="text-zinc-300">tailwind-pill-border</code> loaded, Tailwind's own{" "}
          <code className="text-zinc-300">border-*</code> utilities drive a ring the worklet draws
          along the real outline. Inset shadows and outlines need nothing special.
        </p>
        <div className="flex flex-wrap gap-6">
          <PillBox label="border-2" className="squircle-pill border-2 text-demo-corner" />
          <PillBox
            label="border-4 border-demo-corner"
            className="squircle-pill border-4 border-demo-corner bg-zinc-900"
          />
          <PillBox
            label="border-2 border-dashed border-demo-corner"
            className="squircle-pill border-2 border-dashed border-demo-corner"
          />
          <PillBox
            label="shadow-inner (inset shadow)"
            className="squircle-pill bg-demo-corner"
            style={{ boxShadow: "inset 0 6px 10px rgb(0 0 0 / 0.5)" }}
          />
          <PillBox
            label="outline-2 -outline-offset-4"
            className="squircle-pill bg-demo-corner outline-2 -outline-offset-4 outline-white"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Common use cases</h2>
        <div className="space-y-6">
          <div>
            <p className="mb-3 text-sm text-zinc-500">Pill button</p>
            <button className="squircle-pill bg-blue-500 px-6 py-2 text-sm font-medium text-white">
              Click me
            </button>
          </div>
          <div>
            <p className="mb-3 text-sm text-zinc-500">Pill badge</p>
            <span className="squircle-pill inline-block bg-green-100 px-3 py-1 text-xs font-semibold text-green-900">
              New
            </span>
          </div>
          <div>
            <p className="mb-3 text-sm text-zinc-500">Pill with icon placeholder</p>
            <div className="squircle-pill inline-flex items-center gap-2 bg-purple-100 px-4 py-2 text-purple-900">
              <div className="squircle-pill h-5 w-5 bg-purple-500" />
              <span className="text-sm">Label</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
