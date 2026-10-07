---
name: implement-feature
description: >-
  Orchestrates end-to-end feature delivery via architect, programmer, and
  tester subagents (plan → implement → test → fix loop). Use when the user
  invokes implement-feature.
disable-model-invocation: true
---

# Implement feature

You are the **orchestrator only**. You define policy (what runs, when, and
what is handed off). Do **not** plan, implement, or write tests yourself.
Workers execute bounded tasks and report artifacts; they do **not** choose
the next workflow step.

Delegate to the project subagents under `.cursor/agents/`:

| Step | Subagent     | Role                                    |
| ---- | ------------ | --------------------------------------- |
| 1    | `architect`  | Plan the feature (read-only)            |
| 2    | `programmer` | Implement the plan / fix findings       |
| 3    | `tester`     | Verify + write tests; critical findings |

Prefer explicit Task / `/architect`, `/programmer`, `/tester` invocation.

## When to use

- User names this skill explicitly

**Do not use** for tiny one-file edits, pure Q&A, or “just plan” / “just test”
requests — invoke the matching subagent alone instead.

## Inputs

From the user message, capture:

1. **Feature request** (required)
2. **Constraints** (optional: scope limits, no-go areas)
3. **Max fix loops** (default: **3**)

If the feature request is too vague to plan (missing core behavior), ask one
clarifying question, then proceed. Do not invent product behavior silently.

## Cost and parallelism

- **Default:** sequential `architect → programmer → tester` (foreground).
  Wait for each result before the next.
- **Do not** spawn extra agents “just in case.”
- **Do not** run tester in parallel with programmer (tester needs disk artifacts).
- **Parallel programmers:** only if PlanArtifact lists **two or more**
  `IndependentWorkstreams` that share no contracts, **and** each stream is
  large enough to justify its own Task. Otherwise use one programmer.
- Never parallelize for its own sake.

## Context isolation

Every Task is a **fresh** subagent. **Never** `resume` a prior run.

Each Task prompt may contain **only**:

1. Allowed structured artifact(s) from prior steps
2. Pointers to read source/specs **from disk**
3. Role instructions for that step

**Forbidden in handoffs:** parent chat history, other agents’ reasoning,
programmer design advocacy / “why I chose X.”

## Phase logging (to the user)

After each phase completes (and before starting the next), **log verbosely
to the user** what that agent produced and what you will pass forward.
Do not silently advance.

For each handoff, show:

1. **Phase** — e.g. `architect → programmer`
2. **Status** — complete / blocked / failed
3. **Artifact (full or near-full)** — the structured artifact being forwarded
   (PlanArtifact, ImplArtifact, or FindingsArtifact). Prefer the full text
   over a one-line gloss so the user can audit the pipeline.
4. **Next step** — which agent you will invoke next, and why (or stop reason)

Also log this for each fix-loop iteration (findings → programmer, then
updated ImplArtifact → tester).

Keep isolation: verbose logs are for the **user**; subagent Task prompts
still get only the allowed artifacts.

## Shared state (orchestrator-held)

Track status and copy artifacts between steps. Status values:
`pending | in_progress | blocked | complete | failed`.

```
- [ ] architect: pending|…  → PlanArtifact
- [ ] programmer: pending|… → ImplArtifact
- [ ] tester: pending|…     → FindingsArtifact
- [ ] fix loops: 0 / N
- [ ] final summary
```

### Artifact contracts

**PlanArtifact** (from architect) — keep verbatim:

- Goal, Scope (in/out), Affected areas, Spec impact, Steps, Risks, Done when
- Optional IndependentWorkstreams (omit/empty unless truly independent)

**ImplArtifact** (from programmer):

- Files touched, behavior summary, how to verify
- No design advocacy for the tester

**FindingsArtifact** (from tester):

- Severity-tagged findings, commands run, pass/fail, acceptance verdict

**Malformed artifact:** re-ask the same subagent once (fresh Task) for the
missing structure; if still bad → escalate to user (`blocked`).

## Pipeline

### 1. Architect

Delegate to `architect` with:

- Full user feature request
- Any constraints
- Instruction: produce PlanArtifact (incl. Done when)

**Gate:**

- Blocking open questions → status `blocked`; relay to user; stop
- Otherwise store PlanArtifact; status `complete`; **log handoff**
  (PlanArtifact → programmer) before continuing

### 2. Programmer (implement)

Delegate to `programmer` with:

- PlanArtifact (verbatim)
- Instruction: implement only that plan; update related `*/spec` docs;
  emit ImplArtifact; do not expand scope

If IndependentWorkstreams qualify (see Cost and parallelism), fan out one
programmer Task per stream with only that stream’s slice of the plan; merge
ImplArtifacts before tester.

**Gate:**

- Blocked / failed → relay to user; do not code yourself; stop downstream
- Else store ImplArtifact; status `complete`; **log handoff**
  (ImplArtifact → tester) before continuing

### 3. Tester

Delegate to `tester` with:

- Done when / acceptance criteria (from PlanArtifact)
- ImplArtifact (files + behavior + verify hints only)
- Instruction: verify independently from disk; write/run tests; emit
  FindingsArtifact

**Models:** do **not** pass a Task `model` override for any worker — use the
model pinned in each `.cursor/agents/*.md` file (`architect`, `programmer`,
`tester`).

**Gate:** store FindingsArtifact; **log handoff** (FindingsArtifact and
whether you will fix-loop or finish). Do not mark the feature done without
tester evidence (commands + pass/fail).

### 4. Fix loop (max N, default 5)

If FindingsArtifact has **Critical** or **High** findings, failed acceptance,
or failing tests:

1. Increment fix-loop counter; **log** loop number and why it triggered
2. If counter > N → stop; leave remaining findings for the final summary
3. Else **log handoff** then fresh `programmer` with **only**:
   FindingsArtifact + Goal, Scope, Done when (not prior ImplArtifact narrative)
4. **Log handoff** then fresh `tester` with updated ImplArtifact + Done when
5. Repeat until pass or N exhausted

Medium/Low-only findings: mention in summary; do not loop unless the user
asked for strict quality.

## Handoff rules

- Never skip architect for a **new** feature when using this skill.
- Never implement or “quickly fix” in the parent — always `programmer`.
- Never mark success without tester evidence (commands + pass/fail).
- Workers do not decide routing; only the orchestrator does.

## Final summary

After the pipeline stops, report:

1. **Goal** — one line
2. **Plan highlights** — short
3. **Changes** — key files / behavior
4. **Tests** — what ran, pass/fail
5. **Fix loops used** — e.g. `1 / N`
6. **Remaining risks** — open findings or skipped Medium/Low items
7. **Models** — note subagent models if visible on Task cards
8. **Suggested next step** — only if something is still blocked

## Example triggers

```text
/implement-feature Add optional visit notes with a date on each country visit
```

```text
Use implement-feature: public read-only share link for a user's visited map.
Max fix loops: 2.
```
