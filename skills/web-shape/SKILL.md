---
name: web-shape
description: Use when mapping the user-facing semantic structure of an HTML file or page, including landmarks, headings, forms, controls, and links. Do not use for source implementation ownership.
---

# Web shape

Map page semantics without returning body prose or input values.

```bash
bun <skill-directory>/scripts/web-shape.ts <html-file|url> [--labels] [--names show|hash|omit] [-o <chars>] [-j]
```

Static HTML reports `access=observed`. `--labels` adds accessible labels and short control text. Link destinations omit queries and fragments. `[incomplete]` on scripted HTML means the static structure may differ from the rendered page.

Use `code-shape` instead when the goal is to find the template, handler, selector, or implementation owner. Read returned DOM or source locators before drawing content conclusions.
