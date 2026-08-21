---
name: db-shape
description: Use when mapping PostgreSQL or SQLite catalog metadata without reading rows. Do not use for SQL source, row queries, exports, or data analysis.
compatibility: Requires Bun and the complete shape skill family installed as sibling skill directories. PostgreSQL inspection also requires the local psql command.
---

# Database shape

Inspect database catalogs without scanning table rows.

Resolve local input paths from the caller's working directory, then run from this skill's directory:

```bash
bun scripts/db-shape.ts <database.sqlite|postgres-uri> [--table <name>] [--access metadata] [--names show|hash|omit] [--source show|hash|omit] [-o <chars>] [-j]
```

Results report `access=metadata`. SQLite uses `sqlite_schema` and PRAGMAs. PostgreSQL uses `information_schema` through the local `psql` command when available. The command never returns defaults, check expressions, statistics, row counts, or data values.

Pass `--access metadata` when catalog-only access is a requirement. Use `--names hash|omit` for protected schema identifiers and `--source hash|omit` for protected paths or connection labels.

Use this schema with project code to author queries or scripts without selecting protected rows. If analysis results must stay out of model context, write them directly to a user-reviewed file and do not open that file.

Use `code-shape` for migrations, queries, CTEs, procedures, and SQL files.
