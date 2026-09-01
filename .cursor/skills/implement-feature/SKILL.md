---
name: implement-feature
description: >-
  Orchestrates end-to-end feature delivery via architect, programmer, and
  tester subagents (plan → implement → test → fix loop). Use when the user
  asks to implement or build a feature autonomously, run the feature pipeline,
  or invokes implement-feature.
disable-model-invocation: true
---

# Implement feature

You are the orchestrator only. Do **not** plan, implement, or write tests
yourself. Delegate to the project subagents under `.cursor/agents/`:

| Step | Subagent     | Role                                    |
| ---- | ------------ | --------------------------------------- |
| 1    | `architect`  | Plan the feature (read-only)            |
| 2    | `programmer` | Implement the plan / fix findings       |
| 3    | `tester`     | Write + run unit tests; report findings |

Prefer explicit Task / `/architect`, `/programmer`, `/tester` invocation.
Run steps **sequentially** (foreground). Wait for each result before the next.

## When to use

- User wants a full feature built with plan + code + tests
- User says “autonomously”, “end-to-end”, or names this skill

**Do not use** for tiny one-file edits, pure Q&A, or “just plan” / “just test”
requests — invoke the matching subagent alone instead.

## Inputs

From the user message, capture:

1. **Feature request** (required)
2. **Constraints** (optional: scope limits, no-go areas)
3. **Max fix loops** (default: **3**)

If the feature request is too vague to plan (missing core behavior), ask one
clarifying question, then proceed. Do not invent product behavior silently.

## Pipeline

Track progress:

```
- [ ] architect: plan ready
- [ ] programmer: implementation done
- [ ] tester: verification done
- [ ] fix loops: 0 / N
- [ ] final summary
```

### 1. Architect

Delegate to `architect` with:

- Full user feature request
- Any constraints
- Instruction: produce plan with goal, scope, steps, spec impact, acceptance
  criteria (“done when”)

**Gate:** Stop if architect returns blocking open questions — relay to user.
Otherwise keep the **full plan text** for later steps.

### 2. Programmer (implement)

Delegate to `programmer` with:

- Complete architect plan (verbatim)
- Instruction: implement only that plan; update related `*/spec` docs; do not
  expand scope

**Gate:** If programmer is blocked, relay blockers to user. Do not code yourself.

### 3. Tester

Delegate to `tester` with:

- Original acceptance criteria / “done when”
- Programmer’s change summary (files + behavior)
- Instruction: write/run relevant unit tests; report structured findings

### 4. Fix loop (max N, default 3)

If tester reports **Critical** or **High** findings, failed acceptance, or
failing tests:

1. Increment fix-loop counter
2. If counter > N → stop looping; include remaining findings in final summary
3. Else delegate to `programmer` with **only** the tester findings + enough plan
   context to stay on scope
4. Delegate to `tester` again with updated change summary
5. Repeat until pass or N exhausted

Medium/Low-only findings: mention in summary; do not loop unless the user asked
for strict quality.

## Handoff rules

- Each subagent starts with empty context — **pass all needed text** in the
  Task prompt every time.
- Never skip architect for a **new** feature when using this skill.
- Never implement or “quickly fix” in the parent — always `programmer`.
- Never mark success without tester evidence (commands + pass/fail).

## Final summary

After the pipeline stops, report:

1. **Goal** — one line
2. **Plan highlights** — short
3. **Changes** — key files / behavior
4. **Tests** — what ran, pass/fail
5. **Fix loops used** — e.g. `1 / 3`
6. **Remaining risks** — open findings or skipped Medium/Low items
7. **Suggested next step** — only if something is still blocked

## Example triggers

```text
/implement-feature Add optional visit notes with a date on each country visit
```

```text
Use implement-feature: public read-only share link for a user's visited map.
Max fix loops: 2.
```
