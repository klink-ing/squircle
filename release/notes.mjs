/**
 * semantic-release plugin that writes the release notes, in place of
 * @semantic-release/release-notes-generator.
 *
 * A stable release made by promoting alpha or beta into main publishes the
 * promotion PR's `## Release notes` as written. Someone wrote them by hand,
 * against the last stable release (see AGENTS.md), so a feature built over
 * several PRs reads as one change, and what only mattered while building it
 * is left out.
 *
 * Every other release (alpha and beta, or a fix straight into main) is
 * generated: one line per feature, fix and performance change since the last
 * release on that branch, breaking changes first. A line is the PR's
 * `## Release note`, read from the PR as it is now so it can be fixed after
 * merging; failing that, the note in its squashed commit; failing that, its
 * title. "None" leaves a PR out, and so do chores, docs, CI and the bot's
 * merges.
 */
import {
  SECTIONS,
  extractReleaseNote,
  extractReleaseNotes,
  isNone,
  normalizeNote,
  parseCommit,
} from "./release-note.mjs";

/** The bot's merge commit for a promotion into main (.github/scripts/promote.sh). */
const STABLE_PROMOTION = /^Merge (?:alpha|beta) into main \(#(\d+)\)$/;

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
            logger.warn(`Couldn't read PR #${number}: ${error.message}`);
            return null;
          }),
      );
    }
    return bodies.get(number);
  };
}

/** The title line: the version, linked to the comparison with the last release. */
export function releaseTitle({ version, previousTag, tag, date, slug }) {
  return slug && previousTag
    ? `## [${version}](https://github.com/${slug}/compare/${previousTag}...${tag}) (${date})`
    : `## ${version} (${date})`;
}

/**
 * Generated notes for `commits` (`{ message, hash }`, as git log lists them):
 * the `###` sections, joined, or "" when no commit makes a line.
 */
export async function generateSections({ commits, fetchPrBody, slug }) {
  const repoUrl = slug ? `https://github.com/${slug}` : null;
  const breaking = [];
  const sections = new Map(SECTIONS.map(([type]) => [type, []]));

  const listed = [];
  for (const { message, hash } of commits) {
    const commit = parseCommit(message);
    const list = commit.breaking ? breaking : sections.get(commit.type);
    if (list) listed.push({ hash, commit, list });
  }
  // Read the PRs all at once rather than one after another.
  const prBodies = await Promise.all(
    listed.map(({ commit }) => (commit.pr ? fetchPrBody(commit.pr) : null)),
  );

  for (const [i, { hash, commit, list }] of listed.entries()) {
    let note = extractReleaseNote(prBodies[i]) || extractReleaseNote(commit.body);
    if (note && isNone(note)) {
      if (!commit.breaking) continue;
      note = null;
    }

    const link = commit.pr
      ? `[#${commit.pr}](${repoUrl}/pull/${commit.pr})`
      : `[${hash.slice(0, 7)}](${repoUrl}/commit/${hash})`;
    list.push(`- ${normalizeNote(note || commit.subject)}${repoUrl ? ` (${link})` : ""}`);
  }

  const blocks = [];
  if (breaking.length) blocks.push(`### Breaking changes\n\n${breaking.join("\n")}`);
  for (const [type, heading] of SECTIONS) {
    const lines = sections.get(type);
    if (lines.length) blocks.push(`### ${heading}\n\n${lines.join("\n")}`);
  }
  return blocks.join("\n\n");
}

/**
 * The release notes. On a stable release made by a promotion PR whose
 * `## Release notes` are written, those; otherwise generated ones. Returns
 * the Markdown, whether it was `written`, and the promotion PR, if any.
 *
 * Only a promotion whose merge is the newest commit made the release. An
 * earlier one in the range released nothing (or its release failed), so its
 * notes don't describe this release, like a hotfix that came after it.
 */
export async function renderNotes({ stable, commits, fetchPrBody, slug, ...release }) {
  const title = releaseTitle({ slug, ...release });
  const match =
    stable && commits.length ? STABLE_PROMOTION.exec(commits[0].message.split("\n")[0]) : null;
  const promotion = match ? Number(match[1]) : null;
  if (promotion) {
    const written = extractReleaseNotes(await fetchPrBody(promotion));
    if (written && !isNone(written))
      return { markdown: `${title}\n\n${written}\n`, written: true, promotion };
  }
  const sections = await generateSections({ commits, fetchPrBody, slug });
  return {
    markdown: `${title}\n\n${sections || "No user-facing changes."}\n`,
    written: false,
    promotion,
  };
}

/** semantic-release's generateNotes step. */
export async function generateNotes(_pluginConfig, context) {
  const { branch, commits, lastRelease, nextRelease, options, env, logger } = context;
  const slug = repoSlug(options.repositoryUrl, env);
  const { markdown, written, promotion } = await renderNotes({
    stable: branch.type !== "prerelease",
    version: nextRelease.version,
    previousTag: lastRelease?.gitTag,
    tag: nextRelease.gitTag,
    date: new Date().toISOString().slice(0, 10),
    slug,
    commits: commits.map(({ message, hash }) => ({ message, hash })),
    fetchPrBody: prBodyFetcher({ slug, token: env.GITHUB_TOKEN || env.GH_TOKEN, logger }),
  });
  if (written) {
    logger.log(`Release notes written on #${promotion}.`);
  } else if (promotion) {
    logger.warn(
      `#${promotion}'s "## Release notes" are missing or couldn't be read, so they're generated instead.`,
    );
  }
  return markdown;
}
