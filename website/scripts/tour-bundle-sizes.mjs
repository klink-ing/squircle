import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const assets = new URL("../dist/_astro/", import.meta.url);
const files = await readdir(assets);
const groups = { tour: [], sharedReact: [], css: [] };
for (const file of files.sort()) {
  const group = file.startsWith("GuidedExplorer.")
    ? "tour"
    : /^(client|react|jsx-runtime|chunk)\..*\.js$/.test(file)
      ? "sharedReact"
      : file.endsWith(".css")
        ? "css"
        : null;
  if (!group) continue;
  const bytes = await readFile(new URL(file, assets));
  groups[group].push({ file, raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length });
}
for (const [group, rows] of Object.entries(groups)) {
  console.log(group, rows);
  console.log(
    "total",
    rows.reduce((sum, row) => ({ raw: sum.raw + row.raw, gzip: sum.gzip + row.gzip }), {
      raw: 0,
      gzip: 0,
    }),
  );
}
const html = await readFile(new URL("../dist/tour/index.html", import.meta.url));
console.log("tour HTML (includes Astro inline hydration)", {
  raw: html.length,
  gzip: gzipSync(html, { level: 9 }).length,
});
console.log("Directory:", fileURLToPath(assets));
console.log(
  "Bytes; gzip level 9 per file, summed. Tour includes GSAP + @gsap/react + application/math/SVG/Explore; shared React includes ReactDOM and JSX helpers. CSS is the site's stylesheet, not an engine-only delta. Unrelated DemoEmbed omitted.",
);
