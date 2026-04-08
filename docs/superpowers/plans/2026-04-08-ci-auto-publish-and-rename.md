# CI Auto-Publish + Package Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `@klinking/tw-squircle` to `@klinking/squircle`, prefix tailwind-specific exports with `tw-`, and set up semantic-release CI for automated publishing.

**Architecture:** Two-part change: (1) rename package and reorganize exports, (2) add semantic-release config and three GitHub Actions workflows. All work on a worktree branching from `main`. This branch will be squash-merged via PR, so individual commit messages here are for readability — only the PR title matters for semantic-release.

**Tech Stack:** semantic-release, conventional-changelog-conventionalcommits, GitHub Actions, thehanimo/pr-title-checker, voidzero-dev/setup-vp@v1

**Spec:** `docs/superpowers/specs/2026-04-08-ci-auto-publish-design.md`

---

### Task 1: Rename source files and update vite config

**Files:**
- Rename: `package/src/plugin.ts` → `package/src/tw-plugin.ts`
- Rename: `package/src/merge.ts` → `package/src/tw-merge-cfg.ts`
- Modify: `package/vite.config.ts`

- [ ] **Step 1: Rename `plugin.ts` to `tw-plugin.ts`**

```bash
cd package && git mv src/plugin.ts src/tw-plugin.ts
```

- [ ] **Step 2: Rename `merge.ts` to `tw-merge-cfg.ts`**

```bash
git mv src/merge.ts src/tw-merge-cfg.ts
```

- [ ] **Step 3: Update `package/vite.config.ts` pack entry keys**

Change the `pack.entry` from:

```ts
entry: {
  plugin: "./src/plugin.ts",
  merge: "./src/merge.ts",
},
```

to:

```ts
entry: {
  "tw-plugin": "./src/tw-plugin.ts",
  "tw-merge-cfg": "./src/tw-merge-cfg.ts",
},
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: rename source files and update vite pack entries

Rename plugin.ts → tw-plugin.ts, merge.ts → tw-merge-cfg.ts.
Update vite.config.ts pack entry keys to match."
```

---

### Task 2: Update package.json (name + exports)

**Files:**
- Modify: `package/package.json`

- [ ] **Step 1: Update package name**

Change `"name": "@klinking/tw-squircle"` to `"name": "@klinking/squircle"`.

- [ ] **Step 2: Update exports map**

Replace the entire `exports` block with:

```json
"exports": {
  "./tw-utils.css": "./dist/tw-utils.css",
  "./squircle-radius.css": "./dist/squircle-radius.css",
  "./tw-merge-cfg": {
    "types": "./dist/tw-merge-cfg.d.mts",
    "import": "./dist/tw-merge-cfg.mjs"
  },
  "./tw-plugin": {
    "types": "./dist/tw-plugin.d.mts",
    "import": "./dist/tw-plugin.mjs"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add package/package.json && git commit -m "chore: rename package to @klinking/squircle with tw- prefixed exports"
```

---

### Task 3: Update CSS generation output path

**Files:**
- Modify: `package/scripts/generate-squircle-css.ts:84`

- [ ] **Step 1: Change output filename**

In `package/scripts/generate-squircle-css.ts`, change line 84:

```ts
const outPath = join(distDir, "squircle.css");
```

to:

```ts
const outPath = join(distDir, "tw-utils.css");
```

- [ ] **Step 2: Commit**

```bash
git add package/scripts/generate-squircle-css.ts && git commit -m "chore: output generated CSS to dist/tw-utils.css"
```

---

### Task 4: Update sync-readme script

**Files:**
- Modify: `scripts/sync-readme.sh:40-42`

- [ ] **Step 1: Update dist file references**

In `scripts/sync-readme.sh`, change lines 40-42 from:

```bash
sync_file "package/dist/squircle.css" "css"
sync_file "package/dist/merge.mjs" "js"
sync_file "package/dist/plugin.mjs" "js"
```

to:

```bash
sync_file "package/dist/tw-utils.css" "css"
sync_file "package/dist/tw-merge-cfg.mjs" "js"
sync_file "package/dist/tw-plugin.mjs" "js"
```

- [ ] **Step 2: Update sync-readme.yml to include `[skip ci]` in its commit message**

In `.github/workflows/sync-readme.yml`, change the commit message line from:

```yaml
git commit -m "docs: sync README code blocks"
```

to:

```yaml
git commit -m "docs: sync README code blocks [skip ci]"
```

This prevents the sync commit from triggering the release workflow.

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-readme.sh .github/workflows/sync-readme.yml && git commit -m "chore: update sync-readme for renamed dist files"
```

---

### Task 5: Update root vite.config.ts

**Files:**
- Modify: `vite.config.ts:9`

- [ ] **Step 1: Update package name reference**

Change `@klinking/tw-squircle#build` to `@klinking/squircle#build` on line 9.

- [ ] **Step 2: Commit**

```bash
git add vite.config.ts && git commit -m "chore: update package name reference in root vite config"
```

---

### Task 6: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update all occurrences**

Make these replacements throughout `README.md`:

| Old | New |
|-----|-----|
| `@klinking/tw-squircle` | `@klinking/squircle` |
| `@klinking/squircle/squircle.css` (after above replacement) | `@klinking/squircle/tw-utils.css` |
| `@klinking/squircle/plugin` (after above replacement) | `@klinking/squircle/tw-plugin` |
| `@klinking/squircle/merge` (after above replacement) | `@klinking/squircle/tw-merge-cfg` |

Also update the title from `# @klinking/tw-squircle` to `# @klinking/squircle`.

Update the section headers to match new filenames:
- `### squircle.css` → `### tw-utils.css`
- `### plugin.js` → `### tw-plugin.js`
- `### merge.js` → `### tw-merge-cfg.js`

Update the `BEGIN`/`END` comment markers:
- `<!-- BEGIN:dist/squircle.css -->` → `<!-- BEGIN:dist/tw-utils.css -->`
- `<!-- END:dist/squircle.css -->` → `<!-- END:dist/tw-utils.css -->`
- `<!-- BEGIN:dist/plugin.mjs -->` → `<!-- BEGIN:dist/tw-plugin.mjs -->`
- `<!-- END:dist/plugin.mjs -->` → `<!-- END:dist/tw-plugin.mjs -->`
- `<!-- BEGIN:dist/merge.mjs -->` → `<!-- BEGIN:dist/tw-merge-cfg.mjs -->`
- `<!-- END:dist/merge.mjs -->` → `<!-- END:dist/tw-merge-cfg.mjs -->`

- [ ] **Step 2: Commit**

```bash
git add README.md && git commit -m "docs: update README for @klinking/squircle rename"
```

---

### Task 7: Update website references

**Files:**
- Modify: `website/src/pages/index.astro`
- Modify: `website/src/components/slides.tsx:188`

- [ ] **Step 1: Update index.astro**

Replace all occurrences of `@klinking/tw-squircle` with `@klinking/squircle` in `website/src/pages/index.astro`:
- Line 11: page title
- Line 17: h1 heading
- Line 47: npm link href

- [ ] **Step 2: Update slides.tsx**

In `website/src/components/slides.tsx` line 188, change `tw-squircle` to `@klinking/squircle` (this is a display name in prose text referring to the package).

- [ ] **Step 3: Commit**

```bash
git add website/src/pages/index.astro website/src/components/slides.tsx && git commit -m "docs: update website references for package rename"
```

---

### Task 8: Build, test, and verify rename

- [ ] **Step 1: Run full build from repo root**

```bash
vp run -r build
```

Expected: build succeeds, `package/dist/` contains `tw-utils.css`, `tw-plugin.mjs`, `tw-plugin.d.mts`, `tw-merge-cfg.mjs`, `tw-merge-cfg.d.mts`, `squircle-radius.css`.

- [ ] **Step 2: Update test file import paths**

In `package/src/squircle.test.ts`, in the `compileCss` function (around line 58), change:

```ts
@import "../dist/squircle.css";
```

to:

```ts
@import "../dist/tw-utils.css";
```

In the `compilePlugin` function (around lines 70-71), change:

```ts
? `@plugin "./plugin.ts" {\n${pluginBlock}\n}`
: `@plugin "./plugin.ts";`;
```

to:

```ts
? `@plugin "./tw-plugin.ts" {\n${pluginBlock}\n}`
: `@plugin "./tw-plugin.ts";`;
```

- [ ] **Step 3: Run tests and update snapshots**

```bash
cd package && npx vitest run --update
```

Expected: all tests pass, snapshots are updated for new file paths.

- [ ] **Step 4: Run full check suite**

```bash
cd .. && vp ready
```

Expected: fmt, lint, test, and build all pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test: update test imports and snapshots for renamed exports"
```

---

### Task 9: Add semantic-release dependencies

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Install dependencies**

```bash
pnpm add -wD semantic-release @semantic-release/changelog @semantic-release/git conventional-changelog-conventionalcommits
```

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml && git commit -m "ci: add semantic-release dependencies"
```

---

### Task 10: Create `.releaserc.json`

**Files:**
- Create: `.releaserc.json`

- [ ] **Step 1: Create the config file**

```json
{
  "branches": ["main"],
  "plugins": [
    ["@semantic-release/commit-analyzer", {
      "preset": "conventionalcommits"
    }],
    ["@semantic-release/release-notes-generator", {
      "preset": "conventionalcommits"
    }],
    "@semantic-release/changelog",
    ["@semantic-release/npm", {
      "pkgRoot": "package",
      "provenance": true
    }],
    ["@semantic-release/git", {
      "assets": ["CHANGELOG.md", "package/package.json"],
      "message": "chore(release): ${nextRelease.version} [skip ci]"
    }],
    "@semantic-release/github"
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add .releaserc.json && git commit -m "ci: add semantic-release configuration"
```

---

### Task 11: Create CI check workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: voidzero-dev/setup-vp@v1
        with:
          node-version: "22"
          cache: true

      - run: vp install

      - run: vp ready
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml && git commit -m "ci: add PR check workflow"
```

---

### Task 12: Create PR title checker

**Files:**
- Create: `.github/workflows/pr-title.yml`
- Create: `.github/pr-title-checker.json`

- [ ] **Step 1: Create the PR title checker config**

`.github/pr-title-checker.json`:

```json
{
  "LABEL": {
    "name": "",
    "color": ""
  },
  "CHECKS": {
    "regexp": "^(feat|fix|perf|docs|chore|test|ci|style|revert)(!)?((\\(.+\\)))?: .+",
    "ignoreLabels": []
  },
  "MESSAGES": {
    "success": "PR title follows Conventional Commits format.",
    "failure": "PR title must match: type(optional-scope): description. Allowed types: feat, fix, perf, docs, chore, test, ci, style, revert. Use ! for breaking changes (e.g. feat!:). Types 'refactor' and 'build' are not allowed."
  }
}
```

Note: The `regexp` uses `\\(` and `\\)` for literal parentheses in the optional scope group (JSON-escaped `\(` and `\)` for the JavaScript RegExp). The space after `:` is required.

- [ ] **Step 2: Create the workflow file**

`.github/workflows/pr-title.yml`:

```yaml
name: PR title check

on:
  pull_request:
    types: [opened, edited, synchronize, reopened]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: thehanimo/pr-title-checker@v1
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          pass_on_octokit_error: false
          configuration_path: .github/pr-title-checker.json
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/pr-title.yml .github/pr-title-checker.json && git commit -m "ci: add PR title conventional commit enforcement"
```

---

### Task 13: Create release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create the workflow file**

The workflow uses npm trusted publishing via OIDC — the `id-token: write` permission + `provenance: true` in `.releaserc.json` handles npm auth. No `NPM_TOKEN` secret needed. The `GITHUB_TOKEN` env var is used by semantic-release to push the release commit and create GitHub Releases.

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  issues: write
  pull-requests: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false

      - uses: voidzero-dev/setup-vp@v1
        with:
          node-version: "22"
          cache: true

      - run: vp install

      - run: vp run @klinking/squircle#build

      - run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml && git commit -m "ci: add semantic-release publish workflow"
```

---

### Task 14: Create PR template

**Files:**
- Create: `.github/pull_request_template.md`

- [ ] **Step 1: Create the template file**

```markdown
<!--
  PR title must follow Conventional Commits format.
  The title determines how semantic-release bumps the version:

  patch (0.0.x):  fix:, perf:
  minor (0.x.0):  feat:
  major (x.0.0):  feat!: or fix!: (breaking change)
  no release:     docs:, chore:, test:, ci:, style:, revert:

  Examples:
    feat: add new squircle-radius utility
    fix: correct visual radius calculation
    feat!: rename plugin export path

  Types 'refactor' and 'build' are NOT allowed.
-->
```

- [ ] **Step 2: Commit**

```bash
git add .github/pull_request_template.md && git commit -m "ci: add PR template with conventional commit prefix docs"
```

---

### Task 15: Final verification

- [ ] **Step 1: Run full check suite**

```bash
vp ready
```

Expected: all checks pass (fmt, lint, test, build).

- [ ] **Step 2: Verify dist contents**

```bash
ls package/dist/
```

Expected files: `tw-utils.css`, `squircle-radius.css`, `tw-plugin.mjs`, `tw-plugin.d.mts`, `tw-merge-cfg.mjs`, `tw-merge-cfg.d.mts`.

- [ ] **Step 3: Verify no remaining old references**

```bash
grep -r "@klinking/tw-squircle" --include="*.ts" --include="*.tsx" --include="*.astro" --include="*.json" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.css" --include="*.sh" . | grep -v node_modules | grep -v docs/superpowers/specs | grep -v docs/superpowers/plans | grep -v .git
```

Expected: no matches (old design/plan docs are excluded as historical records).

---

### Post-merge manual setup

After this branch is squash-merged to `main`:

1. **Create `v0.1.0` tag** on `main` at the merge commit (or the last commit before it, depending on whether this merge should trigger the first release):
   ```bash
   git tag v0.1.0 && git push origin v0.1.0
   ```

2. **Configure npm trusted publishing** on npmjs.com: link `@klinking/squircle` to the `dogmar/tw-squircle` repo and the `Release` workflow (`release.yml`).
