/**
 * semantic-release plugin that writes the release notes, in place of
 * @semantic-release/release-notes-generator.
 *
 * Each feature, fix and performance change gets one line: its PR's release
 * note (the paragraph under `## Release note`, see release-note.mjs), read
 * from the PR as it is now, so a note can still be edited after merging. A
 * PR without one falls back to the note in its squashed commit, then to its
 * title. Breaking changes come first, whatever their type. A promotion PR's
 * own release note becomes the summary at the top of the release it makes.
 * Everything else (chores, docs, CI, the bot's merges) is left out.
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
 * Returns the Markdown, and the PRs whose line fell back to their title
 * because they have no release note.
 */
export async function renderNotes({ version, previousTag, tag, date, slug, commits, fetchPrBody }) {
  const repoUrl = slug ? `https://github.com/${slug}` : null;
  const summary = [];
  const breaking = [];
  const sections = new Map(SECTIONS.map(([type]) => [type, []]));
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

    const prBody = commit.pr ? await fetchPrBody(commit.pr) : null;
    let note = extractReleaseNote(prBody) || extractReleaseNote(commit.body);
    if (note && isNone(note)) {
      if (!commit.breaking) continue;
      note = null;
    }
    if (!note) {
      note = commit.subject;
      if (commit.pr) untitled.push(commit.pr);
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
  return { markdown: `${blocks.join("\n\n")}\n`, untitled };
}

/** semantic-release's generateNotes step. */
export async function generateNotes(_pluginConfig, context) {
  const { commits, lastRelease, nextRelease, options, env, logger } = context;
  const slug = repoSlug(options.repositoryUrl, env);
  const { markdown, untitled } = await renderNotes({
    version: nextRelease.version,
    previousTag: lastRelease?.gitTag,
    tag: nextRelease.gitTag,
    date: new Date().toISOString().slice(0, 10),
    slug,
    commits: commits.map(({ message, hash }) => ({ message, hash })),
    fetchPrBody: prBodyFetcher({ slug, token: env.GITHUB_TOKEN || env.GH_TOKEN, logger }),
  });
  if (untitled.length) {
    logger.log(
      `No release note on ${untitled.map((pr) => `#${pr}`).join(", ")}, so their titles are used.`,
    );
  }
  return markdown;
}
