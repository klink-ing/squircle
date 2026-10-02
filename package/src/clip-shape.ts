/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

/**
 * Turns an element's computed `clip-path` into polygons, so the pill
 * polyfill can intersect it with the pill's outline: an element has only one
 * `clip-path`, and the polyfill needs it for the pill, so whatever clip the
 * element already had — `sr-only`'s `inset(50%)`, an arbitrary
 * `[clip-path:…]` — has to be folded into the one it sets.
 */

export interface Point {
  x: number;
  y: number;
}

/** The clip as closed polygons in border-box coordinates, with its fill rule. */
export interface ClipShape {
  rule: "nonzero" | "evenodd";
  rings: Point[][];
}

/** Border, padding and margin widths, top, right, bottom, left, in px. */
export interface BoxEdges {
  border: [number, number, number, number];
  padding: [number, number, number, number];
  margin: [number, number, number, number];
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Splits at top-level `separator`s, leaving parentheses and quotes whole. */
function split(value: string, separator: "," | " "): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (const ch of value) {
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0 && (separator === "," ? ch === "," : /\s/.test(ch))) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * A computed `<length-percentage>` in px, with `%` of `basis`: a px value, a
 * percentage, or the `calc()` sum of both a computed value reduces to. `NaN`
 * for anything else.
 */
function length(token: string, basis: number): number {
  const calc = /^calc\((.*)\)$/.exec(token);
  const terms = calc ? calc[1] : token;
  let total = 0;
  let matched = "";
  for (const m of (terms as string).matchAll(/\s*([+-]?)\s*(-?[\d.]+(?:e[+-]?\d+)?)(px|%)?\s*/gi)) {
    const value = Number(m[2]) * (m[1] === "-" ? -1 : 1);
    if (m[3] === "%") total += (value * basis) / 100;
    else if (m[3] === "px" || value === 0) total += value;
    else return Number.NaN;
    matched += m[0];
  }
  return matched.length === (terms as string).length && matched.trim() ? total : Number.NaN;
}

const KEYWORD_PERCENT: Record<string, number> = {
  left: 0,
  top: 0,
  center: 50,
  right: 100,
  bottom: 100,
};

/** A `<position>` within `box`, as one, two or four computed tokens. */
function position(tokens: string[], box: Box): Point {
  const along = (token: string, basis: number) =>
    token in KEYWORD_PERCENT
      ? ((KEYWORD_PERCENT[token] as number) * basis) / 100
      : length(token, basis);
  const vertical = (t: string | undefined) => t === "top" || t === "bottom";
  const horizontal = (t: string | undefined) => t === "left" || t === "right";
  let x = Number.NaN;
  let y = Number.NaN;
  if (tokens.length === 0) {
    x = box.width / 2;
    y = box.height / 2;
  } else if (tokens.length === 1) {
    const [t] = tokens as [string];
    if (vertical(t)) {
      x = box.width / 2;
      y = along(t, box.height);
    } else {
      x = along(t, box.width);
      y = box.height / 2;
    }
  } else if (tokens.length === 2) {
    let [a, b] = tokens as [string, string];
    if (vertical(a) || horizontal(b)) [a, b] = [b, a];
    x = along(a, box.width);
    y = along(b, box.height);
  } else if (tokens.length === 4) {
    // `left 10px top 20px`, either way round: offsets from the named edges.
    for (let i = 0; i < 4; i += 2) {
      const edge = tokens[i] as string;
      const offset = tokens[i + 1] as string;
      const basis = vertical(edge) ? box.height : box.width;
      const from = length(offset, basis);
      const at = edge === "right" || edge === "bottom" ? basis - from : from;
      if (vertical(edge)) y = at;
      else if (horizontal(edge)) x = at;
    }
  }
  return { x: box.x + x, y: box.y + y };
}

/** Segments for an arc of radius `r` turning `angle`, keeping chords within ~0.1px. */
function arcSegments(r: number, angle: number): number {
  if (!(r > 0.1)) return 1;
  const step = 2 * Math.acos(1 - 0.1 / r);
  return Math.min(Math.max(Math.ceil(angle / step), 2), 64);
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number): Point[] {
  // A multiple of four puts a vertex on each extreme, so the polygon spans
  // the full ellipse.
  const n = Math.ceil(Math.max(arcSegments(Math.max(rx, ry), 2 * Math.PI), 12) / 4) * 4;
  const points: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    points.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return points;
}

/** The four corner radii of `round …`, as border-radius expands them. */
function cornerRadii(tokens: string[], width: number, height: number): [number, number][] | null {
  const slash = tokens.indexOf("/");
  const xs = slash === -1 ? tokens : tokens.slice(0, slash);
  const ys = slash === -1 ? tokens : tokens.slice(slash + 1);
  const expand = (values: string[]) => {
    const [a, b = a, c = a, d = b] = values;
    return [a, b, c, d] as string[];
  };
  const rx = expand(xs).map((t) => length(t, width));
  const ry = expand(ys).map((t) => length(t, height));
  if ([...rx, ...ry].some((v) => !Number.isFinite(v))) return null;
  const pairs = rx.map(
    (x, i) => [Math.max(x, 0), Math.max(ry[i] as number, 0)] as [number, number],
  );
  // Radii that overlap are scaled down together, as CSS does for borders.
  const [tl, tr, br, bl] = pairs as [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
  const scale = Math.min(
    1,
    width / (tl[0] + tr[0] || 1),
    width / (bl[0] + br[0] || 1),
    height / (tl[1] + bl[1] || 1),
    height / (tr[1] + br[1] || 1),
  );
  return pairs.map(([x, y]) => [x * scale, y * scale]);
}

function roundedRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
  radii: [number, number][] | null,
): Point[] {
  if (right <= left || bottom <= top) return [];
  if (!radii || radii.every(([x, y]) => x <= 0 || y <= 0)) {
    return [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ];
  }
  // Clockwise from the top-left corner, each corner a quarter ellipse.
  const corners: [number, number, number][] = [
    [left, top, Math.PI],
    [right, top, -Math.PI / 2],
    [right, bottom, 0],
    [left, bottom, Math.PI / 2],
  ];
  const points: Point[] = [];
  corners.forEach(([x, y, start], i) => {
    const [rx, ry] = radii[i] as [number, number];
    if (rx <= 0 || ry <= 0) {
      points.push({ x, y });
      return;
    }
    const cx = x === left ? left + rx : right - rx;
    const cy = y === top ? top + ry : bottom - ry;
    const n = arcSegments(Math.max(rx, ry), Math.PI / 2);
    for (let k = 0; k <= n; k++) {
      const a = start + ((Math.PI / 2) * k) / n;
      points.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
  });
  return points;
}

/** SVG path data with only straight and Bézier segments, flattened; `null` for arcs. */
function pathRings(d: string, origin: Point): Point[][] | null {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/g) ?? [];
  const rings: Point[][] = [];
  let ring: Point[] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  // The last control point, for the smooth curves that reflect it.
  let control: Point | null = null;
  let command = "";
  let i = 0;
  const num = () => Number(tokens[i++]);
  const emit = (px: number, py: number) => ring.push({ x: origin.x + px, y: origin.y + py });
  const curve = (points: Point[]) => {
    // de Casteljau at evenly spaced t, enough for a clip.
    const n = 16;
    for (let k = 1; k <= n; k++) {
      let level = points;
      const t = k / n;
      while (level.length > 1) {
        const next: Point[] = [];
        for (let j = 0; j < level.length - 1; j++) {
          const a = level[j] as Point;
          const b = level[j + 1] as Point;
          next.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
        level = next;
      }
      emit((level[0] as Point).x, (level[0] as Point).y);
    }
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i] as string)) command = tokens[i++] as string;
    else if (!command) return null;
    const relative = command === command.toLowerCase();
    const ox = relative ? x : 0;
    const oy = relative ? y : 0;
    switch (command.toUpperCase()) {
      case "M": {
        if (ring.length > 2) rings.push(ring);
        ring = [];
        x = ox + num();
        y = oy + num();
        startX = x;
        startY = y;
        emit(x, y);
        // Further pairs after a move are lines.
        command = relative ? "l" : "L";
        control = null;
        break;
      }
      case "L":
        x = ox + num();
        y = oy + num();
        emit(x, y);
        control = null;
        break;
      case "H":
        x = ox + num();
        emit(x, y);
        control = null;
        break;
      case "V":
        y = oy + num();
        emit(x, y);
        control = null;
        break;
      case "C":
      case "S": {
        const c1: Point =
          command.toUpperCase() === "C"
            ? { x: ox + num(), y: oy + num() }
            : control && /[CS]/i.test(command)
              ? { x: 2 * x - control.x, y: 2 * y - control.y }
              : { x, y };
        const c2 = { x: ox + num(), y: oy + num() };
        const end = { x: ox + num(), y: oy + num() };
        curve([{ x, y }, c1, c2, end]);
        control = c2;
        x = end.x;
        y = end.y;
        break;
      }
      case "Q":
      case "T": {
        const c: Point =
          command.toUpperCase() === "Q"
            ? { x: ox + num(), y: oy + num() }
            : control
              ? { x: 2 * x - control.x, y: 2 * y - control.y }
              : { x, y };
        const end = { x: ox + num(), y: oy + num() };
        curve([{ x, y }, c, end]);
        control = c;
        x = end.x;
        y = end.y;
        break;
      }
      case "Z":
        if (ring.length > 2) rings.push(ring);
        ring = [];
        x = startX;
        y = startY;
        control = null;
        break;
      default:
        // Arcs, or anything unknown.
        return null;
    }
    if ([x, y].some((v) => !Number.isFinite(v))) return null;
  }
  if (ring.length > 2) rings.push(ring);
  return rings;
}

const BOXES = [
  "border-box",
  "padding-box",
  "content-box",
  "margin-box",
  "fill-box",
  "stroke-box",
  "view-box",
];

function referenceBox(name: string, width: number, height: number, edges?: BoxEdges): Box | null {
  const shrink = (by: [number, number, number, number], sign: number, box: Box): Box => ({
    x: box.x + sign * by[3],
    y: box.y + sign * by[0],
    width: box.width - sign * (by[1] + by[3]),
    height: box.height - sign * (by[0] + by[2]),
  });
  const border: Box = { x: 0, y: 0, width, height };
  // For an HTML element the SVG boxes stand in for the CSS ones.
  if (name === "border-box" || name === "stroke-box" || name === "view-box") return border;
  if (!edges) return null;
  if (name === "margin-box") return shrink(edges.margin, -1, border);
  const padding = shrink(edges.border, 1, border);
  if (name === "padding-box") return padding;
  return shrink(edges.padding, 1, padding);
}

/** Whether a computed `clip-path` names a reference box other than the border box. */
export function needsBoxEdges(value: string): boolean {
  return /\b(padding-box|content-box|margin-box|fill-box)\b/.test(value);
}

/**
 * The computed `clip-path` `value` of an element `width` by `height`, as
 * polygons in its border box. `null` where it clips nothing (`none`, or just
 * the border box); `undefined` where it can't be expressed as polygons — a
 * `url()` reference, `shape()`, an arc in a `path()` — and is best left as is.
 */
export function clipShape(
  value: string,
  width: number,
  height: number,
  edges?: BoxEdges,
): ClipShape | null | undefined {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "none") return null;
  const parts = split(trimmed, " ");
  const boxName = parts.find((p) => BOXES.includes(p));
  const shape = parts.find((p) => !BOXES.includes(p));
  if (!shape) return boxName === "border-box" || boxName === "margin-box" ? null : undefined;
  const box = referenceBox(boxName ?? "border-box", width, height, edges);
  const fn = /^([a-z-]+)\((.*)\)$/s.exec(shape);
  if (!box || !fn || parts.length > 2) return undefined;
  const [, name, inner] = fn as unknown as [string, string, string];
  const nonzero = (rings: Point[][]): ClipShape => ({ rule: "nonzero", rings });

  if (name === "inset" || name === "rect" || name === "xywh") {
    const tokens = split(inner, " ");
    const round = tokens.indexOf("round");
    const values = round === -1 ? tokens : tokens.slice(0, round);
    let left: number;
    let top: number;
    let right: number;
    let bottom: number;
    if (name === "xywh") {
      if (values.length !== 4) return undefined;
      const [x, y, w, h] = values as [string, string, string, string];
      left = box.x + length(x, box.width);
      top = box.y + length(y, box.height);
      right = left + length(w, box.width);
      bottom = top + length(h, box.height);
    } else {
      const [a, b = a, c = a, d = b] = values;
      if (!a || values.length > 4) return undefined;
      if (name === "inset") {
        const [t, r, bo, l] = [
          length(a, box.height),
          length(b as string, box.width),
          length(c as string, box.height),
          length(d as string, box.width),
        ];
        // Insets that meet or cross leave nothing.
        left = box.x + l;
        right = box.x + box.width - r;
        top = box.y + t;
        bottom = box.y + box.height - bo;
      } else {
        // rect(top right bottom left), each from the top or left edge; `auto`
        // is that edge itself.
        const edge = (t: string, basis: number, auto: number) =>
          t === "auto" ? auto : length(t, basis);
        top = box.y + edge(a, box.height, 0);
        right = box.x + edge(b as string, box.width, box.width);
        bottom = box.y + edge(c as string, box.height, box.height);
        left = box.x + edge(d as string, box.width, 0);
      }
    }
    if ([left, top, right, bottom].some((v) => !Number.isFinite(v))) return undefined;
    let radii: [number, number][] | null = null;
    if (round !== -1) {
      radii = cornerRadii(tokens.slice(round + 1), right - left, bottom - top);
      if (!radii) return undefined;
    }
    const rect = roundedRect(left, top, right, bottom, radii);
    return nonzero(rect.length > 0 ? [rect] : []);
  }

  if (name === "circle" || name === "ellipse") {
    const tokens = split(inner, " ");
    const at = tokens.indexOf("at");
    const radii = at === -1 ? tokens : tokens.slice(0, at);
    const centre = position(at === -1 ? [] : tokens.slice(at + 1), box);
    if (!Number.isFinite(centre.x) || !Number.isFinite(centre.y)) return undefined;
    const sides = [
      Math.abs(centre.x - box.x),
      Math.abs(box.x + box.width - centre.x),
      Math.abs(centre.y - box.y),
      Math.abs(box.y + box.height - centre.y),
    ] as [number, number, number, number];
    const corners = [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x, box.y + box.height],
      [box.x + box.width, box.y + box.height],
    ].map(([x, y]) => Math.hypot((x as number) - centre.x, (y as number) - centre.y));
    if (name === "circle") {
      const [token = "closest-side"] = radii;
      const r =
        token === "closest-side"
          ? Math.min(...sides)
          : token === "farthest-side"
            ? Math.max(...sides)
            : token === "closest-corner"
              ? Math.min(...corners)
              : token === "farthest-corner"
                ? Math.max(...corners)
                : length(token, Math.hypot(box.width, box.height) / Math.SQRT2);
      if (!Number.isFinite(r)) return undefined;
      return nonzero(r > 0 ? [ellipsePoints(centre.x, centre.y, r, r)] : []);
    }
    const [tx = "closest-side", ty = "closest-side"] = radii;
    const axis = (token: string, near: number, far: number, basis: number) =>
      token === "closest-side"
        ? Math.min(near, far)
        : token === "farthest-side"
          ? Math.max(near, far)
          : length(token, basis);
    const rx = axis(tx, sides[0], sides[1], box.width);
    const ry = axis(ty, sides[2], sides[3], box.height);
    if (!Number.isFinite(rx) || !Number.isFinite(ry)) return undefined;
    return nonzero(rx > 0 && ry > 0 ? [ellipsePoints(centre.x, centre.y, rx, ry)] : []);
  }

  if (name === "polygon" || name === "path") {
    const args = split(inner, ",");
    let rule: ClipShape["rule"] = "nonzero";
    if (args[0] === "evenodd" || args[0] === "nonzero") rule = args.shift() as ClipShape["rule"];
    if (name === "path") {
      const d = /^["'](.*)["']$/s.exec(args[0] ?? "")?.[1];
      if (d === undefined || args.length !== 1) return undefined;
      const rings = pathRings(d, { x: box.x, y: box.y });
      return rings ? { rule, rings } : undefined;
    }
    const ring: Point[] = [];
    for (const pair of args) {
      const [px, py, extra] = split(pair, " ");
      if (px === undefined || py === undefined || extra !== undefined) return undefined;
      const point = { x: box.x + length(px, box.width), y: box.y + length(py, box.height) };
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return undefined;
      ring.push(point);
    }
    return { rule, rings: ring.length > 2 ? [ring] : [] };
  }

  return undefined;
}

/**
 * `subject` cut to the convex polygon `clip`, which runs clockwise in screen
 * coordinates (Sutherland–Hodgman). The subject may be any polygon: where it
 * is concave the result carries zero-width bridges along the clip's edge,
 * which fill nothing, and inside the clip every point keeps the winding
 * number it had, so either fill rule still applies.
 */
export function clipToConvex(subject: Point[], clip: Point[]): Point[] {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of subject) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  let out = subject;
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const a = clip[i] as Point;
    const b = clip[(i + 1) % clip.length] as Point;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const side = (x: number, y: number) => dx * (y - a.y) - dy * (x - a.x);
    // Most of the outline's edges are nowhere near the subject: when its
    // whole bounding box is inside one, the edge cuts nothing.
    if (
      side(minX, minY) >= 0 &&
      side(maxX, minY) >= 0 &&
      side(minX, maxY) >= 0 &&
      side(maxX, maxY) >= 0
    ) {
      continue;
    }
    const input = out;
    out = [];
    let prev = input[input.length - 1] as Point;
    let sp = side(prev.x, prev.y);
    for (const cur of input) {
      const sc = side(cur.x, cur.y);
      if (sc >= 0 !== sp >= 0) {
        const t = sp / (sp - sc);
        out.push({ x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t });
      }
      if (sc >= 0) out.push(cur);
      prev = cur;
      sp = sc;
    }
  }
  return out;
}
