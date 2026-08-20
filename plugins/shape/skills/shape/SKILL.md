---
name: shape
description: Use when the user explicitly asks for shape inspection across mixed targets, or the target is ambiguous between code, web, document, data, database, and API structure.
---

# Shape director

Choose the focused shape from the user's goal, not only the extension. Read [routing.md](references/routing.md) when the target could have several meanings. Read [shape-contract.md](references/shape-contract.md) when privacy, redaction, or access guarantees matter. Read [coverage.md](references/coverage.md) before promising support for an uncommon format.

```bash
bun <skill-directory>/scripts/shape.ts <target> --as <api|code|data|db|doc|web> [options]
bun <skill-directory>/scripts/shape.ts <target> --question '<goal>' [options]
```

Use the focused command directly once selected. Same-file composition is valid, such as document shape for notebook narrative followed by code shape for an extracted cell.

Never claim metadata-only access when a focused result reports `access=observed` or `access=rendered`. Use returned locators for the next targeted read.
