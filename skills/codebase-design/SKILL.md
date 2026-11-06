---
name: codebase-design
description: Use when deciding where behavior belongs or whether to extract a module, or when designing interfaces, seams, adapters, or architectural testability. Do not use for routine fixes, naming, formatting, or implementation that leaves module ownership and interfaces unchanged.
---

# Codebase design

Keep clear ownership and little unnecessary machinery. When a module earns separate ownership, design it for **depth**: useful behaviour behind a small interface, placed at a clean seam, testable through that interface. The aim is less code to maintain, leverage for callers, and locality for maintainers.

## Establish the design context

Inspect the affected operation owners, callers, dependencies, configuration, persisted data, and existing checks before moving behaviour. Follow repository instructions and inspect supplied reference code. Existing patterns are evidence to assess, not proof that every abstraction deserves repetition.

Implement the requirements with the smallest sufficient design. Preserve established contracts and conventions unless the task requires changing them. Limit restructuring to the affected area. Distinguish requirements from assumptions instead of inventing extension points or future consumers.

## Glossary

Use these terms consistently for design decisions. Preserve actual framework and domain names. A **trust boundary** names a change in input authority, not necessarily a module seam.

**Module**: anything with an interface and an implementation. Deliberately scale-agnostic: a function, class, package, or tier-spanning slice.

**Interface**: everything a caller must know to use the module correctly: the type signature, but also invariants, ordering constraints, error modes, required configuration, and performance characteristics. Every module has an interface in this sense. A separate language-level interface, trait, protocol, or abstract class is optional.

**Implementation**: what's inside a module, its body of code. Distinct from **Adapter**: a thing can be a small adapter with a large implementation (a Postgres repo) or a large adapter with a small implementation (an in-memory fake). Reach for "adapter" when the seam is the topic; "implementation" otherwise.

**Depth**: leverage at the interface. The amount of behaviour a caller (or test) can exercise per unit of interface they have to learn. A module is **deep** when a large amount of behaviour sits behind a small interface, **shallow** when the interface is nearly as complex as the implementation.

**Seam**: a place where you can alter behaviour without editing the code that uses it. Where to put the seam is its own design decision, distinct from what goes behind it.

**Adapter**: a concrete thing that satisfies an interface at a seam. Describes *role* (what slot it fills), not substance (what's inside).

**Leverage**: what callers get from depth. More capability per unit of interface they learn. One implementation pays back across N call sites and M tests.

**Locality**: what maintainers get from depth. Change, bugs, knowledge, and verification concentrate in one place rather than spreading across callers. Fix once, fixed everywhere.

## Deep vs shallow

**Deep module** = small interface + lots of implementation:

```
┌─────────────────────┐
│   Small Interface   │  ← Few methods, simple params
├─────────────────────┤
│                     │
│  Deep Implementation│  ← Complex logic hidden
│                     │
└─────────────────────┘
```

**Shallow module** = large interface + little implementation (avoid):

```
┌─────────────────────────────────┐
│       Large Interface           │  ← Many methods, complex params
├─────────────────────────────────┤
│  Thin Implementation            │  ← Just passes through
└─────────────────────────────────┘
```

When designing an interface, ask:

- Can I reduce the number of methods?
- Can I simplify the parameters?
- Can I hide more complexity inside?

## Decide where behaviour belongs

Start with the existing operation owner, such as a request handler, command, job, or library function. Keep unique sequencing, one-off queries, result assembly, and caller-specific response decisions there.

Give behaviour a separate owner only for a concrete integration or actual shared behaviour:

- An external integration has meaningful protocol, resource lifetime, containment, or recovery behaviour to encapsulate.
- Real callers or concrete required uses share an operation or policy. Name them. A shared function may be enough.

Before introducing that owner, finish this sentence:

> This owns ___ for the external system ___, or is shared by ___ and ___.

A concrete integration can justify a module with one caller and one implementation. One ordinary query or file write does not justify a module merely because it performs I/O. A database call alone does not require a repository abstraction.

Use private helpers to clarify an operation without assigning its behaviour to another owner. Cohesion or complexity alone does not justify separate ownership. File length, class count, mock convenience, and hypothetical reuse do not justify extraction. Apply this decision to behavioural abstractions, not ordinary data or configuration types with distinct contracts.

| Situation | Design decision |
| --- | --- |
| One endpoint queries inventory and assembles a summary | Keep the query and assembly with the endpoint. |
| A web request, import, and job all create shipments under the same rules | Share the creation operation. |
| One provider needs authentication, timeouts, response conversion, and cleanup | Give a concrete client that integration to own. A separate abstract interface needs its own justification. |
| Several operations repeat resource acquisition and release | A focused lifetime-owning module or helper can centralize cleanup. |

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be internally composed of small, mockable, swappable parts; they just aren't part of the interface. A module can have **internal seams** (private to its implementation, used by its own tests) as well as the **external seam** at its interface.
- **The deletion test.** Imagine inlining the module into its callers. If complexity vanishes, question the indirection. If protocol details, invariants, or repeated policy return to callers, the module earns its place.
- **Test behaviour through the interface.** Internal seams may support focused checks, but callers should not learn implementation details to test required outcomes.
- **Extraction and substitution are separate decisions.** Prefer concrete collaborators. Add an abstract interface for a useful external contract, framework extension point, or actual substitution need. Production and test adapters can justify substitution when they exercise a meaningful contract. Do not manufacture an adapter merely to justify an abstraction.
- **Use existing capabilities.** Inspect framework and client-library operations before adding custom locking, caching, parsing, authentication, or error machinery. Fill a specific missing capability with a focused implementation, not a general framework.

## Give each rule and value one owner

- Reuse an existing policy implementation before adding another. Share the rule when independently untrusted entry paths need the same check.
- Keep changing content and workflow rules in application code. Avoid SQL `CHECK` rules that duplicate application policies for formats, supported states, or workflow decisions. Preserve keys, foreign keys, nullability, uniqueness, transactions, concurrency guarantees, and required database-enforced invariants.
- Normalize where the canonical form is established. Validate at trust boundaries or to protect a distinct invariant, rather than repeat checks mechanically in every module.
- Keep path construction and containment policy with the storage owner. Callers may enforce different requirements, such as existence or length.
- Avoid identical models connected only by repetitive mappings. Keep distinct models when authority, fields, invariants, or lifetime differ.
- Preserve atomicity, ownership checks, structural data integrity, cleanup, and required recovery when simplifying. Fewer layers do not excuse a weaker contract.

## Own effects and failures

The integration module owns executing and interpreting the external exchange, including malformed responses. Give callers a consistent failure contract instead of repeating exception classification in every caller. Preserve caller cancellation and the application's normal policy for unexpected programming failures.

Keep expected malformed-input handling around the whole operation that can reject input, including construction and initial reads. If the contract requires rejection, preserve it through decoding, parsing, and saving. A header check does not establish complete validation.

Preserve safe diagnostics separately from public error messages. Use existing logging without exposing credentials or sensitive payloads. For background callers, verify that recoverable failures leave work retryable and the host running. Do not achieve recovery by suppressing unrelated failures.

## Compose dependencies and configuration

Keep application assembly visible at its composition root, where dependencies and startup behaviour are connected. Follow the repository's existing configuration approach. A library does not need an application host or a dependency-injection framework.

When the repository leaves the approach open, prefer direct configuration reads and a small plain configuration object for related values. Use normal framework configuration for framework features. Do not introduce application-wide configuration machinery solely for consistency.

- Give defaults and effective limits one maintained owner. Consumers use that configuration instead of another operation's constants or deeper hard-coded overrides.
- Make values configurable when deployment or supported operation needs variation. Keep settled product decisions fixed unless a requirement says otherwise.
- Preserve configuration keys, precedence, and explicitly required extension points. Do not replace useful framework configuration solely for stylistic consistency.
- Choose dependency lifetimes from state, concurrency, dependencies, and cleanup needs. Using a concrete type says nothing about its lifetime.

## Designing for testability

Good interfaces make testing natural:

1. **Accept dependencies that need controlled substitution.** Construct them at the composition root or owning integration. Ordinary internal objects need no injected abstraction.

   ```typescript
   // Testable
   function processOrder(order, paymentGateway) {}

   // Hard to test
   function processOrder(order) {
     const gateway = new StripeGateway();
   }
   ```

2. **Separate calculation from effects where it helps.** Return computed results when possible. Modules that perform I/O or own state should expose those effects through a clear contract.

   ```typescript
   // Return the calculation directly
   function calculateDiscount(cart): Discount {}

   // Caller must inspect the changed cart
   function applyDiscount(cart): void {
     cart.total -= discount;
   }
   ```

3. **Keep setup proportional to the operation.** Fewer caller obligations simplify tests. Required cases still come from behaviour and risk, not the number of methods. Test required outcomes, not abstractions introduced solely for mocking.

## Replace superseded designs safely

For an unreleased first implementation, replace superseded modules and compatibility branches rather than preserve hypothetical consumers. First identify actual consumers, persisted data ownership, and migration needs. Preserve released contracts and explicitly required compatibility. Replacing code does not authorize deleting user data or rewriting history.

## Review the changed design

Before delivery, check the affected design:

1. Can each new behavioural owner name its integration or real callers and required uses?
2. Do operation owners retain their unique sequencing and response decisions?
3. Does any layer add only forwarding, identical mapping, or repeated policy?
4. Do shared rules and configuration have one maintained owner? Does each setting have a real reason to vary?
5. Did simplification preserve required trust checks, atomicity, cleanup, recovery, data, and compatibility?
6. Do checks cover the old contract and intended change, including relevant failure outcomes?

Fix unjustified maintenance before delivery. Explain non-obvious retained seams and unresolved tradeoffs. Report checks that actually ran and their limits. This review does not authorize delegation.

## Rejected framings

- **Depth as ratio of implementation-lines to interface-lines** (Ousterhout): rewards padding the implementation. We use depth-as-leverage instead.
- **"Interface" as the TypeScript `interface` keyword or a class's public methods**: too narrow: interface here includes every fact a caller must know.
- **A separate abstract interface for every module**: a module's caller contract exists even when callers use a concrete function or type.

## Going deeper

- When consolidating shallow modules, see [DEEPENING.md](DEEPENING.md) for dependency-aware verification, seam discipline, and preserving coverage while replacing tests.
- When the user requests exploration of alternative interfaces for a chosen module, see [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md). It uses parallel design work when delegation is authorized, then compares depth, locality, and seam placement.
