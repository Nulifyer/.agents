# Project and task continuity validation

Validated on 2026-10-31. Project records can coordinate optional task ledgers.
The coupled update covers continuity, the task-ledger template, inception
instructions and bootstrap, delegation context, and structural validation.
Existing single-task project records remain supported. No task or worker ledger
is automatically created.

## Executed checks

`bun test tests/project-continuity/continuity.test.ts` passed six tests and 27
assertions. Two parallel-status cases failed against the previous validator
before implementation. The final suite covers:

- Existing single-task status and rejection of an empty next action.
- Parallel task links, missing local records, and exclusion of remote links and
  unlinked historical ledgers from filesystem validation.
- Titled and angle-delimited inline links, encoded spaces, and missing targets.
- Rejection of status without either supported work view or with an empty
  active-task section.
- A task-only directory remaining untouched when the project-suite validator
  reports its missing project records.
- Bootstrap and validation from clean copied scripts, rejection of unfilled
  scaffold content, and preservation of existing instructions and task status.

The repository command `bun run check` passed typecheck, lint, and all 115 tests
with 764 assertions. The full run includes existing unrelated skill tests; it
does not make their uncommitted changes part of this delivery.

## Package and review checks

The Agent Skills reference validator accepted the source and clean-copy packages
for frontend-design, skill-authoring, project-continuity, project-inception,
work-ledger, and subagent-handoff. Relative Markdown links and whitespace were
checked inside the package copies. The executable continuity tests also exercise
copied scripts without source-repository dependencies.

The Codex bundled quick validator accepted the three packages without
`compatibility`. It rejects that standard field in continuity, inception, and
handoff. The field already existed in those packages and is supported by the
[Agent Skills specification](https://agentskills.io/specification). It was
retained rather than removing required runtime information to satisfy a stale
validator.

Two read-only reviewers inspected the proposal and implementation. Their
findings led to a regression test and correction for Markdown link destinations,
and tighter wording so a prose edit does not automatically require clean-install
checks. No unresolved blocking findings were reported after those corrections.

## Evidence limits

The validator checks project-suite structure and the existence of declared
inline local task files. It does not validate reference-style Markdown links,
task ownership, requirements, acceptance evidence, integration, or truthful
completion. It neither fetches remote trackers nor crawls historical ledgers.
Standalone task records do not require the project suite.

Small-task exclusion, user steering, record ownership, and distinctions between
returned, verified, integrated, and accepted work were reviewed as instructions.
They were not measured in model-driven cross-host scenarios. The authoring
changes introduce no new host metadata or compatibility claim; the existing
host-check limitations remain unchanged.

Unrelated staged and working changes were preserved while the branch was
fast-forwarded to origin/main. Incoming README restructuring was reconciled with
the pre-existing staged research text and separate unstaged supervision text.
Those README edits remain outside these skill commits.
