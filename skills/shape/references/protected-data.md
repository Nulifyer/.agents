# Protected-data workflow

Use shape when the model may work with identifiers and structure but must not receive record, secret, patient, customer, or other protected values.

## Establish the boundary

Decide which access is allowed before running a tool:

- If only declared contracts and catalogs are allowed, use `api-shape` or `db-shape`. Do not fetch business payloads or query rows.
- If a trusted local process may inspect a file while the model receives structure only, use an observed adapter such as `data-shape`. Do not print, preview, or attach the original input.
- If structural names are also protected, use `--names hash` or `--names omit`. This also protects identifier-bearing locators.
- If a filename, local path, or connection label is protected, use `--source hash` or `--source omit`.
- Pass the expected `--access` mode when it is a privacy requirement so the adapter refuses an unexpected broader mode.

Prefer declared or metadata access over observed access when both can answer the question. An OpenAPI document is safer than a live response. A database catalog is safer than inferring a schema from query results.

## Build without reading values

Combine only the context needed for the task:

1. Map repository ownership with `code-shape` or `repo-map`.
2. Map API contracts, payload structure, environment keys, or database catalogs with the focused shape tool.
3. Write the script, query, migration, or integration from those contracts and relationships.
4. Validate syntax and behavior against synthetic fixtures whose values are safe for model context.

Do not claim semantic correctness that depends on unseen distributions or values. State which parts were checked from structure and which require a user or authorized runtime to verify.

Never use `code-shape` to inspect a secret-bearing `.env` file. Use `data-shape` for its key inventory, then use `code-shape` on ordinary source files to locate those keys' consumers.

## Keep protected results out of context

When the requested analysis must run against protected data, follow the user's access policy. If execution is authorized but result values must remain hidden from the model:

- Design the command to write results directly to a user-reviewed file instead of stdout.
- Avoid verbose modes, row previews, exception dumps, and logs that can echo inputs or results.
- Report the output path and the checks that ran. Do not open, summarize, or attach the protected result file.
- Give the user a safe checklist for reviewing the result and rerunning the command.

If execution is not authorized, provide the script or query and instructions for the user to run it. Do not broaden access merely because shape information was available.
