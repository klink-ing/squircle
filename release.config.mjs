/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
  // `main` publishes to npm's `latest`. The prerelease branches publish
  // `x.y.z-alpha.n` / `x.y.z-beta.n` to dist-tags of the same name, so
  // `npm install @klinking/squircle` never picks them up; `@alpha` or
  // `@beta` does. Merging a prerelease branch into `main` releases it.
  branches: ["main", { name: "beta", prerelease: true }, { name: "alpha", prerelease: true }],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
      },
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
      },
    ],
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
