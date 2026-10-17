/**
 * Placeholder for Tailwind v3 support coverage.
 *
 * The plugin's API surface (`plugin.withOptions`, `matchUtilities`,
 * `{ type: "length" | "number" }`, `theme("borderRadius")`) exists in both
 * v3 and v4, but the package is currently only declared and tested against
 * v4 (see `peerDependencies` in package.json).
 *
 * Before un-skipping: widen the peerDep to `>=3.0.0`, install v3 alongside
 * v4 as a dev dependency, document the `require()`-based config.js install
 * path in the README, and wire this file to compile against v3.
 *
 * Tracking: the PR this file was introduced in.
 */
import { describe, it } from "vitest";

describe.skip("plugin against Tailwind v3", () => {
  it.todo("plugin registers via tailwind.config.js { plugins: [require(...)] }");
  it.todo("matchUtilities { type: 'length' } resolves theme values");
  it.todo("matchUtilities { type: 'number' } rejects unit-bearing values like [1em]");
  it.todo("squircle-md emits the same CSS in v3 as in v4");
  it.todo("prefix option produces correctly namespaced classes");
  it.todo("amt-var option changes the CSS variable name");
  it.todo("squircle-t-md (multi-prop) uses intermediate --squircle-r variable");
  it.todo("squircle-tl-md (single-prop) inlines the correction directly");
});
