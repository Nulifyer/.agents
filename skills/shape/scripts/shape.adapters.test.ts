import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { renderShape, type CommonOptions, type ShapeResult } from "./lib/core.ts";
import { shapeApi } from "../../api-shape/scripts/api-shape.ts";
import { shapeData } from "../../data-shape/scripts/data-shape.ts";
import { shapeDatabase } from "../../db-shape/scripts/db-shape.ts";
import { shapeDocument } from "../../doc-shape/scripts/doc-shape.ts";
import { shapeWeb } from "../../web-shape/scripts/web-shape.ts";

const CANARY = "SHAPE_PRIVATE_CANARY_7f92";
const options: CommonOptions = { maxOutput: 8_000, json: false, names: "show", labels: false };
let directory = "";

function rendered(result: ShapeResult, overrides: Partial<CommonOptions> = {}): string {
  return renderShape(result, { ...options, ...overrides });
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, source] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(source);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDirectory, end]);
}

function pdf(): Buffer {
  const content = `BT
/F1 20 Tf
72 720 Td
(OPERATIONS REPORT) Tj
/F1 10 Tf
0 -40 Td
(${CANARY}) Tj
ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  const chunks = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  const offsets = [0];
  let offset = chunks[0]?.length ?? 0;
  for (let index = 0; index < objects.length; index++) {
    offsets.push(offset);
    const chunk = Buffer.from(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`);
    chunks.push(chunk);
    offset += chunk.length;
  }
  const xrefOffset = offset;
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (const entryOffset of offsets.slice(1)) xref.push(`${entryOffset.toString().padStart(10, "0")} 00000 n `);
  chunks.push(Buffer.from(`${xref.join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

async function runCli(script: string, args: string[], input?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const child = Bun.spawn([process.execPath, script, ...args], {
    cwd: join(import.meta.dir, "../../.."),
    stdin: input === undefined ? undefined : new Blob([input]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, exitCode };
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "shape-adapters-"));
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("data shape adapters", () => {
  test("maps JSONL and NDJSON records with sampling and no values", async () => {
    for (const extension of ["jsonl", "ndjson"]) {
      const path = join(directory, `events.${extension}`);
      const lines = Array.from({ length: 65 }, (_, index) => JSON.stringify({ event_id: index, actor: { email: CANARY }, active: index % 2 === 0 }));
      await writeFile(path, `${lines.join("\n")}\n`);
      const output = rendered(await shapeData(path, undefined, true, options));
      expect(output).toContain("array object[] {sampled=64}");
      expect(output).toContain("field event_id integer");
      expect(output).toContain("field email string");
      expect(output).toContain("[incomplete]");
      expect(output).not.toContain(CANARY);
    }
  });

  test("maps TSV and headerless CSV columns", async () => {
    const tsvPath = join(directory, "ledger.tsv");
    await writeFile(tsvPath, `posted_at\tamount\tapproved\tnote\n2026-08-20\t19.95\ttrue\t${CANARY}\n`);
    const tsv = rendered(await shapeData(tsvPath, undefined, true, options));
    expect(tsv).toContain("column posted_at date-time");
    expect(tsv).toContain("column amount number");
    expect(tsv).toContain("column approved boolean");
    expect(tsv).not.toContain(CANARY);

    const csvPath = join(directory, "headerless.csv");
    await writeFile(csvPath, `1,${CANARY},true\n2,,false\n`);
    const csv = rendered(await shapeData(csvPath, undefined, false, options));
    expect(csv).toContain("column column_1 integer");
    expect(csv).toContain("column column_2 null|string {nullable}");
    expect(csv).not.toContain(CANARY);
  });

  test("maps CSV records with quoted commas, quotes, and newlines", async () => {
    const path = join(directory, "multiline.csv");
    await writeFile(path, `id,note,amount\n1,"first line\nsecond line, ${CANARY}",10.5\n2,"said ""hello""",11.25\n`);
    const output = rendered(await shapeData(path, undefined, true, options));
    expect(output).toContain("column id integer");
    expect(output).toContain("column note string");
    expect(output).toContain("column amount number");
    expect(output).not.toContain(CANARY);
  });

  test("maps a real XLSX package from workbook and table metadata", async () => {
    const path = join(directory, "orders.xlsx");
    await writeFile(path, zip({
      "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>`,
      "_rels/.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      "xl/workbook.xml": `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Orders" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
      "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:C3"/><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${CANARY}</t></is></c></row></sheetData></worksheet>`,
      "xl/worksheets/_rels/sheet1.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/></Relationships>`,
      "xl/tables/table1.xml": `<?xml version="1.0"?><table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="OrdersTable" displayName="OrdersTable" ref="A1:C3"><tableColumns count="3"><tableColumn id="1" name="order_id"/><tableColumn id="2" name="customer_email"/><tableColumn id="3" name="total"/></tableColumns></table>`,
    }));
    const output = rendered(await shapeData(path, undefined, true, options));
    expect(output).toContain("access=metadata");
    expect(output).toContain("sheet Orders");
    expect(output).toContain("table OrdersTable {range=A1:C3}");
    expect(output).toContain("column customer_email");
    expect(output).not.toContain(CANARY);
  });
});

describe("API shape adapters", () => {
  test("maps OpenAPI JSON and standalone JSON Schema", async () => {
    const openApiPath = join(directory, "openapi.json");
    await writeFile(openApiPath, JSON.stringify({
      openapi: "3.1.0",
      paths: { "/orders/{orderId}": { get: { operationId: "getOrder", parameters: [{ name: "orderId", in: "path", required: true, schema: { type: "string", example: CANARY } }], responses: { 204: { description: CANARY } } } } },
    }));
    const openApi = rendered(await shapeApi(openApiPath, undefined, options));
    expect(openApi).toContain("endpoint /orders/{orderId}");
    expect(openApi).toContain("parameter orderId string {path,required}");
    expect(openApi).not.toContain(CANARY);

    const schemaPath = join(directory, "invoice.schema.json");
    await writeFile(schemaPath, JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Invoice",
      type: "object",
      required: ["invoice_id"],
      properties: { invoice_id: { type: "string", examples: [CANARY] }, lines: { type: "array", items: { type: "object", properties: { amount: { type: "number", default: CANARY } } } } },
    }));
    const schema = rendered(await shapeApi(schemaPath, undefined, options));
    expect(schema).toContain("schema Invoice object {required}");
    expect(schema).toContain("field invoice_id string {required}");
    expect(schema).toContain("field amount number {optional}");
    expect(schema).not.toContain(CANARY);
  });

  test("maps GraphQL SDL without enum values or descriptions", async () => {
    const path = join(directory, "commerce.graphql");
    await writeFile(path, `"""${CANARY}"""\nscalar DateTime\n\nenum OrderStatus {\n  PRIVATE_${CANARY}\n  PAID\n}\n\ninput OrderFilter {\n  status: OrderStatus\n  createdAfter: DateTime\n}\n\ntype Order {\n  id: ID!\n  total: Float!\n}\n\ntype Query {\n  order(id: ID!): Order\n}\n`);
    const output = rendered(await shapeApi(path, undefined, options));
    expect(output).toContain("enum OrderStatus {members=2}");
    expect(output).toContain("input OrderFilter");
    expect(output).toContain("field createdAfter DateTime");
    expect(output).toContain("field order Order");
    expect(output).not.toContain(CANARY);
  });

  test("maps Protocol Buffer messages, repeated fields, enums, and services", async () => {
    const path = join(directory, "orders.proto");
    await writeFile(path, `syntax = "proto3";\npackage commerce.v1;\n// ${CANARY}\nmessage GetOrderRequest { string order_id = 1; }\nmessage Order {\n  string id = 1;\n  repeated string tags = 2;\n}\nenum OrderStatus { ORDER_STATUS_PRIVATE_${CANARY} = 0; PAID = 1; }\nservice Orders { rpc GetOrder(GetOrderRequest) returns (Order); }\n`);
    const output = rendered(await shapeApi(path, undefined, options));
    expect(output).toContain("message GetOrderRequest");
    expect(output).toContain("field tags string {repeated}");
    expect(output).toContain("enum OrderStatus");
    expect(output).toContain("rpc GetOrder GetOrderRequest -> Order");
    expect(output).not.toContain(CANARY);
  });
});

describe("web shape adapters", () => {
  test("fetches a real HTTP page and strips URL secrets", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(`<header><nav><a href="/account?token=${CANARY}">Account</a></nav></header><main><h1>Dashboard</h1><form id="search"><input name="query" value="${CANARY}"><button>Search</button></form><script>window.secret = "${CANARY}"</script></main>`, { headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
    try {
      const output = rendered(await shapeWeb(`http://127.0.0.1:37891/private?token=${CANARY}#fragment`, undefined, options), { labels: true });
      expect(output).toContain("access=observed");
      expect(output).toContain("form search");
      expect(output).toContain('button "Search"');
      expect(output).toContain("[incomplete]");
      expect(output).not.toContain(CANARY);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects unavailable rendered access explicitly", async () => {
    const path = join(directory, "rendered.html");
    await writeFile(path, "<main><button>Open</button></main>");
    await expect(shapeWeb(path, undefined, { ...options, access: "rendered" })).rejects.toThrow("Chromium adapter");
  });
});

describe("document shape adapters", () => {
  test("maps MDX headings, tables, and code without component props or prose", async () => {
    const path = join(directory, "guide.mdx");
    await writeFile(path, `# Deployment guide\n\n<Notice secret="${CANARY}" />\n\n## Matrix\n\n| Region | Owner |\n| --- | --- |\n| east | ${CANARY} |\n\n~~~bash\nTOKEN=${CANARY}\n~~~\n`);
    const output = rendered(await shapeDocument(path, undefined, options), { labels: true });
    expect(output).toContain('section "Deployment guide"');
    expect(output).toContain('section "Matrix"');
    expect(output).toContain("table");
    expect(output).toContain("code-block bash");
    expect(output).not.toContain(CANARY);
  });

  test("maps a real DOCX package without paragraph values", async () => {
    const path = join(directory, "handbook.docx");
    await writeFile(path, zip({
      "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
      "_rels/.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      "word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Operations handbook</w:t></w:r></w:p><w:p><w:r><w:t>${CANARY}</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Escalation</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>${CANARY}</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>`,
    }));
    const output = rendered(await shapeDocument(path, undefined, options), { labels: true });
    expect(output).toContain('section "Operations handbook" {level=1,style=Title}');
    expect(output).toContain('section "Escalation" {level=2,style=Heading2}');
    expect(output).toContain("table");
    expect(output).toContain("page-section");
    expect(output).not.toContain(CANARY);
  });

  test("maps real PDF metadata and infers labels without exposing body text", async () => {
    const path = join(directory, "operations.pdf");
    await writeFile(path, pdf());
    const metadata = rendered(await shapeDocument(path, undefined, options));
    expect(metadata).toContain("document {pages=1}");
    expect(metadata).toContain("access=metadata");
    expect(metadata).not.toContain(CANARY);

    const labels = rendered(await shapeDocument(path, undefined, { ...options, labels: true }), { labels: true });
    expect(labels).toContain("access=observed");
    expect(labels).toContain('section "OPERATIONS REPORT"');
    expect(labels).not.toContain(CANARY);
  });
});

describe("database shape adapters", () => {
  test("maps SQLite views, indexes, generated columns, and focused tables", async () => {
    const path = join(directory, "commerce.sqlite");
    const database = new Database(path, { create: true });
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE customers (id INTEGER PRIMARY KEY, email TEXT NOT NULL DEFAULT '${CANARY}');
      CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), subtotal REAL, tax REAL, total REAL GENERATED ALWAYS AS (subtotal + tax) STORED);
      CREATE UNIQUE INDEX orders_customer_id_unique ON orders(customer_id);
      CREATE VIEW order_totals AS SELECT customer_id, total, '${CANARY}' AS private_value FROM orders;
      INSERT INTO customers(email) VALUES ('${CANARY}');
    `);
    database.close();

    const output = rendered(await shapeDatabase(path, undefined, options));
    expect(output).toContain("view order_totals");
    expect(output).toContain("column total REAL {nullable,hidden=3}");
    expect(output).toContain("index orders_customer_id_unique {unique,origin=c}");
    expect(output).toContain("fk=customers.id");
    expect(output).not.toContain(CANARY);

    const focused = rendered(await shapeDatabase(path, "orders", options));
    expect(focused).toContain("table orders");
    expect(focused).not.toContain("table customers");
    await expect(shapeDatabase(path, "missing", options)).rejects.toThrow("No table or view named missing");
  });
});

describe("CLI boundaries", () => {
  test("accepts stdin for API, data, document, and web shapes", async () => {
    const cases = [
      ["../../api-shape/scripts/api-shape.ts", ["-", "schema.json"], JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", properties: { secret: { type: "string", example: CANARY } } }), "api json-schema"],
      ["../../data-shape/scripts/data-shape.ts", ["-", "events.jsonl"], `${JSON.stringify({ id: 1, secret: CANARY })}\n`, "data jsonl"],
      ["../../doc-shape/scripts/doc-shape.ts", ["-", "guide.md", "--labels"], `# Guide\n\n${CANARY}\n`, "document markdown"],
      ["../../web-shape/scripts/web-shape.ts", ["-", "page.html", "--labels"], `<main><button>Continue</button><p>${CANARY}</p></main>`, "web html-static"],
    ] as const;
    for (const [relativeScript, args, input, expected] of cases) {
      const result = await runCli(join(import.meta.dir, relativeScript), [...args], input);
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(expected);
      expect(result.stdout).not.toContain(CANARY);
    }
  });

  test("director routes and runs focused tools end to end", async () => {
    const dataPath = join(directory, "director.json");
    await writeFile(dataPath, JSON.stringify({ account_id: 1, secret: CANARY }));
    const result = await runCli(join(import.meta.dir, "shape.ts"), [dataPath, "--question", "Which fields are in these records?"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("data json");
    expect(result.stdout).toContain("field account_id integer");
    expect(result.stdout).not.toContain(CANARY);
  });
});
