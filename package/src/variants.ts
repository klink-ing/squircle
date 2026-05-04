export const DEFAULT_AMT = 2 as const;
export const DEFAULT_AMOUNT_VAR_NAME = "--squircle-amt" as const;
export const DEFAULT_R_VAR_NAME = "--squircle-r" as const;
export const DEFAULT_AMT_CSS = `var(${DEFAULT_AMOUNT_VAR_NAME}, ${DEFAULT_AMT})` as const;

export const getCornerShape = (varName: string = DEFAULT_AMOUNT_VAR_NAME) =>
  `superellipse(var(${varName}, ${DEFAULT_AMT}))` as const;

export function correctedRadius(radius: string, amt: string = DEFAULT_AMT_CSS): string {
  return `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt}))))` as const;
}

type SectionComment = { comment: string };
type VariantEntry = string[] | SectionComment;

function isComment(entry: VariantEntry): entry is SectionComment {
  return !Array.isArray(entry);
}

export const SUPPORTS_RULE = "@supports (corner-shape: superellipse(2))";

export const VARIANTS: Record<string, VariantEntry> & Record<`$comment-${string}`, SectionComment> =
  {
    "": ["border-radius"],
    "$comment-physical-sides": { comment: "/* --- Per-side physical variants --- */" },
    t: ["border-top-left-radius", "border-top-right-radius"],
    r: ["border-top-right-radius", "border-bottom-right-radius"],
    b: ["border-bottom-left-radius", "border-bottom-right-radius"],
    l: ["border-top-left-radius", "border-bottom-left-radius"],
    "$comment-logical-sides": { comment: "/* --- Per-side logical variants --- */" },
    s: ["border-start-start-radius", "border-end-start-radius"],
    e: ["border-start-end-radius", "border-end-end-radius"],
    "$comment-physical-corners": { comment: "/* --- Per-corner physical variants --- */" },
    tl: ["border-top-left-radius"],
    tr: ["border-top-right-radius"],
    br: ["border-bottom-right-radius"],
    bl: ["border-bottom-left-radius"],
    "$comment-logical-corners": { comment: "/* --- Per-corner logical variants --- */" },
    ss: ["border-start-start-radius"],
    se: ["border-start-end-radius"],
    es: ["border-end-start-radius"],
    ee: ["border-end-end-radius"],
  };

export function variantEntries(): [string, string[]][] {
  return Object.entries(VARIANTS).filter(
    (entry): entry is [string, string[]] => !isComment(entry[1]),
  );
}

export function usesIntermediateVar(suffix: string): boolean {
  const entry = VARIANTS[suffix];
  if (!entry || isComment(entry)) return false;
  return suffix === "" || entry.length > 1;
}

/**
 * Property-name table used by the Panda preset and StyleX module.
 * Each entry maps a Tailwind variant suffix to the camelCase utility name and
 * Panda-style shorthand. The descriptive label is used in generated docs and
 * snapshot tests. Order matches `VARIANTS`.
 */
export type CamelVariant = {
  /** Suffix from `VARIANTS` ("" for all-corners). */
  suffix: string;
  /** Full camelCase property name, e.g. "squircleTopLeftRadius". */
  property: string;
  /** Short alias following Panda's `rounded*` shorthand convention. */
  shorthand: string;
  /** Side/corner direction key (passed to a side-aware factory). */
  side:
    | "all"
    | "top"
    | "right"
    | "bottom"
    | "left"
    | "start"
    | "end"
    | "topLeft"
    | "topRight"
    | "bottomRight"
    | "bottomLeft"
    | "startStart"
    | "startEnd"
    | "endStart"
    | "endEnd";
};

export const CAMEL_VARIANTS: readonly CamelVariant[] = [
  { suffix: "", property: "squircleRadius", shorthand: "squircle", side: "all" },
  { suffix: "t", property: "squircleTopRadius", shorthand: "squircleTop", side: "top" },
  { suffix: "r", property: "squircleRightRadius", shorthand: "squircleRight", side: "right" },
  { suffix: "b", property: "squircleBottomRadius", shorthand: "squircleBottom", side: "bottom" },
  { suffix: "l", property: "squircleLeftRadius", shorthand: "squircleLeft", side: "left" },
  { suffix: "s", property: "squircleStartRadius", shorthand: "squircleStart", side: "start" },
  { suffix: "e", property: "squircleEndRadius", shorthand: "squircleEnd", side: "end" },
  {
    suffix: "tl",
    property: "squircleTopLeftRadius",
    shorthand: "squircleTopLeft",
    side: "topLeft",
  },
  {
    suffix: "tr",
    property: "squircleTopRightRadius",
    shorthand: "squircleTopRight",
    side: "topRight",
  },
  {
    suffix: "br",
    property: "squircleBottomRightRadius",
    shorthand: "squircleBottomRight",
    side: "bottomRight",
  },
  {
    suffix: "bl",
    property: "squircleBottomLeftRadius",
    shorthand: "squircleBottomLeft",
    side: "bottomLeft",
  },
  {
    suffix: "ss",
    property: "squircleStartStartRadius",
    shorthand: "squircleStartStart",
    side: "startStart",
  },
  {
    suffix: "se",
    property: "squircleStartEndRadius",
    shorthand: "squircleStartEnd",
    side: "startEnd",
  },
  {
    suffix: "es",
    property: "squircleEndStartRadius",
    shorthand: "squircleEndStart",
    side: "endStart",
  },
  {
    suffix: "ee",
    property: "squircleEndEndRadius",
    shorthand: "squircleEndEnd",
    side: "endEnd",
  },
];

const KEBAB_TO_CAMEL_CACHE = new Map<string, string>();
function toCamel(kebab: string): string {
  const cached = KEBAB_TO_CAMEL_CACHE.get(kebab);
  if (cached) return cached;
  const camel = kebab.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  KEBAB_TO_CAMEL_CACHE.set(kebab, camel);
  return camel;
}

export type CssLikeObject = Record<string, string | number | null | Record<string, string | number | null>>;

export interface SquircleCssObjOptions {
  /** Override the `--squircle-amt` variable name (default `--squircle-amt`). */
  amtVar?: string;
  /** Override the intermediate corrected-radius variable name (default `--squircle-r`). */
  rVar?: string;
  /**
   * Output property name case. `kebab` (default) emits `border-radius`-style keys
   * for Tailwind plugins and raw CSS. `camel` emits `borderRadius`-style keys
   * for Panda/StyleX/CSS-in-JS callers.
   */
  case?: "kebab" | "camel";
  /**
   * When false, never emit the `--squircle-r` intermediate variable: the corrected
   * `calc(...)` is inlined into each property. Defaults to the same heuristic
   * Tailwind uses (true for all-corners and multi-prop sides, false for single
   * corners). Pass `false` for callers that prefer flat output (StyleX cannot
   * read a custom property set in the same rule it's used in without a separate
   * declaration cycle, so the inlined form is more portable).
   */
  useIntermediateVar?: boolean;
}

/**
 * Build the framework-agnostic CSS-in-JS object for one squircle utility.
 * Returns the same shape Tailwind's `matchUtilities` consumes, with an
 * `@supports` block that gates the corrected radius behind `corner-shape`
 * support. Used by the Tailwind plugin, the static-CSS generator, the Panda
 * preset, and the StyleX helpers.
 */
export function squircleCssObj(
  props: string[],
  radius: string,
  options: SquircleCssObjOptions = {},
): CssLikeObject {
  const amtVar = options.amtVar ?? DEFAULT_AMOUNT_VAR_NAME;
  const rVar = options.rVar ?? DEFAULT_R_VAR_NAME;
  const keyCase = options.case ?? "kebab";
  const useIntermediate =
    options.useIntermediateVar ?? (props.length > 1 || props[0] === "border-radius");

  const amtCss = `var(${amtVar}, ${DEFAULT_AMT})`;
  const rCss = `var(${rVar})`;
  const cornerShape = getCornerShape(amtVar);
  const corrected = correctedRadius(radius, amtCss);

  const cornerShapeKey = keyCase === "camel" ? "cornerShape" : "corner-shape";
  const propKey = (p: string) => (keyCase === "camel" ? toCamel(p) : p);

  const fallback: Record<string, string> = {};
  for (const p of props) fallback[propKey(p)] = radius;

  const supportsBlock: Record<string, string> = {};
  if (useIntermediate) {
    supportsBlock[rVar] = corrected;
    for (const p of props) supportsBlock[propKey(p)] = rCss;
  } else {
    for (const p of props) supportsBlock[propKey(p)] = corrected;
  }
  supportsBlock[cornerShapeKey] = cornerShape;

  return {
    ...fallback,
    [SUPPORTS_RULE]: supportsBlock,
  };
}

export { isComment };
export type { SectionComment, VariantEntry };
