# Reverse-engineering case record

```markdown
# <case name>

## Question
- Outcome: analysis / source recovery / matching / patching / rebuild
- Artifact:
- SHA-256:
- Version/build:
- Question:
- Stop condition:

## Assumptions
- Format and architecture:
- Image base or address model:
- Packing or container layers:

## Companions
| Artifact | Hash | Identity check | Match state |
| --- | --- | --- | --- |

## Tools and access
| Tool | Version | Operation | Network | Execution |
| --- | --- | --- | --- | --- |
- Analysis settings, export completeness and failed targets:
- Runtime/container/provider selection:
- Time, retry and storage budget:

## Findings
| Target | Claim | Evidence locator | Provenance | Completeness |
| --- | --- | --- | --- | --- |

## Annotations
| Target | Proposed name/type/role | Reason | Confidence limit |
| --- | --- | --- | --- |

## Unknowns
- <missing evidence and what would settle it>

## Rebuild acceptance (when applicable)
- Contract and state owner:
- Asset/configuration/provider inventory:
- Build receipt and runtime identities:
- Reference, candidate, fixture and comparator identities:
- Passed / failed / unknown / total, with the counting unit:
- Lost events, normalization and complete-run check:
- Protected inputs before and after:
- Actual consumer replay and unsupported partitions:
- Next action:
```

## Optional case utility

Run `python3 scripts/case.py --help` from this skill's directory. It uses only
the Python standard library, reads tracked files, and writes only the specified
case JSON. It does not execute artifacts, fetch symbols or install tools.
Create the output directory first. Use an existing project record/tool when it
already supplies these checks.

```sh
python3 scripts/case.py init /work/case.json /inputs/component.dll \
  --mode rebuild --question 'Which lower contract blocks initialization?' \
  --scope 'Pinned x64 startup caller' --stop 'Identify and validate one owner'
python3 scripts/case.py track /work/case.json /work/listing.txt \
  --id listing --role trace --origin 'Tool version and settings recorded in case'
python3 scripts/case.py check /work/case.json
```

`track` refuses duplicate IDs or a case whose existing inputs changed. Preserve
the old record and create a new case for a new baseline. Paths written by the
utility are absolute; a manually maintained relative path resolves against the
case directory. Hash large inputs once, then recheck before and after costly
work when identity matters. These reads can be expensive for large corpora.

Edit findings in JSON with this shape:

```json
{
  "id": "initialization-call",
  "claim": "The selected caller requests the callback table",
  "provenance": "derived",
  "scope": "One pinned call path",
  "locators": [{"input": "listing", "location": "RVA 0x1234"}]
}
```

A `verified` finding also needs `verification_inputs`, a nonempty list of
tracked input IDs. Record companion GUID/age or equivalent fields, match state
and independent checks in the findings; hashing a PDB does not validate its
relationship to a DLL.

For a rebuild, track the fixture, reference result, candidate result, actual
build receipt and comparator under their corresponding roles. Add:

```json
{
  "validation": {
    "scope": "Named fixture/input partition; records are the counting unit",
    "fixture": "fixture",
    "reference": "reference",
    "candidate": "candidate",
    "build": "build",
    "comparator": "comparator",
    "complete": true,
    "exit_code": 0,
    "counts": {"total": 20, "passed": 20, "failed": 0, "unknown": 0}
  }
}
```

`check --rebuild` rejects missing identities, wrong evidence roles, incomplete
validation and inconsistent/failing counts. Exit codes: 0 for a successful
operation/check, 1 for failed checks, 2 for command or record errors.

The utility validates bytes and bookkeeping. It does **not** inspect receipt
semantics, run the comparator, establish symbol matching, measure trace loss,
prove behavioral parity or enforce clean-room independence. Inspect the actual
evidence and run the project's comparator before recording acceptance.
