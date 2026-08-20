---
name: doc-shape
description: Use when mapping the outline and containers of Markdown, DOCX, or PDF documents, including headings, sections, tables, code blocks, and pages, without reading broad prose first.
---

# Document shape

Map document organization before targeted reading.

```bash
bun <skill-directory>/scripts/doc-shape.ts <file> [--labels] [--names show|hash|omit] [-o <chars>] [-j]
```

Markdown and DOCX structure reports `access=observed`. PDF without `--labels` returns metadata only. PDF labels require text extraction and report an inferred, incomplete outline. Treat that outline as navigation help, not authoritative tagging.

Use returned line, package, or page locators for the next read. Do not use this skill for spreadsheet tables; use `data-shape`.
