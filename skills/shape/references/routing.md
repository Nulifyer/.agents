# Shape routing

Choose by question before extension.

| Goal | Domain |
|---|---|
| Find source ownership, declarations, callbacks, config keys, SQL statements, or raw HTTP definitions | `code` |
| Map visible or accessible landmarks, controls, forms, links, and headings | `web` |
| Map headings, sections, pages, tables, figures, and document containers | `document` |
| Map fields, columns, arrays, sheets, dimensions, XML elements and attributes, `.env` keys, and storage schemas | `data` |
| Map live schemas, tables, views, columns, keys, indexes, and relationships | `database` |
| Map endpoints, operations, messages, request and response schemas, or type systems | `api` |
| Map compiled image, library, section, import/export, runtime, or archive metadata | `binary` |

Ambiguous examples:

- HTML implementation questions use `code`; page interaction questions use `web`.
- JSON configuration uses `code`; records use `data`; OpenAPI and JSON Schema use `api`.
- `.env` key inventory uses `data`; finding where an environment key is read uses `code`.
- XML instance payloads use `data`; WSDL and other declared XML contracts require a supported API adapter.
- SQL files use `code`; live databases and SQLite files use `database`.
- Notebook narrative uses `document`; implementation inside a code cell uses `code` after extraction.
- A native DLL uses `binary`; source that produces or loads it uses `code`.

The router refuses content-ambiguous JSON, XML, YAML, and SQL unless the question or `--as` resolves the domain. A specific non-binary extension such as `.graphql` or `.proto` routes without reading a header, so `--access declared` remains enforceable. Binary and extensionless targets use bounded header evidence; magic bytes and conservative COFF-header checks outrank fallback source guesses. `--adapter` is an explicit override and should be used only when the caller knows the format.
