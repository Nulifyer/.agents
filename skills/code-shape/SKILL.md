---
name: code-shape
description: Locate declarations and data keys across large files or folders with a token-minimal Tree-sitter outline before targeted reads. Use the native shape tool when available or the bundled CLI in other agent runners. Apply around 500 lines or longer, especially 2,000-line files. Skip small files and known short ranges.
---

# Code shape

Use this skill to decide what to read. The analyzer returns symbol kinds, names, nesting, and locations. Normal locations are one-based inclusive lines. Long one-line input uses zero-based, end-exclusive byte ranges such as `[b120-245]`. Its output is a location index, not a source preview. It omits signatures, parameter and return types, modifiers, literal values, and other source text. Kinds use fixed shorthand: `fn`, `var`, `prop`, `type`, `impl`, `mod`, `sec`, `sel`, `elem`, and `key`.

Prefer a native `shape` tool when the current environment provides one. Otherwise run the bundled CLI from any working directory:

```bash
bun <skill-directory>/scripts/code-shape.ts <path> [glob] [--symbol <name> | --line <number>] [--depth <number>] [--max-items <number>]
```

Replace `<skill-directory>` with the directory containing this `SKILL.md`. Add `--json` when structured output is useful. If dependencies are missing after copying the skill to another machine, run `bun install --cwd <skill-directory>` before the first use.

For a folder, omit `glob` to scan supported files recursively. Add one quoted, folder-relative glob to narrow it:

```bash
bun <skill-directory>/scripts/code-shape.ts src '**/*.{cs,cshtml}'
bun <skill-directory>/scripts/code-shape.ts src '*.cs,*.cshtml'
```

`*.cs,*.cshtml` is accepted as a comma-list convenience. It scans only the folder root. Use `**/` for recursion. The folder scan ignores common dependency, build, VCS, and vendor directories; does not follow directory symlinks; sorts paths; and applies fixed file, item, and time budgets.

## When it pays for itself

- Use it by default before reading an unfamiliar source file of roughly 500 lines or more.
- Strongly prefer it for files around 2,000 lines or larger.
- Shape a candidate folder with an exact `symbol` when text search does not reveal which file owns the behavior.
- Use it for a large JSON, TOML, or YAML file when its key hierarchy matters.
- Skip it for a small file, an already-known line range, and ordinary configuration files around 20 lines.

## Navigation loop

1. Shape a likely large file, or a folder when ownership is unknown. A folder path alone scans supported files.
2. Add `glob` only when narrowing the folder materially reduces work.
3. Narrow with an exact `symbol` when the outline names it, or with `line` when search found a relevant occurrence. Do not pass both.
4. Read only the returned ranges that can answer the question. Include nearby imports, types, or callers only when needed.
5. Base edits and conclusions on the source read, not on the outline alone.

Tree-sitter parses original text and recovers partial outlines through many syntax errors. The analyzer never formats source first because that would change locations and formatters often reject broken syntax. It parses minified text directly and uses byte locations when line locations have little value. Compressed or binary input returns a compact type marker; decompress it to a separate file before shaping. Treat an empty or heavily recovered outline as a reason to fall back to repository search and targeted reads.

Harness adapters should return the same compact text as one model-visible content block. Keep structured details UI-only. Prefer a native adapter; use this CLI as the universal fallback. Add an MCP adapter only when multiple MCP-capable harnesses need native access. Skills provide discovery and instructions, not tool registration.

Use the environment's normal read permissions for `shape`. This skill does not widen access.
