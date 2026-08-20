# Shape coverage

## Implemented

- `code-shape`: the languages and configuration formats listed in its `SKILL.md`.
- `web-shape`: static local or fetched HTML. Scripted pages are marked incomplete.
- `doc-shape`: Markdown, MDX, DOCX, and PDF metadata or inferred labels.
- `data-shape`: JSON, JSONL, NDJSON, CSV, TSV, and XLSX metadata.
- `db-shape`: SQLite catalogs and PostgreSQL `information_schema` when `psql` is installed.
- `api-shape`: OpenAPI JSON or YAML, JSON Schema, GraphQL SDL, and Protocol Buffers.

## Next adapters

Prioritize by real requests and fixture availability.

- Code and configuration: SQL, HCL and Terraform, XML, Dockerfile, Makefile, CMake, Nix, PowerShell, R, `.http`, `.rest`, INI, properties, and Helm templates.
- Documents: reStructuredText, AsciiDoc, Org, ODT, RTF, EPUB, PPTX, ODP, and tagged-PDF logical structure.
- Data: Parquet, Arrow IPC, Feather, Avro, ORC, ODS, HDF5, netCDF, Zarr, NPY, NPZ, GeoParquet, Shapefile, and GeoPackage.
- Databases: MySQL and MariaDB, SQL Server, DuckDB, BigQuery, Snowflake, and database-specific PostgreSQL catalog details.
- APIs: live GraphQL introspection, gRPC reflection, AsyncAPI, WSDL, HAR, and Postman collections.
- Web: rendered Chromium accessibility trees.

Do not silently fall back to raw broad reads for an unsupported format. Report the missing adapter and use an available declared schema, metadata export, or narrowly scoped reader when possible.
