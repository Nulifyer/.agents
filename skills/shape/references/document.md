# Document adapter

```bash
bun scripts/shape.ts <file> --as document [--labels] [--access metadata|observed] [--names show|hash|omit] [--source show|hash|omit] [-o <chars>] [-j]
```

Supports Markdown, MDX, DOCX, and PDF. Markdown and DOCX structure reports `access=observed`. PDF without `--labels` is metadata-only; PDF labels require text extraction and produce an inferred, incomplete outline.

Use returned line, package, or page locators for targeted reading. Use a document-reading tool when prose or media must be extracted, and `data` for spreadsheet tables.
