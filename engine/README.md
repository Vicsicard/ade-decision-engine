# @ade/engine

**Deterministic decision engine with audit-grade replay.**

ADE is not an AI that decides—it is a system that decides about AI, safely, deterministically, and audibly.

## What ADE Is

- A **9-stage decision pipeline** with immutable selection after scoring
- **Authority separation**: the engine decides, skills only narrate
- **Deterministic replay**: same inputs → same outputs, always
- **Audit-grade traces**: every decision is fully reconstructable
- **Governance-first**: versioned authority patterns and prohibitions

## What ADE Is Not

- Not an AI/ML model
- Not a recommendation engine
- Not a chatbot or copilot
- Not a system that "learns" inline (learning is post-decision, pre-next-decision)

## Who Should Use ADE

- **Regulated decision systems** — finance, healthcare, safety-critical
- **AI-assisted products needing auditability** — explain every decision
- **Products that must explain why** — not just what action occurred
- **Teams replacing heuristic sprawl** — with deterministic control

## Quick Start

```typescript
import { createEngine } from '@ade/engine';

// 1. Create engine
const engine = await createEngine();

// 2. Register your scenario
await engine.registerScenario({
  scenario_id: 'my-scenario',
  version: '1.0.0',
  // ... scenario definition
});

// 3. Make a decision
const response = await engine.decide({
  scenario_id: 'my-scenario',
  user_id: 'user-123',
  actions: [
    { action_id: 'action-a', type_id: 'my_action', attributes: {} },
    { action_id: 'action-b', type_id: 'my_action', attributes: {} },
  ],
  signals: {
    engagement_score: 0.7,
    days_since_last_action: 2,
  },
  context: {
    current_time: new Date().toISOString(),
  },
  options: {
    execution_mode_override: 'deterministic_only',
    include_rationale: true,
  },
});

// 4. Use the decision
console.log(response.decision.selected_action);  // 'action-a'
console.log(response.decision.payload.rationale); // 'Based on your engagement...'
console.log(response.audit.replay_token);         // 'rpl_...'
```

## Core Concepts

### The 9-Stage Pipeline

| Stage | Name | Purpose |
|-------|------|---------|
| 1 | Ingest | Normalize request |
| 2 | Derive State | Compute user state from signals |
| 3 | Evaluate Guardrails | Filter/force actions |
| 4 | **Score and Rank** | **Selection locks here** |
| 5 | Resolve Skills | Map action to skill |
| 6 | Execute Skill | Generate rationale |
| 7 | Validate Output | Enforce authority boundaries |
| 8 | Fallback | Safe degradation if needed |
| 9 | Audit | Store trace, generate replay token |

### Authority Separation

```
┌─────────────────────────────────────────────────────────┐
│                    DECISION AUTHORITY                    │
│                      (Engine Only)                       │
│  • Which action is selected                             │
│  • Guardrail enforcement                                │
│  • Scoring and ranking                                  │
│  • Selection is IMMUTABLE after Stage 4                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   NARRATIVE AUTHORITY                    │
│                      (Skills Only)                       │
│  • How to explain the decision                          │
│  • Display text and parameters                          │
│  • Cannot change, suggest, or override selection        │
└─────────────────────────────────────────────────────────┘
```

### Deterministic Replay

Every decision can be replayed:

```typescript
// Retrieve audit trace
const trace = await auditStore.retrieve(decision_id);

// Re-execute with same inputs
const replay = await engine.decide(trace.request);

// Verify determinism
assert(replay.decision.selected_action === trace.final_decision.decision.selected_action);
```

## Scenarios

Scenarios define the decision space:

```typescript
const scenario = {
  scenario_id: 'fitness-daily-session',
  version: '1.0.0',
  state_schema: {
    core_dimensions: { /* engagement, fatigue, etc. */ },
    scenario_dimensions: { /* domain-specific */ },
  },
  actions: {
    action_types: [
      { type_id: 'workout_session', /* ... */ },
      { type_id: 'rest_day', /* ... */ },
    ],
  },
  guardrails: {
    rules: [
      { rule_id: 'GR-001', condition: '...', effect: 'block_action' },
    ],
  },
  scoring: {
    objectives: [
      { objective_id: 'completion', weight: 0.4, formula: '...' },
    ],
  },
};
```

## Execution Modes

| Mode | Description |
|------|-------------|
| `deterministic_only` | Template-based rationale, no LLM |
| `skill_enhanced` | LLM-powered rationale (with fallback) |

Deterministic mode is always available. Skill-enhanced mode falls back to deterministic if validation fails.

## Governance

Authority patterns and prohibitions are versioned:

```typescript
import { AUTHORITY_PATTERNS_V1, PROHIBITIONS_V1 } from '@ade/engine';

// Patterns detect authority boundary violations
// e.g., "I recommend", "you should", "instead"

// Prohibitions detect unsafe content
// e.g., medical claims, urgency manipulation
```

## Golden Vectors

Test correctness with golden vectors:

```typescript
import { runVectorSuite, FITNESS_GOLDEN_VECTORS } from '@ade/engine/tests';

const result = await runVectorSuite(FITNESS_GOLDEN_VECTORS, scenario);
console.log(result.passed); // true if behavior matches expectations
```

## API Reference

### Engine

```typescript
const engine = await createEngine(config?: EngineConfig);

await engine.registerScenario(scenario: Scenario);
const response = await engine.decide(request: DecisionRequest);
```

### Response Shape

```typescript
interface DecisionResponse {
  decision: {
    decision_id: string;
    selected_action: string;
    payload: { rationale?: string; display_title?: string };
    ranked_options: Array<{ action_id: string; rank: number; score: number }>;
  };
  state: UserState;
  execution: {
    execution_mode: 'deterministic_only' | 'skill_enhanced';
    fallback_used: boolean;
  };
  guardrails_applied: string[];
  audit: {
    replay_token: string;
    scenario_hash: string;
  };
}
```

## License

MIT

## Philosophy

> "The decision system never changes. Only the evidence it observes can grow."

ADE is designed for environments where:
- Decisions must be explainable
- Replay must be exact
- Authority must be bounded
- Compliance is non-negotiable

This includes finance, healthcare, safety-critical systems, and any domain where "the AI decided" is not an acceptable answer.
