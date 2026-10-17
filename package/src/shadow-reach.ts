/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

/**
 * How far a `box-shadow` list reaches past the box it is cast by: offset,
 * blur and spread together, for the furthest outer shadow. This is only a
 * build-time estimate for px literals; the runtime uses computed box-shadow.
 * Three blur standard deviations (1.5 times the CSS blur) include its tail.
 */
export function shadowReach(value: string): number {
  let reach = 0;
  let depth = 0;
  let layer = "";
  const layers: string[] = [];
  for (const ch of value) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      layers.push(layer);
      layer = "";
    } else layer += ch;
  }
  layers.push(layer);
  for (const shadow of layers) {
    if (/\binset\b/.test(shadow)) continue;
    // Lengths outside any colour function, in order: x, y, blur, spread.
    const bare = shadow.replace(/[a-z-]+\([^()]*(?:\([^()]*\)[^()]*)*\)/gi, " ");
    const lengths = [...bare.matchAll(/(^|\s)(-?(?:\d+\.?\d*|\.\d+))(?:px)?(?=\s|$)/g)].map((m) =>
      Number(m[2]),
    );
    const [x = 0, y = 0, blur = 0, spread = 0] = lengths;
    reach = Math.max(reach, Math.max(Math.abs(x), Math.abs(y)) + 1.5 * Math.max(blur, 0) + spread);
  }
  return Math.ceil(Math.max(reach, 0));
}
