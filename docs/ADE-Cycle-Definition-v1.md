# ADE Cycle Definition v1

**Version:** 1.0.0  
**Status:** Canonical  
**Date:** January 16, 2026  
**Depends On:** None (this is the foundational reference)

---

## Overview

This document defines the **canonical 9-stage decision cycle** for the Adaptive Decision Engine (ADE). Every ADE decision traverses these stages in order. Each stage has explicit inputs, outputs, invariants, and audit requirements.

**Core Principles:**
- Each stage is **deterministic** — same inputs always produce same outputs
- Each stage emits a **structured artifact** that is logged and replayable
- **Authority boundaries are absolute** — no stage may violate the boundaries of prior stages
- The cycle is **scenario-agnostic** — the same pipeline processes any valid scenario

**Canonical Rule:** All ADE stages operate on a single evolving **Decision Envelope** whose structure is defined in this document. The envelope accumulates stage outputs as it flows through the pipeline.

---

## The 9-Stage Decision Cycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 1: INGEST                                                             │
│  Normalize request into canonical DecisionRequest                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 2: DERIVE STATE                                                       │
│  Compute user state from signals (deterministic, no AI)                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 3: EVALUATE GUARDRAILS                                                │
│  Filter actions by hard constraints → eligible action set                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 4: SCORE AND RANK                                                     │
│  Compute scores (including execution risk) → ranked actions                 │
│  ══════════════════════════════════════════════════════════════════════════ │
│  *** SELECTION LOCKS HERE — selected_action is IMMUTABLE from this point ***│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 5: RESOLVE SKILLS                                                     │
│  Determine which Skills apply + execution mode                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 6: EXECUTE SKILL                                                      │
│  Run Skill (LLM or deterministic) within SEC bounds                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 7: VALIDATE OUTPUT                                                    │
│  Schema + invariant + authority boundary checks                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                              ┌───────┴───────┐
                         PASS ▼          FAIL ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────────────┐
│  Stage 8a: ASSEMBLE RESPONSE    │  │  Stage 8b: FALLBACK                      │
│  Build final decision payload   │  │  Execute deterministic substitute        │
└─────────────────────────────────┘  └─────────────────────────────────────────┘
                              │               │
                              └───────┬───────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 9: AUDIT AND REPLAY                                                   │
│  Store full trace, generate replay token, return decision                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Stage Specifications

---

### Stage 1: INGEST

**Purpose:** Normalize incoming request into a canonical `DecisionRequest` structure.

#### Input
```json
{
  "raw_request": {
    "headers": {},
    "body": {},
    "metadata": {}
  }
}
```

#### Output: `DecisionRequest`
```json
{
  "decision_id": "uuid-v4",
  "request_id": "client-provided-or-null",
  "scenario_id": "string",
  "scenario_version": "semver",
  "user_id": "string",
  "platform_id": "string",
  "timestamp": "ISO8601",
  "execution_mode_override": "deterministic_only | skill_enhanced | null",
  "context": {
    "available_actions": [],
    "signals": {},
    "platform_constraints": {}
  }
}
```

#### Invariants
- `decision_id` MUST be generated (UUID v4)
- `scenario_id` and `scenario_version` MUST be valid and loaded
- `timestamp` MUST be server-generated (not client-provided)
- Invalid requests MUST be rejected before proceeding

#### Audit Artifact
```json
{
  "stage": "ingest",
  "decision_id": "...",
  "input_hash": "sha256-of-raw-request",
  "output": { "DecisionRequest": {} },
  "duration_ms": 2,
  "errors": []
}
```

---

### Stage 2: DERIVE STATE

**Purpose:** Compute user state from signals using deterministic logic. No AI involvement.

#### Input
- `DecisionRequest.context.signals`
- Short-term memory (from KV store)
- Scenario state schema

#### Output: `UserState`
```json
{
  "state_version": "1.0.0",
  "core": {
    "engagement_level": 0.0,
    "recency_score": 0.0,
    "interaction_depth": 0,
    "churn_risk": 0.0
  },
  "scenario_extensions": {},
  "execution_capabilities": {
    "llm_available": true,
    "max_latency_ms": 500,
    "offline_mode": false
  },
  "computed_at": "ISO8601",
  "inputs_hash": "sha256"
}
```

#### Invariants
- State derivation MUST be deterministic (same inputs → same state)
- No AI/ML inference allowed in this stage
- Missing signals MUST use documented defaults
- `inputs_hash` MUST be computed for replay verification

#### Audit Artifact
```json
{
  "stage": "derive_state",
  "decision_id": "...",
  "input": { "signals": {}, "memory": {} },
  "output": { "UserState": {} },
  "duration_ms": 5,
  "defaults_applied": []
}
```

---

### Stage 3: EVALUATE GUARDRAILS

**Purpose:** Apply hard constraints to filter eligible actions. Guardrails are non-negotiable.

#### Input
- `DecisionRequest.context.available_actions`
- `UserState`
- Scenario guardrail definitions

#### Output: `EligibleActions`
```json
{
  "eligible": [
    { "action_id": "...", "passed_guardrails": ["..."] }
  ],
  "rejected": [
    { "action_id": "...", "violated_guardrails": ["..."] }
  ]
}
```

#### Invariants
- Guardrails MUST be evaluated deterministically
- An action is eligible IFF it passes ALL guardrails
- Guardrail violations MUST be logged with reason codes
- If zero actions are eligible, return error (do not proceed)

#### Audit Artifact
```json
{
  "stage": "evaluate_guardrails",
  "decision_id": "...",
  "input": { "actions_count": 5, "state_summary": {} },
  "output": { "eligible_count": 3, "rejected_count": 2 },
  "guardrails_evaluated": ["...", "..."],
  "duration_ms": 3
}
```

---

### Stage 4: SCORE AND RANK

**Purpose:** Compute scores for eligible actions and rank them. Includes execution risk penalty.

#### Input
- `EligibleActions.eligible`
- `UserState`
- Scenario scoring objectives and weights
- Execution capability constraints

#### Output: `RankedActions`
```json
{
  "ranked": [
    {
      "action_id": "...",
      "final_score": 0.87,
      "score_breakdown": {
        "objective_scores": {},
        "execution_risk_penalty": 0.0
      },
      "rank": 1
    }
  ],
  "selected_action": "action_id",
  "selection_locked_at": "ISO8601"
}
```

#### Invariants
- Scoring MUST be deterministic
- Execution risk MUST be factored into final score
- `selected_action` is the highest-ranked action
- **CRITICAL: `selected_action` becomes IMMUTABLE after this stage**

#### Authority Boundary (CANONICAL RULE)
```
After Stage 4 completes, no subsequent stage may alter `selected_action`.
Skills may enrich HOW the action is expressed, never WHAT action is taken.
```

#### Audit Artifact
```json
{
  "stage": "score_and_rank",
  "decision_id": "...",
  "input": { "eligible_count": 3 },
  "output": { 
    "selected_action": "...",
    "top_3_scores": [],
    "execution_risk_applied": true
  },
  "duration_ms": 8,
  "selection_locked": true
}
```

---

### Stage 5: RESOLVE SKILLS

**Purpose:** Determine which Skills apply to the selected action and which execution mode to use.

#### Input
- `selected_action`
- `UserState.execution_capabilities`
- Scenario skill mappings
- `execution_mode_override` (from request)

#### Output: `SkillResolution`
```json
{
  "selected_action": "...",
  "skill_bundle_id": "decision_rationale_template",
  "skill_version": "1.0.0",
  "execution_mode": "deterministic_only | skill_enhanced",
  "fallback_skill_id": "decision_rationale_template",
  "resolution_reason": "llm_unavailable | mode_override | default"
}
```

#### Execution Mode Hierarchy
1. **Request override** (highest priority)
2. **Scenario default**
3. **Engine default**

#### Invariants
- Skill resolution MUST NOT alter `selected_action`
- If no skill is mapped, use `null_skill` (pass-through)
- Fallback skill MUST always be deterministic

#### Audit Artifact
```json
{
  "stage": "resolve_skills",
  "decision_id": "...",
  "input": { "selected_action": "...", "capabilities": {} },
  "output": { "skill_bundle_id": "...", "execution_mode": "..." },
  "duration_ms": 1
}
```

---

### Stage 6: EXECUTE SKILL

**Purpose:** Run the resolved Skill within Skill Execution Contract (SEC) bounds.

#### Input
- `selected_action`
- `UserState`
- `SkillResolution`
- Skill Execution Contract (SEC)

#### Output: `SkillOutput`
```json
{
  "skill_bundle_id": "...",
  "skill_version": "...",
  "execution_mode": "...",
  "payload": {
    "rationale": "string",
    "display_parameters": {},
    "metadata": {}
  },
  "execution_duration_ms": 45,
  "executor_id": "llm_stub | deterministic | cloud_llm"
}
```

#### Invariants
- Skill execution is BOUNDED by SEC
- Skill output MUST conform to SEC output schema
- Skill CANNOT reference or alter `selected_action`
- Timeout MUST trigger fallback, not failure

#### Audit Artifact
```json
{
  "stage": "execute_skill",
  "decision_id": "...",
  "input": { "skill_bundle_id": "...", "execution_mode": "..." },
  "output": { "payload_hash": "sha256", "executor_id": "..." },
  "duration_ms": 45,
  "timeout_occurred": false
}
```

---

### Stage 7: VALIDATE OUTPUT

**Purpose:** Verify Skill output against schema, invariants, and authority boundaries.

#### Input
- `SkillOutput`
- Skill Execution Contract (SEC)
- `selected_action` (for boundary check)

#### Output: `ValidationResult`
```json
{
  "valid": true,
  "checks_passed": [
    "schema_valid",
    "invariants_satisfied",
    "authority_boundary_intact",
    "prohibited_fields_absent"
  ],
  "checks_failed": [],
  "validation_duration_ms": 2
}
```

#### Validation Checks (Required)
1. **Schema validation** — output matches SEC JSON schema
2. **Invariant enforcement** — all SEC invariants satisfied
3. **Authority boundary** — output does not reference/alter action selection
4. **Prohibited fields** — no banned content present

#### Invariants
- Validation is DETERMINISTIC
- Validation failure triggers Stage 8b (Fallback), not error
- All check results MUST be logged

#### Audit Artifact
```json
{
  "stage": "validate_output",
  "decision_id": "...",
  "input": { "payload_hash": "..." },
  "output": { "valid": true, "checks_passed": [], "checks_failed": [] },
  "duration_ms": 2
}
```

---

### Stage 8: FALLBACK (Conditional)

**Purpose:** If validation fails, execute deterministic fallback to ensure a valid decision is always returned.

#### Trigger Condition
- `ValidationResult.valid === false`

#### Input
- `selected_action`
- `UserState`
- Fallback skill definition

#### Output: `FallbackOutput`
```json
{
  "fallback_used": true,
  "fallback_reason_code": "validation_failed | timeout | skill_error",
  "fallback_skill_id": "decision_rationale_template",
  "payload": {
    "rationale": "string (template-generated)",
    "display_parameters": {},
    "metadata": {}
  }
}
```

#### Invariants
- Fallback skill MUST be deterministic (no LLM)
- Fallback MUST produce valid output (guaranteed by design)
- Fallback MUST NOT alter `selected_action`
- Fallback usage MUST be explicitly flagged in response

#### Audit Artifact
```json
{
  "stage": "fallback",
  "decision_id": "...",
  "trigger_reason": "validation_failed",
  "original_validation_errors": [],
  "fallback_skill_id": "...",
  "output": { "payload_hash": "..." },
  "duration_ms": 1
}
```

---

### Stage 9: AUDIT AND REPLAY

**Purpose:** Store complete decision trace, generate replay token, assemble and return final response.

#### Input
- All stage artifacts
- Final payload (from Stage 7 or Stage 8)

#### Output: `DecisionResponse`
```json
{
  "decision": {
    "decision_id": "uuid",
    "selected_action": "action_id",
    "payload": {},
    "ranked_options": []
  },
  "state": {},
  "execution": {
    "execution_mode": "deterministic_only | skill_enhanced",
    "skill_bundle_id": "...",
    "skill_version": "...",
    "validation_status": "passed | failed",
    "fallback_used": false,
    "fallback_reason_code": null
  },
  "audit": {
    "decision_id": "uuid",
    "replay_token": "...",
    "scenario_id": "...",
    "scenario_version": "...",
    "scenario_hash": "sha256",
    "trace_id": "..."
  },
  "meta": {
    "request_id": "client-provided-or-null",
    "timestamp": "ISO8601",
    "total_duration_ms": 67,
    "api_version": "1.0.0"
  }
}
```

#### Replay Token Structure
```json
{
  "decision_id": "uuid",
  "scenario_hash": "sha256",
  "inputs_hash": "sha256",
  "created_at": "ISO8601"
}
```

The replay token enables:
1. **Audit retrieval** — fetch stored trace by `decision_id`
2. **Deterministic re-execution** — re-run with same inputs + scenario hash, verify identical output

#### Invariants
- Full trace MUST be stored before response is returned
- `replay_token` MUST be included in every response
- Trace retention period: configurable (default 90 days)

#### Audit Artifact (Full Trace)
```json
{
  "trace_version": "1.0.0",
  "decision_id": "uuid",
  "scenario_id": "...",
  "scenario_version": "...",
  "scenario_hash": "sha256",
  "timestamp": "ISO8601",
  "stages": {
    "ingest": {},
    "derive_state": {},
    "evaluate_guardrails": {},
    "score_and_rank": {},
    "resolve_skills": {},
    "execute_skill": {},
    "validate_output": {},
    "fallback": null,
    "audit_and_replay": {}
  },
  "final_decision": {},
  "replay_token": "...",
  "total_duration_ms": 67
}
```

---

## Authority Boundary Enforcement

### The Canonical Rule

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AFTER STAGE 4 (SCORE AND RANK):                                            │
│                                                                             │
│  • selected_action is IMMUTABLE                                             │
│  • No component may alter WHAT action is taken                              │
│  • Skills may only enrich HOW the action is expressed                       │
│  • Validators MUST reject any output that attempts to influence selection   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Boundary Violations (Automatic Rejection)

The following are **always rejected** by Stage 7 validation:

| Violation | Example | Result |
|-----------|---------|--------|
| Action reference | Skill output contains `"recommended_action": "..."` | Reject |
| Score manipulation | Skill output contains scoring data | Reject |
| State mutation | Skill output attempts to modify user state | Reject |
| Guardrail override | Skill output references guardrail bypass | Reject |

---

## Deterministic Mode

### Definition

In **deterministic mode**, the entire cycle produces identical output for identical inputs.

### Activation Hierarchy

1. **Request override:** `execution_mode_override: "deterministic_only"`
2. **Scenario default:** `scenario.execution.default_mode: "deterministic_only"`
3. **Engine default:** `engine.config.default_mode: "deterministic_only"`

### Deterministic Mode Guarantees

- Stage 6 uses deterministic skill only (no LLM)
- All randomness is seeded or eliminated
- Replay verification is guaranteed to match

---

## Error Handling

### Stage-Level Errors

| Stage | Error Condition | Behavior |
|-------|-----------------|----------|
| 1 (Ingest) | Invalid request | Return 400, no trace stored |
| 2 (Derive State) | KV unavailable | Use cold-start defaults, continue |
| 3 (Guardrails) | Zero eligible actions | Return 422 `NO_ELIGIBLE_ACTIONS`, trace stored |
| 4 (Score/Rank) | Scoring failure | Return 500, trace stored |
| 5 (Resolve Skills) | Skill not found | Use null_skill, continue |
| 6 (Execute Skill) | Timeout/error | Trigger fallback |
| 7 (Validate) | Validation failure | Trigger fallback |
| 8 (Fallback) | Fallback failure | Return 500, trace stored |
| 9 (Audit) | Storage failure | Log error, return response anyway |

### Canonical Error Rule

```
ADE always returns a lawful decision if at least one action is eligible.
Degradation is explicit (flagged), never silent.
```

---

## Latency Targets

| Stage | Target | Hard Limit |
|-------|--------|------------|
| 1. Ingest | 2ms | 10ms |
| 2. Derive State | 5ms | 20ms |
| 3. Guardrails | 3ms | 15ms |
| 4. Score/Rank | 10ms | 30ms |
| 5. Resolve Skills | 1ms | 5ms |
| 6. Execute Skill (deterministic) | 5ms | 20ms |
| 6. Execute Skill (`skill_enhanced`) | 200ms | 500ms |
| 7. Validate | 2ms | 10ms |
| 8. Fallback | 5ms | 20ms |
| 9. Audit | 5ms | 20ms |
| **Total (deterministic)** | **33ms** | **150ms** |
| **Total (`skill_enhanced`)** | **230ms** | **600ms** |

---

## What Flows From This Definition

| Artifact | Status |
|----------|--------|
| ADE-Skill-Execution-Contract-v1.md | Unblocked |
| ADE-Validators-v1.md | Unblocked |
| ADE-Scenario-Schema-v1.md | Unblocked |
| Engine Implementation | Unblocked |
| Audit Storage Schema | Defined above |
| Replay Mechanism | Defined above |

---

## Appendix A: Stage Dependency Graph

```
ingest
   │
   ▼
derive_state
   │
   ▼
evaluate_guardrails
   │
   ▼
score_and_rank ─────────────────┐
   │                            │
   ▼                            │ (selected_action locked)
resolve_skills                  │
   │                            │
   ▼                            │
execute_skill                   │
   │                            │
   ▼                            │
validate_output ────────────────┤
   │         │                  │
   │    FAIL ▼                  │
   │    fallback                │
   │         │                  │
   ▼         ▼                  │
audit_and_replay ◄──────────────┘
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Decision** | The complete output of one ADE cycle |
| **Action** | A candidate option that ADE may select |
| **Skill** | A bounded executor that enriches action payloads |
| **Null Skill** | A no-op skill that produces an empty payload and bypasses Stage 6 execution logic |
| **SEC** | Skill Execution Contract — defines skill boundaries |
| **Guardrail** | A hard constraint that filters eligible actions |
| **Scenario** | A pluggable configuration (state + guardrails + scoring + skills) |
| **Replay Token** | A key enabling audit retrieval and deterministic re-execution |
| **Authority Boundary** | The immutable line after which selection cannot change |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-16 | Initial canonical definition |
