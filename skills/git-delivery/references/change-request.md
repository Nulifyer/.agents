# Change-request writing

Treat the pull or merge request title as durable history. In a squash workflow
it often becomes the public commit subject, so make it stand alone and match the
change that will land.

Scale the description to the change:

- A small fix needs the concrete symptom, its cause when known, the changed
  behavior, and focused verification.
- A larger or riskier change should make the problem, chosen approach,
  measurements or evidence, tradeoffs, operational consequences, and remaining
  gaps easy to find.
- UI changes need before-and-after images. Motion or timing changes need a short
  recording. Keep review-only media out of the repository unless its conventions
  say otherwise.

Write for the reviewer and the developer searching history later. Source code
shows what the implementation does; preserve why the change exists and why this
approach won. State accepted losses and unresolved gaps plainly.

A small request can read like this:

```text
Expired sessions could redirect once per failed request, leaving users in a
loop when several requests failed together.

The client now clears the session once and coalesces concurrent redirects.
Ordinary authorization failures still return to the caller unchanged.

Tested: `session-expiry.test.ts`
```

Avoid generated file tours, duplicate bot summaries, empty template sections,
and ceremony that makes a small change look like a design document. Mention the
model or agent only when the repository asks for attribution.

Open a draft when the user wants early feedback or the change is not ready to
merge. Before requesting review, confirm the diff is coherent, the description
matches the current scope, and required evidence is present. Update the title
and description when review changes what will land.
