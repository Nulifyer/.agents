---
name: skill-authoring
description: Use when creating, revising, reviewing, porting, organizing, or validating an Agent Skill or SKILL.md after the need is known. Do not mine work history; use workflow-miner.
---

# Skill authoring

A skill is a reusable instruction package loaded when its description matches the task.

This skill starts from a direct user request, a clearly named recurring failure, or a candidate brief produced by `workflow-miner`. It decides how to represent the behavior and owns all resulting skill files. It does not search raw work history to discover improvement opportunities. A candidate brief supports a recommendation but does not authorize file changes; create or update files only when the user's request includes that work.

If the harness provides skill-authoring guidance, use it for discovery paths, metadata, invocation controls, and validation. Keep the structure and writing style below.

## Fit

Create or retain a skill when it addresses repeated work, an observed failure, or a decision the model cannot make reliably from ordinary context. Do not add a skill because a collection is popular or because its instructions sound useful in isolation.

Before creating a new skill, compare the candidate with nearby skills and global or project instructions. Prefer a focused revision when an existing owner already covers the behavior. Keep separate skills only when their activation conditions or operating contracts differ in practice.

When adapting another skill:

- Read the complete package, including scripts, references, dependencies, and invocation metadata.
- Preserve the useful decisions and invariants, not the source wording or prescribed workflow.
- Remove assumptions about tools, paths, products, and invocation syntax that the target environment does not support.
- Keep executable dependencies only when their benefit justifies their installation and trust cost.

## Context budget

- `name` and `description` may remain in context every turn. Treat `description` as a routing rule, not a summary or capability list. State when the skill should load and add a nearby exclusion when it prevents likely misrouting.
- `SKILL.md` loads after selection. Put what the skill changes about the agent's behavior here.
- References load on demand. Move branch-specific detail out of `SKILL.md` and link it with the exact condition for reading it.
- Every paragraph should tell the agent what to do, when to do it, or how to know it is done. Cut the rest.

## Build

1. Inspect actual requests, failures, the target harness, nearby skills, and existing files. Choose global, project, or cross-harness placement.
2. Match the lowercase hyphenated folder name and frontmatter `name`. Add only supported metadata the skill needs.
3. Write only instructions that change agent behavior: purpose, workflow, inputs, outputs, invariants, and checkable completion criteria. Prefer positive, concrete directions and established terms. Remove exposition, defaults, duplicate meanings, and facts cheap to inspect from files or `--help`.
4. Match prescription to risk. Describe outcomes and decision criteria for flexible work. Use fixed steps only when reordering or omission would cause a real failure.
5. Keep always-needed instructions in `SKILL.md`. Use `references/` for conditional knowledge, `scripts/` for repeated deterministic work, and `assets/` for output resources. Keep each fact in one place and avoid reference chains.
6. Decide whether the behavior is intended for automatic selection or explicit use. Follow the target harness policy and preserve existing invocation settings unless the user asks to change them.
7. Add human-facing README or setup docs only when requested or required for packaging. Link them from `SKILL.md` only when agents must read them.

## Validate

Test the completed skill with:

- A realistic request that should activate it.
- A nearby request that should not activate it.
- A realistic task that exercises its important decisions.
- Direct tests for scripts, dependencies, outputs, and failure behavior.

Judge whether the skill changed the model's decisions and produced the intended observable result. Do not test exact prose, headings, or other incidental wording. Prune instructions that testing does not justify.
