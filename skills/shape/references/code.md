# Code adapter

```bash
bun scripts/shape.ts <path> [glob] --as code [-m <regex> | -s <name> | -l <line>] [-o <chars>] [--docs] [-p] [-j]
bun scripts/shape.ts - <name.ext> --adapter code [-m <regex> | -s <name> | -l <line>]
```

A folder scans supported files recursively. A quoted folder-relative glob narrows it. When the owner is unknown, prefer one `-m` expression with alternatives. Results rank implementation owners and preserve file and symbol nesting. `-s` focuses an exact declaration; `-l` focuses its enclosing declaration. `--docs` adds normalized documentation summaries and `-p` adds parameter names without types or defaults.

Default output is 800 characters. `[more]` means lower-ranked complete branches did not fit; `[incomplete]` means a parse, time, or bounded-window limit may hide ownership. Line locators are one-based and byte locators are zero-based.

Tree-sitter parses original text and can recover partial outlines. Binary and compressed input is rejected by this adapter; let the router choose `binary` or select a binary adapter directly.

Supported language families include TypeScript/JavaScript, Python, Rust, Go, Kotlin, Bash, C/C++, C#, CSS, Dart, Lisp, HTML/templates, Haskell, Java, JSON, Julia, Lua, Objective-C, OCaml, PHP, Ruby, Scala, Solidity, Swift, SystemVerilog, TOML, Vue, YAML, Zig, and the additional grammars exercised by the adapter tests.
