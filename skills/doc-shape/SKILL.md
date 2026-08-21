---
name: doc-shape
description: Use when only a Markdown, DOCX, or PDF outline and container map is needed. Use document-read for prose or media extraction and data-shape for spreadsheets.
compatibility: Requires Bun and the complete shape skill family installed as sibling skill directories. DOCX requires unzip; PDF inspection requires pdfinfo and pdftotext.
---

# Document shape

Map document organization before targeted reading.

Resolve local input paths from the caller's working directory, then run from this skill's directory:

```bash
bun scripts/doc-shape.ts <file> [--labels] [--access metadata|observed] [--names show|hash|omit] [--source show|hash|omit] [-o <chars>] [-j]
```

Markdown and DOCX structure reports `access=observed`. PDF without `--labels` returns metadata only. PDF labels require text extraction and report an inferred, incomplete outline. Treat that outline as navigation help, not authoritative tagging.

Use returned line, package, or page locators for the next read. Use `document-read` when content must be extracted or converted. Use `data-shape` for spreadsheet tables.
