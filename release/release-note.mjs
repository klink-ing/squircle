/**
 * The release note a PR carries for the release notes: the paragraph under its
 * `## Release note` heading. Shared by the notes generator (notes.mjs), the
 * promotion preview (preview.mjs) and the PR check (check-release-note.mjs).
 * No dependencies, so the workflows can run it without installing anything.
 */

/** Longest note allowed, in characters. A note is a line in a list, not a description. */
export const MAX_LENGTH = 300;

/** Types that appear in the release notes, in order, with their headings. */
export const SECTIONS = [
  ["feat", "Features"],
  ["fix", "Fixes"],
  ["perf", "Performance"],
];

const HEADING = /^#{2,3}[ \t]*release[ \t]+notes?[ \t]*$/im;
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
 * A PR body's release note: the first paragraph under its `## Release note`
 * heading, comments aside. Only the first, so a footer after it (a sign-off,
 * a co-author) stays out of the release notes. `null` without the heading,
 * `""` when there's nothing under it.
 */
export function extractReleaseNote(body) {
  if (!body) return null;
  const text = body.replace(/\r\n/g, "\n");
  const heading = HEADING.exec(text);
  if (!heading) return null;
  let section = text.slice(heading.index + heading[0].length);
  const next = NEXT_HEADING.exec(section);
  if (next) section = section.slice(0, next.index);
  return section
    .replace(COMMENT, "")
    .trim()
    .split(/\n[ \t]*\n/)[0]
    .trim();
}

/** Whether a note says the change needs no line in the release notes. */
export function isNone(note) {
  return NONE.test(note);
}

/**
 * One line of release notes from a note: a single paragraph that starts with a
 * capital letter and ends with a full stop.
 */
export function normalizeNote(note) {
  let text = note.replace(/\s+/g, " ").trim();
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?)`]$/.test(text) ? text : `${text}.`;
}

/**
 * A commit's or PR title's conventional header, as the version is worked out
 * from it: `{ type, scope, subject, breaking, pr }`. `type` is null when the
 * header isn't conventional, like the bot's "Merge alpha into main".
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

/**
 * Checks a PR's release note. Promotions and syncs don't need one; features,
 * fixes, performance changes and breaking changes do. Returns a message
 * saying what to change, or null when the note is fine.
 */
export function checkReleaseNote({ title, body, headRef }) {
  if (isPromotionHead(headRef)) return null;
  const { type, breaking } = parseCommit(title);
  const needed = breaking || SECTIONS.some(([sectionType]) => sectionType === type);
  const note = extractReleaseNote(body);

  if (!needed && !note) return null;
  if (note === null) {
    return `Add a "## Release note" section to the description: one or two sentences for people using the package, saying what's new or fixed and how to use it. It goes into the release notes as written. Write "None" if users won't notice the change.`;
  }
  if (note === "") {
    return `The "## Release note" section is empty. Write one or two sentences for people using the package, or "None" if they won't notice the change.`;
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
