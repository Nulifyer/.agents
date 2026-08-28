# Shape coverage

## Implemented

- `code`: Tree-sitter source and configuration languages documented in [code.md](code.md).
- `web`: static local or fetched HTML. Scripted pages are marked incomplete.
- `document`: Markdown, MDX, DOCX, and PDF metadata or inferred labels.
- `data`: JSON, JSONL, NDJSON, XML instance payloads, dotenv, CSV, TSV, and XLSX metadata.
- `database`: SQLite catalogs and PostgreSQL `information_schema` when `psql` is installed.
- `api`: OpenAPI JSON or YAML, JSON Schema, GraphQL SDL, and Protocol Buffers.
- `binary`: PE, COFF, ELF, Unix/Windows archives, and WebAssembly. See [binary.md](binary.md).

## Next adapters

Prioritize by real requests and fixture availability.

- Code and configuration: SQL, HCL and Terraform, XML source and configuration semantics beyond instance-data trees, Dockerfile, Makefile, CMake, Nix, PowerShell, R, `.http`, `.rest`, INI, properties, and Helm templates.
- Documents: reStructuredText, AsciiDoc, Org, ODT, RTF, EPUB, PPTX, ODP, and tagged-PDF logical structure.
- Data: Parquet, Arrow IPC, Feather, Avro, ORC, ODS, HDF5, netCDF, Zarr, NPY, NPZ, GeoParquet, Shapefile, and GeoPackage.
- Databases: MySQL and MariaDB, SQL Server, DuckDB, BigQuery, Snowflake, and database-specific PostgreSQL catalog details.
- APIs: live GraphQL introspection, gRPC reflection, AsyncAPI, WSDL, HAR, and Postman collections.
- Web: rendered Chromium accessibility trees.
- Binary and artifacts: .NET declarations, PE and ELF symbol detail, PDB, DWARF, dumps, packages, and containers. See [binary-artifacts.md](binary-artifacts.md).

Do not silently fall back to raw broad reads for an unsupported format. Report the missing adapter and use an available declared schema, metadata export, or narrowly scoped reader when possible.

## Real-file verification

The repository-level `tests/shape-real` corpus runs the public router against pinned OpenAPI, DOCX, and XLSX samples plus SQLite and compiler-produced artifacts. Upstream sources, revisions, licenses, and checksums are recorded in its fixture manifest. GCC/ar and Zig cases skip explicitly when those producers are unavailable; the pinned and SQLite cases remain required and offline.

## Compatibility window

The package temporarily exposes `code-shape`, `api-shape`, `data-shape`, `db-shape`, `doc-shape`, and `web-shape` command aliases. They enter this same router with a fixed adapter; they are not separate skills or packages. Remove the aliases after one migration release once callers use `shape --as` or `shape --adapter`.
