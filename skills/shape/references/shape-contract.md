# Shape contract

Shape output maps structure and actionable locations. It does not answer content questions.

## Evidence and access

- `declared` reads an explicit schema or contract.
- `metadata` reads catalogs or container metadata without records, cells, or document bodies.
- `observed` inspects content locally but does not emit its values.
- `rendered` executes a page and inspects the resulting semantic tree.

Never describe `observed` output as metadata-only. Redaction is not access control.

## Disclosure

- `--names show` returns structural identifiers.
- `--names hash` returns stable short hashes.
- `--names omit` returns anonymous structure.
- `--labels` opts into user-facing labels such as headings and button names.

Do not emit record values, cell values, examples, enum literals, statistics, SQL default expressions, URL query strings, URL fragments, input values, comments, custom metadata, or paragraph bodies.

## Result semantics

Every useful node has a domain locator where the source permits one. `[more]` means complete lower-ranked nodes did not fit. `[incomplete]` means parsing, inference, unavailable metadata, or a safety limit may have hidden structure.

Increasing the output budget must retain the earlier traversal prefix. Plain text is the default; JSON mode returns the same compact text as one JSON string.
