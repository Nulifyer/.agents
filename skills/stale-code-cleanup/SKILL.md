---
name: stale-code-cleanup
description: Use when retiring a proven superseded implementation and its supporting files, or when cleaning material task-created disk usage. Do not use for speculative dead-code audits, ordinary small edits, or uncertain user data.
---

# Stale code cleanup

Remove obsolete work as a complete change. Source control preserves committed
history; the working tree should preserve supported behavior, current evidence,
and intentional compatibility.

## Route the cleanup

Read only the reference that matches the cleanup:

- When a replacement makes an implementation, tests, dependencies,
  configuration, docs, or generated output obsolete, read
  [retiring a path](references/retire-path.md).
- When development, testing, downloads, captures, or experiments create
  material disk usage, read [disk artifacts](references/disk-artifacts.md).

Read both when retiring a path also requires removing large artifacts.

## Establish ownership before deletion

Perform a cleanup review when a replacement becomes the supported path, a
migration or compatibility window closes, an experiment is abandoned, or a
disk-heavy task reaches a verified boundary. Preserve a failed path's lesson
when it affects future decisions, then remove its disposable files.

Classify each target as committed and unchanged, modified or staged, untracked,
ignored, or outside the repository. Version control protects committed content,
not every file under a working tree. Preserve changes outside this cleanup and
ask about unique data whose owner or purpose is uncertain.

If replacement status, retention policy, migration state, or user intent is
unresolved, report the decision needed before deleting. Do not turn cleanup
into an unrelated redesign or broad system purge.

## Finish the cleanup

Inspect the complete diff and worktree. Confirm every deletion and surviving
generated change belongs to the cleanup while unrelated and concurrent work
remains untouched.

When a cleanup commit is authorized, keep the removal with its required
dependency, test, configuration, and documentation changes. Use `git-delivery`
when available. A cleanup request does not itself authorize a commit, push, or
history rewrite.

Report what was removed, the evidence supporting removal, intentional survivors
and their reason, checks that ran, and material disk space actually reclaimed.
