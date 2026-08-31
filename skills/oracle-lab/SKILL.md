---
name: oracle-lab
description: Use when externally defined or undocumented behavior must be established through repeatable observation of a reference system, differential fixtures, traces, or controlled black-box experiments. Do not use for ordinary unit testing, source review, or one-off manual reproduction.
compatibility: Requires authorized access to a controllable reference system; tracing, virtualization, and isolation tools vary by platform.
---

# Oracle lab

Build a repeatable experiment around a reference system whose observable
behavior defines or constrains an implementation. A trace is evidence only for
the events, time window, workload, and loss conditions it actually captured.

## Define the claim first

State:

- the behavior question and observable result;
- the reference system, version, identity, and authority it provides;
- the workload, actor, privilege, session, and environmental assumptions;
- the stop condition and evidence needed to accept or reject the claim;
- what the experiment cannot establish.

Use `reverse-engineering` when static artifacts can settle call shape or control
flow before runtime observation. Do not collect a broad trace to answer a
question a symbol, structure definition, or focused fixture can settle.

## Choose the reference environment

Use the simplest environment that preserves the behavior named in the claim.
Do not assume an oracle requires a VM or even a running system. The right form
depends on what must remain real, what may be simulated, and what must be kept
isolated.

Suitable forms include:

- a frozen, read-only artifact set when files, metadata, symbols, schemas, or
  deterministic offline tools can answer the question;
- a controlled run on the proper host when hardware, installed services,
  credentials, licensing, or host integration are part of the behavior and the
  run is safe and authorized;
- one or more containers when process, filesystem, network, or service topology
  matters but sharing the host kernel does not change the result;
- one or more VMs when boot, firmware, kernel behavior, full operating-system
  state, stronger isolation, or repeatable snapshots matter;
- physical machines, remote reference systems, emulators, or mixed setups when
  those better preserve the behavior under test.

Use multiple instances when the claim depends on peers, failover, identity,
distributed state, or network roles. Record why the selected form is faithful
and which differences from production could affect the finding. A container is
not a faithful kernel oracle, and a VM is not automatically a faithful hardware
oracle.

## Protect the reference

Protect the source and other active work:

1. Record hashes and relevant metadata for the clean reference.
2. Make mutable state disposable or resettable with a clone, snapshot, overlay,
   private workspace, container layer, VM disk, or the equivalent for the
   selected environment. Keep firmware variables, security devices, ports,
   sockets, logs, and temporary state private to the run when they can change.
3. Verify the source identity before and after the series. Do not infer
   immutability from an intended read-only flag alone.
4. Keep credentials, licensed files, personal data, raw command lines, and
   machine-specific traces out of publishable artifacts unless their release is
   explicitly authorized.

Do not execute an untrusted target, weaken isolation, or mutate a real system
without authority specific to that action.

## Calibrate, then repeat

1. Run one pilot to prove startup, collection, stop, export, normalization, and
   cleanup. Retain failed-pilot lessons that prevent repeating a bad setup, but
   do not count the pilot as accepted evidence unless it meets every final gate.
2. Start with the narrowest provider or observation set that can answer the
   question. Record buffer sizes, sampling choices, filters, and event-loss
   counters.
3. Add explicit action boundaries around boot, login, idle periods, program
   launches, inputs, shutdown, or other controlled actions. Record both a wall
   clock and a monotonic clock when events cross clock domains.
4. Capture actor, privilege, process, parent, session, and environment snapshots
   at boundaries when they affect interpretation.
5. After the pipeline is stable, run enough independent accepted repetitions to
   distinguish stable behavior from a one-off result. Three is the normal
   baseline for a stability claim; use fewer only when the claim does not depend
   on repeatability and state that limit.
6. Use a broader or higher-volume profile only for a named unresolved question.
   Reject completeness claims when the collector reports loss.

## Preserve raw evidence and normalize separately

Keep raw captures immutable. Produce normalized records as derived artifacts
with their own schema, tool version, command, input hash, output hash, and
declared nondeterminism. Never replace raw results with cleaned output.

Each accepted run should include a manifest, reference identity, configuration
hash, action boundaries, loss counters, raw-artifact hashes, normalized result,
acceptance result, and cleanup state. Use
[the lab record](references/lab-record.md) when the project has no stronger
record format.

Compare runs by stable roles, ordering, state transitions, inputs, outputs, and
side effects. Treat timestamps, identifiers, addresses, scheduling, and other
run-specific values as variable only after evidence shows they are variable.

## Turn observation into an implementation contract

For each useful finding, record:

- the exact observed input class and environment;
- output, error, ordering, side effects, lifetime, and cleanup;
- whether the result came from specification, static analysis, runtime
  observation, cross-run comparison, or inference;
- the fixture that can run unchanged against the reference and implementation;
- unsupported inputs and questions the experiment did not reach.

Repeat the same fixture through the production implementation. A matching
fixture proves only its declared partition. It does not establish full
compatibility with the reference system.

## Finish

Report the accepted runs, rejected runs, loss state, stable findings, variable
findings, raw and normalized artifact locations, privacy boundary, and the next
question that would justify another experiment. Stop collecting when the
declared claim is settled.
