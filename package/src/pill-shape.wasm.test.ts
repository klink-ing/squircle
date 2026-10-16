import { afterEach, describe, expect, it } from "vitest";
import { paintDef } from "./pill-shape.worklet";

const { load: loadKernels, use: useKernels } = (
  paintDef as unknown as {
    kernels: { load(): unknown; use(next: unknown): void };
  }
).kernels;

/*
 * The WebAssembly kernels (wasm/src/lib.rs) and the script loops they
 * replace are two implementations of one thing, and the script is the
 * reference. Neither may drift from the other.
 */

interface Worklet {
  profile(q: number, c: number): { remaining: Float64Array; lambda: number };
  fresnel(
    beta: number,
    profile: { remaining: Float64Array; lambda: number },
  ): {
    cos: Float64Array;
    sin: Float64Array;
  };
  junctionRatio(beta: number, q: number, c: number): number;
  boxOutline(w: number, h: number, props?: unknown): { x: number; y: number }[];
}
const make = () => new (paintDef as unknown as new () => Worklet)();
const kernels = loadKernels();

const close = (a: number, b: number, tolerance = 1e-12) =>
  Object.is(a, b) ||
  (Number.isNaN(a) && Number.isNaN(b)) ||
  Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

afterEach(() => useKernels(kernels));

const CASES: [beta: number, q: number, continuity: number][] = [];
for (const continuity of [2, 3])
  for (const q of [-2, -1, 0.5, 1, 2, 3, 6, 12])
    for (const beta of [0.05, 0.4, 0.9, Math.PI / 3]) CASES.push([beta, q, continuity]);

describe("pill shape kernels", () => {
  it("are available where WebAssembly is", () => {
    expect(kernels).not.toBeNull();
  });

  it("agree with the script on the profile and both integrals", () => {
    useKernels(null);
    const script = make();
    const reference = CASES.map(([beta, q, c]) => {
      const profile = script.profile(q, c);
      return {
        profile,
        fresnel: script.fresnel(beta, profile),
        reach: script.junctionRatio(beta, q, c),
      };
    });
    useKernels(kernels);
    const compiled = make();
    CASES.forEach(([beta, q, c], i) => {
      const want = reference[i]!;
      const tag = `beta ${beta} q ${q} G${c}`;
      const profile = compiled.profile(q, c);
      expect(close(profile.lambda, want.profile.lambda), `lambda, ${tag}`).toBe(true);
      for (let k = 0; k < want.profile.remaining.length; k++) {
        if (!close(profile.remaining[k]!, want.profile.remaining[k]!)) {
          expect.fail(
            `remaining[${k}], ${tag}: ${profile.remaining[k]} vs ${want.profile.remaining[k]}`,
          );
        }
      }
      const fresnel = compiled.fresnel(beta, profile);
      for (let k = 0; k < fresnel.cos.length; k++) {
        if (
          !close(fresnel.cos[k]!, want.fresnel.cos[k]!) ||
          !close(fresnel.sin[k]!, want.fresnel.sin[k]!)
        ) {
          expect.fail(`fresnel[${k}], ${tag}`);
        }
      }
      expect(close(compiled.junctionRatio(beta, q, c), want.reach), `reach, ${tag}`).toBe(true);
    });
  });

  it("draw the same outline as the script", () => {
    const sizes: [number, number][] = [
      [200, 40],
      [64, 48],
      [48, 48],
      [37, 120],
      [500, 20],
      [90, 33],
    ];
    const props = (values: Record<string, string>) => ({
      get: (name: string) =>
        values[name] === undefined ? undefined : { toString: () => values[name] },
    });
    const settings = [
      {},
      { "--squircle-pill-continuity": "2" },
      { "--squircle-pill-ease": "6", "--squircle-pill-amt": "3" },
    ];
    useKernels(null);
    const script = make();
    const reference = sizes.flatMap(([w, h]) =>
      settings.map((s) => script.boxOutline(w, h, props(s))),
    );
    useKernels(kernels);
    const compiled = make();
    let n = 0;
    for (const [w, h] of sizes)
      for (const s of settings) {
        const got = compiled.boxOutline(w, h, props(s));
        const want = reference[n++]!;
        expect(got.length, `${w}x${h}`).toBe(want.length);
        got.forEach((p, i) => {
          expect(
            close(p.x, want[i]!.x, 1e-9) && close(p.y, want[i]!.y, 1e-9),
            `${w}x${h} point ${i}`,
          ).toBe(true);
        });
      }
  });
});
