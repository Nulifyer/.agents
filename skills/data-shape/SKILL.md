---
name: data-shape
description: Use when mapping fields, columns, nested types, arrays, sheets, and tables in structured data files without returning record or cell values. Do not use for API contracts or source configuration ownership.
---

# Data shape

Map JSON, JSONL, CSV, TSV, and XLSX structure.

```bash
bun <skill-directory>/scripts/data-shape.ts <file> [--no-header] [--names show|hash|omit] [-o <chars>] [-j]
```

Raw JSON and delimited files report `access=observed` because their structure requires reading content. XLSX reports `access=metadata` and reads workbook and table-definition parts without opening worksheets or reading cell values. Sampling affects inference only; values never appear in output.

Use `api-shape` for JSON Schema or OpenAPI. Use `code-shape` when JSON or YAML is source configuration and the goal is implementation discovery.
