/**
 * semantic-release plugin that writes the release notes, in place of
 * @semantic-release/release-notes-generator.
 *
 * A feature, fix or performance change gets one line when its PR has a
 * release note (the paragraph under `## Release note`, see release-note.mjs),
 * read from the PR as it is now, so a note can still be added or edited after
 * merging; failing that, from its squashed commit. A PR without one is left
 * out: on alpha and beta that's a change that only mattered while a feature
 * was being built. Breaking changes come first, whatever their type, and are
 * never left out; without a note, their title stands in. A promotion PR's own
 * release note becomes the summary at the top of the release it makes.
 * Everything else (chores, docs, CI, the bot's merges) is left out too.
 */
import {
  SECTIONS,
  extractReleaseNote,
  isNone,
  normalizeNote,
  parseCommit,
} from "./release-note.mjs";

/** The bot's merge commit for a promotion PR (.github/scripts/promote.sh). */
const PROMOTION = /^Merge (?:alpha|beta) into (?:beta|main) \(#(\d+)\)$/;

/** "#40", "#38 and #40", "#1, #2 and abc1234": PR numbers and short hashes as prose. */
export function refList(refs) {
  const names = refs.map((ref) => (typeof ref === "number" ? `#${ref}` : ref));
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
    : (names[0] ?? "");
}

/** `owner/repo` on GitHub, from Actions' environment or the repository URL. */
export function repoSlug(repositoryUrl, env = process.env) {
  if (env.GITHUB_REPOSITORY) return env.GITHUB_REPOSITORY;
  const match = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(repositoryUrl ?? "");
  return match ? `${match[1]}/${match[2]}` : null;
}

/**
 * A function that fetches a PR's body from GitHub, once per PR. It resolves to
 * null when it can't, so a GitHub outage costs a note, never the release.
 */
export function prBodyFetcher({ slug, token, logger = console }) {
  const bodies = new Map();
  return (number) => {
    if (!slug || !token) return Promise.resolve(null);
    if (!bodies.has(number)) {
      const url = `https://api.github.com/repos/${slug}/pulls/${number}`;
      const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" };
      bodies.set(
        number,
        fetch(url, { headers })
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          })
          .then((pr) => pr.body ?? "")
          .catch((error) => {
            logger.warn(
              `Couldn't read PR #${number}, so its note comes from its commit: ${error.message}`,
            );
            return null;
          }),
      );
    }
    return bodies.get(number);
  };
}

/**
 * The release notes for `commits` (`{ message, hash }`, as git log lists them).
 * Returns the Markdown; `leftOut`, the features, fixes and performance changes
 * with no release note; and `untitled`, the breaking changes whose title
 * stood in for a note. Each is a PR number, or a short hash without a PR.
 */
export async function renderNotes({ version, previousTag, tag, date, slug, commits, fetchPrBody }) {
  const repoUrl = slug ? `https://github.com/${slug}` : null;
  const summary = [];
  const breaking = [];
  const sections = new Map(SECTIONS.map(([type]) => [type, []]));
  const leftOut = [];
  const untitled = [];

  for (const { message, hash } of commits) {
    const promotion = PROMOTION.exec(message.split("\n")[0]);
    if (promotion) {
      const note = extractReleaseNote(await fetchPrBody(Number(promotion[1])));
      if (note && !isNone(note)) summary.push(normalizeNote(note));
      continue;
    }

    const commit = parseCommit(message);
    const list = commit.breaking ? breaking : sections.get(commit.type);
    if (!list) continue;

    const ref = commit.pr ?? hash.slice(0, 7);
    const prBody = commit.pr ? await fetchPrBody(commit.pr) : null;
    let note = extractReleaseNote(prBody) || extractReleaseNote(commit.body);
    if (note && isNone(note)) {
      if (!commit.breaking) continue;
      note = null;
    }
    if (!note) {
      if (!commit.breaking) {
        leftOut.push(ref);
        continue;
      }
      note = commit.subject;
      untitled.push(ref);
    }

    const link = commit.pr
      ? `[#${commit.pr}](${repoUrl}/pull/${commit.pr})`
      : `[${hash.slice(0, 7)}](${repoUrl}/commit/${hash})`;
    list.push(`- ${normalizeNote(note)}${repoUrl ? ` (${link})` : ""}`);
  }

  const title =
    repoUrl && previousTag
      ? `## [${version}](${repoUrl}/compare/${previousTag}...${tag}) (${date})`
      : `## ${version} (${date})`;
  const blocks = [title, ...summary];
  if (breaking.length) blocks.push(`### Breaking changes\n\n${breaking.join("\n")}`);
  for (const [type, heading] of SECTIONS) {
    const lines = sections.get(type);
    if (lines.length) blocks.push(`### ${heading}\n\n${lines.join("\n")}`);
  }
  if (blocks.length === 1) blocks.push("No user-facing changes.");
  return { markdown: `${blocks.join("\n\n")}\n`, leftOut, untitled };
}

/** semantic-release's generateNotes step. */
export async function generateNotes(_pluginConfig, context) {
  const { commits, lastRelease, nextRelease, options, env, logger } = context;
  const slug = repoSlug(options.repositoryUrl, env);
  const { markdown, leftOut, untitled } = await renderNotes({
    version: nextRelease.version,
    previousTag: lastRelease?.gitTag,
    tag: nextRelease.gitTag,
    date: new Date().toISOString().slice(0, 10),
    slug,
    commits: commits.map(({ message, hash }) => ({ message, hash })),
    fetchPrBody: prBodyFetcher({ slug, token: env.GITHUB_TOKEN || env.GH_TOKEN, logger }),
  });
  if (leftOut.length) logger.log(`Left out, with no release note: ${refList(leftOut)}.`);
  if (untitled.length) {
    logger.warn(
      `Breaking changes with no release note, so their titles stand in: ${refList(untitled)}.`,
    );
  }
  return markdown;
}
