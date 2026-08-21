---
name: git-delivery
description: Use when staging or committing repository changes, curating local history for delivery, or creating, updating, merging, or monitoring a pull or merge request. Do not use for ordinary edits, read-only Git inspection, or unrequested commit, push, or PR actions.
compatibility: Requires Git. Hosted pull or merge request actions require an available host client or API and authorization.
---

# Git delivery

Turn completed work into a small, inspectable change and a durable explanation. Local history is working memory. Published history is the record other people must review, search, revert, and trust.

## Respect authority and repository rules

- Read applicable repository instructions before choosing branch, commit, test, push, or PR behavior. Inspect recent public commits and the PR template when local convention is unclear.
- Editing, fixing, or testing does not authorize staging, committing, pushing, opening a PR, or merging. A request to commit authorizes the local commit only. A request to open a PR includes the branch push needed to open it, but not merging it.
- Never rewrite shared history, force-push, merge, or delete branches without clear authorization. Follow the repository's required merge method.
- Preserve unrelated work. Treat existing modifications and untracked files as belonging to the user unless the task proves otherwise.
- Do not add or change Git hooks, commit linting, CI, branch protection, or repository policy merely to deliver one change. Existing enforcement still applies; changing it is separate work.
- Use the host's available source-control capability. Do not require GitHub, Graphite, `gh`, or another particular service when plain Git or a different host can complete the job.

## Inspect before staging

Start with repository root, current branch, upstream, `git status --short`, unstaged diff, staged diff, and recent subject style. Read untracked files before staging them. Check for secrets, local configuration, generated output, debug artifacts, and planning files that should stay out of history.

Resolve the exact files or hunks owned by the requested change. Stage those paths or hunks, then inspect `git diff --cached` as the proposed commit. Do not use a broad stage operation in a dirty worktree unless every included change was inspected and belongs together.

If hooks or formatters change files during commit, inspect the new state. Do not silently stage or amend changes whose contents were not reviewed.

## Shape the delivery unit

- One public commit or PR should carry one coherent concern. If its honest summary needs "and also," split it when each part can stand and verify on its own.
- Keep a behavior change with its focused tests and required documentation. Do not split them merely to reduce line count.
- Separate preparatory refactors, generated changes, or mechanical rewrites when doing so makes the semantic change easier to review and each intermediate state remains valid.
- Size is conceptual. A deletion or generated diff may be large but easy to review. A small diff crossing several responsibilities may still need splitting.
- Use stacked changes when dependent units can be reviewed independently and waiting would block useful work. Keep every layer understandable, name its dependency, and avoid adding stack-specific tooling unless it earns its setup cost.
- Working commits may be frequent and imperfect. Clean the published history at the delivery boundary, using the repository's squash, rebase, or merge policy. Do not rewrite commits other people may depend on.

## Write the commit

Follow repository style first. Otherwise prefer a compact conventional subject when it fits:

```text
type(scope): changed behavior
```

Use `fix`, `feat`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, or `chore` for their ordinary meanings. Choose a scope that helps someone scan history; omit it when it adds no information.

Write the subject like a tiny release note. Name the observable result, not the activity performed. Treat this first line as the commit's shorthand: `git log --oneline`, history lists, release tooling, and squash interfaces often show only the subject. It must stand alone; never rely on the body to make a vague subject meaningful.

```text
Weak: fix(auth): update session handling
Better: fix(auth): expired sessions redirect to sign-in once

Weak: perf: improve caching
Better: perf(cache): repeated lookups reuse parsed manifests
```

Avoid subjects such as "updates," "changes," "cleanup," "work on," or "implement feature" unless they are the precise result. A reader should understand what became different without opening the diff.

For a multi-line commit message, leave one blank line after the subject. Add a body only when the subject and diff cannot preserve an important reason, root cause, rejected alternative, constraint, tradeoff, migration note, or verification detail. Use short paragraphs and explain why the chosen behavior exists. Do not narrate the file list or duplicate a future PR body.

Before committing, inspect the staged diff one last time. After committing, verify the resulting commit and working-tree state. Report the commit hash and subject without implying that it was pushed.

## Write the pull or merge request

Treat the title as durable history. In a squash workflow it often becomes the public commit subject, so make it stand alone and match the change that will land.

Scale the description to the change:

- A small fix usually needs the concrete symptom, its cause when known, the changed behavior, and focused verification.
- A larger or riskier change should make the problem, chosen approach, measurements or evidence, tradeoffs, operational consequences, and remaining gaps easy to find.
- UI changes need before-and-after images. Motion or timing changes need a short recording. Keep review-only media out of the repository unless its conventions say otherwise.

Write for the reviewer and the developer searching history next year. Source code shows what the implementation does; the description should preserve why this change exists and why this approach won. State accepted losses and unresolved gaps plainly.

A small PR can sound like this:

```text
Expired sessions could redirect once per failed request, leaving users in a loop when several requests failed together.

The client now clears the session once and coalesces concurrent redirects. Ordinary authorization failures still return to the caller unchanged.

Tested: `session-expiry.test.ts`
```

Apply `unslop` to the title, description, review replies, and merge message. Use concrete language with enough rhythm to sound written by a person. Avoid a generated file tour, duplicate bot summaries, empty template sections, and ceremony that makes a two-line fix look like a design document. Mention the model or agent only when the repository asks for attribution.

Use `evidence-discipline` for every test, performance, safety, and completion claim. Name checks that actually ran and what they covered. Do not turn a targeted test into "all tests pass," and do not run unrelated broad checks merely to make the PR look more proven.

Open a draft when the user wants early feedback or the change is not ready to merge. Before requesting review, confirm the diff is coherent, the description matches the current scope, and required evidence is present. Update the title and description when review changes what will land.

## Finish the requested lifecycle

- Before pushing, confirm branch, upstream, commits to publish, and clean separation from unrelated work.
- After opening or updating a PR, report its URL, base and head branches, title, and current check state that was actually observed.
- When asked to monitor or babysit it, inspect checks and comments newer than the last push. Verify automated findings against the source, fix real issues within scope, and answer or dismiss false positives with a concrete reason. Stop at the user's requested terminal condition.
- Merge only when explicitly requested and required checks, approvals, and repository policy allow it. Report the observed merge result, not an assumption based on a button press.
