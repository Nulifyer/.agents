---
name: api-shape
description: Use when mapping declared API structure from OpenAPI, JSON Schema, GraphQL SDL, or Protocol Buffers, including operations, parameters, messages, and request or response types.
---

# API shape

Map API contracts without calling business operations or fetching payloads.

```bash
bun <skill-directory>/scripts/api-shape.ts <contract-file> [--names show|hash|omit] [-o <chars>] [-j]
```

Results report `access=declared`. Descriptions, examples, defaults, enum literals, and server credentials are excluded. OpenAPI output includes endpoints, operations, parameters, request bodies, responses, and component schemas. GraphQL and Protocol Buffer output includes type and operation declarations.

Use `data-shape` for response payload files and `code-shape` for client or server implementation ownership.
