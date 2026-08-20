---
name: code-shape
description: Use before broad reads or repeated searches when trying to identify a code symbol, or when a compact map of source structure and ownership would reduce code reading.
---

# Code shape

Maps declarations, nesting, data keys, and locations without returning source code.

```bash
bun <skill-directory>/scripts/code-shape.ts <path> [glob] [--match <regex> | --symbol <name> | --line <number>] [--docs] [--params] [--json]
curl -Ls <raw-url> | bun <skill-directory>/scripts/code-shape.ts - <name.ext> [--match <regex> | --symbol <name> | --line <number>] [--docs] [--params] [--json]
```

`<skill-directory>` is this skill's directory. A folder scans supported files recursively. A quoted folder-relative glob narrows it. `*.cs,*.cshtml` scans the folder root; use `**/` for recursion.

When the responsible symbol is unknown, use one `--match` expression with regex alternatives instead of repeated searches. Matching is case-insensitive. It scans source internally, deduplicates matches by their deepest enclosing symbol, and returns at most 12 owners without matched source. Ripgrep regex syntax applies.

`--symbol` finds an exact declaration name. `--line` finds its enclosing declaration. These three focus modes are mutually exclusive. `--docs` adds bounded, normalized documentation summaries. `--params` adds up to 12 normalized function parameter names while omitting types and defaults. Folder detail options require `--symbol` or `--match`. For stdin, `<name.ext>` selects the language.

Output is `kind name [start-end]`, with indentation for nesting. Lines are one-based and inclusive. `[b<start>-<end>]` means zero-based, end-exclusive byte locations for long one-line input. Kinds: `fn`, `var`, `prop`, `type`, `impl`, `mod`, `sec`, `sel`, `elem`, `key`.

Tree-sitter parses original text and can recover partial outlines from syntax errors. Binary or compressed input is rejected. Use returned locations to choose source ranges, then read source before editing or concluding.
