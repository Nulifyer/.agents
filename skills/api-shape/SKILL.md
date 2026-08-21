---
name: api-shape
description: Use when mapping declared OpenAPI, JSON Schema, GraphQL SDL, or Protobuf contracts without calling live operations. Use data-shape for observed payload files and code-shape for implementation ownership.
---

# API shape

Map API contracts without calling business operations or fetching payloads.

```bash
bun <skill-directory>/scripts/api-shape.ts <contract-file> [--access declared] [--names show|hash|omit] [--source show|hash|omit] [-o <chars>] [-j]
```

Results report `access=declared`. Descriptions, examples, defaults, enum literals, and server credentials are excluded. OpenAPI output includes endpoints, operations, parameters, request bodies, responses, and component schemas. GraphQL and Protocol Buffer output includes type and operation declarations.

Prefer a declared contract over calling a live operation when payload values are protected. Use the contract with project code to prepare clients, validators, fixtures, or transformations without fetching business data.

When privacy depends on declared-only access, pass `--access declared`. Protect contract identifiers or its path with `--names hash|omit` and `--source hash|omit`.

Use `data-shape` for response payload files and `code-shape` for client or server implementation ownership.
