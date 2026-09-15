function PillBox({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`h-20 w-32 ${className}`} />
      <span className="max-w-32 text-center text-xs text-zinc-400">{label}</span>
    </div>
  );
}

export default function PillTailwindDemo() {
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
          <PillBox label="squircle-pill-sm" className="squircle-pill-sm bg-demo-squircle" />
          <PillBox label="squircle-pill-md" className="squircle-pill-md bg-demo-squircle" />
          <PillBox label="squircle-pill-lg" className="squircle-pill-lg bg-demo-squircle" />
          <PillBox label="squircle-pill-xl" className="squircle-pill-xl bg-demo-squircle" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Pill variants (side-specific)</h2>
        <div className="flex flex-wrap gap-6">
          <PillBox label="squircle-pill-t-lg" className="squircle-pill-t-lg bg-demo-corner" />
          <PillBox label="squircle-pill-r-lg" className="squircle-pill-r-lg bg-demo-corner" />
          <PillBox label="squircle-pill-b-lg" className="squircle-pill-b-lg bg-demo-corner" />
          <PillBox label="squircle-pill-l-lg" className="squircle-pill-l-lg bg-demo-corner" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">
          Pill amount control (squircle-pill-amt-*)
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Adjust superellipse smoothness at transition points.
        </p>
        <div className="flex flex-wrap gap-6">
          <PillBox
            label="squircle-pill-lg squircle-pill-amt-1"
            className="squircle-pill-amt-1 squircle-pill-lg bg-demo-amount"
          />
          <PillBox
            label="squircle-pill-lg squircle-pill-amt-1.5"
            className="squircle-pill-amt-1.5 squircle-pill-lg bg-demo-amount"
          />
          <PillBox
            label="squircle-pill-lg (default 2)"
            className="squircle-pill-lg bg-demo-amount"
          />
          <PillBox
            label="squircle-pill-lg squircle-pill-amt-3"
            className="squircle-pill-amt-3 squircle-pill-lg bg-demo-amount"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Common use cases</h2>
        <div className="space-y-6">
          <div>
            <p className="mb-3 text-sm text-zinc-500">Pill button</p>
            <button className="squircle-pill-full bg-blue-500 px-6 py-2 text-sm font-medium text-white">
              Click me
            </button>
          </div>
          <div>
            <p className="mb-3 text-sm text-zinc-500">Pill badge</p>
            <span className="squircle-pill-md inline-block bg-green-100 px-3 py-1 text-xs font-semibold text-green-900">
              New
            </span>
          </div>
          <div>
            <p className="mb-3 text-sm text-zinc-500">Pill with icon placeholder</p>
            <div className="squircle-pill-lg inline-flex items-center gap-2 bg-purple-100 px-4 py-2 text-purple-900">
              <div className="squircle-pill-sm h-5 w-5 bg-purple-500" />
              <span className="text-sm">Label</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
