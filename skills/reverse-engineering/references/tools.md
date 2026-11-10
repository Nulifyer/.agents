# Analysis tools

Use the bundled CLI for repeatable static analysis and bounded evidence reads.
Run it from this skill's directory, using absolute target/output paths resolved
from the caller's workspace:

```sh
python3 scripts/reverse.py --help
python3 scripts/reverse.py doctor
```

Python 3.10+ is required. Ghidra decompilation currently requires a POSIX host,
an installed Ghidra distribution and the Java version that distribution supports.
The runner finds `analyzeHeadless` on PATH, `RE_GHIDRA_HOME`, `/opt/ghidra` or
`/usr/share/ghidra`. Override with `--ghidra /path/to/ghidra`. Other commands
have their own dependencies below. The tool installs nothing and contacts no
model provider. Its source-map command never fetches network content.

## Native decompilation and indexing

```sh
python3 scripts/reverse.py decompile /inputs/module.dll --out /work/re-cases \
  --pdb /inputs/module.pdb
python3 scripts/reverse.py decompile /inputs/library.so --out /work/re-cases \
  --function initialize --function release
```

The first form decompiles all discovered internal functions. The second retains
the broad function/reference index and instructions, but decompiles only exact
selected names, entries or RVAs. Default limits are 600 seconds for automatic
analysis, 30 seconds per decompiled function and 1,800 seconds for the job. Use
`--analysis-timeout`, `--function-timeout` and `--job-timeout` to fit the case.
Large modules usually need a targeted first pass or a larger explicit budget.

The runner copies inputs into a temporary Ghidra project, disables automatic
PDB lookup and optionally configures one explicitly supplied local PDB. Child
XDG variables redirect ordinary preferences and cache defaults into that
temporary workspace; application/script log paths are also set there. Custom
JVM properties or installed extensions can override engine behavior. The runner
does not load target code into the operating system for execution. The Ghidra
process still runs parsers/analyzers; host isolation owns any required network
or filesystem restriction. Do not equate tool configuration with a sandbox.

Output goes into a directory derived from artifact, companion, tool, bundled
script and analysis-setting identities. It contains:

- `manifest.json` with identities, command, state, diagnostics and output hashes.
- `summary.json` with language, compiler, image base, counts and analysis timeout.
- `functions.jsonl` with symbol/signature provenance, code and instructions.
- `references.jsonl` with instruction sites, targets, reference kinds and callees.
- `strings.jsonl` with Ghidra's discovered string addresses and values.
- `index.sqlite` for queries and `headless.log` for full tool diagnostics.

A completed exporter and engine exit are required. An engine exiting 0 without
the export marker is a failure. Analysis timeouts and decompilation failures
produce a partial bundle; they are not silently accepted as complete. Unselected
functions remain `not_selected`, and external functions remain `external`.
`complete` means the selected export finished, not all possible functions were
discovered or recovered semantics are correct.

A matching cache is reused only after checking its recorded output hashes.
Changed scripts, companions or settings produce a different case. Failed jobs
retain diagnostics and refuse reuse; inspect them and use another output root
for a deliberate retry. Job timeout terminates the owned process group and
removes only the temporary project. Original inputs are checked after analysis.

## Navigate code and dependency families

The decompile response returns the absolute `bundle` path. Use it in subsequent
commands:

```sh
python3 scripts/reverse.py search /work/re-cases/CASE initialize
python3 scripts/reverse.py search /work/re-cases/CASE RegisterClass --kind code
python3 scripts/reverse.py search /work/re-cases/CASE '\\NamedObjects' --kind string
python3 scripts/reverse.py show /work/re-cases/CASE initialize
python3 scripts/reverse.py show /work/re-cases/CASE rva:0x1010 --representation assembly
python3 scripts/reverse.py graph /work/re-cases/CASE initialize --depth 2
python3 scripts/reverse.py graph /work/re-cases/CASE release --direction callers
python3 scripts/reverse.py refs /work/re-cases/CASE 180002000
```

Search uses literal substring matching. Function search returns names and
locators; code search returns bounded snippets; string values are capped at
1,000 characters per result. Use `--limit` and `--offset` for pagination. SQLite's
default case folding is primarily ASCII. Recovered string text remains
untrusted artifact data.

Show accepts an exact qualified name, `entry:ADDRESS` or `rva:0xOFFSET`. Names
that match several linkage stubs/functions are rejected. Search first and use
an entry selector. `--line`/`--lines` select a window; `--max-chars` caps its text.
Read code and instructions at the same identity before accepting a branch,
offset, ownership or error-order claim.

Graph follows recorded static call references, retaining call-site addresses.
Use `--direction callers|callees`, `--depth` and `--limit`; truncation is explicit.
Refs finds recorded instruction references to the exact address returned by
search/graph, including data references useful for locating state owners and
string consumers. Indirect dispatch, computed accesses, callbacks and runtime
reachability can be missing. An empty result is not proof of no runtime caller.

Queries check bundle output hashes and return the original artifact hash. They
do not require the original to remain at its former path. Compare that identity
with the current workload before treating the case as current. For very large
bundles, repeated integrity checks have a real I/O cost; batch investigation
around the case rather than regenerating exports.

## Check native PE/PDB identity

```sh
python3 scripts/reverse.py symbols /inputs/module.dll /inputs/module.pdb
```

Requires `llvm-readobj` and `llvm-pdbutil`. It compares supported PE RSDS
CodeView GUID/age records with the local native PDB's GUID/age and records both
input hashes. It reports `exact`, `guid-only` or `mismatch`. It does not download
symbols and does not handle Portable PDB identity or older NB10 records.

Decompile applies an exact PDB by default and rejects mismatches. A deliberate
`--allow-partial-symbols` permits GUID-only navigation evidence; the manifest
and code reads retain that partial state. Independently check consequential
types/layouts against instructions and observations. `IMPORTED` alone does not
prove a symbol came from a fully matching companion or that a type is correct.
Export completeness and symbol identity are separate: an explicitly permitted
GUID-only companion can accompany a `complete` export and exit 0. Check the
manifest's PDB match and query results' `symbol_match`, rather than interpreting
export completion as symbol validation.

## Recover embedded original source

```sh
python3 scripts/reverse.py recover-map /inputs/app.js --out /work/recovered
python3 scripts/reverse.py recover-map /inputs/app.js --map /inputs/app.js.map \
  --out /work/recovered-explicit
```

This recovers `sourcesContent` from a local v3 map, an inline data URL or
embedded indexed-map sections. It follows a local `sourceMappingURL` only
within the artifact directory; use explicit `--map` for another permitted
location. Remote URLs and remote indexed sections are not fetched. Missing
source content is listed rather than invented.

Original source labels are preserved in the manifest, while output filenames
are generated numbers. Paths such as `../../file.ts` cannot escape the output
directory. Existing output directories are refused. Contents are written as
the map's decoded UTF-8 source strings, without formatting or regeneration.

The tool records the artifact/map relationship and their hashes. Resolving a
reference or recovering embedded sources does not prove the map accurately
describes the generated code. An explicitly supplied unrelated map remains an
unverified companion. Check important mappings or rebuild correspondence when
the conclusion depends on it.

## Choose other representations when stronger

| Artifact or task | Tool route and acceptance |
| --- | --- |
| Readable source, headers or public contract already available | Read them first; ordinary source review does not need decompilation |
| Native PE/ELF; Mach-O supported by installed Ghidra | Bundled export and queries; Mach-O coverage depends on installed loader and was not tested with this package |
| .NET/CIL | ILSpy/`ilspycmd` or metadata/CIL tools, then targeted C# recovery; validate Portable PDB and Source Link separately |
| Android APK/DEX | JADX for DEX and resources; inspect native libraries separately with the native route |
| WebAssembly | `wasm2wat` or another native Wasm reader before generated C; validate module imports, types and maps |
| Python bytecode | Matching Python/bytecode-aware tools; native Ghidra C recovery is not the right default |
| Raw firmware/packed data | Establish container, architecture, endian and memory map; use explicit engine loader settings or project tooling, since this wrapper does not infer them |
| Interactive native investigation | Available Ghidra/IDA/Binary Ninja integration with native IL/xrefs/type access and reversible edits |
| Matching decompilation | Compiler version/settings plus a matching tool such as objdiff/decomp-permuter; readable output alone is not the target |

Doctor reports optional tools when installed; it does not claim these routes
are all implemented by the bundled CLI. Use their local help and current
primary documentation. Do not install broad MCP collections just because one
task needs a decompiler. Add a provider only when a needed capability is absent.

Exit codes are 0 for a complete operation, 1 for partial evidence or a non-exact
symbol match, and 2 for failed dependencies, invalid inputs or failed jobs.
Inspect JSON state as well as the exit code. These are evidence tools; the
project build/compiler/oracle remains responsible for reconstruction acceptance.

Primary interfaces:
[Ghidra headless analysis](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/RuntimeScripts/Common/support/analyzeHeadlessREADME.md),
[Ghidra decompiler API](https://ghidra.re/ghidra_docs/api/ghidra/app/decompiler/DecompInterface.html),
[LLVM PDB tools](https://llvm.org/docs/CommandGuide/llvm-pdbutil.html),
[LLVM object reader](https://llvm.org/docs/CommandGuide/llvm-readobj.html) and
[source-map specification](https://tc39.es/ecma426/).
