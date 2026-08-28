# Binary and artifact roadmap

Treat the artifact family as internal adapters, not additional model-facing skills.

| Platform | Common artifacts | Intended adapter |
|---|---|---|
| Windows | PE `.exe`, `.dll`, `.sys`, `.efi`, `.ocx`, `.cpl`, `.scr`, extensionless images | `pe` |
| Windows | COFF `.obj`, static/import `.lib` | `coff`, `archive` |
| Windows/.NET | managed PE assemblies, `.winmd`, mixed-mode images | `dotnet` layered after `pe` |
| Windows | PDB, portable PDB, embedded portable PDB | `pdb` / `portable-pdb` |
| Windows | minidump and full dump `.dmp`, `.mdmp` | `minidump` |
| Windows | NuGet `.nupkg`, AppX/MSIX, symbols packages | package/container adapters |
| Linux | extensionless ELF executables, `.so`, versioned `.so.*`, `.o`, `.ko`, core files | `elf` |
| Linux | static archives `.a` | `archive` |
| Linux | split debug `.debug`, build-id files, DWARF sections | `dwarf` layered after `elf` |
| Linux | Debian `.deb`, RPM, Alpine `.apk`, Arch packages | package/container adapters |
| Cross-platform | WebAssembly `.wasm`, LLVM bitcode, Java `.jar`/`.war`, ZIP/TAR containers, OCI image layouts | `wasm`, `llvm-bitcode`, package/container adapters |

Probe container first, then layer adapters. For example, a managed DLL is PE → CLR metadata → .NET declarations; a Debian package is ar → control/data members → compressed tar metadata. Routing should report every layer it used.

Next priority:

1. Full .NET metadata type/member/interface/resource shape.
2. PE import/export symbol names and delay imports.
3. ELF dynamic dependencies, symbol tables, notes, and build IDs.
4. PDB/portable-PDB and DWARF debug shape.
5. Minidump/core-dump module and thread metadata.
6. Package/container manifests and member maps.

Keep probes bounded and deterministic. A probe may read only documented header regions needed to identify a format. It must not silently decompress, execute, load, or perform network symbol resolution.
