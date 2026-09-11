# Commit delivery

## Inspect and stage

Resolve the repository root, current branch, upstream, `git status --short`,
unstaged diff, and staged diff. Read untracked files before staging them. Check
for secrets, local configuration, generated output, debug artifacts, and
planning files that should stay out of history.

Resolve the exact files or hunks owned by the requested change. Stage those
paths or hunks, then inspect `git diff --cached` as the proposed commit. Do not
use broad staging in a dirty worktree unless every included change was inspected
and belongs to the same result.

If hooks or formatters change files during commit, inspect the new state. Do not
silently stage or amend changes whose contents were not reviewed.

## Write the commit

Use this scoped Conventional Commit form regardless of repository history:

```text
type(scope): changed behavior
```

Use `fix`, `feat`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, or `chore`
for their ordinary meanings. Name the owning component, subsystem, package, or
documentation area in `scope`. If enforced tooling rejects this form, report
the conflict instead of silently changing formats.

Write the subject like a small release note. Name the observable result, not
the editing activity. It must stand alone in history lists and squash
interfaces.

```text
Weak: fix(auth): update session handling
Better: fix(auth): expired sessions redirect to sign-in once

Weak: perf: improve caching
Better: perf(cache): repeated lookups reuse parsed manifests
```

Avoid vague subjects such as "updates," "changes," "cleanup," "work on," or
"implement feature" unless that word names the precise result.

Add a body only when the subject and diff cannot preserve an important reason,
root cause, rejected alternative, constraint, tradeoff, migration note, or
verification detail. Explain why the behavior exists; do not narrate the file
list or duplicate a future change-request description.

Before committing, inspect the staged diff one last time. After committing,
verify the commit and worktree state. Report the hash and subject without
implying that the commit was pushed.
