---
name: skill-authoring
description: Use when creating, revising, reviewing, porting, organizing, or validating an Agent Skill or SKILL.md after the need is known. Do not mine work history; use workflow-miner.
---

# Skill authoring

A skill is a reusable instruction package loaded when its description matches the task.

This skill starts from a direct user request, a clearly named recurring failure, or a candidate brief produced by `workflow-miner`. It decides how to represent the behavior and owns all resulting skill files. It does not search raw work history to discover improvement opportunities. A candidate brief supports a recommendation but does not authorize file changes; create or update files only when the user's request includes that work.

If the harness provides skill-authoring guidance, use it for discovery paths, metadata, invocation controls, and validation. For a skill intended to work in more than one harness, read [cross-harness.md](references/cross-harness.md) before choosing metadata, paths, dependencies, or invocation behavior. Keep the structure and writing style below.

## Fit

Create or retain a skill when it addresses repeated work, an observed failure, or a decision the model cannot make reliably from ordinary context. Do not add a skill because a collection is popular or because its instructions sound useful in isolation.

Preserve a broad activation rule when the user explicitly designates a skill as a standing global preference. `unslop` is the current exception: it applies to user-facing communication and prose people will read. Do not narrow it back to explicit writing requests during routine cleanup.

Before creating a new skill, compare the candidate with nearby skills and global or project instructions. Prefer a focused revision when an existing owner already covers the behavior. Keep separate skills only when their activation conditions or operating contracts differ in practice.

When adapting another skill:

- Read the complete package, including scripts, references, dependencies, and invocation metadata.
- Preserve the useful decisions and invariants, not the source wording or prescribed workflow.
- Remove assumptions about tools, paths, products, and invocation syntax that the target environment does not support.
- Keep executable dependencies only when their benefit justifies their installation and trust cost.

## Decide whether prose is behavior

Classify the skill before rewriting it:

- **Operational skill:** teaches when or how to use a tool, command, process, schema, or decision procedure. Its wording only needs to preserve exact meaning. Once correctness and safety are settled, its instructions may be compressed with `caveman` in full mode to make the skill cheaper to load. Preserve negations, order, identifiers, prerequisites, evidence boundaries, and failure behavior. Do not compress code, commands, or text the skill is meant to emit for people.
- **Language or style skill:** changes voice, tone, rhythm, phrasing, formatting, or another part of language behavior. Its prose is both instruction and demonstration. Write and revise it with `unslop`, then keep the intended voice in the skill itself. Do not neutralize its language, reduce expressive examples to abstract rules, or move style-bearing passages out of `SKILL.md` merely to save tokens. `unslop` is the main example.
- **Mixed skill:** combines an operational workflow with a language contract. Compress only the operational parts. Keep style-bearing instructions and examples in the intended voice, and make the boundary between execution rules and expression rules obvious.

Examples carry unusual weight in a language or style skill. Preserve enough representative wording, rhythm, punctuation, register, and contrast examples to prime the intended behavior. Use `unslop` to remove accidental model habits, then write in the skill's target style. If that target intentionally conflicts with ordinary prose conventions, the target style wins.

## Context budget

- `name` and `description` may remain in context every turn. Treat `description` as a routing rule, not a summary or capability list. State when the skill should load and add a nearby exclusion when it prevents likely misrouting.
- `SKILL.md` loads after selection. Put what the skill changes about the agent's behavior here.
- References load on demand. Move branch-specific detail out of `SKILL.md` and link it with the exact condition for reading it.
- In a language or style skill, style-bearing prose and examples are not disposable exposition. Keep enough in `SKILL.md` to prime the target voice even when an operational skill would move the same amount to a reference.
- Every paragraph should tell the agent what to do, when to do it, or how to know it is done. Cut the rest.

## Build

1. Inspect actual requests, failures, the target harness, nearby skills, and existing files. Choose global, project, or cross-harness placement.
2. Classify the skill as operational, language or style, or mixed, then apply the matching authoring rules above.
3. Match the lowercase hyphenated folder name and frontmatter `name`. Start with the Agent Skills core fields. Add optional or host-specific metadata only when it carries information or enforces behavior the skill actually needs.
4. Write only instructions that change agent behavior: purpose, workflow, inputs, outputs, invariants, and checkable completion criteria. Prefer positive, concrete directions and established terms. Remove exposition, defaults, duplicate meanings, and facts cheap to inspect from files or `--help`.
5. Match prescription to risk. Describe outcomes and decision criteria for flexible work. Use fixed steps only when reordering or omission would cause a real failure.
6. Keep always-needed instructions in `SKILL.md`. Use `references/` for conditional knowledge, `scripts/` for repeated deterministic work, and `assets/` for output resources. Keep each fact in one place and avoid reference chains.
7. Reference bundled files relative to the skill root. Do not depend on a harness-specific skill-directory placeholder, invocation sigil, or tool name when plain instructions express the same operation.
8. Make an executable skill self-contained as distributed, or declare the bundle, runtime, system commands, network access, and sibling skills it requires. Do not assume a monorepo install when users can install one skill directory.
9. Decide whether the behavior is intended for automatic selection or explicit use. Follow the target harness policy and preserve existing invocation settings unless the user asks to change them.
10. Add human-facing README or setup docs only when requested or required for packaging. Link them from `SKILL.md` only when agents must read them.

## Validate

Test the completed skill with:

- A realistic request that should activate it.
- A nearby request that should not activate it.
- A realistic task that exercises its important decisions.
- Direct tests for scripts, dependencies, outputs, and failure behavior.
- A clean installation of the actual distribution unit when the skill contains scripts, external dependencies, sibling references, or host-specific metadata.
- For a language or style skill, several representative outputs whose voice, rhythm, register, and forbidden habits can be judged without requiring exact wording.

For cross-harness work, validate the standard package first, then test discovery and invocation in each claimed target harness. A field being ignored without error does not prove that it enforced the intended behavior.

Judge whether the skill changed the model's decisions and produced the intended observable result. For an operational skill, test decisions and actions. For a language or style skill, language is observable behavior: review several outputs for the intended voice while preserving their meaning. Do not require exact generated sentences, headings, or incidental wording unless the interface requires them. Prune instructions that testing does not justify.
