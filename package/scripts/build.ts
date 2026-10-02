import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * The whole package build, as one step.
 *
 * `vp run` caches each `&&`-separated segment of a task command on its own, so
 * a chain of `vp pack && tsx generate-*.ts` could re-run the pack — which
 * empties dist/ first — while replaying the generators from cache, leaving
 * dist/ without the generated CSS. One script is one cache entry.
 */
const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const bin = (name: string) =>
  [
    join(pkgDir, "node_modules", ".bin", name),
    join(pkgDir, "..", "node_modules", ".bin", name),
  ].find(existsSync) ?? name;

const run = (file: string, args: string[]) =>
  execFileSync(file, args, { cwd: pkgDir, stdio: "inherit" });

run(bin("tsx"), ["scripts/generate-stylex.ts"]);
run(bin("vp"), ["pack"]);
run(bin("tsx"), ["scripts/generate-squircle-css.ts"]);
run(bin("tsx"), ["scripts/generate-pill-css.ts"]);
