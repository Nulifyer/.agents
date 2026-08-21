---
name: shape
description: Use only when explicitly invoked to route mixed or ambiguous targets among focused shape domains. Do not use when one focused shape skill clearly applies.
compatibility: Requires Bun and the complete shape skill family installed as sibling skill directories. Each focused skill may declare additional format-specific requirements.
---

# Shape director

Choose the focused shape from the user's goal, not only the extension. Read [routing.md](references/routing.md) when the target could have several meanings. Read [shape-contract.md](references/shape-contract.md) whenever privacy, redaction, or access guarantees matter. Read [protected-data.md](references/protected-data.md) when using shape to prepare code, scripts, or queries without exposing protected values. Read [coverage.md](references/coverage.md) before promising support for an uncommon format.

The shape family is one distribution bundle: `shape`, `code-shape`, `api-shape`, `data-shape`, `db-shape`, `doc-shape`, and `web-shape`. Keep these sibling directories together; the director and focused adapters rely on the family layout.

Resolve local input paths from the caller's working directory, then run from this skill's directory:

```bash
bun scripts/shape.ts <target> --as <api|code|data|db|doc|web> [options]
bun scripts/shape.ts <target> --question '<goal>' [options]
```

Use the focused command directly once selected. Same-file composition is valid, such as document shape for notebook narrative followed by code shape for an extracted cell.

Never claim metadata-only access when a focused result reports `access=observed` or `access=rendered`. Use returned locators for the next targeted read.

When privacy depends on the boundary, assert it with `--access`, protect identifier-bearing locators with `--names hash|omit`, and protect the input path with `--source hash|omit`.
