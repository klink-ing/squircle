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
  One or two sentences for people using the package: what's new or fixed, and
  how to use it. Its first paragraph becomes this PR's line in the release
  notes, as written, so leave how it works to the rest of the description.

  Required for feat, fix and perf PRs and breaking changes (say what to change).
  Write "None" if users won't notice the change. On a promotion PR, it's the
  summary at the top of the release.

  Example: Add `squircle-pill-ease-*` to stretch a pill's easing along its
  straight edges.
-->
