# Performance and acceleration

Read this reference for profiling, cache behavior, SIMD, CPU features,
concurrency, or hardware offload.

## Evidence

Record:

- source revision and `zig version`;
- target, CPU features, and optimization mode;
- machine, operating system, power state, and relevant topology;
- workload, data, warm-up, threads, and affinity;
- sample count, median, spread, and raw measurements;
- the correctness comparison.

Use optimized artifacts. Compare the shipping mode with ReleaseSafe when
safety checks or code size may explain a difference. ReleaseFast is an option,
not proof of correctness.

Measure elapsed behavior first. Use sampling and hardware counters to explain
it. A cache-miss count alone does not identify the bottleneck.

## Order of work

Prefer:

1. less work and better algorithms;
2. fewer allocations, copies, conversions, syscalls, and IPC messages;
3. smaller hot data and better locality;
4. less contention and unnecessary ownership transfer;
5. batching or concurrency where ordering permits it;
6. explicit SIMD or hardware offload.

Change one cause at a time and keep the correctness comparison.

## Cache

Do not hard-code a universal cache size or line size. Measure the target CPU.
Walk memory contiguously, reuse blocks, separate hot fields from cold metadata,
and choose structure-of-arrays or array-of-structures from the actual access
pattern.

Investigate coherence before padding for false sharing. Add prefetch hints only
after a profile shows a latency problem and a benchmark shows improvement.

## SIMD and CPU dispatch

Use explicit vectors for large, uniform operations over independent lanes.
Keep a scalar reference. Handle small inputs, unaligned starts, and tails
without out-of-bounds access.

Distributed binaries need a baseline CPU path and runtime-dispatched optional
paths, or separately selected artifacts. A native-CPU local build may crash on
older hardware.

Do not expose vector width in a stable API. Test every implementation against
the same reference and inspect generated assembly. Zig and LLVM lowering can
change between toolchain versions.

Fast floating-point modes need a numerical contract covering rounding, NaN,
infinity, signed zero, and accepted error.

## Offload

Use established libraries and operating-system facilities for GPU, media,
cryptography, storage, networking, and devices. Include transfer, queueing,
synchronization, startup, and fallback costs in the benchmark.

Asynchronous I/O and thread pools may reduce waiting or syscall overhead. They
are not hardware acceleration by themselves. Small workloads often lose to
setup and transfer costs.
