---
name: code-shape
description: Use first for repository source discovery when locating the implementation or owner of a symbol, UI control, behavior, callback, route, or config key. Do not use for page semantics, document outlines, datasets, live databases, or API contracts.
---

# Code shape

Maps declarations, nesting, data keys, and locations without returning source code.

```bash
bun <skill-directory>/scripts/code-shape.ts <path> [glob] [-m <regex> | -s <name> | -l <line>] [-o <chars>] [--docs] [-p] [-j]
curl -Ls <raw-url> | bun <skill-directory>/scripts/code-shape.ts - <name.ext> [-m <regex> | -s <name> | -l <line>] [-o <chars>] [--docs] [-p] [-j]
```

`<skill-directory>` is this skill's directory. A folder scans supported files recursively. A quoted folder-relative glob narrows it. `*.cs,*.cshtml` scans the folder root; use `**/` for recursion.

When the responsible symbol is unknown, use one `-m` expression with regex alternatives instead of repeated searches. Matching is case-insensitive. Folder matching streams every eligible file through one combined `rg` search, ranks matching files, then resolves matches to Tree-sitter owners. It favors implementation owners, owner-name matches, alternative coverage, and source paths over tests, mocks, generated files, and localization data. Ranking propagates through files and enclosing symbols while output keeps containment. Large files use byte windows around matches. Ripgrep regex syntax applies.

`-s` finds an exact declaration name. `-l` finds its enclosing declaration. Focus modes are mutually exclusive. `--docs` adds normalized documentation summaries. `-p` adds normalized function parameter names while omitting types and defaults. For stdin, `<name.ext>` selects the language.

`-j` emits the same compact shape as one JSON string for callers that require valid JSON. Prefer plain text for model context.

Default output budget is 800 characters; minimum is 120. Use `-o` only when the caller needs a different budget. Search and ranking do not use result-count caps. Increasing the budget retains every smaller-budget branch. `[more]` means complete lower-ranked shape branches did not fit the output budget. `[incomplete]` means a safety deadline, parse limit, or bounded large-file window may have hidden ownership.

Output is `kind name [start-end]`, with indentation for nesting. Match output starts with each ranked file and places its strongest symbol branch first. `@<line>` marks a match inside a wider owner range. Lines are one-based and inclusive. `[b<start>-<end>]` and `@b<offset>` are zero-based byte locations for minified or windowed input. Kinds: `fn`, `var`, `prop`, `type`, `impl`, `mod`, `sec`, `sel`, `elem`, `key`.

Tree-sitter parses original text and can recover partial outlines from syntax errors. Binary or compressed input is rejected. Use returned locations to choose source ranges, then read source before editing or concluding.
