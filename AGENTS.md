# Notes for agents

## Pull requests

PRs are squash-merged, so the title becomes the commit subject and the description becomes its body. Both feed the release.

### Title

[Conventional Commits](https://www.conventionalcommits.org), checked in CI: `type(scope): description`, with `feat`, `fix`, `perf`, `docs`, `chore`, `test`, `ci`, `style` or `revert` (`refactor` and `build` are rejected). The type sets the next version: `feat` is a minor release, `fix` and `perf` a patch, and `!` after the type a major. Mark a change `!` only if it breaks something in the last stable release.

A `feat`, `fix` or `perf` title is also the PR's line in the alpha and beta release notes when it has no release note, so write it to read well there.

### Description

Keep it short: what changed and why, then a test plan. Detail for reviewers goes here, not in the release notes.

Don't start a line with `BREAKING CHANGE:` unless the PR is one. The description is the squashed commit's body, and that line alone makes the next release a major.

## Release notes

Both kinds are read from PR descriptions when the release is made (`release/notes.mjs`), so they can still be fixed after merging.

### Alpha and beta releases: generated, one line per PR

Each `feat`, `fix` and `perf` PR since the previous alpha or beta gets a line, breaking changes first. The line is the first paragraph of the PR's `## Release note`, or its title without one. Write the note for someone trying the prerelease: what changed and what to use, in one or two sentences (at most 300 characters, no list).

- **Into alpha or beta:** a note is optional. Write one when the title alone wouldn't tell a tester what changed. `None` leaves the PR out, for changes nobody using the package would notice, like the demos and site.
- **Into main** (released straight away): `feat`, `fix` and `perf` PRs need a note; `None` will do.
- **Breaking changes**, into any branch: a real note, saying what changed and what to do about it.

### Stable releases: written by hand on the promotion PR

A promotion into main (from alpha or beta) carries the stable release's notes under `## Release notes`, published as written. Promoting is blocked until they're there.

**Write them against the last stable release, not the last alpha or beta.** Someone upgrading from it never saw the prereleases in between.

```sh
gh release list --exclude-pre-releases --limit 1
git describe --tags --abbrev=0 --exclude='*-*' origin/main
```

- Cover what's new or different since that release: one entry per change a user would notice, however many PRs it took.
- Leave out what only mattered while building it: fixes to bugs no stable release had, and renames or tweaks to options that never shipped. Leave out changes to the demos and site too. To tell whether something shipped, look at the tag: `git grep <name> <tag>`, `git show <tag>:<path>`.
- Open with a sentence or two on what the release is about, then `### Breaking changes` (with what to do), `### Features` and `### Fixes` as needed, as short bullets. Name the utility, option or export to use; leave how it works to the docs.
- The section ends at the next `##` heading or a `---` line, so put anything else, like a footer, after one.
- The PR's "Release notes preview" comment shows the version, warns when it's a major, lists every change since the last stable release to write from, and shows the notes exactly as they'll be published.

```md
## Release notes

Pills now animate between sizes, and work in Panda as well as Tailwind.

### Fixes

- Borders no longer clip on pills under 24px tall.

---
```

## Branches and merging

- Branch names need a folder (`claude/…`, `fix/…`); the repo rejects branches without one.
- Feature work goes into `alpha` and is squash-merged.
- Promotions (alpha → beta → main) and syncs back down are merged by adding the `promote` label, never the merge button (a required check keeps it shut). After each release, the release workflow merges main into beta and alpha by itself.
