import { execFileSync } from "node:child_process";
import { copyFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Compiles the Rust kernels in wasm/ to wasm/pill-shape-kernel.wasm, which is
 * committed: the package builds without a Rust toolchain, and vite.config.ts
 * inlines it into the paint worklet. Run after changing wasm/src/lib.rs, with
 * the `wasm32-unknown-unknown` target installed (`rustup target add`).
 */
const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const crate = join(pkgDir, "wasm");

execFileSync("cargo", ["build", "--release", "--target", "wasm32-unknown-unknown"], {
  cwd: crate,
  stdio: "inherit",
});
const bytes = readFileSync(
  join(crate, "target", "wasm32-unknown-unknown", "release", "pill_shape_kernel.wasm"),
);

copyFileSync(
  join(crate, "target", "wasm32-unknown-unknown", "release", "pill_shape_kernel.wasm"),
  join(crate, "pill-shape-kernel.wasm"),
);
console.log(`wasm/pill-shape-kernel.wasm: ${bytes.length} bytes`);
