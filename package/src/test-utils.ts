import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { compile } from "tailwindcss";

export const VARIANTS: Record<string, string[]> = {
  "": ["border-radius"],
  t: ["border-top-left-radius", "border-top-right-radius"],
  r: ["border-top-right-radius", "border-bottom-right-radius"],
  b: ["border-bottom-left-radius", "border-bottom-right-radius"],
  l: ["border-top-left-radius", "border-bottom-left-radius"],
  s: ["border-start-start-radius", "border-end-start-radius"],
  e: ["border-start-end-radius", "border-end-end-radius"],
  tl: ["border-top-left-radius"],
  tr: ["border-top-right-radius"],
  br: ["border-bottom-right-radius"],
  bl: ["border-bottom-left-radius"],
  ss: ["border-start-start-radius"],
  se: ["border-start-end-radius"],
  es: ["border-end-start-radius"],
  ee: ["border-end-end-radius"],
};

const require = createRequire(import.meta.url);

function resolveStylesheetPath(id: string, base: string): string {
  if (id === "tailwindcss") {
    return require.resolve("tailwindcss/index.css");
  }
  if (id.startsWith("tailwindcss/")) {
    return require.resolve(id.endsWith(".css") ? id : `${id}.css`);
  }
  return join(base, id);
}

async function loadStylesheet(id: string, base: string) {
  const path = resolveStylesheetPath(id, base);
  const content = await readFile(path, "utf-8");
  return { path, base: dirname(path), content };
}

async function loadModule(id: string, base: string, _resourceHint: "plugin" | "config") {
  const path = join(base, id);
  const module = await import(path);
  return { path, base, module: module.default ?? module };
}

function extractUtilitiesLayer(css: string): string {
  const match = /@layer utilities \{([\s\S]*)\}\s*$/.exec(css);
  return match?.[1]?.trim() ?? "";
}

export function createCompiler(srcDir: string) {
  async function compileCss(candidates: string[]): Promise<string> {
    const input = `
@import "tailwindcss";
@import "../dist/tailwind/utils.css";
`;
    const compiler = await compile(input, {
      base: srcDir,
      loadStylesheet,
      loadModule,
    });
    return extractUtilitiesLayer(compiler.build(candidates));
  }

  async function compilePlugin(candidates: string[], pluginBlock = ""): Promise<string> {
    const pluginDecl = pluginBlock
      ? `@plugin "./tailwind.ts" {\n${pluginBlock}\n}`
      : `@plugin "./tailwind.ts";`;
    const input = `
@import "tailwindcss";
${pluginDecl}
`;
    const compiler = await compile(input, {
      base: srcDir,
      loadStylesheet,
      loadModule,
    });
    return extractUtilitiesLayer(compiler.build(candidates));
  }

  return { compileCss, compilePlugin };
}
