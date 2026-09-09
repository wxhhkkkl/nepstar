<!--
  ============================================================================
  SYNC IMPACT REPORT
  ============================================================================
  Version change: (template) → 1.0.0
  Date: 2026-09-09

  Modified principles (initial ratification — all new):
    - (new) I. Test-Driven Development (TDD) — NON-NEGOTIABLE
    - (new) II. Scope Discipline (只做当前需求)
    - (new) III. Architecture Change Approval (架构变更需用户确认)
    - (new) IV. Clarify First, Don't Guess (先澄清不猜测)

  Added sections:
    - Core Principles (4 principles)
    - Development Workflow
    - Quality Gates & Change Control
    - Governance

  Removed sections: none (initial fill of template)

  Templates:
    - .specify/templates/plan-template.md       - ✅ aligned (Constitution Check gate already references this file; no change required)
    - .specify/templates/spec-template.md       - ✅ aligned (NEEDS CLARIFICATION markers + Assumptions section support Clarify-First; no change required)
    - .specify/templates/tasks-template.md      - ✅ updated (test tasks now REQUIRED per TDD principle)
    - .specify/templates/checklist-template.md  - ✅ aligned (no change required)

  Deferred TODOs: none
  ============================================================================
-->

# Nepstar Constitution

## Core Principles

### I. Test-Driven Development (TDD) — NON-NEGOTIABLE

Development MUST be test-first. For every requirement:

1. Write a failing test that expresses the required behavior.
2. Run it and confirm it fails (Red).
3. Implement the minimum code that makes it pass (Green).
4. Refactor only while tests stay green (Refactor).

A feature is NOT done until its tests exist, were confirmed to fail before
implementation, and pass afterward. Skipping the red step invalidates the test.

**Rationale**: A failing test is the only unambiguous statement of the
requirement. TDD makes "done" verifiable rather than a matter of opinion.

### II. Scope Discipline (只做当前需求)

Implementation MUST cover only the current requirement. No speculative
features, no unrequested refactoring, no gold-plating.

- Every change MUST trace to the current requirement.
- Unrelated improvements MUST be reported to the user, never silently
  implemented.
- If work exceeds the confirmed scope, STOP and confirm before continuing.

**Rationale**: Out-of-scope work adds review burden, test surface, and
regression risk without the user asking for it.

### III. Architecture Change Approval (架构变更需用户确认)

Significant architectural changes MUST receive explicit user confirmation
before implementation. This includes: new services or module splits, changes to
storage or communication layers, framework or dependency changes, and redesigns
of existing components.

- Present the change, its motivation, and the alternatives considered.
- Wait for explicit user approval before proceeding.

**Rationale**: Architecture decisions are expensive and hard to reverse; the
user owns the tradeoffs.

### IV. Clarify First, Don't Guess (先澄清不猜测)

When a requirement is ambiguous, incomplete, or contradictory, ASK before
implementing.

- State assumptions explicitly.
- Present multiple interpretations rather than silently choosing one.
- Never guess, invent, or silently fill in gaps.

**Rationale**: A wrong guess ships with high confidence; a short clarifying
question is cheaper than a rewrite.

## Development Workflow

- Phases execute in order: Clarify → Spec → Plan → Tasks → Implement. Skipping
  a phase requires user consent.
- Within implementation, follow the TDD cycle from Principle I.
- Commit after each logical unit of work.
- On discovering a scope or architecture issue mid-implementation, stop and
  confirm before continuing.

## Quality Gates & Change Control

A change is complete only when:

- Requirements were clarified, not guessed (Principle IV).
- Tests exist and were red before implementation (Principle I).
- Scope matches the confirmed requirement (Principle II).
- Any significant architecture change was user-approved (Principle III).

- **Constitution Check**: Plans, specs, and task lists MUST pass a constitution
  compliance check at creation and after design changes.
- **Complexity Justification**: Complexity beyond the current requirement MUST
  be documented and justified in the plan.

## Governance

This constitution supersedes all other development practices in this project.

- **Amendment procedure**: Any participant MAY propose an amendment. An
  amendment MUST state its rationale and receive user approval before taking
  effect. Amendments are recorded in the version history of this file.
- **Versioning policy**: Semantic versioning — MAJOR for principle removal or
  redefinition; MINOR for a new principle or section; PATCH for clarifications
  and wording.
- **Compliance review**: Every plan, spec, task list, and review MUST verify
  compliance with these principles.

**Version**: 1.0.0 | **Ratified**: 2026-09-09 | **Last Amended**: 2026-09-09
