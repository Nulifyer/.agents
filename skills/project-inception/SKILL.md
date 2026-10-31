---
name: project-inception
description: Use when starting or substantially redefining a project whose goals, boundaries, feature choices, architecture, or proof of completion are not yet agreed. Do not use for a well-scoped implementation task in an established project.
compatibility: Requires Bun to run the bundled bootstrap script.
---

# Project inception

Turn an underspecified project into an agreed, durable working contract before implementation expands.

## Establish the boundary

1. Read the repository's instruction file and the smallest relevant set of existing plans, documentation, source entrypoints, and tests.
2. Decide whether the repository already answers the consequential questions below. Do not repeat settled questions.
3. For a new or lightly specified project, conduct focused decision rounds with the user. Cover only choices that would materially change the implementation:
   - desired outcome, users, and observable success;
   - included and excluded scope;
   - platform and compatibility boundaries;
   - features to keep, drop, replace, or defer;
   - architecture, ownership, security, performance, and deployment constraints;
   - evidence required before a phase or project is called complete;
   - delivery and commit policy for autonomous work.
4. Present concrete alternatives and a recommended default when the evidence supports one. Record only confirmed decisions. Keep unresolved choices visible rather than choosing silently.
5. Do not begin broad implementation until the goal, exclusions, first milestone, and acceptance evidence are settled. Small read-only probes or prototypes are allowed when they answer a decision question.

## Create the durable project state

Reuse an existing project convention when it already owns the required state. For the standard project record suite, resolve `scripts/bootstrap.ts` relative to this file, run it with Bun, and pass the absolute repository root through `--project-root`. Do not bootstrap a project suite solely for one standalone task.

The script creates missing files without overwriting existing content. Fill the generated sections from repository evidence and confirmed user decisions:

- root `AGENTS.md`: stable repository rules and a short pointer to the work state;
- `.agents/PLAN.md`: end goal, scope, boundaries, phases, and success conditions;
- `.agents/DECISIONS.md`: binding decisions and unresolved choices;
- `.agents/STATUS.md`: verified project state, one current batch or linked active tasks, integration blockers, and the coordinator's next action;
- `.agents/TESTING.md`: commands and evidence that prove progress;
- `.agents/README.md`: fixed read order and maintenance rules;

Preserve existing instructions and custom sections. Add missing standard sections instead of replacing the user's prose. Put factual product or subsystem documentation under the repository's documentation convention, usually `docs/`; keep planning and current work state under `.agents/`.

Use optional task ledgers for independently resumable outcomes, not one per agent or batch. Each task owns its acceptance evidence, dependencies, owner, and next action. Project status links those details instead of copying them. A task ledger may coexist with project records; work-ledger owns its template and lifecycle.

## Keep the records bounded

- Store current truth, not a transcript. Git owns history.
- Replace stale status instead of appending daily entries.
- Keep active or open choices future work must preserve in `DECISIONS.md`. Do
  not record task completion there.
- Put stable discoveries and product facts in the smallest owning factual doc.
- Keep commands and evidence rules in `TESTING.md`; put exact results in
  contracts or evidence artifacts and only current failures in `STATUS.md`.
- Keep stable goals and phase definitions in `PLAN.md`; do not use it as a task diary.
- Preserve user-added sections. If a standard file becomes hard to scan, shorten repeated prose before splitting it.

## Completion

Inception is complete when the user has agreed to consequential boundaries and
delivery policy, the chosen records have current content, each initial task has
an owner and runnable next action, and the evidence standard defines what
closes the first milestone. Do not create task files when project status
already tracks the work adequately.
