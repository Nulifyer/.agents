# Code shape

Human-facing documentation. Agent Skills loaders discover and load `SKILL.md`; this README is not part of the injected skill instructions.

Code Shape answers two questions with little output: what is in this file, and where is it? It returns declaration or data-key names, nesting, and locations. It does not return source, signatures, modifiers, or values. Documentation summaries and normalized parameter names are opt-in with `--docs` and `--params`.

Regex discovery maps case-insensitive source matches to their deepest enclosing symbols. One expression can cover several spellings with `|`. Longer matches rank first, then ownership and repeated matches break ties. Best descendant rank propagates through symbol branches and files, so output keeps its shape while putting likely targets first. Results contain match locations and owner ranges, never matched source. Discovery returns at most 12 owners and requires `rg`.

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

`shape cache.js --docs --params`:

```text
cache.js javascript 4L
type Cache [1-4]
  fn get(key) [3] | Read cached value.
```

## Supported languages

TypeScript, TSX, JavaScript, JSX, Python, Rust, Go, Kotlin, Bash, C, C++, C#, CSS, Dart, Emacs Lisp, ERB and EJS templates, HTML, Haskell, Java, JSON, Julia, Lua, Objective-C, OCaml, PHP, ReScript, Ruby, Scala, Solidity, Swift, SystemRDL, SystemVerilog, Razor and CSHTML, TLA+, TOML, Tree-sitter queries, regular expressions, Vue, YAML, and Zig.

Tree-sitter recovers partial shapes from many syntax errors. Long one-line files use byte locations. Binary and compressed inputs are rejected without decoding.

```bash
shape <file>
shape <folder> '**/*.js' --match 'add\s+to\s+deck|add.*deck|deck.*add'
shape <file> --docs
shape <file> --params
shape <folder> '**/*.{cs,cshtml}'
curl -Ls <raw-url> | shape - source.ts
```

For folder details, add an exact symbol to keep output bounded:

```bash
shape src '**/*.ts' --symbol Worker --docs --params
```
