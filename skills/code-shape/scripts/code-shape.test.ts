import { describe, expect, test } from "bun:test";
import { shapeSource } from "./lib/index.ts";

describe("code shape", () => {
  test("extracts TypeScript signatures, nesting, and one-based ranges", async () => {
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
    expect(result.text).toContain("interface Service<T> [1-4]");
    expect(result.text).toContain("  run(input: T): Promise<T> [3]");
    expect(result.text).toContain("export class Worker [6-12]");
    expect(result.text).toContain("  async execute(value: number): Promise<number> [9-11]");
    expect(result.text).toContain("export const double = (value: number): number => [14]");
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
    expect(symbol.text).toContain("execute(value: number) [2-4]");
    expect(symbol.text).not.toContain("stop()");

    const line = await shapeSource("worker.ts", source, { line: 3 });
    expect(line.focus).toBe("Worker > execute");
    expect(line.text).toContain("execute(value: number) [2-4]");
    expect(line.text).not.toContain("class Worker");
  });

  test("supports the initial language set", async () => {
    const cases = [
      ["sample.js", "export function run(x) { return x; }", "function run(x) [1]"],
      ["sample.jsx", "export const Card = () => <div />;", "export const Card = () => [1]"],
      ["sample.tsx", "export function Card(): JSX.Element { return <div />; }", "function Card(): JSX.Element [1]"],
      ["sample.py", "class Box:\n    def get(self):\n        return 1\n", "class Box: [1-3]"],
      ["sample.rs", "impl Box { fn get(&self) -> i32 { 1 } }", "impl Box [1]"],
      [
        "sample.go",
        "package p\ntype Runner interface { Run(x int) int }\nfunc Run(x int) int { return x }\n",
        "  Run(x int) int [2]",
      ],
      ["sample.kt", "class Box { fun get(): Int { return 1 } }", "class Box [1]"],
      ["sample.sh", "run() { echo ok; }\n", "run() [1]"],
    ] as const;

    for (const [path, source, expected] of cases) {
      const result = await shapeSource(path, source);
      expect(result.text).toContain(expected);
    }
  });

  test("extracts useful shapes for compiled and systems languages", async () => {
    const cases = [
      ["sample.c", "typedef struct Box { int value; } Box;\nint run(Box *box) { return box->value; }", "c", "int run(Box *box)"],
      ["sample.cpp", "namespace app { class Box { int run() { return 1; } }; }", "cpp", "  class Box"],
      ["sample.cs", "namespace App; class Box { int Run() { return 1; } }", "csharp", "  class Box"],
      ["Sample.java", "package app; class Box { int run() { return 1; } }", "java", "  int run()"],
      ["sample.m", "@interface Box : NSObject\n- (int)run;\n@end", "objective-c", "  - (int)run"],
      ["sample.sol", "contract Box { function run() public returns (uint) { return 1; } }", "solidity", "  function run()"],
      ["sample.swift", "struct Box { func run() -> Int { 1 } }", "swift", "  func run() -> Int"],
      ["sample.zig", "const Box = struct { pub fn run() void {} };", "zig", "  pub fn run() void"],
      ["sample.rdl", "addrmap top { };", "systemrdl", "addrmap top"],
      ["sample.sv", "module counter; function int run(); run = 1; endfunction endmodule", "systemverilog", "  function int run()"],
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
      ["sample.dart", "class Box { int run(int x) => x; }", "dart", "  int run(int x)"],
      ["sample.el", "(defun run (x) x)", "elisp", "(defun run (x)"],
      ["sample.hs", "module App where\nrun :: Int -> Int\nrun x = x\n", "haskell", "run :: Int -> Int"],
      ["sample.jl", "module App\nfunction run(x)\n x\nend\nend", "julia", "  function run(x)"],
      ["sample.lua", "local function run(x) return x end", "lua", "local function run(x)"],
      ["sample.ml", "module App = struct let run x = x end", "ocaml", "  let run x"],
      ["sample.php", "<?php class Box { function run($x) { return $x; } }", "php", "  function run($x)"],
      ["sample.res", "module Box = { let run = x => x }", "rescript", "  run ="],
      ["sample.rb", "class Box\n def run(x) = x\nend", "ruby", "  def run(x)"],
      ["sample.scala", "class Box { def run(x: Int): Int = x }", "scala", "  def run(x: Int): Int ="],
      ["sample.tla", "---- MODULE Counter ----\nInit == TRUE\n====", "tlaplus", "  Init == TRUE"],
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
      ["sample.css", "@media screen { .card { color: red; } }", "css", "  .card"],
      ["sample.erb", "<% if user %><%= user.name %><% end %>", "embedded-template", "<%= user.name %>"],
      ["sample.html", "<main id=\"app\"><section class=\"card\"></section></main>", "html", "  <section class=\"card\">"],
      ["sample.json", '{"app":{"port":3000}}', "json", '  "port":3000'],
      ["sample.toml", "[app]\nport = 3000", "toml", "  port = 3000"],
      ["sample.vue", "<template><main/></template>", "vue", "  <main/>"],
      ["sample.yaml", "app:\n  port: 3000", "yaml", "  port: 3000"],
      ["Counter.razor", "@code { private int count; void Increment() { count++; } }", "razor", "  void Increment()"],
      ["queries/tags.scm", "(function_declaration) @definition.function", "tree-sitter-query", "@definition.function"],
      ["sample.regex", "^(?<name>[a-z]+)(?:-(\\d+))?$", "regex", "(?<name>[a-z]+)"],
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
    expect(malformed.text).toContain("recovered errors");

    const limited = await shapeSource("many.ts", "function a() {}\nfunction b() {}\nfunction c() {}\n", {
      maxItems: 2,
    });
    expect(limited.shownCount).toBe(2);
    expect(limited.omittedCount).toBe(1);
    expect(limited.text).toContain("1 definitions omitted");
  });

  test("rejects unsupported files and conflicting focus", async () => {
    expect(shapeSource("notes.txt", "hello")).rejects.toThrow("Unsupported source language");
    expect(shapeSource("worker.ts", "function run() {}", { symbol: "run", line: 1 })).rejects.toThrow(
      "either symbol or line",
    );
  });
});
