---
name: repo-map
description: Use when entering an unfamiliar repository or package and needing its boundaries, instructions, stack, entrypoints, execution flow, test commands, generated areas, or likely files for a task. Do not use when the responsible file or symbol is already known.
---

# Repository map

Build the smallest evidence-backed map needed for the task. The goal is not to understand the whole repository. Stop when you can name the governing instructions, relevant package boundary, execution path, likely owners, nearby tests, and verification commands.

## Start from the task

Extract the names, behaviors, routes, commands, errors, file types, and packages mentioned by the user. These are search leads, not confirmed owners. Let the task decide how far the map needs to extend.

If the responsible file, symbol, or package is already known, skip repository mapping and inspect that area directly.

## Review in this order

Read only enough at each stage to settle its question.

1. **Boundary and state.** Resolve the repository root and relevant package. Check for nested repositories, submodules, and workspaces before treating the root as one package. If edits may follow, inspect the working tree before reading source so existing user changes remain distinct.
2. **Instructions.** Find repository instruction files within the repository root. Read the root instructions, then each closer file that governs the target path. Apply the closest scoped rule when instructions conflict.
3. **Topology.** Use manifests, lockfiles, workspace configuration, and a bounded file inventory to identify the stack, package boundaries, source roots, tests, generated areas, and build system. Use README or design-document headings for stated intent, but confirm operational claims in configuration or code.
4. **Execution.** Start from declared entrypoints such as binaries, exports, startup files, routers, registries, handlers, or dependency wiring. Trace one concrete path toward the requested behavior. Do not read every layer or sibling implementation.
5. **Owner and tests.** Search task terms, user-visible text, config keys, routes, event names, and symbols together. Read the strongest implementation candidate, then its callers, dependencies, and nearby tests only as needed.
6. **Verification.** Derive build, lint, test, and generation commands from manifests and CI configuration. Do not substitute ecosystem defaults for commands the repository actually uses.

For a monorepo, map the target package and only the neighboring packages whose contracts cross the task path. Expand farther only when imports, configuration, or runtime wiring require it.

Generated output should lead back to its schema, template, generator, or source file. Treat the owner as the edit target unless repository instructions say generated files are maintained directly.

## Choose the cheapest useful tool

| Question | Tool |
|---|---|
| Repository state and root | `git status`, `git rev-parse` |
| Files, manifests, and candidate paths | `rg --files` with narrow globs; include hidden configuration roots when relevant |
| Exact text, keys, routes, or symbols | One `rg -n` search with related alternatives |
| Unknown source owner | `code-shape` match mode |
| Known declaration or containing line | `code-shape` symbol or line focus |
| Long Markdown or design document | `doc-shape`, then exact line ranges |
| API, database, or dataset structure | The matching shape skill |
| Reason for an existing design or change | Targeted `git log` or `git blame` after current code is understood |

Use shape output as navigation metadata, then read the returned source range before editing or making behavioral claims. Prefer exact ranges over whole files. Follow references only when they can change the target path or conclusion.

Batch independent read-only checks when the tool supports it. Keep each search bounded and widen it only when the current evidence leaves a specific question unanswered. Avoid recursive directory dumps, repeated one-term searches, and broad reads of vendored, dependency, cache, generated, or build-output trees.

## Keep evidence separate from inference

Keep observed facts separate from inferences. A script in `package.json`, a CI command, or an entrypoint declaration is evidence. A conventional folder name is a lead.

When the user asks for the map itself, return this compact form with clickable paths:

```text
Boundary: repository and relevant package/workspace
Stack: languages, frameworks, build and package tools
Execution: entrypoint -> relevant path -> owner
Tests: nearby tests and commands proven by config
Conventions: scoped instructions and local patterns
Likely files: task owners, tests, and generated sources
Unknowns: facts that still require running code or external access
```

If mapping is preparation for an implementation task, keep the map internal and proceed. Surface only findings that explain the change, risk, or verification choice.
