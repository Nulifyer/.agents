---
name: doc-shape
description: Use when only a Markdown, DOCX, or PDF outline and container map is needed. Use document-read for prose or media extraction and data-shape for spreadsheets.
---

# Document shape

Map document organization before targeted reading.

```bash
bun <skill-directory>/scripts/doc-shape.ts <file> [--labels] [--access metadata|observed] [--names show|hash|omit] [--source show|hash|omit] [-o <chars>] [-j]
```

Markdown and DOCX structure reports `access=observed`. PDF without `--labels` returns metadata only. PDF labels require text extraction and report an inferred, incomplete outline. Treat that outline as navigation help, not authoritative tagging.

Use returned line, package, or page locators for the next read. Use `document-read` when content must be extracted or converted. Use `data-shape` for spreadsheet tables.
