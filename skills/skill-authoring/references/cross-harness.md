# Cross-harness portability

Use this reference when a skill targets more than one agent harness, is distributed independently, contains executable resources, or needs explicit invocation, permissions, file scoping, or UI metadata.

Treat the harness as separate from the model provider. Claude, OpenAI, Gemini, or another model running inside a harness receives the skills, tools, paths, and policies that the harness exposes.

## Portable metadata

Start with the [Agent Skills specification](https://agentskills.io/specification). Keep the shared `SKILL.md` on its common contract:

| Field | Use |
| --- | --- |
| `name` | Required. Lowercase letters, numbers, and single hyphens; match the containing directory. |
| `description` | Required. Concisely state what the skill does, when it should activate, and a nearby exclusion when misrouting is plausible. |
| `license` | Add when distributing under stated terms or referring to a bundled license. Do not invent one. |
| `compatibility` | Add only for real environment requirements such as runtimes, system packages, supported products, network access, or platform limits. Do not use it as a ceremonial list of harness names. |
| `metadata` | Add only when a known consumer or release process uses the string-valued entries. Namespace nonstandard keys when collision is plausible. |
| `allowed-tools` | Experimental and interpreted differently across hosts. Omit by default; use only for a reviewed target deployment where preapproval is necessary and its exact syntax is verified. |

Do not populate optional fields merely because a host accepts them. Unknown fields may be ignored, rejected by validation, or create a false impression that a policy is enforced.

## Portability gate

Before claiming a skill is portable:

1. Keep `SKILL.md` and frontmatter valid under the open specification. Put host-only UI, dependency, or policy files beside it when the host provides a sidecar format.
2. Use relative links and commands such as `references/api.md` and `scripts/check.ts`. Refer to "this skill's directory" in prose when the working directory matters. Do not rely on `<skill-directory>` or another placeholder unless every target expands it.
3. Refer to another skill by its plain name and desired behavior. Do not embed `$skill`, `/skill`, `@skill`, tool-call syntax, or a particular subagent API in shared instructions.
4. Make scripts self-contained within the installed skill, or define and test an inseparable distribution bundle. A sibling import that works only in the source monorepo is not an independently installable skill.
5. Put required runtimes, binaries, environment capabilities, network access, and first-run downloads in `compatibility` or concise setup instructions. Fail with an actionable message when a dependency is absent.
6. Keep permissions outside the skill when possible. A skill's prose and metadata are not security boundaries; host policy, sandboxing, approvals, filesystem permissions, and output handling remain authoritative.
7. Avoid host tool names when describing common operations. State the capability and required outcome, then add a host-specific instruction only when the operation cannot otherwise be selected reliably.
8. Preserve progressive disclosure. Shared descriptions must stay short because every host advertises them differently and may limit or shorten the available-skill catalog.

## Harness matrix

Verify current primary documentation before relying on host-specific behavior. This matrix was reviewed 2026-08-21.

| Harness | Shared `.agents/skills` discovery | Host-specific behavior to use only when needed |
| --- | --- | --- |
| [OpenAI Codex](https://developers.openai.com/codex/skills) | Project and `~/.agents/skills` | `agents/openai.yaml` provides UI metadata, dependency declarations, and `policy.allow_implicit_invocation`. Keep it a sidecar so other hosts can ignore it. |
| [GitHub Copilot](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#skills-reference) | Project and `~/.agents/skills` in supported local surfaces | Supports `argument-hint`, `user-invocable`, `disable-model-invocation`, and host-specific `allowed-tools`. Do not expect a remote cloud agent to read a workstation home directory; distribute remote skills through a repository or organization-supported mechanism. |
| [Gemini CLI](https://geminicli.com/docs/cli/using-agent-skills/) | Workspace and `~/.agents/skills` aliases | Activates skills with user consent. Prefer the core fields unless current Gemini documentation defines an extension that the skill needs. |
| [Cursor](https://cursor.com/docs/skills) | Project and `~/.agents/skills` | Supports `paths`, `disable-model-invocation`, and UI fields such as `icon` and `color`. Keep file scoping and UI decoration out of the portable core unless Cursor is an explicit target requirement. |
| [OpenCode](https://opencode.ai/docs/skills) | Project and `~/.agents/skills` | Recognizes the core fields and ignores unknown frontmatter. Configure skill permissions in OpenCode configuration rather than assuming another host's permission metadata applies. |
| [Pi](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md) | Project and `~/.agents/skills` | Follows the standard but is lenient and also recognizes `disable-model-invocation` and experimental `allowed-tools`. Strictly follow the standard even when Pi accepts a mismatch. |
| [Claude Code](https://code.claude.com/docs/en/slash-commands) | No direct `.agents/skills` discovery documented | Install or symlink the same skill into `.claude/skills` or `~/.claude/skills`. Claude-specific fields include `disable-model-invocation`, `user-invocable`, `context`, `agent`, `argument-hint`, and tool permissions. |

`disable-model-invocation: true` is understood by several hosts, but it is not a universal Agent Skills field. For an explicit-only shared skill, also state the boundary in its description and configure each target host's supported invocation policy. Do not claim strict explicit-only enforcement on a host that merely ignores the field.

## Validation

Use the cheapest checks that support the compatibility claim:

1. Run `skills-ref validate <skill-directory>` when the reference validator is available.
   If a host-bundled validator rejects a field that the current open specification defines, confirm the field against the current specification and report the validator mismatch. Do not silently delete useful portable metadata to satisfy a stale validator.
2. Install or copy the exact distribution unit into a temporary clean location. Confirm its scripts do not depend on the source repository, undeclared packages, or sibling paths.
3. In each claimed harness, confirm discovery, one intended activation, one nearby non-activation, explicit invocation when relevant, and the intended permission behavior.
4. Exercise important scripts with their declared runtime and missing-dependency path. Confirm model-visible output excludes secrets or protected values when that is part of the contract.
5. Record what was actually tested. Passing in one harness or with one underlying model does not establish support in another.
