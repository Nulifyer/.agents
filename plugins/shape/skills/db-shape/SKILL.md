---
name: db-shape
description: Use when mapping a live database or SQLite file through catalog metadata, including schemas, tables, views, columns, keys, indexes, and relationships. Do not use for SQL source files.
---

# Database shape

Inspect database catalogs without scanning table rows.

```bash
bun <skill-directory>/scripts/db-shape.ts <database.sqlite|postgres-uri> [--table <name>] [--names show|hash|omit] [-o <chars>] [-j]
```

Results report `access=metadata`. SQLite uses `sqlite_schema` and PRAGMAs. PostgreSQL uses `information_schema` through the local `psql` command when available. The command never returns defaults, check expressions, statistics, row counts, or data values.

Use `code-shape` for migrations, queries, CTEs, procedures, and SQL files.
