# Binary adapters

```bash
bun scripts/shape.ts <artifact> --as binary [--access metadata] [--names show|hash|omit] [--source show|hash|omit] [-o <chars>] [-j]
bun scripts/shape.ts <artifact> --adapter <pe|coff|elf|archive|wasm> [options]
```

Automatic routing uses magic bytes before extensions. Current adapters:

| Adapter | Artifacts | Shape |
|---|---|---|
| `pe` | Windows EXE, DLL, SYS, EFI, OCX, CPL; managed .NET assemblies | machine and image markers, including .NET native-OS machine overrides, sections, imported DLL names, export marker/counts, CLR runtime and metadata streams |
| `coff` | Windows `.obj`, including extensionless objects | machine and section map with string-table section names |
| `elf` | Linux executables, shared objects, kernel modules, object and core headers | class, byte order, PIE/shared image distinction, machine, and sections |
| `archive` | Unix `.a` and Windows `.lib` archives | ordinary, symbol-table, and long-table member names, byte sizes, and locators |
| `wasm` | WebAssembly modules | section map and custom-section names |

All current binary results report `access=metadata`. Metadata can still contain protected identifiers such as DLL, section, stream, and member names; use `--names hash|omit` when needed. Numeric structural traits such as byte and symbol counts remain visible in those modes.

Debug databases, crash dumps, package containers, symbol tables, individual PE imports/exports, ELF dynamic dependencies, and full .NET type/member tables remain separate planned adapters. See [binary-artifacts.md](binary-artifacts.md).
