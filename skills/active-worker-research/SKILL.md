---
name: active-worker-research
description: Use when asked to review an active development session or recent commit stream and proactively find missing technical knowledge, requirements, evidence, or design risks without taking over implementation. Do not use for ordinary code review, direct implementation, or general web research.
---

# Active worker research

Act as an advisory researcher beside an implementation worker. Keep the
worker's terminal goal and current batch connected while getting useful facts
in front of future work. Do not become a second implementation owner.

## Establish current truth

1. Identify the repository, worker or session, terminal goal, permissions, and
   requested output.
2. Read the repository instructions and canonical current-state record when
   present. Inspect the worktree and recent commits before trusting a transcript
   or prior summary.
3. When the host exposes the worker session, read only the recent turns needed
   to understand its current decision, evidence, retries, and next action. If
   session history is unavailable, use commits, worktree state, continuity
   records, and generated evidence, then state that visibility limit. Do not
   inspect unrelated private history.
4. Map the current batch to the terminal goal. Distinguish observed progress
   from import-count movement, compilation, or a status restatement.

## Find useful gaps

Look for gaps that could change the next few implementation batches:

- an undocumented external contract, data layout, call shape, state machine,
  lifetime, concurrency rule, or error path;
- an assumption supported only by one workload or one successful run;
- behavior already solved in an authoritative specification or mature source
  project;
- duplicated ownership, a growing entry file, a facade that forks state, or a
  host mechanism leaking into externally visible policy;
- missing oracle evidence, action boundaries, negative cases, cleanup proof,
  or repeated-run evidence;
- research or documentation that exists but the worker did not find.

Rank gaps by their chance of preventing rework or an incorrect callable claim.
Do not produce a broad subject survey merely because adjacent material exists.

## Research ahead of the worker

For each selected gap:

1. State the exact question and what evidence would settle it.
2. Prefer primary specifications, official documentation, matching symbols or
   source, and the project's pinned references. Use community material as a
   lead, not unmarked authority.
3. Compare the finding with the current implementation and contract. Separate
   observed facts from inference.
4. Return the smallest result the worker can act on: owner, interface, inputs,
   outputs, errors, lifetime, evidence pointer, and remaining unknowns.
5. Stop when the decision is supported. More links are not more certainty.

Use `reverse-engineering` for static artifact questions and `oracle-lab` when a
repeatable reference-system experiment is needed.

## Protect concurrent work

Remain read-only unless the user authorizes documentation or continuity
changes. In a shared worktree, do not edit files the worker is changing. If a
new document is authorized, put stable facts in the owning documentation area,
link it from the normal index, and keep current state out of research notes.

Do not stage or commit without separate authority. Before any authorized write,
recheck the worktree. If another session created overlapping changes, stop or
isolate the work instead of silently absorbing them.

## Report

Keep the result compact:

- what the worker is doing now and how it advances the terminal goal;
- the most important missing fact or design risk;
- the evidence found and what it does or does not establish;
- the recommended next action, or a clear statement that no intervention is
  needed.

Do not narrate every search. Do not tell the worker to change direction unless
the evidence shows the current direction conflicts with the stated goal or an
architectural decision.
