# Guided tour engine comparison brief

Build three independently runnable implementations on separate branches: Remotion, GSAP with React, and Motion sequences with Motion Studio. Each implementation starts from the same committed repository state. A separate evaluator reviews the completed versions and runs the demos.

## Common product requirements

Preserve the `/tour` route, shared site shell, and seven narrative beats: rounded corner, superellipse, radius comparison, strength exploration, correction, visual alignment, and utility usage. Keep the same copy or make only small clarity/accessibility corrections. Reuse the existing numeric math and SVG graphic where practical.

- Next animates to a settled reading checkpoint and pauses. Rapid repeated activation must not skip reading stops.
- Back returns to the preceding checkpoint and can interrupt a forward transition safely. A direct backward seek is acceptable.
- At the strength checkpoint, an inline slider between explanatory paragraphs updates the graphic immediately while the narrative remains paused. The range is 1 to 3 in increments of 0.1, initially 2.
- Remember the slider choice. Next smoothly returns to the authored value of 2 during correction; Back restores the user's choice. Include Reset.
- Preserve the final Explore handoff and return. Explore changes remain separate from remembered tour choices.
- Text must remain selectable and controls usable with pointer and keyboard. Hidden/outgoing content must not remain focusable. Preserve focus during slider updates.
- Support 320, 390, 768, 960, and 1280 viewport widths without page overflow, clipped copy, or overlapping controls. Handle resizing during playback and while paused without losing location or choice.
- Support reduced motion and respect it if the preference changes during playback.

## Library boundaries

Remotion should use a persistent Player, a single frame timeline, native sequences, and compact/wide composition presets. Use the completed baseline as a starting point and audit it independently. Do not introduce continuous canvas measurement unless a demonstrated defect requires it. Include working Remotion Studio presets.

GSAP should use normal responsive HTML/CSS and a shared GSAP timeline with library labels/checkpoint methods. Use the official React integration and lifecycle cleanup. Avoid React/GSAP writing the same property concurrently. Remove Remotion runtime/editor dependencies from this branch when no longer used.

Motion should use the actual shared sequence API and scoped React integration, rather than independent springs/presence callbacks. Use normal responsive HTML/CSS. Configure and test the current Motion Studio integration against the repository's real Astro setup. Document any verified version/account limitations rather than implying that configuration alone is a working editor. Remove Remotion dependencies from this branch when no longer used.

Each engine may use its natural architecture. They need the same product behavior, not identical internal data structures. Do not build a replacement generic animation framework. Explicit interaction state and geometry helpers are expected.

## Delivery requirements

Create the requested named branch in the assigned isolated worktree. Do not modify the parent checkout or another implementation's worktree. Commit the completed implementation and its branch-specific authoring instructions. Do not push or create a pull request.

Run focused automated tests, scoped typecheck/lint, a production build, and browser checks. Record exact failures and distinguish existing generated Panda lint, Vite+ task-runner dependency resolution, and CSS utility test failures from new issues. Do not change unrelated library behavior or snapshots to hide baseline failures.

Start an independent preview on the assigned port and leave it running. Return the branch name, commit SHA, worktree path, demo/Studio URLs, commands, test results, remaining limitations, and a short summary of the animation/control architecture.

## Independent evaluation

Wait until all three implementations are committed. Read each implementation and authoring instructions, run its focused checks and production build, and exercise its actual demo in separate browser tabs. Verify the common interaction requirements, including nondefault slider values, rapid input, interrupted navigation, keyboard focus, viewport changes, and Explore return.

Compare correctness, responsive readability, accessibility, authoring/retiming effort, direct seeking, runtime and development dependency cost, cleanup/reliability, and the amount of custom coordination code that remains. Report objective measurements separately from qualitative judgments. Compare production chunks using consistent raw/gzip accounting and note shared React separately. A missing browser/version check is a limitation, not a passing result.

Do not favor an engine based on the earlier alternatives research. Give concrete reproduction steps for defects and code references for architectural claims. Explain which engine is the best fit for this interactive website, and when another engine would be preferable. Do not change implementations during the review; return findings to the parent.
