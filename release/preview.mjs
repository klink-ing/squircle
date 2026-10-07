/**
 * Prints the comment release-notes.yml keeps on a promotion PR: the version
 * and the release notes that adding the `promote` label would publish, made by
 * the same code as the real ones (notes.mjs).
 *
 * Into main, those are this PR's `## Release notes`, written by hand; below
 * them, every change since the last stable release, to write them from. A
 * promotion into main that releases something needs them ("None" won't do):
 * the check fails until they're written, and the promote bot waits for it.
 * Into beta, the notes are generated from the PRs.
 *
 * The version is worked out the way commit-analyzer does it, from the last
 * stable tag on the base branch. Prereleases (into beta) aren't numbered here.
 *
 * Reads BASE_REF, HEAD_REF, BASE_SHA, HEAD_SHA, PR_NUMBER and PR_BODY, plus
 * GITHUB_REPOSITORY and GITHUB_TOKEN to read the other PRs' notes.
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { extractReleaseNotes, isNone, isStablePromotion, parseCommit } from "./release-note.mjs";
import { generateSections, prBodyFetcher, releaseTitle, renderNotes, repoSlug } from "./notes.mjs";

export const MARKER = "<!-- release-notes-preview -->";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

/** The commits on head that base doesn't have, newest first. */
function commitsBetween(base, head) {
  return git("log", "--format=%H%x1f%B%x1e", `${base}..${head}`)
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, message] = entry.split("\x1f");
      return { hash, message: message.trim() };
    });
}

/** The next stable version after `tag` for these commits, or null for none. */
export function nextVersion(tag, commits) {
  const parsed = commits.map(({ message }) => parseCommit(message));
  const [major, minor, patch] = tag.replace(/^v/, "").split(".").map(Number);
  if (parsed.some((commit) => commit.breaking)) return `${major + 1}.0.0`;
  if (parsed.some((commit) => commit.type === "feat")) return `${major}.${minor + 1}.0`;
  if (parsed.some((commit) => ["fix", "perf"].includes(commit.type))) {
    return `${major}.${minor}.${patch + 1}`;
  }
  return null;
}

/**
 * The comment, for a promotion PR whose `commits` (newest first) aren't on the
 * base yet, and whether the PR is `ok` to promote: false when it releases a
 * stable version without written notes. `previousTag` is the last stable tag
 * on main; unused into beta.
 */
export async function previewComment({
  baseRef,
  headRef,
  commits,
  previousTag,
  prBody,
  fetchPrBody,
  slug,
  date,
}) {
  const lines = [MARKER, "### Release notes preview", ""];

  if (!isStablePromotion({ headRef, baseRef })) {
    const { markdown } = await renderNotes({
      stable: false,
      version: "Next beta",
      date,
      commits,
      fetchPrBody,
      slug,
    });
    lines.push(
      "Adding the `promote` label releases the next beta, with notes generated from its PRs:",
      "",
      "---",
      "",
      markdown.trim(),
      "",
      "---",
      "",
      `<sub>Each line is a PR's "Release note", or its title. Edit those, then re-run this check.</sub>`,
    );
    return { comment: `${lines.join("\n")}\n`, ok: true };
  }

  const version = nextVersion(previousTag, commits);
  if (!version) {
    lines.push(
      "Promoting this releases nothing: none of its commits are features, fixes, performance changes or breaking changes. It needs no release notes.",
    );
    return { comment: `${lines.join("\n")}\n`, ok: true };
  }

  const changes = await generateSections({ commits, fetchPrBody, slug });
  const notes = extractReleaseNotes(prBody);
  const written = notes && !isNone(notes) ? notes : null;
  const major = version.split(".")[0] !== previousTag.replace(/^v/, "").split(".")[0];

  if (major) {
    lines.push(
      "> [!WARNING]",
      `> **${version} is a major release**, for the breaking changes listed below. Say in the notes what changed and what to do about it.`,
      "",
    );
  }
  if (written) {
    const title = releaseTitle({ version, previousTag, tag: `v${version}`, date, slug });
    lines.push(
      `Adding the \`promote\` label releases **${version}** with this PR's "Release notes", as written:`,
      "",
      "---",
      "",
      title,
      "",
      written,
      "",
      "---",
      "",
      "<details>",
      `<summary>Changes since ${previousTag}, to write the notes from</summary>`,
      "",
    );
  } else {
    lines.push(
      "> [!IMPORTANT]",
      `> Write ${version}'s notes under a \`## Release notes\` heading in this PR's description${notes ? ` ("None" won't do: this promotion releases ${version})` : ""}. They're published as written, and this check fails, so the PR can't be promoted, until they're there.`,
      "",
      `**Changes since ${previousTag}**, to write them from:`,
      "",
    );
  }
  lines.push(
    `Every feature, fix and performance change since the last stable release, as the alpha notes listed them. Cover what's new or different for someone on ${previousTag}; leave out what only mattered while building it.`,
    "",
    changes || "_None._",
  );
  if (written) lines.push("", "</details>");
  return { comment: `${lines.join("\n")}\n`, ok: Boolean(written) };
}

async function main(env) {
  const slug = repoSlug(undefined, env);
  const pr = Number(env.PR_NUMBER);
  const prBody = env.PR_BODY ?? "";
  const fromGitHub = prBodyFetcher({ slug, token: env.GITHUB_TOKEN });
  return previewComment({
    baseRef: env.BASE_REF,
    headRef: env.HEAD_REF,
    commits: commitsBetween(env.BASE_SHA, env.HEAD_SHA),
    previousTag:
      env.BASE_REF === "main"
        ? git("describe", "--tags", "--abbrev=0", "--exclude=*-*", env.BASE_SHA).trim()
        : undefined,
    prBody,
    fetchPrBody: (number) => (number === pr ? Promise.resolve(prBody) : fromGitHub(number)),
    slug,
    date: new Date().toISOString().slice(0, 10),
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { comment, ok } = await main(process.env);
  process.stdout.write(comment);
  if (!ok) {
    console.error(
      `::error title=Release notes::Write this release's notes under "## Release notes" in the description; see the preview comment.`,
    );
    process.exitCode = 1;
  }
}
