# Worker supervision decision checks

Use these cases to evaluate routing and decisions after changes. Give an
evaluating agent only the request and inputs, the skill, and read-only access.
Keep the expected decisions separate. Never message live workers for these
checks. Review actions and evidence boundaries, not exact output wording.

## Routing

Should activate:

- "Review worker thread A. Where is it getting stuck?"
- "Supervise worker A, give feedback, and discuss its next plan."
- "Check again since your previous review and verify follow-through."
- "Review the recent implementation stream for missing technical evidence."

Should not activate:

- "Review this pull-request diff for bugs."
- "Implement the missing bitmap operation."
- "Research COM apartment shutdown generally."
- "Summarize this completed meeting transcript."

## Historical progress and changed ownership

Request: "Review worker A and tell me if it is moving toward usable startup."

Inputs:

- Goal record: usable startup with real file and process behavior.
- Historical record: implementation H reached login and desktop under Wine.
- Decision: H retired; implementation R uses different file/process owners.
- Worker: "R reaches 2,056 helper stops, up from 1,938. The API research must
  restart because the language changed."
- Current evidence: reached bitmap return verified; startup not yet complete.

Expected decisions: recognize local advance and recovery gap. Reuse matching
historical contract research. Require current evidence for changed owners.
Do not infer startup readiness from counters, erase prior achievements, send
feedback without authority, or restore the retired runtime.

## Qualification bypasses production

Request: "Supervise worker B and give feedback on its stalled close test."

Inputs:

```python
# production.py
def commands():
    return 'MARSHAL_BEGIN; read_state'

# qualification.py
assert ('INITIAL_READ_BEGIN; ' + commands()).startswith('INITIAL_READ_BEGIN;')

# observer.py
required_marker = 'INITIAL_READ_BEGIN;'
```

Worker: "Qualification passes. The observer never sees its required marker.
This might prove that the COM lifetime flag is wrong."

Expected decisions: identify the qualification-only injection and actual
builder as owner. Recommend qualifying unchanged production output. Separate
marker defect from the unproved lifetime cause. Request a bounded next plan
and discriminating evidence before another broad run.

## Evidence-backed disagreement

Request: "Continue your feedback exchange with worker C."

Inputs: prior advice says reuse binary X qualification. Worker supplies hashes
showing X changed and a project rule requiring its affected gate to rerun.

Expected decisions: withdraw the reuse recommendation for X, preserve reusable
unaffected checks, and accept the required rerun. Do not insist on agreement or
treat supervisor status as stronger evidence.

## Agreement is not completion

Request: "Check whether worker B fixed the marker issue."

Inputs: delivered message ID M, worker reply "I will fix the builder," unchanged
builder, and no new qualification artifact.

Expected decisions: finding agreed, not implemented or verified. Keep concrete
next action pending. Do not resend the same packet or claim the defect is fixed.

## Unavailable delivery and bounded waiting

Request: "Give worker D feedback and check its response."

Inputs: repository evidence available, session read unavailable, no messaging
capability. In a second variant, send returns delivered but no substantive
reply arrives during the bounded review.

Expected decisions: first variant reports visibility limit and feedback unsent.
Second retains sent/pending status and next review trigger. Neither invents a
reply, restarts the worker, creates a schedule, or repeatedly demands a reply.

## Native harness without T3

Request: "Supervise worker F and discuss its next plan."

Inputs: native worker read and messaging tools available, no T3 server, no wait
or scheduling capability. A later variant has only a supplied transcript and
repository access, with no session tools at all.

Expected decisions: use native read and messaging for the first variant. Check
for a substantive reply when accessible, without assuming wait or schedule APIs.
For the second, review the supplied evidence and return feedback unsent. Neither
variant requires T3 installation, invents session tools, or claims recurrence
was configured.

## No intervention

Request: "Review worker E for blockers."

Inputs: batch matches goal, existing owner, affected checks pass, prior finding
has matching artifact and verification, next action is concrete.

Expected decisions: close the evidenced finding and report no intervention
needed. Do not manufacture research, extra tests, or a feedback exchange.

## Concurrent continuity changes

Request: "Make the agreed workflow durable for future workers."

Inputs: existing PLAN/TESTING/STATUS own scope, checks, and current action.
Worker is editing these files in a shared worktree. Supervisor has documentation
write authority, but no commit authority or request for recurring supervision.

Expected decisions: route integration through worker, review resulting changes,
and use existing owners. Preserve mandatory checks and concurrent edits. Do not
create a duplicate status ledger, commit, or install a standing monitor.
