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
  // Tailwind preserves /*! ... */ license comments after the final layer.
  const match = /@layer utilities \{([\s\S]*)\}\s*(?:\/\*![\s\S]*?\*\/\s*)*$/.exec(css);
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

  async function compilePlugin(
    candidates: string[],
    pluginBlock = "",
    plugin = "./tailwind.ts",
  ): Promise<string> {
    const pluginDecl = pluginBlock
      ? `@plugin "${plugin}" {\n${pluginBlock}\n}`
      : `@plugin "${plugin}";`;
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

  /** The whole build, not just the utilities layer — for base-layer output. */
  async function compilePluginAll(
    candidates: string[],
    pluginBlock = "",
    plugin = "./tailwind.ts",
  ): Promise<string> {
    const pluginDecl = pluginBlock
      ? `@plugin "${plugin}" {\n${pluginBlock}\n}`
      : `@plugin "${plugin}";`;
    const compiler = await compile(`\n@import "tailwindcss";\n${pluginDecl}\n`, {
      base: srcDir,
      loadStylesheet,
      loadModule,
    });
    return compiler.build(candidates);
  }

  return { compileCss, compilePlugin, compilePluginAll };
}

// --- Corner cascade model ----------------------------------------------------
//
// Utilities that each set a radius can still fight over a custom property they
// share, which no single utility's output shows. These helpers put several
// utilities on one element the way a browser would: later rules win, and a
// `var()` is only substituted once the cascade is done, so every property that
// reads it gets whichever value won.

type Declaration = [property: string, value: string];
/** One rule's declarations: those outside its `@supports` block, then those inside. */
export type CascadeRule = { base: Declaration[]; supports: Declaration[] };
export type Corner = "tl" | "tr" | "br" | "bl";

function blockEnd(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return i;
  }
  throw new Error("unbalanced braces");
}

function declarations(body: string): Declaration[] {
  return [...body.matchAll(/([-\w]+)\s*:\s*([^;{}]+);/g)].map(
    ([, property, value]) => [property!, value!.trim()] as Declaration,
  );
}

/** Each rule in compiled utilities CSS, in source order. */
export function parseRules(css: string): CascadeRule[] {
  const rules: CascadeRule[] = [];
  for (let open = css.indexOf("{"); open !== -1;) {
    const close = blockEnd(css, open);
    let body = css.slice(open + 1, close);
    const supports: Declaration[] = [];
    const at = body.indexOf("@supports");
    if (at !== -1) {
      const innerOpen = body.indexOf("{", at);
      const innerClose = blockEnd(body, innerOpen);
      supports.push(...declarations(body.slice(innerOpen + 1, innerClose)));
      body = body.slice(0, at) + body.slice(innerClose + 1);
    }
    rules.push({ base: declarations(body), supports });
    open = css.indexOf("{", close);
  }
  return rules;
}

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** A CSS-in-JS object (as the Panda transforms return) as a rule. */
export function ruleFromObject(obj: Record<string, unknown>): CascadeRule {
  const base: Declaration[] = [];
  const supports: Declaration[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("@supports")) {
      for (const [k, v] of Object.entries(value as Record<string, string>)) {
        supports.push([kebab(k), String(v)]);
      }
    } else {
      base.push([kebab(key), String(value)]);
    }
  }
  return { base, supports };
}

/** Each radius property and the corner it sets, logical ones as in left-to-right text. */
const RADIUS_CORNERS: Record<string, readonly Corner[]> = {
  "border-radius": ["tl", "tr", "br", "bl"],
  "border-top-left-radius": ["tl"],
  "border-top-right-radius": ["tr"],
  "border-bottom-right-radius": ["br"],
  "border-bottom-left-radius": ["bl"],
  "border-start-start-radius": ["tl"],
  "border-start-end-radius": ["tr"],
  "border-end-end-radius": ["br"],
  "border-end-start-radius": ["bl"],
};

/**
 * The radius each corner ends up with on an element carrying all of `rules`,
 * in a browser that does or doesn't support `corner-shape`, with any custom
 * property the rules set substituted in. `var()`s nobody set are left as is.
 */
export function resolveCorners(
  rules: CascadeRule[],
  { supported }: { supported: boolean },
): Record<Corner, string> {
  const corners: Partial<Record<Corner, string>> = {};
  const custom = new Map<string, string>();
  for (const rule of rules) {
    for (const [property, value] of supported ? [...rule.base, ...rule.supports] : rule.base) {
      if (property.startsWith("--")) custom.set(property, value);
      for (const corner of RADIUS_CORNERS[property] ?? []) corners[corner] = value;
    }
  }
  const substitute = (value: string): string => {
    const next = value.replace(
      /var\((--[-\w]+)\)/g,
      (ref, name: string) => custom.get(name) ?? ref,
    );
    return next === value ? value : substitute(next);
  };
  const resolved = {} as Record<Corner, string>;
  for (const corner of ["tl", "tr", "br", "bl"] as const) {
    resolved[corner] = substitute(corners[corner] ?? "0");
  }
  return resolved;
}
