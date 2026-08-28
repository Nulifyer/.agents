# Web adapter

```bash
bun scripts/shape.ts <html-file|url> --as web [--labels] [--access observed] [--names show|hash|omit] [--source show|hash|omit] [-o <chars>] [-j]
```

Maps static HTML landmarks, controls, forms, and links without body prose or input values. Labels add short accessible names. Link destinations omit queries and fragments. Scripted HTML is marked incomplete because static structure may differ from rendered state.

Use `code` to locate a template, handler, selector, or implementation owner.
