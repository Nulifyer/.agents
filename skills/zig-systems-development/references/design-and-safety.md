# Design and safety

Read this reference for Zig API design, ownership, errors, low-level memory,
and concurrency.

## Ownership

Make the allocator part of the API when the caller owns the returned memory.
Document whether a slice is borrowed, transferred, retained, or valid only
during the call.

Choose allocation from lifetime:

- fixed storage for a known maximum;
- stack storage for small values that cannot escape;
- an arena for a phase whose allocations die together;
- caller-supplied allocation for library results;
- a long-lived allocator only for independently released objects.

Avoid allocation in hot loops and bounded-latency callbacks. Test failure after
each acquisition in multi-stage construction. Use `defer` after successful
acquisition and `errdefer` for failure-only rollback.

## APIs and types

Use a tagged union for mutually exclusive states with different payloads. Use
an enum for a closed set of names. Use distinct wrapper types when two integers
represent different identities.

Accept slices for bounded sequences. Use sentinel pointers only where an ABI
requires them. Do not retain a slice without a lifetime contract.

Prefer small modules with deep, stable APIs. Avoid pass-through wrappers and
generic helpers that only rename one operation. Use `comptime` to enforce
invariants or generate real repetition, not to hide ordinary control flow.

## Errors

Return errors the caller can act on. Translate foreign errors at the boundary
that owns the public policy. Preserve cleanup and useful context.

Use `catch unreachable` only for a local invariant that has already been
proved. Do not turn input, resource, environment, or dependency failures into
unreachable states.

## Integers and memory

Check additions and multiplications used for sizes, offsets, and counts before
allocation or access. Make truncation and signedness changes deliberate.

An alignment cast asserts a fact; it does not align memory. A pointer cast
changes type; it does not prove validity, range, ownership, or lifetime.
Integer-derived pointers need all of those proofs separately.

Initialize every externally observable byte. `undefined` is suitable only when
all bytes are definitely written before any read or escape.

Keep disabled runtime safety inside the narrow operation that needs it. Add a
`SAFETY` comment with the preconditions and a test for the boundary.

## Concurrency

Write down which thread owns mutable state, which locks protect it, and how
callbacks retain it. Define shutdown before startup:

1. stop accepting work;
2. signal cancellation;
3. drain or join work that holds references;
4. release resources;
5. free state.

Use `volatile` only for accesses that must occur, such as a defined foreign
memory contract. Use locks or atomics for concurrency. Choose atomic ordering
from the required happens-before relationship, not from a habit of using the
weakest or strongest order.
