---
name: dotnet
description: Use when designing, implementing, refactoring, or reviewing C#/.NET code, especially deciding where behavior belongs, when to extract components, and how to compose configuration. Do not use for UI-only styling, prose-only work, or package operations without C# design decisions.
---

# .NET design style

Write purposeful C# with clear ownership and little unnecessary machinery. The aim is less code to maintain, not fewer lines at any cost.

## Establish the local style

- Follow the current task and repository instructions before these defaults.
- If the user supplies reference code, inspect relevant examples before choosing configuration, layout, or component splits. Do not assume those references exist on another machine.
- Match surrounding naming, constructors, namespaces, dependency registration, and formatting. Do not standardize unrelated code.
- Distinguish an explicit user choice from a pattern found in agent-written code. Existing code is evidence to inspect, not proof every design deserves repetition.

When starting from a plan, implement its requirements with the smallest sufficient design. Use the new-project defaults below where the plan leaves conventions open. Keep assumptions distinct from requirements instead of inventing a framework or extra product features.

When refactoring, first inspect the affected entry points, callers, configuration, data and existing checks. Preserve routes, configuration keys, persisted data, working behavior and established conventions unless the requested change requires altering them. Apply these ownership decisions to the changed area, not as a reason to restyle or restructure the whole project. Verify the old contract as well as the intended improvement.

## Decide where code belongs

Start with the existing operation owner, such as an HTTP action, message handler, scheduled job, command, or library operation. Move behavior only when the move has a concrete reason:

1. **An external-system integration.** A REST client, process integration, directory connection, or file store has meaningful protocol, resource, path-containment, or recovery behavior to own.
2. **Actual shared behavior.** Real callers need the same operation, policy, or cross-feature facility, such as a cache helper. Name the callers or concrete required uses. A shared function or static helper can be enough. Shared logic does not have to become a service.

An external integration can justify a component with one caller and one implementation. Do not wait for a second provider. Do not build provider machinery before the integration is needed.

Keep unique input sequencing, a one-off query, and result assembly with that operation owner. HTTP actions also own their response decisions. A database call alone does not require a repository class. One ordinary query or file-write call does not become an integration merely because it touches PostgreSQL or the filesystem.

Use private methods when they make the owning operation easier to read without creating another owner. File length, class count, and a desire to mock everything are not extraction criteria.

Before extracting behavior into a component, interface, or layer, finish this sentence:

> This owns ___ for the external system ___, or is shared by ___ and ___.

Apply this test to behavioral abstractions, not ordinary request, data, view, or configuration types with distinct contracts.

If the only answer is "separation of concerns", "clean architecture", or "we may reuse it later", leave the behavior with its current owner.

### Examples of the decision

| Situation | Choice |
| --- | --- |
| One inventory endpoint validates a filter, runs a query, and returns a summary | Keep the query and assembly in the endpoint. No summary service and repository interface are needed. |
| Web entry, CSV import, and a scheduled job all create shipments under the same rules | Share the creation operation. Fixing those rules should not require three implementations. |
| One shipping provider needs authentication, timeouts, response conversion, and connection handling | Use a focused concrete client. An interface is optional unless it serves a real contract or substitution need. |
| Several operations acquire and release the same external resource | A small lifetime-owning class can earn its place through acquisition, cancellation, disposal, and cleanup. |

Do not force shared persistence, external protocol details, or recovery coordination into entry points to satisfy an anti-service rule. Keep required behavior intact when simplifying.

## Prefer concrete code and existing capabilities

- Use concrete collaborators unless an interface represents a useful external contract, framework extension point, or actual substitution need.
- Do not add an interface for every class, a pass-through service, a generic repository framework, or a base controller merely to make the layers look consistent.
- Choose dependency lifetimes from state, thread safety, disposal, and dependencies. Concrete registration does not mean singleton-only.
- Use established .NET and client-library operations before implementing another authentication, locking, caching, serialization, or error-handling subsystem.
- Prefer typed C# client calls to embedded scripts when the client supports the required operation. Compiler checking is valuable, but does not replace runtime failure handling.
- If the typed API lacks an operation, use a focused lower-level call, parameterized SQL, or necessary script. Explain the specific gap rather than build a general framework around it.

For example, if the cache client provides owner-checked release:

```csharp
await cache.LockReleaseAsync(lockKey, ownerToken);
```

Use that operation instead of an embedded compare/delete script. Do not replace it with a separate read followed by delete. A single cache node does not make multiple client commands atomic.

Use ASP.NET Core authentication and authorization mechanisms rather than a parallel identity system. Select cookies, bearer tokens, and identity providers from the application's requirements, not from this skill.

## Give each rule and value one maintained owner

- Reuse an existing implementation before introducing another one for the same policy.
- Keep filesystem path construction and containment policy with the storage owner. Callers may still enforce their own existence or length requirements.
- Avoid identical database, service, and transfer models connected only by repetitive mappings. Keep distinct models when authority, fields, invariants, or lifetime genuinely differ.
- Normalize content where its canonical form is established. Do not repeatedly sanitize the same trusted value merely because it passes through another method.
- Validate at real trust boundaries. Repeat a check when it protects a different invariant or independently untrusted entry path, not because every layer is expected to validate everything.
- Include eager construction and reads in an expected-input error boundary. A reader or parser can reject input before its processing loop starts. Preserve data and return a useful validation outcome for expected malformed input.
- When the input contract requires rejection, keep that guarantee through decoding, detection, parsing, and saving. Do not silently replace malformed content. Test supported markers or headers combined with malformed bodies, not only each feature separately.
- Keep a shared policy implementation when several boundaries need it. Rechecking untrusted input does not require copying the rule itself.
- Use focused helpers for repeated work. A short helper that centralizes parameter binding or resource cleanup is not automatically an unnecessary layer.

Do not turn incidental work into a custom subsystem. If an upload needs bounded type checks, do not casually write a full image-format parser. If complete decoding is required, use an appropriate maintained decoder and keep the requirement explicit.

Simplification must not turn header checks into a claim of complete validation, or remove atomicity, ownership checks, safe disposal, or recovery that the task requires.

Retain safe diagnostics when handling an external-system failure. Use the existing logger at the owning client or endpoint, and show a concise public error separately. Do not log credentials, session tokens, untrusted payloads, or patient content.

The external boundary owns failures while executing and interpreting the remote exchange, including malformed response metadata or encoding. Classify those as failed operations there, rather than repeat the same exception whitelist in every caller. Preserve caller cancellation. Unexpected local or programming failures still follow the application's normal failure policy, without an exception framework or blanket suppression.

If a background job consumes the integration, verify that recoverable remote failures leave its work retryable and the host running. Do not disable fatal host safeguards or swallow unrelated programming errors to achieve this. The same client failure outcome should work for request and background callers.

## Compose configuration directly

In an application host, keep registration and pipeline composition visible at its composition root, normally `Program`. Prefer direct configuration reads and a small plain configuration class when several values belong together. These are style defaults, not mandates to replace an established repository approach. A library does not need to add an application host.

```csharp
var config = new ExportConfig
{
    OutputDirectory = builder.Configuration.GetValue(
        "app_settings:export_directory", "exports")!
};

builder.Services.AddSingleton(config);
```

This example registers configuration, not a rule that every service must be singleton.

- Use normal framework options for framework features. Do not introduce an application-wide options architecture solely for consistency.
- Match the repository's configuration-key conventions. For a new application without established conventions, default to lowercase hierarchical sections and snake_case application keys, such as `app_settings:application_title`. Keep infrastructure/provider sections purposeful, and do not rename framework-owned or externally defined keys.
- Put defaults and effective limits in one maintained location. Do not override them with another hard-coded value deeper in the application.
- Consume shared configuration instead of another controller's constants.
- Preserve intended configuration precedence. Do not change it unintentionally when adding providers.
- Make values configurable when deployment or supported operation needs variation. Prefer a fixed value for a settled product decision rather than a setting that must equal one permitted value.
- Retain conventional settings or extension points the user explicitly wants, even if a current code search finds no consumer.
- If readiness is checked during startup or recovery, do not repeat that check on every ordinary read without a concrete operational need.

These are defaults, not bans on useful registration extensions, `IOptions`, or runtime health checks in a project that needs them.

## Keep application policy in C#

Let the database store typed data and structural identities and relationships. Validate changing content and workflow rules in C#.

- Avoid SQL `CHECK` rules that duplicate application policies for labels, formats, supported states, lengths, or workflow decisions.
- Preserve primary keys, foreign keys, nullability, and uniqueness needed for structural integrity. Do not interpret the policy preference as permission to weaken identity or concurrency safety.
- Use the project's query library directly where it fits. A required database-specific statement does not justify a general repository layer.
- Keep SQL parameterized and preserve transactions and concurrency conditions needed by the operation.

For application event timestamps, use UTC `DateTimeOffset` values in storage and transport. Use timezone-aware database types, such as PostgreSQL `timestamptz`, and convert for display in the user's timezone.

Keep calendar dates with no associated instant as date-only values, such as `DateOnly` and a database `date` column. Keep durations distinct from timestamps. If the domain meaning is unclear, resolve it before choosing the type. Do not rewrite authored dates or historical Git objects to implement a display preference.

## Preserve the existing application shape

For comparable server-rendered web applications, default to MVC, Razor views, and ordinary feature JavaScript. Do not add a frontend framework or build pipeline without a requirement.

Use familiar MVC folders and focused component folders. Do not impose a new project hierarchy or copy a reference application's generic infrastructure without its actual consumers.

### Defaults for a new MVC application

When no existing repository establishes another pattern:

- Give actions explicit route and HTTP-verb contracts with attributes such as `HttpGet` and `HttpPost`. Map attribute-routed controllers with `MapControllers` rather than depend on a broad conventional default route.
- Make binding intentional and keep validation, MVC results, redirects, and response decisions visible in their owning actions. Do not add binding attributes everywhere when the normal MVC convention already expresses the intended input.
- Put configuration types in `Configuration`. Organize request, view, and mapped data types by purpose, using folders such as `Models/RequestObjects` and `Models/ViewModels` where useful.
- Keep unrelated types out of a catch-all `Models.cs`. Related small records or purposeful nested types may share a file. File organization does not justify an extra behavior layer or project.
- Keep local static assets in ordinary `wwwroot/css`, `wwwroot/js`, and library folders as needed. Do not add empty folders or a frontend pipeline merely to satisfy a layout template.

Preserve established conventional routing, folder layouts, constructor syntax, and namespace forms in an existing project. These defaults do not require a particular controller-name suffix or a separate file for every type.

Keep presentation decisions with the appropriate UI owner. This skill does not prescribe a brand, screen layout, model provider, or division of work between agents.

## Replace superseded first-pass code

For an unreleased first implementation, replace a superseded design rather than retain old types, routes, flags, and compatibility branches for hypothetical users.

First identify existing consumers and who owns persisted data. Keep a safe migration or forward-edit path when required. Removing an obsolete implementation does not authorize deleting user data or rewriting history.

For released contracts or explicitly required compatibility, preserve the actual obligation. Do not use this preference to redesign away established behavior without examining it.

## Verify and format proportionately

- Follow `.editorconfig` and format authored C# before delivery. Do not reformat vendored assets or unrelated files.
- For a new C# project without formatting rules, default to four-space indentation and Allman braces, and record the chosen rules in `.editorconfig`. Follow the repository's line-ending convention rather than impose workstation-specific endings.
- Use one statement per line. Expand substantial methods, catches, and multi-step branches instead of packing them into single-line blocks. Simple single-statement guards and trivial expression helpers can remain concise.
- Break long argument lists into readable lines and separate logical steps. Group host configuration and registration in `Program` with short section comments instead of extracting a startup framework.
- Check readable expression as well as formatter output. A formatter pass does not prove that actions, startup code, or Razor markup are easy to scan.
- Check the whole expected-failure outcome: truthful user feedback, retained data, and required retry behavior. Include failures that framework filters or request limits can produce before an action runs. Do not weaken antiforgery or size bounds, or add duplicate I/O checks for guarantees the framework already provides.
- Create tests where the changed behavior and risk require them. Test sanitization and normalization heavily, including hostile inputs, meaningful content preservation, and persistence consistency where relevant.
- Test required behavior, not an abstraction introduced solely to make mocks convenient.
- Keep new test code and test results local and ignored unless the user approves retaining or committing them. Do not remove existing tests or interpret this as a request to avoid verification.
- Use the requested package-management workflow. Prefer guget when available for NuGet work. If it is unavailable, report the limitation rather than assume this skill installs it.
- Report checks that actually ran and their limits. Compilation alone does not prove runtime integration, visual acceptance, or correctness under failure.

## Ownership review before delivery

Check the changed design, not just syntax:

1. Can each new behavioral component or interface name its external integration or real callers and required uses?
2. Does each entry point or other operation owner still own its unique request or job behavior?
3. Did any layer add only forwarding, identical mapping, or repeated policy?
4. Does configuration have one owner and a real reason to vary?
5. Did the framework or client already supply a custom operation you added?
6. Did simplification preserve trust boundaries, atomicity, cleanup, and required recovery?
7. Were superseded paths removed without losing owned data or required compatibility?
8. Did the affected checks run, and does formatting match the repository?

Fix unjustified maintenance before delivery. Explain only the non-obvious retained boundaries and any unresolved tradeoff. Perform this review yourself, or use an independent reviewer when delegation is authorized. The checklist does not authorize delegation or justify another framework or implementation layer.
