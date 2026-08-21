---
name: data-shape
description: Use when mapping value-free structure from JSON, JSONL, XML payloads, dotenv, CSV, TSV, or XLSX and local inspection is allowed. Do not use for API contracts, live databases, document outlines, or source ownership.
---

# Data shape

Map JSON, JSONL, XML instance payloads, dotenv files, CSV, TSV, and XLSX structure.

```bash
bun <skill-directory>/scripts/data-shape.ts <file> [--no-header] [--access observed|metadata] [--names show|hash|omit] [--source show|hash|omit] [-o <chars>] [-j]
```

Raw JSON, XML, dotenv, and delimited files report `access=observed` because their structure is stored in content. XML returns element and attribute names but not text or attribute values. Dotenv returns keys but not assignments or comments. XLSX reports `access=metadata` and reads workbook and table-definition parts without opening worksheets or reading cell values. Sampling affects inference only; values never appear in output.

Observed access means the local adapter reads protected values even though it withholds them from model output. Use it only when that process access is permitted. Pass `--access observed` or `--access metadata` when that boundary must be enforced. Use `--names hash|omit` when identifiers are protected and `--source hash|omit` when the path is protected.

Use `api-shape` for JSON Schema or OpenAPI. Use `code-shape` when JSON or YAML is source configuration and the goal is implementation discovery, or when finding where a dotenv key is consumed.
