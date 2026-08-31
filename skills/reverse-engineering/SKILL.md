---
name: reverse-engineering
description: Use when source, interfaces, data formats, state changes, or behavior must be inferred from compiled, minified, packaged, dumped, or observed artifacts. Do not use for ordinary source review, simple conversion, or metadata-only structure inspection.
compatibility: Static analysis tools vary by artifact; runtime execution and observation require a separate authorized workflow.
---

# Reverse engineering

Answer a bounded question from the strongest available artifact evidence.
Decompilation is one technique, not the goal.

## Set the question and stop condition

State what must be learned, which artifact and version are in scope, what
evidence would answer the question, and what uncertainty may remain. Hash the
artifact and preserve its original bytes before analysis.

Use `shape` first to identify format, container layers, names, sections,
metadata, imports, exports, symbols, and likely inspection points. Stop there
when structure alone answers the request.

## Prefer stronger representations

Use evidence in this order:

1. matching source, schemas, headers, manifests, type libraries, and public
   specifications;
2. validated debug information, source maps, symbol records, and embedded
   metadata;
3. targeted imports, exports, references, strings, relocations, types, and
   control-flow evidence;
4. format-native instructions or intermediate representation;
5. targeted decompilation of selected functions;
6. assembly, bytes, or a controlled comparison to settle an uncertain claim.

Read [evidence order](references/evidence-order.md) when choosing among debug,
decompiler, and lower-level representations. Validate companion identity before
using it. A plausible filename or nearby build is not a match.

## Build a bounded case

Keep analysis output outside the original artifact. Record the artifact hash,
architecture and base assumptions, tool versions, companion hashes and match
state, representations used, warnings, failures, and whether network access or
execution occurred.

Index broadly enough to navigate, then read narrowly. Rank functions, types,
calls, fields, changed regions, or resources against the question. Materialize
large source-like or decompiler output only for selected targets. Do not place a
whole-program pseudo-source export into model context.

Use [the case record](references/case-record.md) when no project format exists.

## Make claims with locators

Each finding must distinguish:

- `declared`: specification, symbol, schema, debug record, or explicit type;
- `observed`: instruction, import, relocation, reference, memory access, or
  captured event;
- `derived`: control flow, data flow, field offset, call relation, or branch;
- `inferred`: suggested role, name, type, ownership rule, or algorithm;
- `verified`: confirmed by another representation, comparison, test, or
  controlled runtime observation.

Attach an address, function, section, file, source, event, or other stable
locator. Mark whether the finding is complete for the artifact, one function,
one path, or only the selected evidence. Keep model-generated names and
annotations separate from declared symbols.

## Validate and stop

Check consequential conclusions against a lower-level representation, a
version comparison, a black-box fixture, or an authorized `oracle-lab`
experiment. Static analysis alone does not prove runtime parity.

The default workflow is static and read-only. Do not execute, load, emulate,
unpack, attach a debugger, contact a symbol server, or use network lookups
without authority for that action. State missing architecture, packing,
symbols, paths, or tool support as incomplete evidence rather than filling the
gap with a guess.

Return the smallest evidence-backed answer that settles the question, then
stop. Include the artifact identity, finding, locator, provenance, completeness
limit, and the next observation only when the question remains open.
