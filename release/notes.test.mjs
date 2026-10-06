import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkReleaseNote,
  extractReleaseNote,
  normalizeNote,
  parseCommit,
} from "./release-note.mjs";
import { renderNotes, repoSlug } from "./notes.mjs";
import { nextVersion } from "./preview.mjs";

const body = (note) =>
  `## Summary\n\nLots of detail.\n\n## Release note\n\n${note}\n\n## Test plan\n\n- [x] ran it`;

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
      extractReleaseNote(
        "## Release note\n\nAdds `x`.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)",
      ),
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
  const check = (title, note, headRef = "claude/x") =>
    checkReleaseNote({ title, body: note === undefined ? "## Summary\n\nx" : body(note), headRef });

  it("requires a note on features, fixes, performance and breaking changes", () => {
    for (const title of ["feat: x", "fix(pill): x", "perf: x", "chore!: x"]) {
      assert.match(check(title), /Add a "## Release note" section/, title);
    }
  });
  it("doesn't on other types, promotions or syncs", () => {
    assert.equal(check("chore: x"), null);
    assert.equal(check("ci: x"), null);
    for (const head of ["alpha", "beta", "main", "sync/main-into-alpha"]) {
      assert.equal(check("feat: x", undefined, head), null, head);
    }
  });
  it("rejects an empty note, and 'None' on a breaking change only", () => {
    assert.match(check("feat: x", "<!-- guidance -->"), /is empty/);
    assert.equal(check("feat(demos): x", "None."), null);
    assert.match(check("feat!: x", "None"), /breaking change/);
  });
  it("wants one short paragraph", () => {
    assert.equal(check("feat: x", "One.\n\nA footer after it is fine."), null);
    assert.match(check("feat: x", "- a\n- b"), /not a list/);
    assert.match(check("feat: x", "1. a"), /not a list/);
    assert.match(check("feat: x", "a".repeat(300)), /is 301 characters; keep it under 300/);
    assert.equal(check("feat: x", "a".repeat(299)), null);
  });
  it("still checks a note someone added to a chore", () => {
    assert.match(check("chore: x", "- a"), /not a list/);
  });
});

describe("renderNotes", () => {
  const prs = {
    38: body("New `squircle-pill` utility."),
    40: "## Summary\n\nNo note in the PR.",
    43: body("This release adds pill shapes."),
    44: body("None"),
    45: body("Rename `--a` to `--b`."),
  };
  const render = (commits, extra = {}) =>
    renderNotes({
      version: "0.11.0",
      previousTag: "v0.10.0",
      tag: "v0.11.0",
      date: "2026-10-07",
      slug: "o/r",
      commits: commits.map((message, i) => ({ message, hash: `${i}`.repeat(40) })),
      fetchPrBody: async (n) => prs[n] ?? null,
      ...extra,
    });

  it("lists notes by section, puts the promotion's note on top, and leaves the rest out", async () => {
    const { markdown, untitled } = await render([
      "Merge alpha into main (#43)",
      "Merge main into alpha",
      "chore(demos): hide pages (#41)",
      "feat: export defaults (#40)",
      "fix: crease (#39)\n\n## Release note\n\nfixes the crease in Safari",
      "feat: Add pill (#38)",
      "feat(demos): demo only (#44)",
    ]);
    assert.equal(
      markdown,
      [
        "## [0.11.0](https://github.com/o/r/compare/v0.10.0...v0.11.0) (2026-10-07)",
        "",
        "This release adds pill shapes.",
        "",
        "### Features",
        "",
        "- Export defaults. ([#40](https://github.com/o/r/pull/40))",
        "- New `squircle-pill` utility. ([#38](https://github.com/o/r/pull/38))",
        "",
        "### Fixes",
        "",
        "- Fixes the crease in Safari. ([#39](https://github.com/o/r/pull/39))",
        "",
      ].join("\n"),
    );
    assert.deepEqual(untitled, [40]);
  });

  it("puts breaking changes first, whatever their type, and never drops them", async () => {
    const { markdown } = await render([
      "fix!: rename (#45)",
      "feat!: other (#44)",
      "feat: x (#38)",
    ]);
    assert.match(
      markdown,
      /### Breaking changes\n\n- Rename `--a` to `--b`\. \(\[#45\]\(.*\)\)\n- Other\. \(\[#44\]/,
    );
    assert.ok(markdown.indexOf("### Breaking changes") < markdown.indexOf("### Features"));
  });

  it("links the commit when there's no PR, and says when nothing is user-facing", async () => {
    assert.match(
      (await render(["fix: direct push"])).markdown,
      /- Direct push\. \(\[0000000\]\(https:\/\/github\.com\/o\/r\/commit\/0{40}\)\)/,
    );
    assert.match(
      (await render(["feat(demos): demo only (#44)"])).markdown,
      /No user-facing changes\./,
    );
  });

  it("falls back to the commit's note when GitHub can't be read", async () => {
    const { markdown, untitled } = await render(
      ["feat: x (#50)\n\n## Release note\n\nfrom the commit"],
      { fetchPrBody: async () => null },
    );
    assert.match(markdown, /- From the commit\. \(\[#50\]/);
    assert.deepEqual(untitled, []);
  });

  it("has no compare link for a first release", async () => {
    const { markdown } = await render(["feat: x (#38)"], { previousTag: undefined });
    assert.match(markdown, /^## 0\.11\.0 \(2026-10-07\)\n/);
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
