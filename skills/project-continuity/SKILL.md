---
name: project-continuity
description: Use when substantial repository work needs durable intent, progress, or coordination across sessions, tasks, or agents, or when resuming existing work records. Skip routine one-off work.
compatibility: Requires Bun for the standard-layout validator.
---

# Project continuity

Preserve the user's intended outcome and enough verified state to continue work without reconstructing the conversation. The host owns goal APIs, agent sessions, scheduling, and permissions.

## Choose proportionate records

Reuse existing project conventions and trackers. Do not create records merely because tools or several agents are involved. Reading a CSV, answering a bounded question, or making a small self-contained edit normally needs no new ledger.

Use project records for durable goals, boundaries, decisions, and overall progress. Add a task ledger when an independently resumable outcome needs its own scope, acceptance evidence, ownership, dependencies, or handoff state. A long-running standalone task may need one ledger without a full project bootstrap. A simple ongoing project may keep its only task in project status.

Create or update records only within existing write authority. For read-only work, return a proposed checkpoint instead of creating files.

## Establish and recover intent

Read governing instructions and the relevant project and task records. Compare them with the current user request and later steering. Check the relevant worktree, artifacts, and evidence before trusting recorded progress.

Retain the requested outcome, its source, scope, constraints, and observable acceptance checks. Separate confirmed requirements from assumptions. Do not substitute an agent's current tactic or the next failing check for the user's goal.

Apply clear user changes to affected work and record their source. Preserve compatible work. Resolve consequential ambiguity before dependent implementation while continuing independent authorized work. Use project-inception when project-level goals or boundaries need substantial definition, not for routine implementation choices.

## Keep one owner per fact

In the standard layout, project files live under `.agents/`:

- `PLAN.md` owns the agreed project outcome, scope, boundaries, phases, and success conditions.
- `DECISIONS.md` owns durable project choices and their reasons.
- `STATUS.md` owns verified overall capability, active-task links, integration blockers, and the coordinator's next action. Keep a single current batch here when there is only one task.
- `TESTING.md` owns repeatable checks and evidence standards. Exact results live in evidence artifacts.
- `.agents/work/<task-slug>.md`, when needed, owns that task's request, acceptance checks, scope, owner, dependencies, current state, evidence links, and next action. Reference project constraints instead of copying them. Use work-ledger for its Markdown template when available.

Keep established behavior and architecture in their owning factual documentation. Promote a task decision that becomes project-wide to its project owner and leave a link. Do not mirror task detail in project status or load unrelated ledgers during resume.

Read [the artifact contract](references/artifact-contract.md) when adopting, changing, or validating the standard layout. Preserve existing records rather than creating a parallel system.

## Coordinate ownership

Assign one writer per shared record, not one writer for all work. Independent task leads may maintain separate ledgers. The project coordinator maintains shared project status and integration priorities. For solo or standalone work, the responsible agent fills these roles. Record ownership transfers at handoff or authorized resume; an old timestamp does not establish abandonment.

Give workers the relevant goal, task, owned scope, dependencies, deliverable, acceptance evidence, and stopping condition. Workers return evidence to their task owner unless explicitly assigned a separate record. Do not require a ledger per agent, batch, or commit.

Keep a runnable next action for each independent task and name its prerequisites. Project-level prioritization must not serialize independent work. Recheck shared files before writing and route conflicting ownership through the coordinator.

## Deliver verified batches

Choose a coherent result that advances task acceptance. Group coupled behavior under its existing owner; split work when ownership, lifetime, risk, or proof differs. Implement and run focused checks, then applicable integration or project gates. Reuse evidence only while its identities and assumptions remain valid.

Distinguish a worker's returned result, verified task output, integration, and accepted project behavior. A worker report or passing compilation does not establish integration or project completion. A blocked task does not block unrelated tasks.

Keep this loop independent of commit permission. When commits are authorized, use git-delivery if available, stage only inspected batch changes, and preserve concurrent work. Otherwise record the verified uncommitted result and continue within existing authority.

When progress stalls, retain the failing boundary and choose the cheapest new observation that can resolve it. Use reverse-engineering or oracle-lab for their specialized methods when relevant. Do not repeat broad collection without a new question.

## Close and resume safely

After a meaningful result or scope change, and before handoff or compaction, refresh the affected task's state, evidence, blockers, ownership, and next action. Update project status when overall capability, coordination, or integration changes. Replace stale snapshots rather than appending a diary.

Complete a task only when its acceptance checks and required integration are satisfied. Record accepted exceptions and their authority. Complete the project only against project success conditions. Retain completed ledgers when useful without keeping their detail in the normal resume path.

When using the standard project records, resolve `scripts/continuity.ts` from this skill and run `validate --project-root <absolute-root>` with Bun. Fix structural errors in records required for the current work. For a standalone task or another convention, use its checks without bootstrapping unrelated project files. Structural validation does not prove truthful progress or accepted behavior. Compactness warnings prompt review, never deletion of necessary intent or evidence.
