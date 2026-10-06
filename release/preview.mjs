/**
 * Prints the comment release-notes.yml keeps on a promotion PR: the version
 * and release notes that adding the `promote` label would publish, made by the
 * same code as the real ones (notes.mjs).
 *
 * The version is worked out the way commit-analyzer does it, from the last
 * stable tag on the base branch. Prereleases (into beta) aren't numbered here.
 *
 * Reads BASE_REF, HEAD_REF, BASE_SHA, HEAD_SHA, PR_NUMBER and PR_BODY, plus
 * GITHUB_REPOSITORY and GITHUB_TOKEN to read the other PRs' notes.
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { parseCommit } from "./release-note.mjs";
import { prBodyFetcher, renderNotes, repoSlug } from "./notes.mjs";

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

export async function preview({ baseRef, headRef, baseSha, headSha, pr, prBody, slug, token }) {
  const commits = commitsBetween(baseSha, headSha);
  // The merge commit promoting this PR doesn't exist yet; stand one in, so its
  // release note becomes the summary just as it will in the release.
  commits.unshift({ hash: headSha, message: `Merge ${headRef} into ${baseRef} (#${pr})` });
  const fetchFromGitHub = prBodyFetcher({ slug, token });
  const fetchPrBody = (number) =>
    number === pr ? Promise.resolve(prBody) : fetchFromGitHub(number);

  const lines = [MARKER, "### Release notes preview", ""];
  let version = "the next beta";
  let previousTag;
  if (baseRef === "main") {
    previousTag = git("describe", "--tags", "--abbrev=0", "--exclude=*-*", baseSha).trim();
    const next = nextVersion(previousTag, commits);
    if (!next) {
      lines.push(
        "Promoting this releases nothing: none of its commits are features, fixes, performance changes or breaking changes.",
      );
      return `${lines.join("\n")}\n`;
    }
    version = next;
  }

  const { markdown, untitled } = await renderNotes({
    version,
    previousTag,
    tag: `v${version}`,
    date: new Date().toISOString().slice(0, 10),
    slug,
    commits,
    fetchPrBody,
  });
  lines.push(`Adding the \`promote\` label releases **${version}** with these notes:`, "");
  if (untitled.length) {
    const refs = untitled.map((number) => `#${number}`);
    const prs = refs.length > 1 ? `${refs.slice(0, -1).join(", ")} and ${refs.at(-1)}` : refs[0];
    lines.push(
      `> [!NOTE]`,
      `> ${prs} ${untitled.length === 1 ? "has" : "have"} no release note, so ${untitled.length === 1 ? "its title is" : "their titles are"} used. Add a \`## Release note\` section to ${untitled.length === 1 ? "its" : "their"} description, then re-run this check.`,
      "",
    );
  }
  lines.push("---", "", markdown.trim(), "", "---", "");
  lines.push(
    `<sub>Each line is a PR's "Release note" section, and the paragraph under the heading is this PR's. Edit those, then re-run this check to update the preview.</sub>`,
  );
  return `${lines.join("\n")}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { env } = process;
  process.stdout.write(
    await preview({
      baseRef: env.BASE_REF,
      headRef: env.HEAD_REF,
      baseSha: env.BASE_SHA,
      headSha: env.HEAD_SHA,
      pr: Number(env.PR_NUMBER),
      prBody: env.PR_BODY ?? "",
      slug: repoSlug(undefined, env),
      token: env.GITHUB_TOKEN,
    }),
  );
}
