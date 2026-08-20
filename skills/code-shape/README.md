# Code shape

Human-facing documentation. Agent Skills loaders discover and load `SKILL.md`; this README is not part of the injected skill instructions.

Code Shape answers two questions with little output: what is in this file, and where is it? It returns declaration or data-key names, nesting, and locations. It does not return source, signatures, modifiers, or values. Documentation summaries and normalized parameter names are opt-in with `--docs` and `-p`.

Regex discovery maps case-insensitive source matches to their deepest enclosing symbols. Folder discovery streams every eligible path through one combined `rg` search, ranks matching files, then parses matching files until a safety deadline. Large files use bounded windows around top matches. Assigned callbacks use their variable or property name, including callbacks passed through wrappers such as `createMemo`. Other anonymous callbacks use their call target. One expression can cover several spellings with `|`.

Ranking favors implementation owners, owner-name matches, coverage of every top-level regex alternative, and source paths over tests, mocks, generated files, or localization data. Best descendant rank propagates through symbol branches and files, so output keeps containment while putting likely targets first. Results contain match locations and owner ranges, never matched source.

One output budget controls selection. Default is 800 characters; minimum is 120. `-o` changes it. Search and ranking have no result-count caps. Selection is monotonic: increasing the budget retains smaller-budget branches. `[more]` means lower-ranked complete branches did not fit. `[incomplete]` means a safety deadline, parser limit, or bounded window may have hidden ownership.

`-j` emits the compact shape as one JSON string. Plain text costs fewer tokens when a caller does not require JSON.

Documentation mode recognizes common JSDoc and Doxygen blocks, language line-doc conventions, Python and Emacs Lisp docstrings, and Julia leading docstrings. It returns only the first prose paragraph, capped at 200 characters. Tags such as `@param` are omitted.

Parameter mode writes names inside `fn name(...)`. It removes types, defaults, and attributes, normalizes rest parameters as `...name`, and caps each function at 12 names.

## Example

Input:

```js
class Cache {
  /** Read cached value. */
  get(key) { return this.values.get(key); }
}
```

`shape cache.js --docs -p`:

```text
cache.js javascript 4L
type Cache [1-4]
  fn get(key) [3] | Read cached value.
```

## Supported languages

TypeScript, TSX, JavaScript, JSX, Python, Rust, Go, Kotlin, Bash, C, C++, C#, CSS, Dart, Emacs Lisp, ERB and EJS templates, HTML, Haskell, Java, JSON, Julia, Lua, Objective-C, OCaml, PHP, ReScript, Ruby, Scala, Solidity, Swift, SystemRDL, SystemVerilog, Razor and CSHTML, TLA+, TOML, Tree-sitter queries, regular expressions, Vue, YAML, and Zig.

Tree-sitter recovers partial shapes from many syntax errors. Minified files and bounded large-file windows use byte locations. `[incomplete]` marks results whose bounded windows may omit wider ownership. Binary and compressed inputs are rejected without decoding.

```bash
shape <file>
shape <folder> '**/*.js' -m 'add\s+to\s+deck|add.*deck|deck.*add'
shape <file> --docs
shape <file> -p
shape <folder> '**/*.{cs,cshtml}'
curl -Ls <raw-url> | shape - source.ts -m 'submit|send'
```

Tighten output only when a caller has less context available:

```bash
shape src '**/*.ts' -m 'submit|send' -p -o 900
```
