import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const directory = fileURLToPath(new URL("../dist/_astro/", import.meta.url));
const files = readdirSync(directory);
const groups = {
  "Tour + Motion (includes SVG/math and Explore)": /^GuidedExplorer\..*\.js$/,
  "Shared React + React DOM + Astro React client + JSX": /^(client|react|jsx-runtime)\..*\.js$/,
  "Shared bundler helpers": /^chunk\..*\.js$/,
  "Site CSS (all routes)": /\.css$/,
};
for (const [label, pattern] of Object.entries(groups)) {
  let raw = 0;
  let gzip = 0;
  for (const file of files.filter((file) => pattern.test(file))) {
    const bytes = readFileSync(`${directory}/${file}`);
    raw += bytes.length;
    gzip += gzipSync(bytes).length;
    console.log(`${file}: ${bytes.length} raw / ${gzipSync(bytes).length} gzip bytes`);
  }
  console.log(`${label}: ${raw} raw / ${gzip} gzip bytes\n`);
}
const js = files.filter((file) => file.endsWith(".js"));
for (const file of js) {
  if (
    /motion-studio|__mtl|@mtl-client|remotion/i.test(readFileSync(`${directory}/${file}`, "utf8"))
  ) {
    throw new Error(`Development/editor code found in production: ${file}`);
  }
}
console.log("Production JavaScript contains no Studio or Remotion markers.");
