# Shape contract

Shape output maps structure and actionable locations. It does not answer content questions.

The disclosure boundary is the model context. A shape adapter can withhold values from its output even when a local process must inspect them to infer structure. Confirm that this local access is allowed before using an observed or rendered adapter.

## Evidence and access

- `declared` reads an explicit schema or contract.
- `metadata` reads catalogs or container metadata without records, cells, or document bodies.
- `observed` inspects content locally but does not emit its values.
- `rendered` executes a page and inspects the resulting semantic tree.

Never describe `observed` output as metadata-only. Redaction is not access control.

If no tool process may access values, use only a declared contract or metadata adapter. Do not send the protected file or payload through an observed adapter. If a trusted local process may inspect values but the model may not receive them, observed shape is appropriate as long as command output, errors, logs, and artifacts also keep values out of model context.

## Disclosure

- `--names show` returns structural identifiers.
- `--names hash` returns stable short hashes.
- `--names omit` returns anonymous structure.
- `--source show|hash|omit` independently controls the input path or connection label in the header.
- `--labels` opts into user-facing labels such as headings and button names.

Structural names and source paths can themselves be sensitive. Use hashing when stable identity is needed without disclosure, or omission when anonymous structure is enough. Name disclosure also applies to named type references, identifier-bearing traits, and locators such as JSON pointers, DOM paths, catalog paths, and sheet names. Numeric line, byte, page, and cell-range positions remain visible.

When privacy depends on the access mode, pass `--access` as an assertion. The focused adapter must refuse a different mode instead of silently broadening access.

Do not emit record values, cell values, examples, enum literals, statistics, SQL default expressions, URL query strings, URL fragments, input values, comments, custom metadata, or paragraph bodies.

## Result semantics

Every useful node has a domain locator where the source permits one. `[more]` means complete lower-ranked nodes did not fit. `[incomplete]` means parsing, inference, unavailable metadata, or a safety limit may have hidden structure.

Increasing the output budget must retain the earlier traversal prefix. Plain text is the default; JSON mode returns the same compact text as one JSON string.
