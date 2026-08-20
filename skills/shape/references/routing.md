# Shape routing

Choose by question before extension.

| Goal | Skill |
|---|---|
| Find source ownership, declarations, callbacks, config keys, SQL statements, or raw HTTP definitions | `code-shape` |
| Map visible or accessible landmarks, controls, forms, links, and headings | `web-shape` |
| Map headings, sections, pages, tables, figures, and document containers | `doc-shape` |
| Map fields, columns, arrays, sheets, dimensions, and storage schemas | `data-shape` |
| Map live schemas, tables, views, columns, keys, indexes, and relationships | `db-shape` |
| Map endpoints, operations, messages, request and response schemas, or type systems | `api-shape` |

Ambiguous examples:

- HTML implementation questions use `code-shape`; page interaction questions use `web-shape`.
- JSON configuration uses `code-shape`; records use `data-shape`; OpenAPI and JSON Schema use `api-shape`.
- SQL files use `code-shape`; live databases and SQLite files use `db-shape`.
- Notebook narrative uses `doc-shape`; implementation inside a code cell uses `code-shape` after extracting that cell.
