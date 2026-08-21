import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "bun:sqlite";
import { renderShape, type CommonOptions, type ShapeResult } from "./lib/core.ts";
import { shapeApi } from "../../api-shape/scripts/api-shape.ts";
import { shapeData } from "../../data-shape/scripts/data-shape.ts";
import { shapeDatabase } from "../../db-shape/scripts/db-shape.ts";
import { shapeDocument } from "../../doc-shape/scripts/doc-shape.ts";
import { shapeWeb } from "../../web-shape/scripts/web-shape.ts";
import { routeByQuestion, routeByTarget } from "./shape.ts";

const CANARY = "SHAPE_PRIVATE_CANARY_7f92";
const options: CommonOptions = { maxOutput: 4_000, json: false, names: "show", source: "show", labels: false };
let directory = "";

function rendered(result: ShapeResult, overrides: Partial<CommonOptions> = {}): string {
  return renderShape(result, { ...options, ...overrides });
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "shape-tests-"));
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("shape family", () => {
  test("routes by goal and refuses ambiguous extensions", () => {
    expect(routeByQuestion("Which API endpoints and response schemas exist?")).toBe("api");
    expect(routeByQuestion("Where is this config key implemented?")).toBe("code");
    expect(routeByQuestion("Which controls can a user click?")).toBe("web");
    expect(routeByQuestion("Show the workbook sheets and columns")).toBe("data");
    expect(routeByQuestion("What tables have foreign keys?")).toBe("db");
    expect(routeByQuestion("Show the XML payload structure without its values")).toBe("data");
    expect(routeByQuestion("Which environment variable names are declared?")).toBe("data");
    expect(routeByTarget("guide.md")).toBe("doc");
    expect(routeByTarget("records.csv")).toBe("data");
    expect(routeByTarget("service/.env.production")).toBe("data");
    expect(routeByTarget("contract.proto")).toBe("api");
    expect(routeByTarget("page.html")).toBeUndefined();
    expect(routeByTarget("payload.json")).toBeUndefined();
    expect(routeByTarget("payload.xml")).toBeUndefined();
    expect(routeByTarget("query.sql")).toBeUndefined();
  });

  test("maps JSON structure without returning values", async () => {
    const path = join(directory, "records.json");
    await writeFile(path, JSON.stringify([{ id: 1, token: CANARY, profile: { enabled: true } }, { id: 2, profile: { enabled: false } }]));
    const output = rendered(await shapeData(path, undefined, true, options));
    expect(output).toContain("field token string {optional}");
    expect(output).toContain("field enabled boolean");
    expect(output).not.toContain(CANARY);
    expect(output).toContain("access=observed");
  });

  test("maps delimited columns and inferred types without row values", async () => {
    const path = join(directory, "records.csv");
    await writeFile(path, `id,note,enabled\n1,${CANARY},true\n2,,false\n`);
    const output = rendered(await shapeData(path, undefined, true, options));
    expect(output).toContain("column id integer");
    expect(output).toContain("column note null|string {nullable}");
    expect(output).not.toContain(CANARY);
  });

  test("maps declared API structure while omitting examples, defaults, and enum literals", async () => {
    const path = join(directory, "openapi.yaml");
    await writeFile(path, `openapi: 3.1.0
paths:
  /users:
    get:
      operationId: listUsers
      responses:
        "200":
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/User"
components:
  schemas:
    User:
      type: object
      required: [id]
      properties:
        id: { type: string, example: "${CANARY}" }
        status: { type: string, enum: ["${CANARY}"] }
        secret: { type: string, default: "${CANARY}" }
`);
    const output = rendered(await shapeApi(path, undefined, options));
    expect(output).toContain("endpoint /users");
    expect(output).toContain("operation listUsers {GET}");
    expect(output).toContain("field id string {required}");
    expect(output).not.toContain(CANARY);
    expect(output).toContain("access=declared");
  });

  test("maps static web controls without input values, body prose, or URL queries", async () => {
    const path = join(directory, "page.html");
    await writeFile(path, `<main><h1>Account</h1><p>${CANARY}</p><form id="profile"><input name="email" value="${CANARY}" required><button>Save</button><a href="/help?token=${CANARY}#top">Help</a></form></main>`);
    const result = await shapeWeb(path, undefined, options);
    const anonymousLabels = rendered(result);
    expect(anonymousLabels).toContain("form profile");
    expect(anonymousLabels).toContain("input email {type=text,required}");
    expect(anonymousLabels).toContain("to=/help");
    expect(anonymousLabels).not.toContain(CANARY);
    const labels = rendered(result, { labels: true });
    expect(labels).toContain('heading "Account"');
    expect(labels).toContain('button "Save"');
    expect(labels).not.toContain(CANARY);
  });

  test("maps Markdown organization without paragraph bodies", async () => {
    const path = join(directory, "guide.md");
    await writeFile(path, `# Guide\n\n${CANARY}\n\n## Setup\n\n\`\`\`ts\nconst secret = "${CANARY}"\n\`\`\`\n`);
    const result = await shapeDocument(path, undefined, options);
    const output = rendered(result, { labels: true });
    expect(output).toContain('section "Guide"');
    expect(output).toContain('section "Setup"');
    expect(output).toContain("code-block ts");
    expect(output).not.toContain(CANARY);
  });

  test("maps SQLite catalogs without scanning rows or returning defaults", async () => {
    const path = join(directory, "catalog.sqlite");
    const database = new Database(path, { create: true });
    database.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL DEFAULT '${CANARY}'); CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id)); INSERT INTO users(email) VALUES ('${CANARY}');`);
    database.close();
    const output = rendered(await shapeDatabase(path, undefined, options));
    expect(output).toContain("table users");
    expect(output).toContain("column email TEXT {not-null}");
    expect(output).toContain("fk=users.id");
    expect(output).not.toContain(CANARY);
    expect(output).toContain("access=metadata");
  });

  test("supports anonymous, hashed, bounded, and JSON output", async () => {
    const result: ShapeResult = {
      source: `private-${CANARY}.json`,
      domain: "data",
      format: "json",
      access: "observed",
      nodes: [{ kind: "object", children: Array.from({ length: 30 }, (_, index) => ({
        kind: "field",
        name: `private_${index}`,
        dataType: index === 0 ? `Patient_${CANARY}` : "string",
        traits: index === 0 ? [`fk=patient_${CANARY}.id`, `to=/patient/${CANARY}`] : undefined,
        locator: { type: "pointer", value: `/private_${index}/${CANARY}` },
      })) }],
    };
    const anonymous = rendered(result, { names: "omit", source: "omit" });
    expect(anonymous).not.toContain("private_");
    expect(anonymous).not.toContain(CANARY);
    expect(anonymous).toContain("[pointer]");
    const hashed = rendered(result, { names: "hash", source: "hash" });
    expect(hashed).toContain("field #");
    expect(hashed).toContain("[pointer #");
    expect(hashed).not.toContain("private_");
    expect(hashed).not.toContain(CANARY);
    const small = rendered(result, { maxOutput: 180 });
    const large = rendered(result, { maxOutput: 500 });
    const smallBranches = small.split("\n").filter((line) => !line.startsWith("[") && line !== small.split("\n")[0]);
    for (const branch of smallBranches) expect(large).toContain(branch);
    const encoded = rendered(result, { maxOutput: 180, json: true });
    expect(encoded.length).toBeLessThanOrEqual(180);
    expect(() => JSON.parse(encoded)).not.toThrow();
  });
});
