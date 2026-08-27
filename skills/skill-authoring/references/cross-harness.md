# Cross-harness portability

Use this reference when a skill targets more than one agent harness, is distributed independently, contains executable resources, or needs explicit invocation, permissions, file scoping, or UI metadata.

Treat the harness as separate from the model provider. Claude, OpenAI, Gemini, or another model running inside a harness receives the skills, tools, paths, and policies that the harness exposes.

## Primary compatibility profile

The default compatibility target for this collection is:

- OpenAI Codex;
- GitHub Copilot CLI and supported Copilot agent surfaces;
- OpenCode.

All three discover personal skills from `~/.agents/skills/<name>/SKILL.md` and repository skills from `.agents/skills/<name>/SKILL.md`. Use that shared location as the source of truth. A remote Copilot cloud job does not receive a workstation home directory; put required remote skills in the repository or an organization-supported source.

The portable frontmatter intersection is `name`, `description`, `license`, `compatibility`, and string-valued `metadata`. `name` and `description` are required. Omit `allowed-tools` in the default profile: the Agent Skills specification marks it experimental, Copilot assigns host-specific semantics, and OpenCode does not list it among recognized fields.

Use the smallest representation that owns the behavior:

| Need | Representation |
| --- | --- |
| Reusable instructions, scripts, references, or assets loaded on demand | Portable skill |
| Stable repository rules that apply to every task | Repository instruction file, normally `AGENTS.md` |
| Deterministic lifecycle behavior such as pre-compaction or stop handling | Host hook or adapter |
| A new external operation or service | Host tool, MCP server, or plugin |
| Session creation, permission policy, or host UI metadata | Host adapter or sidecar, never portable prose alone |

Do not create parallel copies of a skill for the three primary harnesses. Add a host layer only for behavior outside the shared specification.

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

## Primary harness layers

Verify current primary documentation before relying on host-specific behavior. This profile was reviewed 2026-08-27.

| Harness | Shared discovery | Host layer to use only when required |
| --- | --- | --- |
| [OpenAI Codex skills](https://developers.openai.com/codex/skills), [plugins](https://developers.openai.com/codex/plugins), and [hooks](https://developers.openai.com/codex/hooks) | Repository ancestors and `~/.agents/skills` | `agents/openai.yaml` owns presentation, tool dependencies, and `policy.allow_implicit_invocation`. Codex plugins own bundled hooks and other installable components. Changed hooks require trust review. |
| [GitHub Copilot skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills), [CLI plugins](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference), and [hooks](https://docs.github.com/en/copilot/reference/hooks-reference) | Repository and `~/.agents/skills` on documented local surfaces | Copilot-only skills may use `argument-hint`, `user-invocable`, `disable-model-invocation`, and Copilot `allowed-tools`. Plugins use a root `plugin.json`; hooks use `hooks.json` or `hooks/hooks.json`. Keep these extensions out of a portable skill. |
| [OpenCode skills](https://opencode.ai/docs/skills) and [plugins](https://opencode.ai/docs/plugins) | Repository ancestors and `~/.agents/skills` | Configure skill allow, ask, or deny policy in `opencode.json`. Use a TypeScript or JavaScript OpenCode plugin only when lifecycle or host APIs are truly required; plugin APIs are a separate compatibility surface from Agent Skills. |

`disable-model-invocation: true` is not portable. For an explicit-only shared skill, state the boundary in the description and configure each host's supported policy. Do not claim enforcement when a host merely ignores an unknown field.

Other harnesses may also discover `.agents/skills`, but they are outside this collection's default compatibility claim. When one becomes an explicit target, verify its current primary documentation and add only the necessary host layer; do not introduce a second portable layout.

## Validation

Use the cheapest checks that support the compatibility claim:

1. Run `skills-ref validate <skill-directory>` when the reference validator is available.
   If a host-bundled validator rejects a field that the current open specification defines, confirm the field against the current specification and report the validator mismatch. Do not silently delete useful portable metadata to satisfy a stale validator.
2. Install or copy the exact distribution unit into a temporary clean location. Confirm its scripts do not depend on the source repository, undeclared packages, or sibling paths.
3. In each claimed harness, confirm discovery, one intended activation, one nearby non-activation, explicit invocation when relevant, and the intended permission behavior.
4. Exercise important scripts with their declared runtime and missing-dependency path. Confirm model-visible output excludes secrets or protected values when that is part of the contract.
5. Record what was actually tested. Passing in one harness or with one underlying model does not establish support in another.

For the primary profile:

- Codex: inspect `/skills` or the App Server skill list; verify `agents/openai.yaml` behavior separately from core discovery. Validate and reinstall a changed plugin, then review its hook hash with `/hooks`.
- Copilot: inspect `/skills list` or `copilot plugins list`. For a plugin, install the exact directory and verify its root `plugin.json`, hook discovery, and permission behavior.
- OpenCode: run `opencode debug skill` and confirm the skill appears from the intended project or global location, then exercise the native `skill` tool. Check `opencode.json` permission patterns separately; an ignored frontmatter field is not a permission test.
