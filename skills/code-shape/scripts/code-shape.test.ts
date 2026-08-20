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
      ["sample.sh", "version=1\nrun() { echo ok; }\n", "var version [1]"],
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
      ["queries/tags.scm", "(function_declaration) @definition.function", "tree-sitter-query", "sec @definition.function"],
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
      "only one of symbol, line, or match",
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

  test("keeps audited language shapes compact and named", async () => {
    const bash = await shapeSource("sample.sh", "version=1\nrun() { echo ok; }\n");
    expect(bash.text).toContain("var version [1]");
    expect(bash.text).toContain("fn run [2]");

    const haskell = await shapeSource(
      "sample.hs",
      "module Demo where\nrun :: Int -> Int\nrun 0 = 0\nrun x = x\n",
    );
    expect(haskell.text).toContain("mod Demo [1]");
    expect(haskell.text.match(/fn run/g)).toHaveLength(1);

    const toml = await shapeSource("Cargo.toml", "[package]\nname = 'demo'\n[dependencies.clap]\nversion = '4'\n");
    expect(toml.text).toContain("sec package [1-2]");
    expect(toml.text).toContain("sec dependencies.clap [3-4]");

    const query = await shapeSource("queries/highlights.scm", "[(class) (struct)] @type\n(function) @function\n");
    expect(query.text).toContain("sec @type [1]");
    expect(query.text).toContain("sec @function [2]");

    const razor = await shapeSource("Index.cshtml", "@section hero { <main id=\"app\"><h1>Hi</h1></main> }");
    expect(razor.text).toContain("sec hero");
    expect(razor.text).toContain("elem main#app");
  });

  test("accepts stdin with a virtual filename", async () => {
    const proc = Bun.spawn(
      [process.execPath, join(import.meta.dir, "code-shape.ts"), "-", "remote.ts"],
      { stdin: Buffer.from("export function remote() {}\n"), stdout: "pipe", stderr: "pipe" },
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("remote.ts typescript 1L\nfn remote [1]");

    const matched = Bun.spawn(
      [process.execPath, join(import.meta.dir, "code-shape.ts"), "-", "remote.ts", "--match", "needle|other"],
      {
        stdin: Buffer.from('export function remote() { return "needle"; }\n'),
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [matchExitCode, matchStdout, matchStderr] = await Promise.all([
      matched.exited,
      new Response(matched.stdout).text(),
      new Response(matched.stderr).text(),
    ]);
    expect(matchExitCode).toBe(0);
    expect(matchStderr).toBe("");
    expect(matchStdout).toContain("remote.ts\n  fn remote [1]");
    expect(matchStdout).not.toContain("needle");
  });

  test("maps case-insensitive regex alternatives to owning symbols without source", async () => {
    const source = `class Cards {
  render(card: Card) {
    button.textContent = "Add to Deck";
    log("ADD TO DECK");
  }
}
`;
    const result = await shapeSource("cards.ts", source, {
      match: "add\\s+to\\s+deck|addToDeck",
      params: true,
    });

    expect(result.focus).toBe("match");
    expect(result.matchCount).toBe(1);
    expect(result.shownCount).toBe(1);
    expect(result.text).toBe("cards.ts\n  type Cards [1-6]\n    fn render(card) [2-5] @3");
    expect(result.text).not.toContain("Add to Deck");
    expect(result.symbols).toEqual([]);
    expect(result.matches?.[0]).toMatchObject({
      path: "cards.ts",
      line: 3,
      kind: "fn",
      name: "Cards.render",
      startLine: 2,
      endLine: 5,
      parameters: ["card"],
    });
  });

  test("returns file locations when regex matches have no enclosing symbol", async () => {
    const result = await shapeSource("cards.js", "// Add to Deck\n", { match: "add.*deck" });
    expect(result.text).toBe("cards.js\n  file @1");
    expect(result.matches?.[0]).toEqual({ path: "cards.js", line: 1, kind: "file" });

    expect((await shapeSource("cards.js", "function render() {}", { match: "missing" })).text).toBe("[no match]");
  });

  test("handles Unicode offsets and rejects invalid or conflicting match focus", async () => {
    const unicode = await shapeSource(
      "cards.js",
      'const café = "x"; function render() { return "Add to Deck"; }',
      { match: "add to deck" },
    );
    expect(unicode.text).toContain("fn render [1]");

    expect(shapeSource("cards.js", "function render() {}", { match: "(" })).rejects.toThrow(
      "Invalid --match regex: unclosed group",
    );
    expect(
      shapeSource("cards.js", "function render() {}", { match: "render", symbol: "render" }),
    ).rejects.toThrow("only one of symbol, line, or match");
  });

  test("bounds regex owners and scans a folder with one expression", async () => {
    const source = Array.from(
      { length: 14 },
      (_, index) => `function job${index}() { return "needle ${index}"; }`,
    ).join("\n");
    const bounded = await shapeSource("jobs.js", source, { match: "needle" });
    expect(bounded.shownCount).toBe(12);
    expect(bounded.matchCount).toBe(14);
    expect(bounded.omittedMatchCount).toBe(2);
    expect(bounded.text).toContain("  fn job11 [12]");
    expect(bounded.text).toContain("[+2 owners]");
    expect(bounded.text).not.toContain("job12");

    const root = mkdtempSync(join(tmpdir(), "code-shape-match-dir-"));
    roots.push(root);
    writeFileSync(join(root, "cards.ts"), '/** Draws cards. */\nfunction render(card: Card) { return "Add to Deck"; }\n');
    writeFileSync(join(root, "deck.js"), "function addToDeck(card) { return card; }\n");
    writeFileSync(join(root, "ignored.css"), ".add-to-deck {}\n");

    const matched = await shapeTarget(
      root,
      { glob: "*.{js,ts}", match: "add\\s+to\\s+deck|addToDeck", docs: true, params: true },
      undefined,
      "src",
    );
    expect(matched.shownCount).toBe(2);
    expect(matched.text).toContain("cards.ts\n  fn render(card) [2] | Draws cards.");
    expect(matched.text).toContain("deck.js\n  fn addToDeck(card) [1]");
    expect(matched.text).not.toContain("ignored.css");
    expect(matched.text).not.toContain("return card");

    const empty = mkdtempSync(join(tmpdir(), "code-shape-empty-match-dir-"));
    roots.push(empty);
    expect(shapeTarget(empty, { match: "(" })).rejects.toThrow("Invalid --match regex: unclosed group");
  });

  test("ranks matched files and symbol branches while preserving nesting", async () => {
    const source = `function weak() { return "shape"; }
class Permissions {
  generic() { return "shape"; }
  exact() { return "read path gates"; }
}
`;
    const ranked = await shapeSource("ranked.ts", source, { match: "read path gates|shape" });
    expect(ranked.text).toBe(
      "ranked.ts\n" +
        "  type Permissions [2-5]\n" +
        "    fn exact [4]\n" +
        "    fn generic [3]\n" +
        "  fn weak [1]",
    );

    const root = mkdtempSync(join(tmpdir(), "code-shape-ranked-dir-"));
    roots.push(root);
    writeFileSync(
      join(root, "a-generic.ts"),
      Array.from({ length: 12 }, (_, index) => `function generic${index}() { return "shape"; }`).join("\n"),
    );
    writeFileSync(join(root, "z-exact.ts"), 'function exact() { return "read path gates"; }\n');

    const directory = await shapeTarget(root, { glob: "*.ts", match: "read path gates|shape" }, undefined, "src");
    expect(directory.text.startsWith("z-exact.ts\n  fn exact [1]\n")).toBe(true);
    expect(directory.text).toContain("a-generic.ts");
    expect(directory.text).toContain("[+1 owners]");
    expect(directory.text).not.toContain("generic11");
  });

  test("includes normalized parameter names only when requested", async () => {
    const source = "function run(input: string, options = {}, ...rest: unknown[]) {}\n";
    const plain = await shapeSource("worker.ts", source);
    expect(plain.text).toContain("fn run [1]");
    expect(plain.text).not.toContain("input");

    const detailed = await shapeSource("worker.ts", source, { params: true });
    expect(detailed.text).toContain("fn run(input,options,...rest) [1]");
    expect(detailed.text).not.toContain("string");
    expect(detailed.text).not.toContain("unknown");
    expect(detailed.text).not.toContain("= {}");
    expect(detailed.symbols[0]?.parameters).toEqual(["input", "options", "...rest"]);

    const patterns = await shapeSource("worker.js", "const run = ({ id }, { name }, [first]) => first", {
      params: true,
    });
    expect(patterns.text).toContain("fn run({},{},[]) [1]");
  });

  test("extracts parameter names across supported language families", async () => {
    const cases = [
      ["worker.py", "def run(self, value: str, *args, **kwargs): pass", "fn run(self,value,...args,...kwargs)"],
      ["worker.rs", "fn run(&self, value: i32, mut other: String) {}", "fn run(self,value,other)"],
      ["worker.go", "func Run(ctx context.Context, values ...string) {}", "fn Run(ctx,...values)"],
      ["worker.cpp", "int run(const char *name, int count = 1) { return 0; }", "fn run(name,count)"],
      ["Worker.cs", "class Worker { void Run(string name, int count = 1) {} }", "fn Run(name,count)"],
      ["Worker.java", "class Worker { void run(String name, int... values) {} }", "fn run(name,...values)"],
      ["worker.rb", "def run(name, count = 1, *rest); end", "fn run(name,count,...rest)"],
      ["worker.lua", "function run(name, count, ...) end", "fn run(name,count,...)"] ,
      ["worker.hs", "run name count = name", "fn run(name,count)"],
      ["worker.jl", "function run(name::String, count=1; flag=true) end", "fn run(name,count,flag)"],
      ["worker.php", "<?php function run(string $name, int $count = 1) {}", "fn run(name,count)"],
      ["worker.kt", "fun run(name: String, count: Int = 1) {}", "fn run(name,count)"],
      ["worker.scala", "def run(name: String, count: Int = 1) = name", "fn run(name,count)"],
      ["Worker.sol", "function run(address owner, uint256 amount) public {}", "fn run(owner,amount)"],
      ["worker.swift", "func run(_ name: String, count: Int = 1) {}", "fn run(name,count)"],
      ["worker.dart", "void run(String name, [int count = 1]) {}", "fn run(name,count)"],
      ["worker.zig", "fn run(name: []const u8, count: usize) void {}", "fn run(name,count)"],
      ["worker.el", "(defun run (name &optional count &rest rest) name)", "fn run(name,count,...rest)"],
      ["worker.ml", "let run name ?(count = 1) ~flag = name", "fn run(name,count,flag)"],
      [
        "Worker.m",
        "@interface Worker : NSObject\n- (void)runWithName:(NSString *)name count:(NSInteger)count;\n@end",
        "fn runWithName(name,count)",
      ],
      ["worker.sv", "function int run(input int value, string name); endfunction", "fn run(value,name)"],
      ["Worker.tla", "---- MODULE Worker ----\nRun(name, count) == name\n====", "fn Run(name,count)"],
    ] as const;

    for (const [path, source, expected] of cases) {
      expect((await shapeSource(path, source, { params: true })).text).toContain(expected);
    }
  });

  test("bounds parameter names and folder usage", async () => {
    const names = Array.from({ length: 15 }, (_, index) => `arg${index}`).join(", ");
    const result = await shapeSource("worker.js", `function run(${names}) {}`, { params: true });
    expect(result.text).toContain("arg11,+3)");
    expect(result.text).not.toContain("arg12");
    expect(result.symbols[0]?.omittedParameterCount).toBe(3);

    const root = mkdtempSync(join(tmpdir(), "code-shape-params-dir-"));
    roots.push(root);
    writeFileSync(join(root, "worker.ts"), "function run(input: string) {}\n");
    expect(shapeTarget(root, { params: true })).rejects.toThrow("requires an exact symbol");
    const focused = await shapeTarget(root, { params: true, symbol: "run" }, undefined, "src");
    expect(focused.text).toContain("fn run(input) [1]");
  });

  test("includes normalized documentation summaries only when requested", async () => {
    const typescript = `/** Runs queued work.
 * Extra detail.
 * @internal ignored
 */
export class Worker {
  /** Runs one job.
   * @param input ignored
   */
  run(input: string) {}
}
`;
    const plain = await shapeSource("worker.ts", typescript);
    expect(plain.text).not.toContain("Runs queued work");

    const documented = await shapeSource("worker.ts", typescript, { docs: true });
    expect(documented.text).toContain("type Worker [5-10] | Runs queued work. Extra detail.");
    expect(documented.text).toContain("fn run [9] | Runs one job.");
    expect(documented.text).not.toContain("@param");
    expect(documented.symbols[0]?.doc).toBe("Runs queued work. Extra detail.");

    const python = await shapeSource(
      "box.py",
      `class Box:\n    """Stores values.\n\n    Internal detail.\n    """\n    pass\n`,
      { docs: true },
    );
    expect(python.text).toContain("type Box [1-6] | Stores values.");

    const csharp = await shapeSource(
      "Worker.cs",
      "/// <summary>Runs C# work.</summary>\nclass Worker {}\n",
      { docs: true },
    );
    expect(csharp.text).toContain("type Worker [2] | Runs C# work.");

    const cases = [
      ["worker.go", "// Run starts work.\nfunc Run() {}\n", "fn Run [2] | Run starts work."],
      ["worker.rs", "/// Starts Rust work.\nfn run() {}\n", "fn run [2] | Starts Rust work."],
      ["worker.hs", "-- | Starts Haskell work.\nrun x = x\n", "fn run [2] | Starts Haskell work."],
      ["worker.lua", "--- Starts Lua work.\nfunction run() end\n", "fn run [2] | Starts Lua work."],
      ["worker.rb", "# Starts Ruby work.\ndef run; end\n", "fn run [2] | Starts Ruby work."],
      ["worker.el", "(defun run () \"Starts Elisp work.\" nil)\n", "fn run [1] | Starts Elisp work."],
      ["Worker.sol", "/** @dev Starts Solidity work. */\ncontract Worker {}\n", "type Worker [2] | Starts Solidity work."],
    ] as const;
    for (const [path, source, expected] of cases) {
      expect((await shapeSource(path, source, { docs: true })).text).toContain(expected);
    }
  });

  test("bounds documentation output and folder usage", async () => {
    const source = Array.from({ length: 42 }, (_, index) => `/** Job ${index}. */\nfunction job${index}() {}`).join("\n");
    const result = await shapeSource("jobs.js", source, { docs: true });
    expect(result.docCount).toBe(40);
    expect(result.omittedDocCount).toBe(2);
    expect(result.text).toContain("[+2 docs omitted]");

    const root = mkdtempSync(join(tmpdir(), "code-shape-docs-dir-"));
    roots.push(root);
    writeFileSync(join(root, "worker.ts"), "/** Worker. */\nclass Worker {}\n");
    expect(shapeTarget(root, { docs: true })).rejects.toThrow("requires an exact symbol");
    const focused = await shapeTarget(root, { docs: true, symbol: "Worker" }, undefined, "src");
    expect(focused.text).toContain("type Worker [2] | Worker.");
  });
});
