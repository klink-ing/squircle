/**
 * Fails a PR whose release note is missing or too long, for the PR checks
 * workflow (pr-title.yml). See checkReleaseNote in release-note.mjs for the
 * rules. Reads PR_TITLE, PR_BODY and HEAD_REF.
 */
import { checkReleaseNote } from "./release-note.mjs";

const problem = checkReleaseNote({
  title: process.env.PR_TITLE ?? "",
  body: process.env.PR_BODY ?? "",
  headRef: process.env.HEAD_REF ?? "",
});

if (problem) {
  console.log(`::error title=Release note::${problem}`);
  process.exit(1);
}
console.log("The release note is fine.");
