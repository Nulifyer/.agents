# Rebuilding artifact-defined behavior

Use this branch for a compatibility layer, emulator, port, replacement library
or program reconstructed from artifacts. Define the supported product outcome
and application boundary first. Source-informed work is the default.

## Establish the environment before explaining the failure

Record the artifact version, ABI, architecture and provider selection. Inventory
assets, fonts, resources, locale files, registrations, configuration and services
that the consumer requires. Distinguish an absent dependency or wrong provider
from an implementation defect. A rendering failure can be missing data; a loaded
DLL can still lack the required interface.

Use the project's public build and test entrypoints. Before testing, verify the
actual source/configuration/toolchain inputs, compiled outputs, runtime copies
and selected providers. Include dirty source content where relevant; a Git HEAD
alone does not identify a local build. Do not manually copy one rebuilt binary
into a runtime that also contains coupled stale outputs. After execution, check
the same identities and protected reference files.

## Choose the smallest justified implementation

Draw the reached dependency and ownership map. Separate public entry points,
shared state, implementation references and host mechanisms. Identify where
validation, lifetime, authority, concurrency and cleanup belong.

Prefer an existing owner and host facility when they preserve the observed
contract. Do not create a second scheduler, handle table, source checkout,
patch distribution or build system merely to get past one caller.

When the goal is to retain original providers, record why each replacement is
needed. A failure in a mixed original/replacement pairing does not establish
that the original provider must be replaced. Inspect private coupling and test
the appropriate original pair before expanding the replacement surface.

Group a batch around one contract and its lifecycle: adjacent operations,
initialization, state transitions, cancellation, failure and final release.
One failing export may locate the owner. It does not define the whole batch.
Bound this family to the reached workload; avoid implementing the entire world.

## Separate evidence roles

Public documentation establishes the stated contract. Pinned original behavior
establishes the tested partition. Decompiled instructions establish call shape
and plausible control/state flow. Another implementation suggests designs and
test questions. Product policy establishes deliberate supported limits.

Record reference version, path, license and use: studied, compared, adapted,
linked or copied. Keep comparison results distinct from original-oracle
expectations. Exclude leaked or restricted sources unless the project explicitly
permits their use under applicable terms. Study clean-room separation only when
relevant; a normal compatibility rebuild need not impose it.

## Implement and test through the production interface

Use decompilation to form a coherent design, then check consequential branches,
offsets and effects against instructions. Recover ABI layout, signedness,
overflow, pointer ownership and calling convention before translating code.
Include globals and dependencies; compiling one function in an invented context
can hide the real behavior.

Use compiler/linker diagnostics to improve the candidate, without treating a
successful build as equivalence. Keep the best candidate and counterexamples.
Test the same fixture against the pinned reference and production entry point.
Use `oracle-lab` to own resets, repetitions, traces, normalization and loss
accounting; do not invent a second oracle framework here.

Choose partitions that can expose the failure: valid and invalid inputs, error
precedence, untouched outputs, last-error state, boundary arithmetic, ordering,
identity, lifetime, concurrent operations, teardown and host adaptation. A
candidate-generated expectation cannot independently validate that candidate.

Record the exact denominator: functions, instructions, test cases, records,
applications or workflows. Report dropped, failed, timed-out and unobserved
items. Freeze comparison rules before changing the candidate. Review any
normalization that discards identity, ordering, errors or side effects.

## Close the batch at both levels

Run owner regression gates, then replay the actual consumer when the batch
claims to unblock it. Distinguish a local contract pass from startup progress,
desktop composition, interaction, save/reopen or installation acceptance.
Screenshots and real interaction matter for graphical behavior; a live process
or a nonempty frame alone cannot establish usable UI.

If the consumer advances to another owner, retain the new boundary and stop
expanding the old claim. If it does not advance, reassess environment, provider
selection and the proposed causal link before adding another special case.

Keep one current test output by default and retain useful evidence deliberately.
Give caches, fixtures and original inputs explicit owners and retention rules.
Measure actual storage as well as logical/reflink size. Reuse the project's
cleanup workflow; never delete reference inputs to satisfy a disk budget.

Update the owning contract and project continuity with accepted limits and the
next action. Commit or publish only under the project's delivery authorization.
