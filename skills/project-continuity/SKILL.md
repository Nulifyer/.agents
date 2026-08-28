---
name: project-continuity
description: Use when resuming long-running repository work, closing a verified batch, recovering after compaction, or preparing a session handoff where .agents owns project state. Do not use for one-off tasks or unsettled project definition.
compatibility: Requires Bun to run the bundled validator.
---

# Project continuity

Keep `.agents` as compact current project state. Git, factual documentation,
contracts, and evidence artifacts preserve detail and history. This skill does
not manage goals, sessions, or subagents.

## Resume

1. Read repository `AGENTS.md`, then `.agents/README.md` and its indexed files.
2. Check the worktree and relevant artifacts before trusting recorded state.
3. Start from the single `Next action`. Repair stale or ambiguous state first.
4. Open only the factual documents needed for the current batch.

Use project-inception when the standard files are missing and consequential
project boundaries remain unsettled.

## Keep one owner per fact

- `PLAN.md` owns stable goals, scope, boundaries, phases, and success conditions.
- `DECISIONS.md` owns choices future work must preserve. It does not record task
  completion.
- `STATUS.md` is a snapshot of the project and current batch. Replace completed
  batch detail; never append a diary or test history.
- `TESTING.md` owns stable commands, environments, gates, and evidence meaning.
  Exact run results belong in contracts or evidence artifacts.
- Stable discoveries, behavior, architecture, and compatibility limits belong
  in the smallest owning factual document, usually under `docs/`.

Read [the artifact contract](references/artifact-contract.md) when creating,
adopting, repairing, splitting, or shrinking the standard files.

## Run verified batches

When the user or repository authorizes autonomous commits, repeat:

1. Select one logical, independently reviewable result from `Next action`.
2. Implement the related changes and update their owning docs or decisions.
3. Replace `STATUS.md` with the resulting current state and one next action.
4. Run the required validation and tests. Repair failures within the same batch.
5. Review the diff, stage only the batch, and commit it after required checks pass.
6. Confirm unrelated work remains untouched, then begin the next batch.

Without commit authority, stop after verified changes and record their
uncommitted state. A partial result may be committed only when it is useful and
verified on its own, with its limits documented.

## Close a boundary

Before pausing, compaction, handoff, or another batch:

1. Move durable facts and exact evidence out of `STATUS.md` to their owners.
2. Leave one current batch, one next action, current blockers, and only the
   latest evidence needed to resume correctly.
3. Resolve `scripts/continuity.ts` relative to this file. Run it with Bun,
   passing `validate`, `--project-root`, and the absolute repository root.

Fix every validation error, including size limits, before starting another
batch. If context quality drops, preserve safe partial work and close this
boundary early.
