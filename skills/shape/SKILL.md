---
name: shape
description: Use first when mapping value-free structure or implementation ownership from source trees, API contracts, payloads, databases, documents, web pages, or compiled binaries. Routes mixed and extensionless targets internally; use a direct adapter when the format is already known.
compatibility: Requires Bun. Source shaping also requires ripgrep and the package dependencies. Some document, database, and remote adapters require the optional commands listed in their references.
---

# Shape

Inspect structure before reading broad content. The command reports its access boundary and returns compact names, kinds, nesting, and locators without returning payload values or source bodies.

Resolve local targets from the caller's working directory, then run from this skill directory:

```bash
bun scripts/shape.ts <target> [--question '<goal>'] [--as <domain>] [options]
bun scripts/shape.ts <target> --adapter <id> [options]
bun scripts/shape.ts <target> --probe
bun scripts/shape.ts <target> --explain-route
bun scripts/shape.ts --list [domain]
bun scripts/shape.ts --help [domain|adapter]
```

Let the router inspect magic bytes, headers, names, and the question. Extensions are hints, not authority. Use `--as` to choose a domain while retaining format detection. Use `--adapter` to bypass routing, especially for extensionless or mislabeled input whose format is known.

| Goal | Domain |
|---|---|
| implementation owners, declarations, callbacks, config or SQL source | `code` |
| declared API operations and schemas | `api` |
| observed payload, record, XML, dotenv, or spreadsheet structure | `data` |
| SQLite or PostgreSQL catalog metadata | `database` |
| Markdown, DOCX, or PDF outline and containers | `document` |
| static page landmarks and controls | `web` |
| PE, COFF, ELF, archive, or WebAssembly metadata | `binary` |

Read [routing.md](references/routing.md) for ambiguous targets. After choosing a domain, read only its matching reference: [code](references/code.md), [api](references/api.md), [data](references/data.md), [database](references/database.md), [document](references/document.md), [web](references/web.md), or [binary](references/binary.md). Read [shape-contract.md](references/shape-contract.md) whenever privacy or access guarantees matter, and [coverage.md](references/coverage.md) before promising an uncommon format.

Never claim metadata-only access when output reports `access=observed` or `access=rendered`. When the boundary matters, assert it with `--access`. Protect structural identifiers with `--names hash|omit` and the target label with `--source hash|omit`. Use returned locators for the next narrow read.
