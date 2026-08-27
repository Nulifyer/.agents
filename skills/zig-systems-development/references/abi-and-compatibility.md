# ABI and compatibility

Read this reference when Zig crosses a C, operating-system, binary, plugin,
network, or foreign-memory boundary.

## Layout

Use fixed-width integers and the required calling convention. Use
`extern struct` for a C-compatible externally defined layout, not as a general
data-organization choice.

Assert required sizes, alignments, and offsets at compile time. Treat unions,
bit fields, flexible arrays, sentinels, padding, and architecture-dependent
types as explicit design work.

Keep the external representation separate from convenient internal types.
Decode, validate, and convert at the boundary.

## Foreign input

Assume pointers, lengths, offsets, handles, tags, and callbacks are malformed
until checked. Validate arithmetic before forming a slice or calculating an end
address. Check nullable and sentinel rules before traversal.

Copy foreign metadata when it can change between validation and later use.
Initialize output and length fields consistently on success and failure.

An exported function's failure precedence can be part of its contract. Do not
reorder validation or collapse errors without tests.

## Compatibility work

Implement observable behavior, not an imagined copy of the other system's
internals. Separate:

- public contract and policy;
- project-owned state and object identity;
- host adapter mechanisms;
- evidence from documentation, reference implementations, and oracle tests.

Host errors, paths, handles, signals, and credentials must not leak across a
foreign contract unless that contract explicitly defines them.

For asynchronous work, define ownership, cancellation, completion, output
initialization, and teardown. Cancellation and normal completion must agree on
one completion and one cleanup.
