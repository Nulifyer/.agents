# Research a selected gap

Use only when a missing technical fact could change the next implementation
decision. Stop once that decision has enough evidence.

- State exact question and competing observations before collecting more data.
- Check existing contracts, retained results, pinned references, and mature
  implementations before commissioning another experiment. A language change
  does not erase established behavior research.
- Prefer primary specifications, official documentation, matching symbols and
  owning source. Treat community material as a lead. Record version, identity,
  input limits, and whether findings apply to current implementation.
- Inspect relevant contract boundaries: interface, inputs, outputs, errors,
  lifetime, concurrency, persistence, and host effects. Select only boundaries
  needed by the reached consumer or named foundation.
- Compare the experiment with the production path. Qualification that injects
  missing production behavior cannot qualify that path. Distinguish valid
  negative results from experiments that never reach required conditions.
- Identify what unchanged evidence remains reusable and what changed mechanism
  needs new checks. Preserve original failures. Choose the cheapest observation
  that distinguishes remaining explanations; avoid broad replay without a new
  question.
- Return actionable owner, contract, evidence pointers, implication, remaining
  unknown, and stop or escalation condition. Avoid a broad subject survey.

When available, use reverse-engineering for compiled artifact questions and
oracle-lab for repeatable reference-system experiments. Without those skills,
use available evidence and state the remaining limit.
