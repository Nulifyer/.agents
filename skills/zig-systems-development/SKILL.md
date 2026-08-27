---
name: zig-systems-development
description: Use when designing, implementing, reviewing, debugging, or optimizing Zig systems code, especially allocators, ABI or FFI boundaries, low-level memory, concurrency, SIMD, or hardware acceleration. Do not use for merely reading Zig code when no engineering judgment is needed.
---

# Zig systems development

Build Zig code whose ownership, failure behavior, ABI, and performance claims
can be checked.

## Start with the actual environment

Inspect the repository instructions, `build.zig`, `build.zig.zon`, wrapper
scripts, tests, target, optimization mode, and `zig version` before changing
code. Use the repository's commands and conventions.

Do not introduce a Zig version pin by default. Adapt to usable toolchain updates
and record the version in test or benchmark evidence. Pin only for a
reproducible compiler or dependency incompatibility, incorrect generated code,
or a stated reproducibility requirement. Document the reason, affected
commands, and removal condition.

When advice depends on a Zig release, consult the matching official language
and release documentation. Do not assume a builtin, standard-library API, or
code-generation behavior remained unchanged.

## Design the change

Before editing, identify:

- the module's responsibility and callers;
- resource ownership and borrowing;
- trust, ABI, thread, and process boundaries;
- valid states and failure behavior;
- required target architectures and CPU baseline;
- the tests that establish correctness.

Use types to exclude invalid states. Keep raw addresses, untyped pointers,
layout-dependent values, and host-specific details at narrow boundaries.
Prefer direct code over a reusable abstraction until real callers demonstrate
the common design.

Read [design and safety](references/design-and-safety.md) when the task involves
allocation, cleanup, errors, `comptime`, pointers, atomics, or concurrency.

## Implement conservatively

Keep acquisition and cleanup together with `defer` or `errdefer`. Make
allocator and returned-memory ownership clear in the API. Check arithmetic
before allocating, slicing, indexing, or converting widths.

Treat `@alignCast`, `@ptrCast`, `@ptrFromInt`, `unreachable`,
`@setRuntimeSafety(false)`, inline assembly, and `undefined` as proof
obligations. Localize them and state the invariant that makes them valid.

`volatile` does not provide inter-thread synchronization. Use atomics with an
intentional memory order or a lock whose ownership is clear.

For ABI or compatibility work, read
[ABI and compatibility](references/abi-and-compatibility.md).

## Verify behavior

Format changed Zig files and run the smallest tests that execute the changed
path. Confirm that build-graph tests run instead of merely compiling.

Test boundary values, malformed input, partial initialization, cleanup, and
allocation failure when relevant. Run an optimized correctness configuration
for code whose behavior depends on overflow, safety checks, alignment,
inlining, vectors, or generated machine code.

Report the exact commands that ran. Do not describe compilation as a passing
runtime test.

## Optimize only with evidence

Define the workload and correct output, then measure an optimized build before
changing it. Improve algorithms, data movement, allocation, layout, IPC,
syscalls, and contention before adding explicit SIMD or offload.

Read [performance and acceleration](references/performance-and-acceleration.md)
for profiling, cache, SIMD, CPU dispatch, GPU or media offload, or any
performance claim.

Keep a portable reference implementation for complex acceleration. Inspect
generated code when the result depends on a particular instruction or compiler
optimization.

## Completion

A completed change has:

- explicit ownership and cleanup;
- validated ABI and trust boundaries;
- no unexplained unchecked operation;
- tests that ran in relevant configurations;
- version, target, and optimization mode recorded when they affect evidence;
- measurements and a fallback path for performance-specific code.
