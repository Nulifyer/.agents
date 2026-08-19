---
name: code-shape
description: Map large or unfamiliar code and structured-data files with Tree-sitter before targeted reads. Use the native code_shape tool when available or the bundled CLI in other agent runners. Apply around 500 lines or longer, especially 2,000-line files. Skip small files and known short ranges.
---

# Code shape

Use this skill to decide what to read. The analyzer returns declarations, data keys, nesting, and one-based inclusive line ranges without putting the whole file into context.

Prefer a native `code_shape` tool when the current environment provides one. Otherwise run the bundled CLI from any working directory:

```bash
bun <skill-directory>/scripts/code-shape.ts <path> [--symbol <name> | --line <number>] [--depth <number>] [--max-items <number>]
```

Replace `<skill-directory>` with the directory containing this `SKILL.md`. Add `--json` when structured output is useful. If dependencies are missing after copying the skill to another machine, run `bun install --cwd <skill-directory>` before the first use.

## When it pays for itself

- Use it by default before reading an unfamiliar source file of roughly 500 lines or more.
- Strongly prefer it for files around 2,000 lines or larger.
- Use a shallow shape for several candidate files when names and text search do not reveal which file owns the behavior.
- Use it for a large JSON, TOML, or YAML file when its key hierarchy matters.
- Skip it for a small file, an already-known line range, generated or minified code, and ordinary configuration files around 20 lines.

## Navigation loop

1. Find candidate paths with repository search. Check line counts when file size is unclear.
2. Request the default shape for one likely large file. For several candidates, use `depth: 2` and a modest `maxItems` for each file.
3. Narrow with an exact `symbol` when the outline names it, or with `line` when search found a relevant occurrence. Do not pass both.
4. Read the returned ranges that can answer the question. Include nearby imports, types, or callers only when needed.
5. Base edits and conclusions on the source read, not on the outline alone.

Treat a failed CLI, recovered parse errors, and empty outlines as a reason to fall back to repository search and targeted reads. The analyzer reads saved files from disk, so an unsaved editor buffer is outside its view until an editor bridge supplies document symbols.

Use the environment's normal read permissions for `code_shape`. This skill does not widen access.
