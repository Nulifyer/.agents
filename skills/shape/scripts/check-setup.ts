// Verify packaged WASM assets with the same loader and queries used by shape.
const failures: string[] = [];

if (!Bun.which("rg")) failures.push("ripgrep (rg) is missing. Install it with your system package manager.");

try {
  const { LANGUAGE_SPECS, loadShapeLanguage } = await import("./adapters/code/lib/languages.ts");
  const { Parser, Query } = await import("web-tree-sitter");
  for (const spec of LANGUAGE_SPECS) {
    try {
      const language = await loadShapeLanguage(spec);
      const parser = new Parser();
      try {
        parser.setLanguage(language);
        const tree = parser.parse("");
        if (!tree) throw new Error("Parser returned no tree");
        try {
          const query = new Query(language, spec.query);
          try {
            query.captures(tree.rootNode);
          } finally {
            query.delete();
          }
        } finally {
          tree.delete();
        }
      } finally {
        parser.delete();
      }
    } catch (error) {
      failures.push(`${spec.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length === 0) {
    console.log(`Shape setup verified: ripgrep, Tree-sitter runtime, and ${LANGUAGE_SPECS.length} language grammars.`);
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

if (failures.length > 0) {
  console.error(`Shape setup failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  console.error("From the shape skill directory, run `bun run setup` to install dependencies and check again.");
  process.exitCode = 1;
}
