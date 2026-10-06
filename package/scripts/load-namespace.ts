import { readFileSync } from "node:fs";

/**
 * The one place the custom-property namespace is resolved.
 *
 * `SQUIRCLE_CSS_NAMESPACE` overrides it for a one-off build;
 * `squircle.cssNamespace` in package.json is the committed default for a
 * fork that wants it permanently. Importing this module first pins the
 * resolved value into the environment, which is where `variants.ts` reads it
 * from when it runs outside Vite (under `tsx`) and so has no define.
 */
export const DEFAULT_CSS_NAMESPACE = "squircle";

export function resolveCssNamespace(): string {
  return (
    process.env["SQUIRCLE_CSS_NAMESPACE"] ||
    JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).squircle
      ?.cssNamespace ||
    DEFAULT_CSS_NAMESPACE
  );
}

export const CSS_NAMESPACE: string = resolveCssNamespace();
process.env["SQUIRCLE_CSS_NAMESPACE"] = CSS_NAMESPACE;
