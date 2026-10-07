<!--
  PR title must follow Conventional Commits format.
  The title determines how semantic-release bumps the version:

  patch (0.0.x):  fix:, perf:
  minor (0.x.0):  feat:
  major (x.0.0):  feat!: or fix!: (breaking change)
  no release:     docs:, chore:, test:, ci:, style:
  varies:         revert: (undoes the original commit's version bump)

  Examples:
    feat: add new squircle-radius utility
    fix: correct visual radius calculation
    feat!: rename plugin export path

  Types 'refactor' and 'build' are NOT allowed.

  Promotions (alpha → beta → main) aren't merged with the button, which can
  only squash: add the `promote` label and a bot merges them with a merge
  commit. After each release, main and beta are merged back down into the
  branches below them automatically.
-->

## Release note

<!--
  This PR's line in the alpha and beta release notes, which are generated
  from the PRs since the last one. Without a note, the PR's title is used.
  One or two sentences for someone trying the prerelease: what changed and
  what to use. Write "None" to leave the PR out.

  Optional on PRs into alpha and beta. Required on feat, fix and perf PRs
  into main, which are released straight away ("None" will do), and on
  breaking changes anywhere (say what to change).

  A promotion into main instead carries the stable release's notes, written
  by hand under "## Release notes". See AGENTS.md.
-->
