# Deepening

Use this reference when consolidating a cluster of shallow modules. Apply the ownership and extraction decisions in [SKILL.md](SKILL.md) first. Dependency type guides verification, not whether modules must be merged or abstract interfaces introduced.

## Dependency categories

Classify dependencies to choose how to exercise the deepened module's interface. Keep transport and test setup out of the caller contract unless callers need to control them.

### 1. In-process

For pure computation or in-memory state, test through the resulting interface directly. Merge only when it reduces caller knowledge or concentrates related invariants. Being in-process does not itself justify consolidation or an adapter.

### 2. Local-substitutable

For dependencies with local stand-ins, exercise the module with the stand-in where its behaviour is representative. Check fidelity for relevant semantics, such as transactions, concurrency, paths, and errors. Use the real dependency for guarantees the stand-in cannot establish. A missing stand-in does not itself justify another abstraction or prevent deepening.

### 3. Remote but owned

For an owned remote system, keep protocol and exchange failures in a focused integration module. Use a concrete client unless an abstract interface has a useful contract or substitution need. When tests need controlled remote outcomes, a test adapter or controlled server may provide them.

Verify serialization, failure handling, cancellation, and retry behaviour through the actual transport where relevant. An in-memory adapter does not prove those guarantees.

### 4. Third-party external

For third-party systems, use existing client-library capabilities before adding a wrapper or custom protocol machinery. A focused integration module earns its place by owning meaningful behaviour, even with one provider. Use controlled responses, a library-supported test seam, or an adapter as needed. Mocked exchanges establish local behaviour, not compatibility with the live provider.

## Seam discipline

- Separate the decision to extract behaviour from the decision to introduce an abstract interface. Apply the criteria in [SKILL.md](SKILL.md), without counting adapters as a proxy for usefulness.
- Keep internal seams private unless callers have a concrete need for them. Tests using a seam do not automatically make it part of the module's external interface.

## Preserve coverage while replacing tests

- Map existing tests to required behaviour before removing or rewriting them. Retire obsolete implementation-coupled tests only after the new checks preserve their relevant coverage. Keep focused tests that still protect distinct invariants or failure cases.
- Test observable outcomes through the resulting interface. Prefer checks that survive internal refactors. Keep internal checks when they add useful evidence that interface-level tests cannot provide economically.
- Check the whole relevant failure outcome, including truthful caller feedback, retained data, cleanup, and required retry behaviour. Preserve rejection guarantees across decoding, parsing, and persistence.
- Match verification to changed behaviour and risk. Report stand-in, mocked, and live-integration coverage accurately. Do not claim remote compatibility from local success.
