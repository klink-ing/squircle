/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
  // `main` publishes to npm's `latest`. The prerelease branches publish
  // `x.y.z-alpha.n` / `x.y.z-beta.n` to dist-tags of the same name, so
  // `npm install @klinking/squircle` never picks them up; `@alpha` or
  // `@beta` does. Promoting a prerelease branch into `main` (the `promote`
  // label, .github/workflows/promote.yml) releases it.
  branches: ["main", { name: "beta", prerelease: true }, { name: "alpha", prerelease: true }],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
      },
    ],
    // Stable releases from a promotion: the promotion PR's hand-written
    // "## Release notes". Everything else: one line per PR, from its
    // "## Release note" section. See release/notes.mjs.
    "./release/notes.mjs",
    [
      "@anolilab/semantic-release-pnpm",
      {
        pkgRoot: "package",
        npmPublish: true,
      },
    ],
    "@semantic-release/github",
  ],
};
