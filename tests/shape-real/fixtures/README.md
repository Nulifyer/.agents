# Shape real-file fixtures

This corpus keeps the required integration test offline and reproducible. `manifest.json` pins every upstream file to a source revision and SHA-256 digest. Upstream payloads are stored as base64 text so repository patches remain reviewable and whitespace checks do not rewrite source bytes; the test decodes them into a temporary directory and verifies their decoded bytes before use.

`LICENSE-APACHE-2.0.txt` applies to the pinned OpenAPI and Apache POI samples. `NOTICE-POI.txt` preserves Apache POI's upstream notice. The files under `generated/` are original regression inputs in this repository, not upstream copies.

Compiler-produced ELF, archive, COFF, PE, and WebAssembly files and the SQLite database are created in a temporary directory during the test. A producer case is skipped with an explicit reason when that producer is unavailable.
