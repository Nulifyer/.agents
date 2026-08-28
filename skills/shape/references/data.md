# Data adapter

```bash
bun scripts/shape.ts <file> --as data [--no-header] [--access observed|metadata] [--names show|hash|omit] [--source show|hash|omit] [-o <chars>] [-j]
```

Supports JSON, JSONL, NDJSON, XML instances, dotenv, CSV, TSV, and XLSX. Raw payload formats report `access=observed`: values are read locally for structural inference but never returned. XLSX reports `access=metadata` and reads workbook and table-definition parts without worksheets or cells.

Use `api` for declared JSON Schema or OpenAPI. Use `code` when JSON or YAML is configuration and the goal is ownership.
