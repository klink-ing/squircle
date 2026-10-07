/**
 * Release notes written on PRs, and the rules for them. Shared by the notes
 * generator (notes.mjs), the promotion preview (preview.mjs) and the PR check
 * (check-release-note.mjs). No dependencies, so the workflows can run it
 * without installing anything.
 *
 * Two kinds:
 *
 * - A PR's `## Release note`: its first paragraph is the PR's line in the
 *   alpha and beta release notes, and in a release straight from main.
 * - A promotion PR's `## Release notes`: the stable release's notes, written by
 *   hand and published as they are. The section runs to the next `#`/`##`
 *   heading or `---` line, so it can hold `###` headings and lists.
 */

/** Longest line a PR's note can make, in characters. */
export const MAX_LENGTH = 300;

/** Types that appear in generated release notes, in order, with their headings. */
export const SECTIONS = [
  ["feat", "Features"],
  ["fix", "Fixes"],
  ["perf", "Performance"],
];

const HEADING = /^#{2,3}[ \t]*release[ \t]+notes?[ \t]*$/im;
const NOTES_HEADING = /^#{2,3}[ \t]*release[ \t]+notes[ \t]*$/im;
const SECTION_END = /^(?:#{1,2}[ \t]|-{3,}[ \t]*$)/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const NEXT_HEADING = /^#{1,3}[ \t]/m;
const COMMENT = /<!--[\s\S]*?-->/g;
const NONE = /^none\.?$/i;

// The same patterns as the conventionalcommits preset that commit-analyzer
// uses, so a commit counts as a feature or a breaking change here exactly when
// it does for the version number.
const HEADER = /^(\w*)(?:\((.*)\))?!?: (.*)$/;
const BREAKING_HEADER = /^(\w*)(?:\((.*)\))?!: (.*)$/;
const BREAKING_NOTE = /^[\s|*]*BREAKING[ -]CHANGE[:\s]/m;

/**
 * The text after a body's release note heading, or null without one. With
 * `plural`, a `## Release notes` heading wins over an earlier `## Release
 * note`, like the one the PR template leaves above hand-written notes.
 */
function afterHeading(body, { plural = false } = {}) {
  if (!body) return null;
  const text = body.replace(/\r\n/g, "\n");
  const heading = (plural && NOTES_HEADING.exec(text)) || HEADING.exec(text);
  return heading ? text.slice(heading.index + heading[0].length) : null;
}

/** Where a promotion's notes end: the first `#`/`##` heading or `---` line outside a code block. */
function notesEnd(section) {
  let fence = null;
  let offset = 0;
  for (const line of section.split("\n")) {
    const marker = FENCE.exec(line)?.[1];
    if (fence) {
      const closes = marker?.[0] === fence[0] && marker.length >= fence.length;
      if (closes && !line.trim().slice(marker.length).trim()) fence = null;
    } else if (marker) {
      fence = marker;
    } else if (SECTION_END.test(line)) {
      return offset;
    }
    offset += line.length + 1;
  }
  return section.length;
}

/**
 * A PR's release note: the first paragraph under its `## Release note`
 * heading, comments aside. Only the first, so a footer after it (a sign-off,
 * a co-author) stays out. `null` without the heading, `""` when it's empty.
 */
export function extractReleaseNote(body) {
  let section = afterHeading(body);
  if (section === null) return null;
  const next = NEXT_HEADING.exec(section);
  if (next) section = section.slice(0, next.index);
  return section
    .replace(COMMENT, "")
    .trim()
    .split(/\n[ \t]*\n/)[0]
    .trim();
}

/**
 * A promotion PR's release notes: everything under its `## Release notes`
 * heading up to the next `#`/`##` heading or `---` line outside a code block,
 * comments aside. `null` without the heading, `""` when it's empty.
 */
export function extractReleaseNotes(body) {
  const section = afterHeading(body, { plural: true });
  if (section === null) return null;
  // Comments go first, so a `---` or heading in one doesn't end the notes.
  const text = section.replace(COMMENT, "");
  return text
    .slice(0, notesEnd(text))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Whether a note says the change needs no line in the release notes. */
export function isNone(note) {
  return NONE.test(note);
}

/**
 * One line of release notes from a note or a title: a single paragraph that
 * starts with a capital letter and ends with a full stop.
 */
export function normalizeNote(note) {
  let text = note.replace(/\s+/g, " ").trim();
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?)`]$/.test(text) ? text : `${text}.`;
}

/**
 * A commit's or PR title's conventional header, as the version is worked out
 * from it: `{ type, scope, subject, breaking, pr, body }`. `type` is null when
 * the header isn't conventional, like the bot's "Merge alpha into main".
 */
export function parseCommit(message) {
  const [header = "", ...rest] = message.replace(/\r\n/g, "\n").split("\n");
  const body = rest.join("\n");
  const match = HEADER.exec(header);
  const pr = /\(#(\d+)\)\s*$/.exec(header)?.[1];
  const subject = (match ? match[3] : header).replace(/\s*\(#\d+\)\s*$/, "");
  return {
    type: match ? match[1] : null,
    scope: match?.[2] ?? null,
    subject,
    breaking: BREAKING_HEADER.test(header) || BREAKING_NOTE.test(body),
    pr: pr ? Number(pr) : null,
    body,
  };
}

/** Whether a PR's head is one of the release branches or a sync/* branch. */
export function isPromotionHead(headRef) {
  return ["main", "beta", "alpha"].includes(headRef) || headRef.startsWith("sync/");
}

/** Whether a PR promotes alpha or beta into main, making a stable release. */
export function isStablePromotion({ headRef, baseRef }) {
  return baseRef === "main" && (headRef === "alpha" || headRef === "beta");
}

/**
 * Checks a PR's release note. Returns a message saying what to change, or null
 * when it's fine.
 *
 * - Features, fixes and performance changes into main need a `## Release
 *   note`, since they're released straight away ("None" will do).
 * - Breaking changes always need a real one, saying what to do.
 * - Otherwise a note is optional; the title stands in for it.
 * - Promotions and syncs need none here. A promotion into main needs its
 *   hand-written `## Release notes` only if it releases something, which the
 *   release notes preview works out and checks (preview.mjs).
 */
export function checkReleaseNote({ title, body, headRef, baseRef }) {
  if (isPromotionHead(headRef)) return null;

  const { type, breaking } = parseCommit(title);
  const releasable = SECTIONS.some(([sectionType]) => sectionType === type);
  const note = extractReleaseNote(body);

  if (!note) {
    if (breaking) {
      return `This is a breaking change, so it needs a "## Release note" section in the description: say what changed and what to do about it.`;
    }
    if (baseRef === "main" && releasable) {
      return `PRs into main are released straight away, so this one needs a "## Release note" section in the description: one or two sentences for people using the package. Write "None" if they won't notice the change.`;
    }
    return null;
  }
  if (isNone(note)) {
    return breaking
      ? `This is a breaking change, so its release note can't be "None": say what changed and what to do about it.`
      : null;
  }
  if (/^\s*([-*+]|\d+\.)\s/m.test(note)) {
    return `Write the release note as one short paragraph, not a list: it's one line in the release notes. The rest of the description is the place for detail.`;
  }
  const length = normalizeNote(note).length;
  if (length > MAX_LENGTH) {
    return `The release note is ${length} characters; keep it under ${MAX_LENGTH}. Say what changed for users and leave how it works to the description.`;
  }
  return null;
}
