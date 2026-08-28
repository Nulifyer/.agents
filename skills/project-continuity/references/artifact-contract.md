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
| `.agents/STATUS.md` | Current project state, current batch, work in flight, one next action, blockers | Milestone diary or run catalog |
| `.agents/TESTING.md` | Repeatable commands, environments, evidence meaning, coverage gaps | Individual results or latest test log |

## Information lifecycle

At a verified batch boundary:

1. Remove completed task detail from `STATUS.md`.
2. Put a choice in `DECISIONS.md` only when future work must preserve it.
3. Put established behavior, architecture, discoveries, and compatibility limits
   in the smallest owning factual document.
4. Put exact assertions and run results in contracts or evidence artifacts.
5. Let the commit preserve what changed and when.

Temporary tactics stay in `STATUS.md` only while active. Promote them to a
decision or factual document after evidence makes them durable.

## Required sections

`PLAN.md`: Goal, Success conditions, Scope, Product boundaries, Architecture
boundaries, Phases, Open planning questions.

`DECISIONS.md`: Binding decisions, Open decisions, Superseded decisions.

`STATUS.md`: Project state, Current batch, In progress, Next action, Blockers,
Verification.

`TESTING.md`: Evidence standard, Fast checks, Full checks, Environment, Known
gaps.

Custom sections are allowed. Preserve user notes unless they are explicitly
removed or superseded.

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
