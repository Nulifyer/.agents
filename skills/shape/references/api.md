# API adapter

```bash
bun scripts/shape.ts <contract-file> --as api [--access declared] [--names show|hash|omit] [--source show|hash|omit] [-o <chars>] [-j]
```

Supports OpenAPI JSON or YAML, JSON Schema, GraphQL SDL, and Protocol Buffers. Results report `access=declared`; descriptions, comments, examples, defaults, enum literals, and server credentials are excluded. OpenAPI locators are RFC 6901 JSON Pointers, including escaped path and media-type segments. The adapter never calls business operations or fetches example payloads.

Use `data` for observed request or response files and `code` for client or server ownership.
