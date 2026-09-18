<!--
  ============================================================================
  SYNC IMPACT REPORT
  ============================================================================
  Version change: 1.1.0 → 1.2.0
  Date: 2026-09-15

  Modified principles:
    - (unchanged) I. Test-Driven Development (TDD) — NON-NEGOTIABLE
    - (unchanged) II. Scope Discipline (只做当前需求)
    - (unchanged) III. Architecture Change Approval (架构变更需用户确认)
    - (unchanged) IV. Clarify First, Don't Guess (先澄清不猜测)
    - V. Canonical Repository Scope and Frontend Baseline →
      V. Canonical Frontend Baseline and Technology

  Added sections:
    - Vue 3 + JavaScript frontend technology constraint

  Removed sections: none

  Templates:
    - .specify/templates/plan-template.md       - ✅ updated (frontend stack check added)
    - .specify/templates/spec-template.md       - ✅ aligned (scope boundaries already mandatory)
    - .specify/templates/tasks-template.md      - ✅ updated (Vue 3 + JavaScript documented)
    - .specify/templates/checklist-template.md  - ✅ aligned (no change required)
    - CLAUDE.md                                  - ✅ aligned (no conflicting runtime guidance)

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

### V. Canonical Frontend Baseline and Technology

All project work and generated artifacts MUST remain inside the canonical
repository root `/Users/leelee/Desktop/体检报告/nepstar`.

- The maintained report frontend baseline is
  `reportFront/report-v2`.
- The maintained report frontend MUST use Vue 3 with JavaScript. TypeScript
  MUST NOT be introduced unless the user explicitly approves a later amendment.
- Existing V2 visual styling, assets, responsive behavior, and business output
  MUST be preserved during framework migration unless a requirement changes
  them explicitly.
- Changes to `reportFront/baogaoV2`, any V3 directory, the legacy
  `reportFront/长寿指数UI设计`, or `KH503` MUST NOT be made unless the user explicitly
  places that target in scope.
- Before editing, plans and task lists MUST name the exact target directory.
- Migration of the V2 baseline to Vue 3 + JavaScript is approved by the user.
  Any different framework or additional architectural dependency MUST still
  satisfy Principle III before implementation.

**Rationale**: The repository contains duplicate report versions and several
independent applications. A single declared baseline and frontend stack prevent
fixes from being applied to the wrong copy and keep future work consistent.

## Development Workflow

- Phases execute in order: Clarify → Spec → Plan → Tasks → Implement. Skipping
  a phase requires user consent.
- Within implementation, follow the TDD cycle from Principle I.
- Resolve every target path from the canonical repository root and confirm the
  maintained version before editing.
- Commit after each logical unit of work.
- On discovering a scope or architecture issue mid-implementation, stop and
  confirm before continuing.

## Quality Gates & Change Control

A change is complete only when:

- Requirements were clarified, not guessed (Principle IV).
- Tests exist and were red before implementation (Principle I).
- Scope matches the confirmed requirement (Principle II).
- Any significant architecture change was user-approved (Principle III).
- Every changed file is inside the canonical root and belongs to the explicitly
  selected application/version (Principle V).

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

**Version**: 1.2.0 | **Ratified**: 2026-09-09 | **Last Amended**: 2026-09-15
