import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkReleaseNote,
  extractReleaseNote,
  extractReleaseNotes,
  normalizeNote,
  parseCommit,
} from "./release-note.mjs";
import { generateSections, renderNotes, repoSlug } from "./notes.mjs";
import { nextVersion, previewComment } from "./preview.mjs";

const body = (note) =>
  `## Summary\n\nLots of detail.\n\n## Release note\n\n${note}\n\n## Test plan\n\n- [x] ran it`;

const WRITTEN = [
  "Pills now animate between sizes.",
  "",
  "### Fixes",
  "",
  "- Borders no longer clip on small pills.",
].join("\n");
const promotionBody = (notes) =>
  `## Summary\n\nPromotes alpha.\n\n## Release notes\n\n<!-- guidance -->\n${notes}\n\n---\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`;

describe("extractReleaseNote", () => {
  it("takes the paragraph under the heading, up to the next one", () => {
    assert.equal(extractReleaseNote(body("Adds `x`.")), "Adds `x`.");
  });
  it("accepts ### and 'notes', in any case, at the end of the body", () => {
    assert.equal(extractReleaseNote("Intro\n\n### release Notes\nFixes y.\n"), "Fixes y.");
  });
  it("drops the template's comments", () => {
    assert.equal(
      extractReleaseNote("## Release note\n\n<!--\n  guidance\n-->\nFixes y."),
      "Fixes y.",
    );
  });
  it("is null without the heading and empty when there's nothing under it", () => {
    assert.equal(extractReleaseNote("## Summary\n\nNo note here."), null);
    assert.equal(extractReleaseNote(null), null);
    assert.equal(extractReleaseNote("## Release note\n\n<!-- guidance -->\n\n## Test plan"), "");
  });
  it("takes only the first paragraph, so a footer after it stays out", () => {
    assert.equal(
      extractReleaseNote("## Release note\n\nAdds `x`.\n\n🤖 Generated with [Claude Code](x)"),
      "Adds `x`.",
    );
    assert.equal(
      extractReleaseNote("## Release note\n<!-- guidance -->\n\nAdds `x`\nacross lines.\n\nMore."),
      "Adds `x`\nacross lines.",
    );
  });
  it("handles CRLF bodies", () => {
    assert.equal(extractReleaseNote("## Release note\r\n\r\nFixes y.\r\n## Next"), "Fixes y.");
  });
});

describe("extractReleaseNotes", () => {
  it("keeps the whole section, ### headings and lists too, up to --- or the next ##", () => {
    assert.equal(extractReleaseNotes(promotionBody(WRITTEN)), WRITTEN);
    assert.equal(
      extractReleaseNotes(`## Release notes\n\n${WRITTEN}\n\n## Test plan\n\nx`),
      WRITTEN,
    );
  });
  it("is null without the heading and empty when there's only guidance", () => {
    assert.equal(extractReleaseNotes("## Summary\n\nx"), null);
    assert.equal(extractReleaseNotes(promotionBody("")), "");
  });
  it("finds them below the template's own '## Release note' heading", () => {
    const templated = `## Release note\n\n<!-- guidance -->\n\n## Release notes\n\n${WRITTEN}`;
    assert.equal(extractReleaseNotes(templated), WRITTEN);
  });
  it("isn't ended by a --- or heading inside a comment", () => {
    const body = `## Release notes\n\n<!--\n---\n## not the end\n-->\n${WRITTEN}\n\n---\n\nfooter`;
    assert.equal(extractReleaseNotes(body), WRITTEN);
  });
  it("doesn't end inside a code block", () => {
    const notes = "Renamed.\n\n```sh\n# before\nnpm i a\n---\n```\n\nAfter the code.";
    assert.equal(extractReleaseNotes(`## Release notes\n\n${notes}\n\n---\n\nfooter`), notes);
  });
});

describe("normalizeNote", () => {
  it("makes one capitalised line ending in a full stop", () => {
    assert.equal(normalizeNote("adds `x`\n  to the  plugin"), "Adds `x` to the plugin.");
  });
  it("keeps existing end punctuation, code and parentheses", () => {
    assert.equal(normalizeNote("Use `x`"), "Use `x`");
    assert.equal(normalizeNote("Fixed (finally)"), "Fixed (finally)");
    assert.equal(normalizeNote("Done!"), "Done!");
  });
});

describe("parseCommit", () => {
  it("reads type, scope, subject and PR number", () => {
    assert.deepEqual(
      (({ type, scope, subject, breaking, pr }) => ({ type, scope, subject, breaking, pr }))(
        parseCommit("feat(pill): add ease (#38)\n\nbody"),
      ),
      { type: "feat", scope: "pill", subject: "add ease", breaking: false, pr: 38 },
    );
  });
  it("sees breaking changes in the header and in a footer", () => {
    assert.equal(parseCommit("feat!: rename").breaking, true);
    assert.equal(parseCommit("fix(x)!: rename").breaking, true);
    assert.equal(parseCommit("fix: y\n\nBREAKING CHANGE: z").breaking, true);
    assert.equal(parseCommit("fix: y\n\nBREAKING-CHANGE: z").breaking, true);
    assert.equal(parseCommit("fix: y\n\nnot a BREAKING CHANGE: z").breaking, false);
  });
  it("has no type for the bot's merges", () => {
    assert.equal(parseCommit("Merge main into alpha").type, null);
    assert.equal(parseCommit("Merge alpha into main (#43)").type, null);
  });
});

describe("checkReleaseNote", () => {
  const check = (title, text, { headRef = "claude/x", baseRef = "alpha" } = {}) =>
    checkReleaseNote({
      title,
      body: text === undefined ? "## Summary\n\nx" : body(text),
      headRef,
      baseRef,
    });

  it("needs nothing on promotions and syncs: the preview checks a promotion's notes", () => {
    for (const [headRef, baseRef] of [
      ["alpha", "main"],
      ["beta", "main"],
      ["alpha", "beta"],
      ["main", "alpha"],
      ["beta", "alpha"],
      ["sync/main-into-alpha", "alpha"],
    ]) {
      assert.equal(
        check("feat!: x", undefined, { headRef, baseRef }),
        null,
        `${headRef}→${baseRef}`,
      );
    }
  });
  it("leaves the note optional on PRs into alpha and beta", () => {
    for (const baseRef of ["alpha", "beta"]) {
      for (const title of ["feat: x", "fix(pill): x", "perf: x", "chore: x"]) {
        assert.equal(check(title, undefined, { baseRef }), null, `${title} into ${baseRef}`);
        assert.equal(check(title, "<!-- guidance -->", { baseRef }), null, `${title}, empty`);
        assert.equal(check(title, "None", { baseRef }), null, `${title}, None`);
      }
    }
  });
  it("requires one on features, fixes and performance into main, though 'None' will do", () => {
    for (const title of ["feat: x", "fix(pill): x", "perf: x"]) {
      assert.match(check(title, undefined, { baseRef: "main" }), /released straight away/);
      assert.match(check(title, "<!-- guidance -->", { baseRef: "main" }), /straight away/);
      assert.equal(check(title, "None.", { baseRef: "main" }), null);
    }
    assert.equal(check("chore: x", undefined, { baseRef: "main" }), null);
  });
  it("requires a real one on breaking changes, into any branch", () => {
    for (const baseRef of ["alpha", "main"]) {
      assert.match(check("feat!: x", undefined, { baseRef }), /breaking change, so it needs/);
      assert.match(check("chore!: x", "None", { baseRef }), /can't be "None"/);
      assert.equal(check("fix!: x", "Rename `--a` to `--b`.", { baseRef }), null);
    }
  });
  it("wants one short paragraph, wherever there's a note", () => {
    assert.equal(check("feat: x", "One.\n\nA footer after it is fine."), null);
    assert.match(check("feat: x", "- a\n- b"), /not a list/);
    assert.match(check("chore: x", "1. a"), /not a list/);
    assert.match(check("feat: x", "a".repeat(300)), /is 301 characters; keep it under 300/);
    assert.equal(check("feat: x", "a".repeat(299)), null);
  });
});

const prs = {
  38: body("New `squircle-pill` utility."),
  40: "## Summary\n\nNo note in the PR.",
  44: body("None"),
  45: body("Rename `--a` to `--b`."),
  50: promotionBody(WRITTEN),
  51: promotionBody(""),
};
const fetchPrBody = async (n) => prs[n] ?? null;
const asCommits = (messages) =>
  messages.map((message, i) => ({ message, hash: `${i}`.repeat(40) }));

describe("generateSections", () => {
  const generate = (messages, extra = {}) =>
    generateSections({ commits: asCommits(messages), fetchPrBody, slug: "o/r", ...extra });

  it("gives each feature, fix and performance change a line: its note, else its title", async () => {
    assert.equal(
      await generate([
        "Merge main into alpha",
        "chore(demos): hide pages (#41)",
        "feat: export defaults (#40)",
        "fix: crease (#39)\n\n## Release note\n\nfixes the crease in Safari",
        "feat: Add pill (#38)",
        "feat(demos): demo only (#44)",
      ]),
      [
        "### Features",
        "",
        "- Export defaults. ([#40](https://github.com/o/r/pull/40))",
        "- New `squircle-pill` utility. ([#38](https://github.com/o/r/pull/38))",
        "",
        "### Fixes",
        "",
        "- Fixes the crease in Safari. ([#39](https://github.com/o/r/pull/39))",
      ].join("\n"),
    );
  });
  it("puts breaking changes first, whatever their type, and never drops them", async () => {
    const sections = await generate(["fix!: rename (#45)", "feat!: other (#44)", "feat: x (#38)"]);
    assert.match(
      sections,
      /^### Breaking changes\n\n- Rename `--a` to `--b`\. \(\[#45\]\(.*\)\)\n- Other\. \(\[#44\]/,
    );
  });
  it("links the commit when there's no PR, and is empty when nothing makes a line", async () => {
    assert.match(
      await generate(["fix: direct push"]),
      /- Direct push\. \(\[0000000\]\(https:\/\/github\.com\/o\/r\/commit\/0{40}\)\)/,
    );
    assert.equal(await generate(["chore: x", "feat(demos): demo only (#44)"]), "");
  });
  it("falls back to the commit's note when GitHub can't be read", async () => {
    const sections = await generate(["feat: x (#60)\n\n## Release note\n\nfrom the commit"], {
      fetchPrBody: async () => null,
    });
    assert.match(sections, /- From the commit\. \(\[#60\]/);
  });
});

describe("renderNotes", () => {
  const render = (messages, extra = {}) =>
    renderNotes({
      stable: true,
      version: "0.12.0",
      previousTag: "v0.11.0",
      tag: "v0.12.0",
      date: "2026-11-02",
      slug: "o/r",
      commits: asCommits(messages),
      fetchPrBody,
      ...extra,
    });
  const TITLE = "## [0.12.0](https://github.com/o/r/compare/v0.11.0...v0.12.0) (2026-11-02)";

  it("publishes a stable promotion's written notes as they are", async () => {
    const result = await render(["Merge alpha into main (#50)", "feat: Add pill (#38)"]);
    assert.deepEqual(result, {
      markdown: `${TITLE}\n\n${WRITTEN}\n`,
      written: true,
      promotion: 50,
    });
  });
  it("only takes the notes of the promotion that makes the release", async () => {
    const hotfix = await render([
      "fix: crease (#39)\n\n## Release note\n\nfixes it",
      "Merge alpha into main (#50)",
      "chore(site): x (#41)",
    ]);
    assert.equal(hotfix.written, false);
    assert.equal(hotfix.promotion, null);
    assert.match(hotfix.markdown, /### Fixes\n\n- Fixes it\./);
    const unreadable = await render(["Merge beta into main (#99)", "Merge alpha into main (#50)"]);
    assert.equal(unreadable.written, false);
    assert.equal(unreadable.promotion, 99);
  });
  it("never publishes 'None' as a release's notes", async () => {
    prs[52] = promotionBody("None");
    const result = await render(["Merge alpha into main (#52)", "feat: Add pill (#38)"]);
    assert.equal(result.written, false);
    assert.match(result.markdown, /### Features\n\n- New `squircle-pill` utility\./);
  });
  it("generates them when the promotion has none, so a release is never blank", async () => {
    const result = await render(["Merge alpha into main (#51)", "feat: Add pill (#38)"]);
    assert.equal(result.written, false);
    assert.equal(result.promotion, 51);
    assert.match(result.markdown, /### Features\n\n- New `squircle-pill` utility\./);
  });
  it("generates them for prereleases and for releases straight from main", async () => {
    const promotedToBeta = await render(["Merge alpha into beta (#50)", "feat: Add pill (#38)"], {
      stable: false,
    });
    assert.equal(promotedToBeta.written, false);
    const hotfix = await render(["fix: crease (#39)\n\n## Release note\n\nfixes it"]);
    assert.equal(
      hotfix.markdown,
      `${TITLE}\n\n### Fixes\n\n- Fixes it. ([#39](https://github.com/o/r/pull/39))\n`,
    );
  });
  it("says when nothing is user-facing, and has no compare link for a first release", async () => {
    const { markdown } = await render(["chore: x"], { previousTag: undefined, stable: false });
    assert.equal(markdown, "## 0.12.0 (2026-11-02)\n\nNo user-facing changes.\n");
  });
});

describe("previewComment", () => {
  const preview = (prBody, messages, extra = {}) =>
    previewComment({
      baseRef: "main",
      headRef: "alpha",
      commits: asCommits(messages),
      previousTag: "v0.11.0",
      prBody,
      fetchPrBody,
      slug: "o/r",
      date: "2026-11-02",
      ...extra,
    });

  it("shows the written notes as published, with the changes since the last stable release folded away", async () => {
    const { comment, ok } = await preview(promotionBody(WRITTEN), ["feat: Add pill (#38)"]);
    assert.equal(ok, true);
    assert.match(comment, /^<!-- release-notes-preview -->\n/);
    assert.match(comment, /releases \*\*0\.12\.0\*\* with this PR's "Release notes", as written/);
    assert.ok(comment.includes(`(2026-11-02)\n\n${WRITTEN}\n\n---`));
    assert.match(
      comment,
      /<details>\n<summary>Changes since v0\.11\.0[\s\S]*- New `squircle-pill` utility\.[\s\S]*<\/details>\n$/,
    );
  });
  it("titles them like the release does, with no compare link without a repository", async () => {
    const { comment } = await preview(promotionBody(WRITTEN), ["feat: Add pill (#38)"], {
      slug: null,
    });
    assert.ok(comment.includes(`## 0.12.0 (2026-11-02)\n\n${WRITTEN}`));
    assert.ok(!comment.includes("github.com/null"));
  });
  it("fails, asking for them with the changes to write them from, when they're missing", async () => {
    const { comment, ok } = await preview(promotionBody(""), ["feat: Add pill (#38)"]);
    assert.equal(ok, false);
    assert.match(
      comment,
      /\[!IMPORTANT\]\n> Write 0\.12\.0's notes under a `## Release notes` heading/,
    );
    assert.match(comment, /\*\*Changes since v0\.11\.0\*\*[\s\S]*- New `squircle-pill` utility\./);
    assert.ok(!comment.includes("<details>"));
  });
  it("doesn't take 'None' for the notes of a promotion that releases something", async () => {
    const { comment, ok } = await preview(promotionBody("None"), ["feat: Add pill (#38)"]);
    assert.equal(ok, false);
    assert.match(comment, /"None" won't do: this promotion releases 0\.12\.0/);
  });
  it("warns about a major release", async () => {
    const { comment } = await preview(promotionBody(WRITTEN), ["fix!: rename (#45)"]);
    assert.match(comment, /\*\*1\.0\.0 is a major release\*\*/);
    assert.match(comment, /### Breaking changes\n\n- Rename `--a` to `--b`\./);
  });
  it("needs no notes when promoting releases nothing", async () => {
    const { comment, ok } = await preview("", ["chore: x"]);
    assert.equal(ok, true);
    assert.match(comment, /Promoting this releases nothing[\s\S]*It needs no release notes\./);
  });
  it("shows generated notes for a promotion into beta, which needs none written", async () => {
    const { comment, ok } = await preview("", ["feat: Add pill (#38)"], { baseRef: "beta" });
    assert.equal(ok, true);
    assert.match(comment, /releases the next beta, with notes generated from its PRs/);
    assert.match(
      comment,
      /## Next beta \(2026-11-02\)\n\n### Features\n\n- New `squircle-pill` utility\./,
    );
  });
});

describe("nextVersion", () => {
  const commits = (...messages) => messages.map((message) => ({ message }));
  it("bumps like commit-analyzer, including major on 0.x", () => {
    assert.equal(nextVersion("v0.10.0", commits("chore: x", "feat: y")), "0.11.0");
    assert.equal(nextVersion("v0.10.3", commits("fix: y", "Merge main into alpha")), "0.10.4");
    assert.equal(nextVersion("v0.10.0", commits("feat: y", "fix!: z")), "1.0.0");
    assert.equal(nextVersion("v0.10.0", commits("chore: x", "Merge alpha into main (#1)")), null);
  });
});

describe("repoSlug", () => {
  it("prefers GITHUB_REPOSITORY, then reads the URL", () => {
    assert.equal(repoSlug("x", { GITHUB_REPOSITORY: "a/b" }), "a/b");
    assert.equal(repoSlug("https://github.com/klink-ing/squircle.git", {}), "klink-ing/squircle");
    assert.equal(repoSlug("git@github.com:klink-ing/squircle.git", {}), "klink-ing/squircle");
    assert.equal(repoSlug("file:///tmp/x", {}), null);
  });
});
