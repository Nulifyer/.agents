---
name: workflow-miner
description: Use only to mine completed work, session history, or repeated corrections for reusable improvements. Produces candidate briefs and does not run during task execution or create or edit skills.
---

# Workflow miner

Find repeated friction worth fixing. This skill owns discovery and recommendation. `skill-authoring` owns skill design, implementation, and validation after a candidate is accepted or the user has already requested its creation.

Do not inspect unrelated private history. Use only sessions, feedback, artifacts, or telemetry the user placed in scope. If the available history is too narrow to support a pattern, report that and identify what future evidence would settle it.

## Review real episodes

For each relevant episode, capture only:

- What the user was trying to accomplish.
- What the agent did, including searches, tools, handoffs, and retries.
- Where time, tokens, or attention were wasted.
- What the user corrected or repeated.
- What evidence shows the final approach worked or failed.

Look for repeated decisions the model handles poorly, recurring user corrections, duplicated context gathering, preventable retries, missing verification, and useful procedures that remain trapped in conversation history. One costly or high-risk failure can justify a candidate, but ordinary one-off preferences usually do not.

## Choose the right owner

Do not assume every improvement should become a skill. Classify each candidate as one of:

- Revise an existing skill when it already owns the activation condition and behavior.
- Create a skill when the behavior is reusable, conditional, and cannot be relied on from ordinary context.
- Add a global instruction when the rule should apply almost every turn and can stay short.
- Add project guidance when the behavior depends on one repository's conventions.
- Add or repair a script or tool when deterministic automation solves the failure better than instructions.
- Make no change when evidence is weak, the case is isolated, or existing behavior is adequate.

Compare names and descriptions of nearby skills before recommending a new one. Read full skill bodies only for plausible owners. Avoid candidates that differ only in wording while sharing the same trigger and workflow.

## Produce a candidate brief

Return one brief per worthwhile improvement:

```text
Observed pattern: episodes and user feedback that support the change
Cost or risk: wasted work, token use, quality loss, or failure mode
Desired behavior: the decision or action that should change
Recommended owner: existing skill, new skill, global instruction, project guidance, script, or none
Activation examples: realistic requests or situations that should trigger it
Non-activation examples: nearby situations that should not trigger it
Overlap: existing skills or instructions considered
Success signal: observable result that would show improvement
Unknowns: evidence still missing
```

Rank candidates by expected recurring benefit minus context, maintenance, and routing cost. Do not create files or draft a full `SKILL.md`. If the same request also asks for implementation, hand the accepted brief to `skill-authoring` and keep the two phases distinct.
