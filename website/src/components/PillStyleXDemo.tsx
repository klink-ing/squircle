function PillBox({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`h-20 w-32 ${className}`} />
      <span className="max-w-32 text-center text-xs text-zinc-400">{label}</span>
    </div>
  );
}

export default function PillStyleXDemo() {
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
          <PillBox label="squirclePill('0.5rem')" className="bg-demo-squircle" />
          <PillBox label="squirclePill('0.75rem')" className="bg-demo-squircle" />
          <PillBox label="squirclePill('1rem')" className="bg-demo-squircle" />
          <PillBox label="squirclePill('1.5rem')" className="bg-demo-squircle" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Pill variants (side-specific)</h2>
        <p className="mb-4 text-sm text-zinc-500">Apply pill radius to specific sides only.</p>
        <div className="flex flex-wrap gap-6">
          <PillBox label="squirclePillTop('1rem')" className="bg-demo-corner" />
          <PillBox label="squirclePillRight('1rem')" className="bg-demo-corner" />
          <PillBox label="squirclePillBottom('1rem')" className="bg-demo-corner" />
          <PillBox label="squirclePillLeft('1rem')" className="bg-demo-corner" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Pill with amount parameter</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Control superellipse smoothness with the amount parameter.
        </p>
        <div className="flex flex-wrap gap-6">
          <PillBox label="squirclePill('1rem', 1)" className="bg-demo-amount" />
          <PillBox label="squirclePill('1rem', 1.5)" className="bg-demo-amount" />
          <PillBox label="squirclePill('1rem') [default 2]" className="bg-demo-amount" />
          <PillBox label="squirclePill('1rem', 3)" className="bg-demo-amount" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-300">Common use cases</h2>
        <div className="space-y-6">
          <div>
            <p className="mb-3 text-sm text-zinc-500">Pill button</p>
            <button className="rounded-full bg-blue-500 px-6 py-2 text-sm font-medium text-white">
              Click me
            </button>
          </div>
          <div>
            <p className="mb-3 text-sm text-zinc-500">Pill badge</p>
            <span className="inline-block rounded-md bg-green-100 px-3 py-1 text-xs font-semibold text-green-900">
              New
            </span>
          </div>
          <div>
            <p className="mb-3 text-sm text-zinc-500">Pill with icon</p>
            <div className="inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-purple-900">
              <div className="h-5 w-5 rounded-full bg-purple-500" />
              <span className="text-sm">Label</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
