# Project artifact contract

The repository root keeps `AGENTS.md` for harness discovery. `.agents` is a
compact project control record, not history. Git, factual docs, contracts, and
evidence artifacts retain completed detail.

| File | Owns | Must not become |
| --- | --- | --- |
| `AGENTS.md` | Stable rules, routing, and delivery policy | Progress or evidence history |
| `.agents/README.md` | Read order and maintenance policy | Duplicate plan |
| `.agents/PLAN.md` | Goal, success conditions, scope, boundaries, phases | Current task list |
| `.agents/DECISIONS.md` | Choices future work must preserve | Task completion or discussion transcript |
| `.agents/STATUS.md` | Verified project state, current batch or active-task links, integration blockers, coordinator's next action | Duplicate task ledgers, milestone diary, or run catalog |
| `.agents/TESTING.md` | Repeatable commands, environments, evidence meaning, coverage gaps | Individual results or latest test log |
| `.agents/work/<task-slug>.md`, when needed | One task's request, acceptance, scope, owner, dependencies, evidence, integration state, next action | Another project plan or a record per worker |

Reuse an existing tracker or record that already fills these roles. A standalone
task may use a ledger without the project suite. Small one-off work needs no new
records. Use work-ledger for its Markdown template when available.

## Project and task coordination

Keep the user ask and its source with the goal it defines. Separate confirmed
requirements from assumptions. Apply later user steering to affected acceptance
checks and preserve compatible work. Project-inception handles consequential
definition or redefinition of project boundaries.

Use `Current batch` and `In progress` for a simple project's task state. For
independent workstreams, replace those sections with `Active tasks`: link each
task record and name its owner, without copying its findings and next action.
Local links are relative to `STATUS.md`, for example `[API](work/api.md)`.
External tracker links are also allowed. When no tasks remain, say so explicitly.

Each independent task owns a runnable next action and any prerequisites. The
project's `Next action` is its coordination or integration priority. Give each
writable record one owner; independent task leads may update separate ledgers.
The responsible agent fills coordination roles in solo work. No separate
appointment or approval is needed beyond existing authority.

Distinguish returned work, verified task output, integration, and project
acceptance. Keep a verified task active while required integration is pending.
A blocked task does not block independent tasks. Retain completed records when
useful, without requiring every resumed task to read them.

## Information lifecycle

At a verified batch boundary:

1. Update the affected task record and replace completed detail in `STATUS.md`
   with the verified project result or a task link.
2. Put a choice in `DECISIONS.md` only when future work must preserve it.
3. Put established behavior, architecture, discoveries, and compatibility limits
   in the smallest owning factual document.
4. Put exact assertions and run results in contracts or evidence artifacts.
5. Let authorized commits and evidence artifacts preserve what changed and when.
   Without commit authority, record verified uncommitted work and continue
   within the existing task authority.

Temporary tactics stay in `STATUS.md` only while active. Promote them to a
decision or factual document after evidence makes them durable.

## Required sections

`PLAN.md`: Goal, Success conditions, Scope, Product boundaries, Architecture
boundaries, Phases, Open planning questions.

`DECISIONS.md`: Binding decisions, Open decisions, Superseded decisions.

`STATUS.md`: Project state, Next action, Blockers, Verification, and either
Current batch plus In progress, or Active tasks. Next action must be nonempty.
An Active tasks section must contain linked task records or an explicit current
statement such as "No active tasks." The validator checks linked local files
exist; it does not verify task ownership, acceptance evidence, or completion.

`TESTING.md`: Evidence standard, Fast checks, Full checks, Environment, Known
gaps.

Custom sections are allowed. Preserve user notes unless they are explicitly
removed or superseded.

The bundled validator checks only this standard project suite. Do not run it
to bootstrap a standalone task ledger or require an external tracker to adopt
these files. It does not crawl unlinked historical ledgers or fetch remote links.

## Compactness guidance

The validator warns when a file crosses these review thresholds:

- `README.md`: 80
- `PLAN.md`: 200
- `DECISIONS.md`: 200
- `STATUS.md`: 100
- `TESTING.md`: 140

These are prompts, not limits. The model and user decide whether the content is
still useful. Never delete necessary scope, decisions, current state, or test
policy just to satisfy a number.

When a file triggers review, remove stale and repeated prose first. Move stable
facts to the smallest owning factual document and exact evidence to contracts
or artifacts. Split factual docs by subject when needed. Keep only current or
open decisions in normal read order. Archive superseded detail only when it
still explains a current decision or risk. Name archives by subject under
`.agents/archive/`; never create one per session, agent, commit, or test run.
