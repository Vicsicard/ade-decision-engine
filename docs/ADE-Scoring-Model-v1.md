# ADE Scoring Model v1

**Version:** 1.0.0  
**Status:** Canonical  
**Date:** January 16, 2026  
**Depends On:** ADE-Cycle-Definition-v1.md, ADE-State-Schema-v1.md, ADE-Scenario-Schema-v1.md

---

## Overview

This document defines the **Scoring Model Framework** for ADE v1. The scoring model determines how eligible actions are ranked after guardrails have filtered the candidate set.

**Core Principles:**
- Scoring operates **only on eligible actions** (guardrails run first)
- Scoring is **deterministic** — same state + same actions = same scores
- Scoring is **explainable** — weights are explicit, formulas are auditable
- Scoring is **scenario-driven** — objectives and weights are defined per scenario
- Scoring includes **execution risk** — actions must be safely executable

**Normative Statement:** Scoring occurs in Stage 4 of the ADE Cycle. After scoring completes, `selected_action` is **immutable** — no subsequent stage may alter it.

---

## Scoring Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  INPUT: Eligible Actions + User State (from Stage 3)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. LOAD SCENARIO SCORING CONFIG                                             │
│     - Objectives with weights                                               │
│     - Execution risk settings                                               │
│     - Tie-breaking rules                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. COMPUTE OBJECTIVE SCORES                                                 │
│     For each eligible action:                                               │
│     - Evaluate each objective formula                                       │
│     - Each returns 0.0 - 1.0                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. COMPUTE EXECUTION RISK                                                   │
│     For each eligible action:                                               │
│     - Assess skill availability                                             │
│     - Assess latency constraints                                            │
│     - Compute risk penalty                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. COMPUTE FINAL SCORE                                                      │
│     final_score = weighted_objective_sum - execution_risk_penalty           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. RANK AND SELECT                                                          │
│     - Sort by final_score descending                                        │
│     - Apply tie-breaking rules                                              │
│     - selected_action = top-ranked action                                   │
│     ════════════════════════════════════════════════════════════════════    │
│     *** SELECTION LOCKS HERE ***                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  OUTPUT: RankedActions + selected_action → Stage 5 (Skill Resolution)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Scoring Framework (Abstract)

The scoring framework is **scenario-agnostic**. Scenarios define their own objectives; the framework provides the computation model.

### Objective Structure

```typescript
interface ScoringObjective {
  objective_id: string;           // Unique identifier
  name: string;                   // Human-readable name
  weight: number;                 // 0.05 - 0.50
  formula: string;                // Expression returning 0.0-1.0
  inputs: string[];               // Required state/action fields
  description: string;            // What this objective measures
}
```

### Weight Constraints

| Constraint | Rule |
|------------|------|
| Minimum weight | 0.05 (no objective is negligible) |
| Maximum weight | 0.50 (no single objective dominates) |
| Sum of weights | Must equal 1.0 |
| Minimum objectives | 2 (single-objective is not scoring) |

### Formula Requirements

| Requirement | Description |
|-------------|-------------|
| Output range | Must return value in [0.0, 1.0] |
| Deterministic | Same inputs → same output |
| No side effects | Pure computation only |
| Bounded complexity | O(1) or O(n) where n = action attributes |

---

## 2. Objective Score Computation

For each eligible action, each objective formula is evaluated.

### Formula Evaluation

```typescript
function evaluateObjective(
  objective: ScoringObjective,
  action: Action,
  state: UserState
): number {
  // 1. Gather inputs from state and action
  const inputs = gatherInputs(objective.inputs, action, state);
  
  // 2. Evaluate formula
  const rawScore = evaluateFormula(objective.formula, inputs);
  
  // 3. Clamp to valid range
  return clamp(rawScore, 0.0, 1.0);
}
```

### Input Sources

| Source | Access Pattern | Example |
|--------|----------------|---------|
| Core state | `state.core.{dimension}` | `state.core.engagement_level` |
| Scenario state | `state.scenario_extensions.{dimension}` | `state.scenario_extensions.fatigue_score` |
| Action attributes | `action.attributes.{field}` | `action.attributes.intensity` |
| Action metadata | `action.{field}` | `action.type_id` |

### Built-in Functions

The formula language supports these built-in functions:

| Function | Signature | Description |
|----------|-----------|-------------|
| `clamp` | `clamp(value, min, max)` | Constrain to range |
| `abs` | `abs(value)` | Absolute value |
| `min` | `min(a, b)` | Minimum of two values |
| `max` | `max(a, b)` | Maximum of two values |
| `if_else` | `if_else(condition, then, else)` | Conditional |
| `map_enum` | `map_enum(value, mapping)` | Map enum to number |

---

## 3. Execution Risk

Execution risk ensures ADE only selects actions it can safely execute given current capabilities.

### Execution Risk Model

```typescript
interface ExecutionRisk {
  enabled: boolean;
  weight: number;                 // Penalty weight (typically 0.05-0.15)
  factors: ExecutionRiskFactor[];
}

interface ExecutionRiskFactor {
  factor: string;                 // Factor identifier
  condition: string;              // When this factor applies
  penalty: number;                // Penalty amount (0.0-1.0)
}
```

### Standard Risk Factors

| Factor | Condition | Typical Penalty | Description |
|--------|-----------|-----------------|-------------|
| `skill_unavailable` | Required skill's LLM executor unavailable | 0.3 | Action needs LLM but none available |
| `high_latency_mode` | `max_latency_ms < 200` | 0.1 | Tight latency budget |
| `offline_mode` | `offline_mode == true` | 0.2 | Running offline |
| `complex_skill` | Skill has high token requirement | 0.1 | May timeout |

### Risk Penalty Computation

```typescript
function computeExecutionRisk(
  action: Action,
  state: UserState,
  riskConfig: ExecutionRisk
): number {
  if (!riskConfig.enabled) return 0.0;
  
  let totalPenalty = 0.0;
  
  for (const factor of riskConfig.factors) {
    if (evaluateCondition(factor.condition, action, state)) {
      totalPenalty += factor.penalty;
    }
  }
  
  // Cap at 1.0
  return Math.min(totalPenalty, 1.0) * riskConfig.weight;
}
```

### Why Execution Risk Matters

Without execution risk:
- ADE might select an action requiring LLM when LLM is unavailable
- Fallback would always trigger, degrading user experience
- Decision quality would be unpredictable

With execution risk:
- ADE prefers actions it can fully execute
- Fallback is rare, not routine
- Decision quality is consistent

---

## 4. Final Score Computation

### Formula

```
final_score = weighted_objective_sum - execution_risk_penalty

where:
  weighted_objective_sum = Σ (objective_score[i] × weight[i])
  execution_risk_penalty = computed_risk × risk_weight
```

### Score Breakdown Structure

```typescript
interface ScoreBreakdown {
  action_id: string;
  objective_scores: Record<string, number>;  // objective_id → score
  weighted_sum: number;
  execution_risk_penalty: number;
  final_score: number;
}
```

### Example Computation

```
Action: yoga-recovery-01
State: { engagement_level: 0.65, fatigue_score: 0.72 }

Objectives:
  completion_likelihood: 0.85 × 0.35 = 0.2975
  fatigue_management:    0.95 × 0.25 = 0.2375
  engagement_momentum:   0.70 × 0.25 = 0.1750
  novelty_optimization:  0.60 × 0.15 = 0.0900
  
Weighted Sum: 0.80

Execution Risk:
  skill_unavailable: false → 0.0
  high_latency_mode: false → 0.0
  Risk Penalty: 0.0

Final Score: 0.80 - 0.0 = 0.80
```

---

## 5. Ranking and Selection

### Ranking

Actions are sorted by `final_score` descending.

### Tie-Breaking

When two actions have identical scores (within 0.001), tie-breaking rules apply in order:

```typescript
type TieBreaker = 
  | "score_desc"        // Higher score wins (default)
  | "intensity_asc"     // Lower intensity wins
  | "duration_asc"      // Shorter duration wins
  | "complexity_asc"    // Simpler action wins
  | "action_id_asc"     // Alphabetical (deterministic fallback)
```

Scenarios define their tie-breaking order. Default: `["score_desc", "action_id_asc"]`

### Selection

```typescript
function selectAction(rankedActions: RankedAction[]): string {
  // Top-ranked action wins
  return rankedActions[0].action_id;
}
```

### Selection Lock

**After selection, `selected_action` is IMMUTABLE.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CANONICAL RULE:                                                            │
│                                                                             │
│  After Stage 4 completes:                                                   │
│  • selected_action cannot be changed                                        │
│  • Skills may enrich HOW the action is expressed                            │
│  • Skills may NOT change WHAT action was selected                           │
│  • Validators MUST reject any attempt to alter selection                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Scoring Output

### RankedActions Structure

```typescript
interface RankedActions {
  ranked: RankedAction[];
  selected_action: string;
  selection_locked_at: string;  // ISO8601
}

interface RankedAction {
  action_id: string;
  rank: number;
  final_score: number;
  score_breakdown: ScoreBreakdown;
  eligible: boolean;
}
```

### Example Output

```json
{
  "ranked": [
    {
      "action_id": "yoga-recovery-01",
      "rank": 1,
      "final_score": 0.80,
      "score_breakdown": {
        "objective_scores": {
          "completion_likelihood": 0.85,
          "fatigue_management": 0.95,
          "engagement_momentum": 0.70,
          "novelty_optimization": 0.60
        },
        "weighted_sum": 0.80,
        "execution_risk_penalty": 0.0
      },
      "eligible": true
    },
    {
      "action_id": "strength-moderate-02",
      "rank": 2,
      "final_score": 0.65,
      "score_breakdown": { },
      "eligible": true
    }
  ],
  "selected_action": "yoga-recovery-01",
  "selection_locked_at": "2026-01-16T09:15:00.123Z"
}
```

---

## 7. Audit Requirements

### What Gets Logged

Every scoring computation produces an audit record:

```json
{
  "audit_type": "scoring",
  "decision_id": "uuid",
  "scenario_id": "fitness-daily-session",
  "timestamp": "ISO8601",
  "input": {
    "eligible_actions_count": 5,
    "state_hash": "sha256"
  },
  "computation": {
    "objectives_evaluated": ["..."],
    "execution_risk_applied": true
  },
  "output": {
    "selected_action": "yoga-recovery-01",
    "top_3_scores": [0.80, 0.65, 0.52],
    "selection_margin": 0.15
  },
  "duration_ms": 8
}
```

### Rationale Generation

When requested, scoring can generate human-readable rationale:

```
"yoga-recovery-01 recommended because: User fatigue elevated (0.72); 
low-intensity session preferred for recovery. 
Primary factor: fatigue_management (0.95)."
```

---

## 8. Scenario Scoring Examples

### Example A: Fitness Daily Session

```json
{
  "objectives": [
    {
      "objective_id": "completion_likelihood",
      "name": "Completion Likelihood",
      "weight": 0.35,
      "formula": "(intensity_match * 0.6) + (duration_fit * 0.4)",
      "inputs": ["state.scenario_extensions.fatigue_score", "action.attributes.intensity"],
      "description": "Probability user completes this session"
    },
    {
      "objective_id": "fatigue_management",
      "name": "Fatigue Management",
      "weight": 0.25,
      "formula": "if_else(projected_fatigue > 0.9, 0.0, if_else(projected_fatigue > 0.7, 0.3, 1.0))",
      "inputs": ["state.scenario_extensions.fatigue_score", "action.attributes.intensity"],
      "description": "Avoid overtraining"
    },
    {
      "objective_id": "engagement_momentum",
      "name": "Engagement Momentum",
      "weight": 0.25,
      "formula": "momentum_score(state.core.engagement_level, action.attributes.intensity)",
      "inputs": ["state.core.engagement_level", "action.attributes.intensity"],
      "description": "Maintain engagement streak"
    },
    {
      "objective_id": "novelty_optimization",
      "name": "Novelty Optimization",
      "weight": 0.15,
      "formula": "novelty_score(state.scenario_extensions.novelty_balance, action.attributes.type)",
      "inputs": ["state.scenario_extensions.novelty_balance", "action.attributes.session_type"],
      "description": "Balance variety vs familiarity"
    }
  ],
  "execution_risk": {
    "enabled": true,
    "weight": 0.10,
    "factors": [
      { "factor": "skill_unavailable", "condition": "!state.execution_capabilities.llm_available", "penalty": 0.3 }
    ]
  },
  "tie_breaking": ["intensity_asc", "duration_asc", "action_id_asc"]
}
```

### Example B: Notification Timing

```json
{
  "objectives": [
    {
      "objective_id": "engagement_potential",
      "name": "Engagement Potential",
      "weight": 0.50,
      "formula": "state.core.engagement_level * (1.0 - state.scenario_extensions.notification_fatigue)",
      "inputs": ["state.core.engagement_level", "state.scenario_extensions.notification_fatigue"],
      "description": "Likelihood of positive engagement"
    },
    {
      "objective_id": "timing_quality",
      "name": "Timing Quality",
      "weight": 0.50,
      "formula": "state.scenario_extensions.optimal_hour_score",
      "inputs": ["state.scenario_extensions.optimal_hour_score"],
      "description": "How good is this time for the user"
    }
  ],
  "execution_risk": {
    "enabled": true,
    "weight": 0.05,
    "factors": []
  },
  "tie_breaking": ["action_id_asc"]
}
```

---

## 9. Testing Requirements

### Unit Tests

| Test | Input | Expected |
|------|-------|----------|
| Single objective | One objective, one action | Correct score |
| Multiple objectives | Four objectives, weights sum to 1.0 | Weighted sum correct |
| Execution risk | LLM unavailable | Penalty applied |
| Tie-breaking | Two actions, same score | Deterministic winner |
| Edge case: all low | All objectives score 0.1 | Valid ranking |
| Edge case: all high | All objectives score 0.9 | Valid ranking |

### Integration Tests

| Test | Scenario | Expected |
|------|----------|----------|
| Fitness scoring | Full fitness scenario | Correct selection |
| Notification scoring | Full notification scenario | Correct selection |
| Cross-scenario | Same state, different scenarios | Different selections |

---

## 10. Performance Requirements

| Metric | Target | Hard Limit |
|--------|--------|------------|
| Per-action scoring | 1ms | 5ms |
| Total scoring (10 actions) | 10ms | 30ms |
| Memory per action | 1KB | 10KB |

---

## What Flows From This Model

| Artifact | Status |
|----------|--------|
| Scoring Engine Implementation | Unblocked |
| Scenario Scoring Validation | Unblocked |
| Rationale Generation | Unblocked |
| Audit Logging | Defined above |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-16 | Refactored to abstract framework with scenario examples |
