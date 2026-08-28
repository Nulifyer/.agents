# Database adapter

```bash
bun scripts/shape.ts <database.sqlite|postgres-uri> --as database [--table <name>] [--access metadata] [--names show|hash|omit] [--source show|hash|omit] [-o <chars>] [-j]
```

SQLite uses catalog tables and PRAGMAs. PostgreSQL uses `information_schema` through local `psql` when available. Results omit defaults, check expressions, statistics, row counts, and row values.

Use `code` for migrations, stored SQL source, query files, and CTE ownership.
