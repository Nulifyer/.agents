#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import {
  parseCommonArgs,
  renderShape,
  runCommand,
  type CommonOptions,
  type ShapeNode,
  type ShapeResult,
} from "../../../packages/shape-core/src/index.ts";

type SqliteObject = { name: string; type: "table" | "view" };
type SqliteColumn = { name: string; type: string; notnull: number; pk: number; hidden: number };
type SqliteForeignKey = { from: string; table: string; to: string };
type SqliteIndex = { name: string; unique: number; origin: string };

function usage(): string {
  return "Usage: db-shape <database.sqlite|postgres-uri> [--table <name>] [--names show|hash|omit] [-o <chars>] [-j]";
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqliteShape(path: string, tableFocus?: string): ShapeResult {
  const database = new Database(path, { readonly: true, strict: true });
  try {
    const objects = database.query<SqliteObject, []>(
      "SELECT name, type FROM sqlite_schema WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name",
    ).all().filter((item) => !tableFocus || item.name === tableFocus);
    const nodes = objects.map((item): ShapeNode => {
      const columns = database.query<SqliteColumn, []>(`PRAGMA table_xinfo(${literal(item.name)})`).all();
      const foreignKeys = database.query<SqliteForeignKey, []>(`PRAGMA foreign_key_list(${literal(item.name)})`).all();
      const foreignByColumn = new Map(foreignKeys.map((key) => [key.from, key]));
      const columnNodes = columns.map((column): ShapeNode => {
        const foreign = foreignByColumn.get(column.name);
        const traits = [
          ...(column.notnull ? ["not-null"] : ["nullable"]),
          ...(column.pk ? [`pk=${column.pk}`] : []),
          ...(column.hidden ? [`hidden=${column.hidden}`] : []),
          ...(foreign ? [`fk=${foreign.table}.${foreign.to}`] : []),
        ];
        return {
          kind: "column",
          name: column.name,
          dataType: column.type || "untyped",
          traits,
          locator: { type: "catalog", value: `main.${item.name}.${column.name}` },
        };
      });
      const indexes = database.query<SqliteIndex, []>(`PRAGMA index_list(${literal(item.name)})`).all().map((index): ShapeNode => ({
        kind: "index",
        name: index.name,
        traits: [index.unique ? "unique" : "non-unique", `origin=${index.origin}`],
        locator: { type: "catalog", value: `main.${index.name}` },
      }));
      return { kind: item.type, name: item.name, locator: { type: "catalog", value: `main.${item.name}` }, children: [...columnNodes, ...indexes] };
    });
    if (tableFocus && nodes.length === 0) throw new Error(`No table or view named ${tableFocus}`);
    return { source: path, domain: "database", format: "sqlite", access: "metadata", nodes: [{ kind: "schema", name: "main", children: nodes }] };
  } finally {
    database.close();
  }
}

function postgresDisplay(connection: string): string {
  try {
    const url = new URL(connection);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "postgres";
  }
}

async function postgresShape(connection: string, tableFocus?: string): Promise<ShapeResult> {
  const filter = tableFocus ? ` AND c.table_name = ${literal(tableFocus)}` : "";
  const query = `SELECT c.table_schema, c.table_name, t.table_type, c.column_name, c.data_type, c.is_nullable FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name WHERE c.table_schema NOT IN ('pg_catalog','information_schema')${filter} ORDER BY c.table_schema,c.table_name,c.ordinal_position`;
  const output = await runCommand(["psql", connection, "--no-align", "--tuples-only", "--field-separator", "\t", "--command", query]);
  const schemas = new Map<string, Map<string, ShapeNode>>();
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [schema, table, tableType, column, dataType, nullable] = line.split("\t");
    if (!schema || !table || !column) continue;
    let tables = schemas.get(schema);
    if (!tables) {
      tables = new Map();
      schemas.set(schema, tables);
    }
    let tableNode = tables.get(table);
    if (!tableNode) {
      tableNode = { kind: tableType === "VIEW" ? "view" : "table", name: table, locator: { type: "catalog", value: `${schema}.${table}` }, children: [] };
      tables.set(table, tableNode);
    }
    tableNode.children?.push({ kind: "column", name: column, dataType, traits: [nullable === "YES" ? "nullable" : "not-null"], locator: { type: "catalog", value: `${schema}.${table}.${column}` } });
  }
  const nodes = [...schemas].map(([schema, tables]): ShapeNode => ({ kind: "schema", name: schema, children: [...tables.values()] }));
  return { source: postgresDisplay(connection), domain: "database", format: "postgresql", access: "metadata", nodes };
}

export async function shapeDatabase(target: string, tableFocus: string | undefined, options: CommonOptions): Promise<ShapeResult> {
  if (options.access && options.access !== "metadata") throw new Error("Database shape supports --access metadata only");
  if (/^postgres(?:ql)?:\/\//i.test(target)) return postgresShape(target, tableFocus);
  return sqliteShape(target, tableFocus);
}

async function main(): Promise<void> {
  const parsed = parseCommonArgs(process.argv.slice(2));
  if (parsed.rest.includes("--help") || parsed.rest.includes("-h")) {
    console.log(usage());
    return;
  }
  const operands: string[] = [];
  let tableFocus: string | undefined;
  for (let index = 0; index < parsed.rest.length; index++) {
    if (parsed.rest[index] === "--table") tableFocus = parsed.rest[++index];
    else operands.push(parsed.rest[index] as string);
  }
  const target = operands[0];
  if (!target) throw new Error("A database file or PostgreSQL URI is required");
  const result = await shapeDatabase(target, tableFocus, parsed.options);
  process.stdout.write(renderShape(result, parsed.options));
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
