---
name: repo-map
description: Use when entering an unfamiliar repository or package and needing its boundaries, instructions, stack, entrypoints, execution flow, test commands, generated areas, or likely files for a task. Do not use when the responsible file or symbol is already known.
---

# Repository map

Build the smallest evidence-backed map needed for the task. Stop when you can name the governing instructions, package boundary, execution path, likely owners, nearby tests, and verification commands.

## Establish the boundary

1. Resolve the working directory and repository root. Check for nested repositories, submodules, and workspace manifests before assuming one root equals one package.
2. Find `AGENTS.md` and other agent instructions by filename. Read the root instructions, then any closer file whose directory contains the target. The closest scoped instruction wins when rules conflict.
3. If edits may follow, inspect `git status --short` before reading source so existing user changes are not mistaken for task work.

Use `rg --files` for the initial inventory. It respects common ignore rules and is cheaper than recursive directory dumps. Search filenames for root manifests, lockfiles, build files, CI workflows, source roots, tests, migrations, generators, and deployment files. Avoid reading vendored, generated, cache, dependency, and build-output trees unless the task points there.

## Map in layers

Read only the files that settle the next question.

1. Package and workspace manifests identify languages, package boundaries, scripts, and dependency direction.
2. Build and CI configuration confirms the commands the repository actually runs. Do not infer test or lint commands from ecosystem defaults.
3. Entrypoint declarations, routers, registries, dependency wiring, and startup code establish runtime flow. Directory names alone are weak evidence.
4. Target terms lead to implementation owners and their tests. Search behavior text, config keys, routes, event names, and symbols together when the owner is unknown.
5. Generated output should lead back to its schema, template, generator, or source file. Work on the owner unless the repository explicitly commits manual changes to generated files.

For a monorepo, map the target package and only the neighboring packages it imports or exposes contracts to. Do not inventory every workspace.

## Pick the cheapest search tool

| Question | Tool |
|---|---|
| Which files or manifests exist? | `rg --files` with filename globs |
| Where does an exact string, key, route, or symbol appear? | one `rg -n` search, combining related terms with regex alternatives |
| Which declaration owns an unfamiliar behavior? | Use the `code-shape` skill with `-m '<term1|term2>'` |
| Where is a known declaration? | Use the `code-shape` skill with `-s <name>` |
| What declaration contains a known line? | Use the `code-shape` skill with `-l <line>` |
| How is a long Markdown, DOCX, or PDF organized? | `doc-shape`, then targeted reads |
| What is the structure of an API, database, or data file? | the matching `api-shape`, `db-shape`, or `data-shape` skill |
| Why did code change? | `git log -- <path>` or targeted `git blame`; use history only when the task asks why |

Invoke `code-shape` through its own skill so its script path is portable across installations. With an unknown owner, send one match expression with alternatives. Its ranking is more useful than separate searches. Treat shapes as navigation metadata, then read the returned source range before editing or making behavioral claims.

Prefer exact ranges over whole files. If a README or design document is long, map its headings first. Follow references only when they affect the target path.

## Record evidence and unknowns

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
