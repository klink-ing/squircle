import * as stylex from "@stylexjs/stylex";

/**
 * StyleX squircle utilities.
 *
 * Each entry is a *dynamic* style — a function that takes a `radius` (and an
 * optional superellipse `amt`) and produces a `borderRadius` + `cornerShape`
 * pair gated behind `@supports (corner-shape: superellipse(2))`. Browsers that
 * don't support `corner-shape` fall back to a plain rounded rectangle at the
 * same radius.
 *
 * ```tsx
 * import * as stylex from '@stylexjs/stylex';
 * import { squircle } from '@klinking/squircle/stylex';
 *
 * <div {...stylex.props(squircle.all('1rem'))} />
 * <div {...stylex.props(squircle.topLeft('0.5rem', 3))} />
 * ```
 *
 * If `amt` is omitted, the corrected radius and `corner-shape` resolve through
 * `var(--squircle-amt, 2)` — set that custom property anywhere up the cascade
 * to drive the superellipse exponent globally.
 *
 * **Constraint** — StyleX's babel plugin requires `stylex.create(...)` to receive
 * a fully-static object literal, and forbids destructuring, spreading, or
 * default values on dynamic-style function parameters. The whole 15-variant
 * table is therefore spelled out here verbatim. Keep it that way; tooling
 * relies on every variant being statically analyzable at this call site.
 */
export const squircle = stylex.create({
  all: (radius: string | number, amt: string | number | undefined) => ({
    borderRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),

  // --- Per-side physical variants ---

  top: (radius: string | number, amt: string | number | undefined) => ({
    borderTopLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    borderTopRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),

  right: (radius: string | number, amt: string | number | undefined) => ({
    borderTopRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    borderBottomRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),

  bottom: (radius: string | number, amt: string | number | undefined) => ({
    borderBottomLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    borderBottomRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),

  left: (radius: string | number, amt: string | number | undefined) => ({
    borderTopLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    borderBottomLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),

  // --- Per-side logical variants ---

  start: (radius: string | number, amt: string | number | undefined) => ({
    borderStartStartRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    borderEndStartRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),

  end: (radius: string | number, amt: string | number | undefined) => ({
    borderStartEndRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    borderEndEndRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),

  // --- Per-corner physical variants ---

  topLeft: (radius: string | number, amt: string | number | undefined) => ({
    borderTopLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),

  topRight: (radius: string | number, amt: string | number | undefined) => ({
    borderTopRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),

  bottomRight: (radius: string | number, amt: string | number | undefined) => ({
    borderBottomRightRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),

  bottomLeft: (radius: string | number, amt: string | number | undefined) => ({
    borderBottomLeftRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),

  // --- Per-corner logical variants ---

  startStart: (radius: string | number, amt: string | number | undefined) => ({
    borderStartStartRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),

  startEnd: (radius: string | number, amt: string | number | undefined) => ({
    borderStartEndRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),

  endStart: (radius: string | number, amt: string | number | undefined) => ({
    borderEndStartRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),

  endEnd: (radius: string | number, amt: string | number | undefined) => ({
    borderEndEndRadius: {
      default: radius,
      "@supports (corner-shape: superellipse(2))": `calc(${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * ${amt ?? "var(--squircle-amt, 2)"}))))`,
    },
    cornerShape: {
      default: null,
      "@supports (corner-shape: superellipse(2))": `superellipse(${amt ?? "var(--squircle-amt, 2)"})`,
    },
  }),
});
