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

Use the `clear-technical-writing` skill when writing or revising continuity
records and their owning technical documentation. Its clarity rules must not
weaken evidence, status, requirements, or exact identifiers.

## Run verified batches

When the user or repository authorizes autonomous commits, repeat:

1. Select one logical, independently reviewable result from `Next action`.
   Name the behavior owner and existing interface before adding code. The next
   missing symbol, failing assertion, or trace event chooses what to inspect;
   it does not automatically define the module or commit boundary.
2. Size the batch around one owner and observable result. Group a small family
   of coupled functions when they share state, evidence, and verification and
   intermediate commits add no review value. Split work when owners, lifetimes,
   risk, or proof differ.
3. Implement the related changes and update their owning docs or decisions.
   Reuse or deepen an existing owner instead of adding a parallel special case.
4. Use focused checks while iterating. Run broader required gates once the
   batch is stable, and rerun them only when later edits could invalidate them.
5. Replace `STATUS.md` with the resulting current state and one next action.
6. Review the diff, stage only the batch, and commit it after required checks
   pass. Use the `git-delivery` workflow when it is available so repository
   subject style and staged-file ownership remain intact.
7. Confirm unrelated and concurrently created work remains untouched, then
   begin the next batch.

Without commit authority, stop after verified changes and record their
uncommitted state. A partial result may be committed only when it is useful and
verified on its own, with its limits documented.

## Resolve undocumented behavior efficiently

When a compatibility, reverse-engineering, or startup batch stalls on unknown
behavior, preserve the first failing boundary and climb this evidence ladder:

1. Retain a bounded trace or other reproducible artifact that names the exact
   failing process, interface, status, and ordering. Reuse it until a specific
   unanswered question requires another run.
2. For a compiled owner, inspect a matching-symbol decompile before attaching a
   debugger. Record the binary and symbol identity so a plausible but mismatched
   decompile cannot become project fact.
3. Read the smallest owning public implementation or adapter source available,
   such as Wine, Proton, ReactOS, FEX, or the project's host layer. Prefer its
   established seam over a local special case.
4. Add one narrow diagnostic log, oracle, or differential fixture for one named
   ambiguity. Decide before running it which observations distinguish the
   competing explanations, then retain the result as evidence.
5. Use a debugger only when the remaining question requires live state that the
   retained artifact, decompile, source, and bounded experiment cannot expose.

Do not repeat debugger setup or broad trace collection without a new question.
After each observation, update the hypothesis and choose the cheapest next
artifact that can falsify it. Remove temporary diagnostics before delivery and
move durable findings to their factual owner.

## Close a boundary

Before pausing, compaction, handoff, or another batch:

1. Move durable facts and exact evidence out of `STATUS.md` to their owners.
2. Leave one current batch, one next action, current blockers, and only the
   latest evidence needed to resume correctly.
3. Resolve `scripts/continuity.ts` relative to this file. Run it with Bun,
   passing `validate`, `--project-root`, and the absolute repository root.

Fix structural validation errors before starting another batch. Treat
compactness warnings as prompts to remove stale, repeated, or misplaced detail,
not as hard limits. Do not normalize a warning that repeats until it stops being
useful: when the current batch touches that record, move historical detail to
its owner and restore a readable current snapshot. Keep detail the user or
project still needs. If context quality drops, preserve safe partial work and
close this boundary early.
