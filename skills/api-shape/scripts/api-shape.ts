#!/usr/bin/env bun

// biome-ignore-all lint/complexity/useLiteralKeys: TypeScript requires bracket access for schema dictionaries.
import { extname } from "node:path";
import {
  lineAt,
  parseCommonArgs,
  readTarget,
  renderShape,
  type CommonOptions,
  type ShapeNode,
  type ShapeResult,
} from "../../shape/scripts/lib/core.ts";

type ObjectValue = Record<string, unknown>;

function usage(): string {
  return "Usage: api-shape <openapi|schema|graphql|proto file> [--names show|hash|omit] [-o <chars>] [-j]\n       api-shape - <name.ext> [options]";
}

function object(value: unknown): ObjectValue | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function schemaType(schema: ObjectValue): string {
  const type = schema["type"];
  if (typeof type === "string") return type;
  if (Array.isArray(type)) return type.filter((item): item is string => typeof item === "string").join("|");
  const reference = string(schema["$ref"]);
  return reference
    ? reference.split("/").at(-1) ?? "ref"
    : object(schema["properties"])
      ? "object"
      : schema["items"]
        ? "array"
        : "unknown";
}

function schemaNode(name: string | undefined, schemaValue: unknown, pointer: string, required = false, depth = 0): ShapeNode {
  const schema = object(schemaValue) ?? {};
  const traits = [required ? "required" : "optional"];
  const node: ShapeNode = { kind: name ? "field" : "schema", name, dataType: schemaType(schema), traits, locator: { type: "pointer", value: pointer } };
  if (depth >= 8) return { ...node, traits: [...traits, "depth-limited"] };
  const properties = object(schema["properties"]);
  const requiredValue = schema["required"];
  const requiredNames = new Set(Array.isArray(requiredValue) ? requiredValue.filter((item): item is string => typeof item === "string") : []);
  const childPointer = pointer === "/" ? "" : pointer;
  if (properties) {
    node.children = Object.entries(properties).map(([key, value]) =>
      schemaNode(key, value, `${childPointer}/properties/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, requiredNames.has(key), depth + 1)
    );
  } else if (schema["items"]) {
    node.children = [schemaNode("item", schema["items"], `${childPointer}/items`, true, depth + 1)];
  }
  return node;
}

function openApiShape(name: string, root: ObjectValue): ShapeResult {
  const nodes: ShapeNode[] = [];
  const paths = object(root["paths"]) ?? {};
  const methods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace", "query"]);
  for (const [path, pathValue] of Object.entries(paths)) {
    const pathObject = object(pathValue) ?? {};
    const operations: ShapeNode[] = [];
    for (const [method, operationValue] of Object.entries(pathObject)) {
      if (!methods.has(method.toLowerCase())) continue;
      const operation = object(operationValue) ?? {};
      const children: ShapeNode[] = [];
      const parametersValue = operation["parameters"];
      const parameters = Array.isArray(parametersValue) ? parametersValue : [];
      if (parameters.length) {
        children.push({
          kind: "parameters",
          children: parameters.map((parameterValue, index): ShapeNode => {
            const parameter = object(parameterValue) ?? {};
            return {
              kind: "parameter",
              name: string(parameter["name"]),
              dataType: schemaType(object(parameter["schema"]) ?? {}),
              traits: [string(parameter["in"]) ?? "unknown", parameter["required"] === true ? "required" : "optional"],
              locator: { type: "pointer", value: `/paths/${path}/${method}/parameters/${index}` },
            };
          }),
        });
      }
      const requestBody = object(operation["requestBody"]);
      const requestContent = object(requestBody?.["content"]);
      if (requestContent) {
        children.push({
          kind: "request",
          children: Object.entries(requestContent).map(([mediaType, mediaValue]) => {
            const media = object(mediaValue) ?? {};
            return schemaNode(mediaType, media["schema"], `/paths/${path}/${method}/requestBody/content/${mediaType}/schema`, requestBody?.["required"] === true);
          }),
        });
      }
      const responses = object(operation["responses"]);
      if (responses) {
        children.push({
          kind: "responses",
          children: Object.entries(responses).map(([status, responseValue]): ShapeNode => {
            const response = object(responseValue) ?? {};
            const content = object(response["content"]) ?? {};
            return {
              kind: "response",
              name: status,
              locator: { type: "pointer", value: `/paths/${path}/${method}/responses/${status}` },
              children: Object.entries(content).map(([mediaType, mediaValue]) => {
                const media = object(mediaValue) ?? {};
                return schemaNode(mediaType, media["schema"], `/paths/${path}/${method}/responses/${status}/content/${mediaType}/schema`, true);
              }),
            };
          }),
        });
      }
      operations.push({
        kind: "operation",
        name: string(operation["operationId"]) ?? method.toUpperCase(),
        traits: [method.toUpperCase()],
        locator: { type: "pointer", value: `/paths/${path}/${method}` },
        children,
      });
    }
    nodes.push({ kind: "endpoint", name: path, locator: { type: "pointer", value: `/paths/${path}` }, children: operations });
  }
  const schemas = object(object(root["components"])?.["schemas"]) ?? object(root["definitions"]);
  if (schemas) {
    nodes.push({
      kind: "schemas",
      children: Object.entries(schemas).map(([schemaName, schema]) => schemaNode(schemaName, schema, `/components/schemas/${schemaName}`, true)),
    });
  }
  return { source: name, domain: "api", format: `openapi-${string(root["openapi"]) ?? string(root["swagger"]) ?? "unknown"}`, access: "declared", nodes };
}

function jsonSchemaShape(name: string, root: ObjectValue): ShapeResult {
  const title = string(root["title"]);
  const node = schemaNode(title, root, "/", true);
  node.kind = "schema";
  return { source: name, domain: "api", format: "json-schema", access: "declared", nodes: [node] };
}

function graphQlShape(name: string, source: string): ShapeResult {
  const located: Array<{ index: number; node: ShapeNode }> = [];
  const definitionPattern = /\b(type|input|interface|enum)\s+([_A-Za-z][_0-9A-Za-z]*)[^{]*\{([\s\S]*?)\}/g;
  for (const match of source.matchAll(definitionPattern)) {
    const kind = match[1] as string;
    const definitionName = match[2] as string;
    const body = match[3] ?? "";
    const bodyStart = match.index + match[0].indexOf(body);
    const children: ShapeNode[] = [];
    if (kind !== "enum") {
      for (const field of body.matchAll(/^\s*([_A-Za-z][_0-9A-Za-z]*)\s*(?:\([^)]*\))?\s*:\s*([^\s#]+)/gm)) {
        children.push({ kind: "field", name: field[1], dataType: field[2], locator: { type: "line", start: lineAt(source, bodyStart + (field.index ?? 0)) } });
      }
    }
    const enumCount = kind === "enum" ? [...body.matchAll(/^\s*([_A-Za-z][_0-9A-Za-z]*)/gm)].length : 0;
    located.push({
      index: match.index,
      node: {
        kind,
        name: definitionName,
        locator: { type: "line", start: lineAt(source, match.index) },
        traits: enumCount ? [`members=${enumCount}`] : undefined,
        children,
      },
    });
  }
  for (const match of source.matchAll(/\b(scalar|union|directive)\s+@?([_A-Za-z][_0-9A-Za-z]*)[^\n]*/g)) {
    located.push({
      index: match.index,
      node: { kind: match[1] as string, name: match[2], locator: { type: "line", start: lineAt(source, match.index) } },
    });
  }
  located.sort((left, right) => left.index - right.index);
  return { source: name, domain: "api", format: "graphql-sdl", access: "declared", nodes: located.map((item) => item.node) };
}

function protoShape(name: string, source: string): ShapeResult {
  const nodes: ShapeNode[] = [];
  for (const match of source.matchAll(/\b(message|enum|service)\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\}/g)) {
    const kind = match[1] as string;
    const body = match[3] ?? "";
    const children: ShapeNode[] = [];
    if (kind === "service") {
      for (const rpc of body.matchAll(/\brpc\s+(\w+)\s*\(([^)]*)\)\s+returns\s*\(([^)]*)\)/g)) {
        children.push({ kind: "rpc", name: rpc[1], dataType: `${rpc[2]?.trim()} -> ${rpc[3]?.trim()}`, locator: { type: "line", start: lineAt(source, match.index + (rpc.index ?? 0)) } });
      }
    } else {
      for (const field of body.matchAll(/^\s*(?:repeated\s+)?([.\w<>]+)\s+(\w+)\s*=\s*\d+/gm)) {
        children.push({ kind: "field", name: field[2], dataType: field[1], traits: /^\s*repeated\b/.test(field[0]) ? ["repeated"] : undefined, locator: { type: "line", start: lineAt(source, match.index + (field.index ?? 0)) } });
      }
    }
    nodes.push({ kind, name: match[2], locator: { type: "line", start: lineAt(source, match.index) }, children });
  }
  return { source: name, domain: "api", format: "protobuf", access: "declared", nodes };
}

export async function shapeApi(path: string, virtualName: string | undefined, options: CommonOptions): Promise<ShapeResult> {
  if (options.access && options.access !== "declared") throw new Error("API contracts support --access declared only");
  const target = await readTarget(path, virtualName);
  const source = target.bytes.toString("utf8");
  const extension = extname(target.name).toLowerCase();
  if ([".graphql", ".gql", ".graphqls"].includes(extension)) return graphQlShape(target.name, source);
  if (extension === ".proto") return protoShape(target.name, source);
  const parsed: unknown = extension === ".json" ? JSON.parse(source) : Bun.YAML.parse(source);
  const root = object(parsed);
  if (!root) throw new Error("API description must be an object");
  if (root["openapi"] || root["swagger"] || root["paths"]) return openApiShape(target.name, root);
  if (root["$schema"] || root["properties"] || root["$defs"] || root["definitions"]) return jsonSchemaShape(target.name, root);
  throw new Error("Unrecognized API contract; expected OpenAPI, JSON Schema, GraphQL SDL, or Protocol Buffers");
}

async function main(): Promise<void> {
  const parsed = parseCommonArgs(process.argv.slice(2));
  if (parsed.rest.includes("--help") || parsed.rest.includes("-h")) {
    console.log(usage());
    return;
  }
  const path = parsed.rest[0];
  if (!path) throw new Error("An API contract file is required");
  const virtualName = path === "-" ? parsed.rest[1] : undefined;
  const result = await shapeApi(path, virtualName, parsed.options);
  process.stdout.write(renderShape(result, parsed.options));
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
