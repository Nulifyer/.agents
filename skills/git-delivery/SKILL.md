---
name: git-delivery
description: Use when staging or committing repository changes, curating delivery history, or creating, updating, monitoring, or merging a pull or merge request. Do not use for ordinary edits, read-only Git inspection, or unrequested repository mutations.
compatibility: Requires Git. Hosted pull or merge request actions require an available host client or API and authorization.
---

# Git delivery

Turn completed work into a small, inspectable change and a durable explanation.
Local history is working memory. Published history is the record other people
must review, search, revert, and trust.

## Route the work

Read only the references needed for the requested delivery stage:

- For staging, committing, or curating local history, read
  [commit delivery](references/commit.md).
- For creating or updating a pull or merge request, read
  [change-request writing](references/change-request.md).
- For pushing, monitoring checks or review, merging, or other remote lifecycle
  work, read [remote lifecycle](references/remote-lifecycle.md).

Read multiple references when the request spans those stages.

## Respect authority and repository rules

- Read applicable repository instructions before choosing branch, commit, test,
  push, or change-request behavior. Inspect the repository template when its
  delivery requirements are unclear.
- Editing, fixing, or testing does not authorize staging, committing, pushing,
  opening a change request, or merging. A request to commit authorizes the local
  commit only. A request to open a change request includes the branch push
  needed to open it, but not merging it.
- Never rewrite shared history, force-push, merge, or delete branches without
  clear authorization. Follow the repository's required merge method.
- Preserve unrelated work. Treat existing modifications and untracked files as
  belonging to the user unless the task proves otherwise.
- Do not change hooks, commit linting, CI, branch protection, or repository
  policy merely to deliver one change. Existing enforcement still applies.
- Use the available source-control capability. Do not require a particular host
  or client when plain Git or another supported interface can finish the work.

## Shape the delivery unit

One public commit or change request should carry one coherent concern. Keep a
behavior change with its focused tests and required documentation. Split work
when owners, reasons, or verification differ and each part can stand on its own.

Separate preparatory refactors, generated changes, or mechanical rewrites when
that makes the semantic change easier to review and every intermediate state
remains valid. Size is conceptual: a large deletion may be simple, while a
small diff crossing several responsibilities may need splitting.

Use stacked changes only when dependent units remain independently reviewable.
Name their dependencies and do not add stack-specific tooling unless it earns
its setup cost. Working commits may be frequent and imperfect; clean published
history at the delivery boundary using the repository's squash, rebase, or
merge policy without rewriting commits other people may depend on.

## Keep claims and prose trustworthy

Apply `unslop` to commit text, change requests, review replies, and merge
messages. Apply `evidence-discipline` to test, performance, safety, and
completion claims. Name checks that ran and what they covered; do not turn a
focused test into a broader claim or run unrelated checks merely to inflate the
evidence.

After the requested stage, report the resulting commit, branch, change request,
check state, or merge state that was actually observed. Keep unrequested later
stages separate.
