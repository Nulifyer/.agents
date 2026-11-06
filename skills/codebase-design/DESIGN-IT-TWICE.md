# Design it twice

When the user wants to explore alternative interfaces for a chosen deepening candidate, use this parallel sub-agent pattern. Based on "Design It Twice" (Ousterhout): your first idea is unlikely to be the best.

Uses the vocabulary in [SKILL.md](SKILL.md): **module**, **interface**, **seam**, **adapter**, **leverage**.

Every candidate must meet the actual requirements and the ownership rules in [SKILL.md](SKILL.md). Include keeping behaviour with its current owner when separate ownership is not justified. Do not invent consumers or extension points to make an alternative look useful. Use parallel agents only when delegation is authorized and supported by the host.

## Process

### 1. Frame the problem space

Before spawning sub-agents, write a user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface would need to satisfy
- The dependencies it would rely on, and which category they fall into (see [DEEPENING.md](DEEPENING.md))
- A rough illustrative code sketch to ground the constraints, not a proposal, just a way to make the constraints concrete

Show this to the user, then immediately proceed to Step 2. The user reads and thinks while the sub-agents work in parallel.

### 2. Spawn sub-agents

Spawn 3+ sub-agents in parallel. Each must produce a **radically different** interface for the deepened module.

Prompt each sub-agent with a separate technical brief (file paths, coupling details, dependency category from [DEEPENING.md](DEEPENING.md), what sits behind the seam). The brief is independent of the user-facing problem-space explanation in Step 1. Give each agent a different design constraint:

- Agent 1: "Minimize the interface: aim for 1–3 entry points max. Maximise leverage per entry point."
- Agent 2: "Support the concrete required callers with the least special-case logic. Add extension points only for an actual contract or substitution need."
- Agent 3: "Optimise for the most common caller: make the default case trivial."
- Agent 4 (if applicable): "Explore another placement for the integration seam. Justify each abstract interface and adapter against an actual contract or substitution need."

Include the ownership rules and vocabulary from [SKILL.md](SKILL.md) in each brief. Include relevant domain vocabulary from the repository's existing documentation, such as CONTEXT.md when present.

Each sub-agent outputs:

1. Interface (types, methods, params, plus invariants, ordering, error modes)
2. Usage example showing how callers use it
3. What the implementation hides behind the seam
4. Dependency strategy and adapters (see [DEEPENING.md](DEEPENING.md))
5. Trade-offs: where leverage is high, where it's thin

### 3. Present and compare

Reject candidates with unjustified ownership, hypothetical consumers, or unnecessary machinery. Present the viable designs sequentially, then compare them in prose. Assess **depth**, **locality**, **seam placement**, and the code and concepts each design requires maintainers to keep.

After comparing, give your own recommendation: which design you think is strongest and why. If elements from different designs would combine well, propose a hybrid. Be opinionated: the user wants a strong read, not a menu.
