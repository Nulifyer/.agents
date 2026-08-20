import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shapeSource, shapeTarget } from "./lib/index.ts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("code shape", () => {
  test("extracts TypeScript names, nesting, and one-based ranges", async () => {
    const source = `interface Service<T> {
  value: T;
  run(input: T): Promise<T>;
}

export class Worker {
  constructor(private readonly id: string) {}

  async execute(value: number): Promise<number> {
    return value;
  }
}

export const double = (value: number): number => value * 2;
`;
    const result = await shapeSource("worker.ts", source);

    expect(result.language).toBe("typescript");
    expect(result.lineCount).toBe(14);
    expect(result.parseErrors).toBe(0);
    expect(result.text).toContain("type Service [1-4]");
    expect(result.text).toContain("  fn run [3]");
    expect(result.text).toContain("type Worker [6-12]");
    expect(result.text).toContain("  fn execute [9-11]");
    expect(result.text).toContain("fn double [14]");
    expect(result.text).not.toContain("Promise<number>");
  });

  test("focuses by symbol or enclosing line", async () => {
    const source = `class Worker {
  execute(value: number) {
    return value;
  }
  stop() {}
}
`;
    const symbol = await shapeSource("worker.ts", source, { symbol: "execute" });
    expect(symbol.focus).toBe("symbol execute");
    expect(symbol.text).toContain("fn execute [2-4]");
    expect(symbol.text).not.toContain("fn stop");

    const line = await shapeSource("worker.ts", source, { line: 3 });
    expect(line.focus).toBe("Worker > execute");
    expect(line.text).toContain("fn execute [2-4]");
    expect(line.text).not.toContain("fn stop");
  });

  test("supports the initial language set", async () => {
    const cases = [
      ["sample.js", "export function run(x) { return x; }", "fn run [1]"],
      ["sample.jsx", "export const Card = () => <div />;", "fn Card [1]"],
      ["sample.tsx", "export function Card(): JSX.Element { return <div />; }", "fn Card [1]"],
      ["sample.py", "class Box:\n    def get(self):\n        return 1\n", "type Box [1-3]"],
      ["sample.rs", "impl Box { fn get(&self) -> i32 { 1 } }", "impl Box [1]"],
      [
        "sample.go",
        "package p\ntype Runner interface { Run(x int) int }\nfunc Run(x int) int { return x }\n",
        "  fn Run [2]",
      ],
      ["sample.kt", "class Box { fun get(): Int { return 1 } }", "type Box [1]"],
      ["sample.sh", "run() { echo ok; }\n", "fn run [1]"],
    ] as const;

    for (const [path, source, expected] of cases) {
      const result = await shapeSource(path, source);
      expect(result.text).toContain(expected);
    }
  });

  test("extracts useful shapes for compiled and systems languages", async () => {
    const cases = [
      ["sample.c", "typedef struct Box { int value; } Box;\nint run(Box *box) { return box->value; }", "c", "fn run"],
      ["sample.cpp", "namespace app { class Box { int run() { return 1; } }; }", "cpp", "  type Box"],
      ["sample.cs", "namespace App; class Box { int Run() { return 1; } }", "csharp", "  type Box"],
      ["Sample.java", "package app; class Box { int run() { return 1; } }", "java", "  fn run"],
      ["sample.m", "@interface Box : NSObject\n- (int)run;\n@end", "objective-c", "  fn run"],
      ["sample.sol", "contract Box { function run() public returns (uint) { return 1; } }", "solidity", "  fn run"],
      ["sample.swift", "struct Box { func run() -> Int { 1 } }", "swift", "  fn run"],
      ["sample.zig", "const Box = struct { pub fn run() void {} };", "zig", "  fn run"],
      ["sample.rdl", "addrmap top { };", "systemrdl", "mod top"],
      ["sample.sv", "module counter; function int run(); run = 1; endfunction endmodule", "systemverilog", "  fn run"],
    ] as const;

    for (const [path, source, language, expected] of cases) {
      const result = await shapeSource(path, source);
      expect(result.language).toBe(language);
      expect(result.parseErrors).toBe(0);
      expect(result.text).toContain(expected);
    }
  });

  test("extracts useful shapes for functional and dynamic languages", async () => {
    const cases = [
      ["sample.dart", "class Box { int run(int x) => x; }", "dart", "  fn run"],
      ["sample.el", "(defun run (x) x)", "elisp", "fn run"],
      ["sample.hs", "module App where\nrun :: Int -> Int\nrun x = x\n", "haskell", "fn run"],
      ["sample.jl", "module App\nfunction run(x)\n x\nend\nend", "julia", "  fn run"],
      ["sample.lua", "local function run(x) return x end", "lua", "fn run"],
      ["sample.ml", "module App = struct let run x = x end", "ocaml", "  fn run"],
      ["sample.php", "<?php class Box { function run($x) { return $x; } }", "php", "  fn run"],
      ["sample.res", "module Box = { let run = x => x }", "rescript", "  fn run"],
      ["sample.rb", "class Box\n def run(x) = x\nend", "ruby", "  fn run"],
      ["sample.scala", "class Box { def run(x: Int): Int = x }", "scala", "  fn run"],
      ["sample.tla", "---- MODULE Counter ----\nInit == TRUE\n====", "tlaplus", "  fn Init"],
    ] as const;

    for (const [path, source, language, expected] of cases) {
      const result = await shapeSource(path, source);
      expect(result.language).toBe(language);
      expect(result.parseErrors).toBe(0);
      expect(result.text).toContain(expected);
    }
  });

  test("uses selectors, elements, sections, and keys for non-code files", async () => {
    const cases = [
      ["sample.css", "@media screen { .card { color: red; } }", "css", "  sel .card"],
      ["sample.erb", "<% if user %><%= user.name %><% end %>", "embedded-template", "prop output"],
      ["sample.html", "<main id=\"app\"><section class=\"card\"></section></main>", "html", "  elem section.card"],
      ["sample.json", '{"app":{"port":3000}}', "json", "  key port"],
      ["sample.toml", "[app]\nport = 3000", "toml", "  key port"],
      ["sample.vue", "<template><main/></template>", "vue", "  elem main"],
      ["sample.yaml", "app:\n  port: 3000", "yaml", "  key port"],
      ["Counter.razor", "@code { private int count; void Increment() { count++; } }", "razor", "  fn Increment"],
      ["queries/tags.scm", "(function_declaration) @definition.function", "tree-sitter-query", "prop @definition.function"],
      ["sample.regex", "^(?<name>[a-z]+)(?:-(\\d+))?$", "regex", "sec name"],
    ] as const;

    for (const [path, source, language, expected] of cases) {
      const result = await shapeSource(path, source);
      expect(result.language).toBe(language);
      expect(result.parseErrors).toBe(0);
      expect(result.text).toContain(expected);
    }
  });

  test("uses filenames, shebangs, and C++ header evidence for ambiguous paths", async () => {
    expect((await shapeSource("Gemfile", "source 'https://example.test'\ngem 'demo'\n")).language).toBe("ruby");
    expect((await shapeSource("tool", "#!/usr/bin/env python3\ndef run(): pass\n")).language).toBe("python");
    expect((await shapeSource("box.h", "class Box { public: int run(); };\n")).language).toBe("cpp");
    expect((await shapeSource("box.h", "typedef struct Box { int value; } Box;\n")).language).toBe("c");
  });

  test("reports recovered syntax errors and bounds output", async () => {
    const malformed = await shapeSource("broken.py", "def broken(:\n    pass\n");
    expect(malformed.parseErrors).toBeGreaterThan(0);
    expect(malformed.text).toContain("errors=");

    const limited = await shapeSource("many.ts", "function a() {}\nfunction b() {}\nfunction c() {}\n", {
      maxItems: 2,
    });
    expect(limited.shownCount).toBe(2);
    expect(limited.omittedCount).toBe(1);
    expect(limited.text).toContain("[+1 omitted]");
  });

  test("rejects unsupported files and conflicting focus", async () => {
    expect(shapeSource("notes.txt", "hello")).rejects.toThrow("Unsupported source language");
    expect(shapeSource("worker.ts", "function run() {}", { symbol: "run", line: 1 })).rejects.toThrow(
      "either symbol or line",
    );
  });

  test("emits navigation metadata without source declarations or values", async () => {
    const source = `export namespace API {
  export const CONFIG = { retries: 3 };
  export async function run(input: string): Promise<string> { return input; }
}
`;
    const result = await shapeSource("api.ts", source);

    expect(result.text).toBe(
      "api.ts typescript 4L\nmod API [1-4]\n  var CONFIG [2]\n  fn run [3]",
    );
    expect(result.symbols[0]).not.toHaveProperty("signature");
    expect(result.symbols[0]).not.toHaveProperty("startIndex");
    expect(result.symbols[0]?.kind).toBe("mod");
  });

  test("does not duplicate nested symbols with the same name when focused", async () => {
    const result = await shapeSource("nested.js", "function run() { function run() {} }", { symbol: "run" });

    expect(result.definitionCount).toBe(2);
    expect(result.shownCount).toBe(2);
    expect(result.text.match(/fn run/g)).toHaveLength(2);
  });

  test("uses byte ranges for one-line shapes and recovers after syntax errors", async () => {
    const minified = await shapeSource(
      "min.js",
      `class A{m(){return 1}}${" ".repeat(180)}class B{n(){return 2}}`,
    );
    expect(minified.text).toContain("type A [b0-");
    expect(minified.text).toContain("type B [b");

    const broken = await shapeSource("broken.js", "class A{m( { return 1 } function ok(){}");
    expect(broken.parseErrors).toBeGreaterThan(0);
    expect(broken.text).toContain("fn ok");
  });

  test("shapes a folder with recursive standard globs and comma-list globs", async () => {
    const root = mkdtempSync(join(tmpdir(), "code-shape-dir-"));
    roots.push(root);
    mkdirSync(join(root, "nested"));
    mkdirSync(join(root, "node_modules"));
    writeFileSync(join(root, "Root.cs"), "class Root { void Run() {} }\n");
    writeFileSync(join(root, "View.cshtml"), "@code { void Render() {} }\n");
    writeFileSync(join(root, "nested", "Child.cs"), "class Child {}\n");
    writeFileSync(join(root, "node_modules", "Ignored.cs"), "class Ignored {}\n");

    const shallow = await shapeTarget(root, { glob: "*.cs,*.cshtml" }, undefined, "src");
    expect(shallow.text).toContain("src 2 files");
    expect(shallow.text).toContain("Root.cs");
    expect(shallow.text).not.toContain("Child.cs");

    const recursive = await shapeTarget(root, { glob: "**/*.{cs,cshtml}", symbol: "Child" }, undefined, "src");
    expect(recursive.text).toContain("nested/Child.cs");
    expect(recursive.text).not.toContain("Ignored.cs");
    expect(recursive.text).not.toContain("Root.cs csharp");
  });

  test("rejects compressed input without decoding it", async () => {
    const root = mkdtempSync(join(tmpdir(), "code-shape-gzip-"));
    roots.push(root);
    const path = join(root, "bundle.js");
    writeFileSync(path, Buffer.from([0x1f, 0x8b, 0x08, 0x00]));
    expect(shapeTarget(path)).rejects.toThrow("[gzip]");
  });
});
