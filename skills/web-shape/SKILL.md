---
name: web-shape
description: Use when mapping semantic landmarks and controls in static HTML or a fetched page. Do not use for implementation ownership, rendered application state, or page prose.
compatibility: Requires Bun and the complete shape skill family installed as sibling skill directories. URL input also requires network access.
---

# Web shape

Map page semantics without returning body prose or input values.

Resolve local input paths from the caller's working directory, then run from this skill's directory:

```bash
bun scripts/web-shape.ts <html-file|url> [--labels] [--access observed] [--names show|hash|omit] [--source show|hash|omit] [-o <chars>] [-j]
```

Static HTML reports `access=observed`. `--labels` adds accessible labels and short control text. Link destinations omit queries and fragments. `[incomplete]` on scripted HTML means the static structure may differ from the rendered page.

Use `code-shape` instead when the goal is to find the template, handler, selector, or implementation owner. Read returned DOM or source locators before drawing content conclusions.
