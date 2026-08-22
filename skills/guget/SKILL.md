---
name: guget
description: Use when inspecting or changing NuGet PackageReference state in a local .NET workspace with guget, including listing packages, searching sources, adding, updating, removing, or restoring. Do not use for publishing packages or editing packages.config.
---

# guget

Use guget's headless verbs for agent work. A bare `guget` starts the interactive TUI.

This skill requires the guget CLI and .NET SDK. Package search and restore may also require network access, feed credentials, or interactive authentication.

Check the installed command and the relevant verb before relying on remembered flags:

```bash
command -v guget
guget version
guget help <verb>
```

If guget is missing, report that. Install or replace it only when the user asks.

## Inspect a workspace

Start with structured output and an explicit workspace root:

```bash
guget list --project <workspace> --format json
guget sources --project <workspace> --format json
guget show <package> --project <workspace> --format json
guget search <query> --project <workspace> --format json --timeout 30s
```

Use `--source <name>` to restrict a search to a configured metadata source. Local and UNC sources are restore-only and cannot supply search metadata. Use `--framework <tfm>` or `--direct` when the user asks for that narrower view. Use `--include-transitive` only when resolved transitive packages matter.

Prefer `json` when warnings and workspace metadata matter. `jsonl` emits rows without the surrounding document. Terminal output defaults to a table, while redirected output defaults to TSV. `--output <file>` replaces the destination atomically after a successful render.

## Change package references

Every mutation needs explicit scope. `--file` is repeatable and names discovered project files relative to `--project`. `--all` means every discovered project. `add` accepts only `--file`; `update` and `remove` accept either one or more `--file` values or `--all`.

Preview the exact change first:

```bash
guget add <package> --version <version> --project <workspace> --file <project> --dry-run --format json
guget update <package> --version <version> --project <workspace> --file <project> --dry-run --format json
guget remove <package> --project <workspace> --file <project> --dry-run --format json
```

Inspect every path and operation in the plan. If the user requested the mutation and the plan matches that request, run the same command without `--dry-run`. Do not apply a change when the request only asks for inspection or a plan.

Use an explicit version from the user or from an inspected search result. The current CLI refuses `--latest-compatible` and `--latest-stable`, so do not use them as shortcuts.

Add `--restore` to an apply command when the user wants restore run after a successful edit. `--interactive` is valid on a mutation only with `--restore`. A standalone restore also requires explicit scope:

```bash
guget restore --project <workspace> --file <project>
guget restore --project <workspace> --all
```

Interactive authentication can expose prompts and requires a terminal. Use it only when the user authorizes that flow.

## Respect ownership limits

Guget can inspect SDK-style C#, F#, and VB projects. It can edit literal project-owned references, `VersionOverride`, and supported Central Package Management owners. It may show but refuse to edit inherited properties, ambiguous or conditional ownership, transitive packages, lock files, and unsupported MSBuild shapes. Treat an edit refusal as a safety result, not a reason to bypass guget with an XML rewrite unless the user separately asks for that work.

`packages.config` is detected but unsupported. Guget does not edit it.

## Interpret results

Stdout contains the selected data format. Diagnostics and mutation status go to stderr. Preserve useful output when exit code 7 reports partial results, then surface its warnings.

| Code | Meaning |
|---|---|
| 0 | Success, including a no-op or empty search |
| 1 | Invalid command, flags, or target scope |
| 2 | Workspace discovery or MSBuild evaluation failed |
| 3 | NuGet source, authentication, or metadata failed |
| 4 | Edit refused because ownership is unsupported, ambiguous, locked, or stale |
| 5 | Write failed or rollback needs attention |
| 6 | Restore or post-edit validation failed |
| 7 | Useful but partial read result |
| 130 | Interrupted |

Report the workspace, package and version, selected project scope, planned or changed files, restore result, warnings, and any output artifact. Do not claim a package changed from a successful dry run alone.
