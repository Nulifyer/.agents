# Evidence order

Choose the richest representation whose identity is established.

| Artifact | Prefer | Fall back to |
| --- | --- | --- |
| JavaScript or CSS bundle | recovered source and validated source map | generated source, then bounded beautified code |
| Native PE, ELF, or Mach-O | matching debug information and typed control flow | instructions, targeted decompilation, assembly |
| .NET assembly | CLR metadata, CIL, Portable PDB, Source Link | targeted decompilation |
| Android APK or DEX | manifest, resources, DEX metadata, mapping file | targeted JADX output |
| WebAssembly | source map and Wasm instructions | WAT, then generated C only when it helps |
| Raw firmware or binary | container and memory map | native analysis after architecture, byte order, and base are known |

Validate a companion with its format's identity fields, not its filename. For
example, verify a PDB signature and age, a build ID, a UUID, a source-map
reference and content, or a module hash as applicable. Record partial or
heuristic matches as weaker evidence.

Decompiler output is derived. Use it to understand selected control flow, then
check important conditions, calls, offsets, and memory effects against the
native instructions or another independent representation.
