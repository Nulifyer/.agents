---
name: sqlgo
description: Use when running or exporting SQL through sqlgo, querying its supported local files, or managing sqlgo connections, history, or SSH settings. Use shape skills when only value-free structure is needed.
---

# sqlgo

Use sqlgo's non-interactive verbs for agent work. A bare `sqlgo` starts the TUI.

Use `db-shape` or `data-shape` instead when structure alone answers the task or protected values must stay out of model context.

Check the installed command before relying on remembered flags:

```bash
command -v sqlgo
sqlgo help <verb>
```

If sqlgo is missing, report that. Do not install it unless the user asks.

## Choose the verb

| Task | Verb |
|---|---|
| Inspect or run SQL and return results | `exec` |
| Create a result file | `export` |
| Query local SQLite, CSV, TSV, or JSONL | `open` |
| List, inspect, test, import, export, add, update, or remove saved connections | `conns` |
| List, search, or clear stored query history | `history` |

Use one query source: `-q`, `-f`, or stdin. Prefer `--format jsonl` for model parsing and pipelines, `table` or `markdown` for a short human-facing result, and `export` for large output.

For initial inspection, set both a timeout and row cap:

```bash
sqlgo exec -c <connection> -q '<read-only SQL>' --format jsonl --max-rows 200 --timeout 30s
sqlgo open --format jsonl --max-rows 200 -q '<read-only SQL>' <file> [file...]
```

`open` flags must come before its file arguments. Flat files load into temporary SQLite tables named from their filenames. Opening a SQLite database accesses that database directly, so mutations change the source file.

## Safety

- Start with read-only SQL unless the user requested a mutation. Add a narrow `LIMIT` when the database supports it.
- Treat `--allow-unsafe` as a guard override, not a read-only mode. Use it only when the user intends the exact destructive statement. sqlgo guards `UPDATE` or `DELETE` without `WHERE`, `TRUNCATE`, and `DROP`, but other statements can still modify data without the flag.
- sqlgo does not add a transaction. Use explicit transaction statements only when their behavior is understood for the selected database and requested operation.
- Do not use `--continue-on-error` unless partial batch execution is acceptable.
- Exit code 5 means `--max-rows` produced partial output. Preserve the result and label it truncated instead of reporting a generic query failure.
- Connection removal, connection import, history clearing, exports that overwrite a file, and database mutations change state. Perform them only when the request includes that change.

## Credentials and connections

Prefer a saved connection with `-c NAME`. Credentials embedded in `--dsn` can appear in logs and process listings. When a password must be supplied, use `--password-stdin` or sqlgo's saved keyring entry. Do not print, persist, or repeat secrets in the response.

Do not pipe both a password and SQL through the same stdin. Put the query in `-q` or `-f` when using `--password-stdin`.

Use `sqlgo help conns` before changing connection or SSH settings. If it does not show a needed flag, consult the installed sqlgo documentation instead of guessing. Key-file SSH authentication is preferred. sqlgo checks host keys through `known_hosts` and does not use `ssh-agent`.

## Completion

Report the connection or local files used without exposing credentials, the query scope, output format, row truncation, and output path when one was created. Distinguish a database error from sqlgo's safety refusal or row-cap exit.
