# ADE Decision Engine

**Deterministic decision engine with audit-grade replay.**

ADE is not an AI that decides—it is a system that decides about AI, safely, deterministically, and audibly.

ADE implements the **Deterministic Decision Runtime (DDR)** model for governed decision control.

> **License Notice**
> This project is source-available under the [Business Source License 1.1](engine/LICENSE).
> Commercial use requires a separate agreement. See [COMMERCIAL.md](COMMERCIAL.md) for details.

## Install

```bash
npm install ade-decision-engine
```

> **Note:** ADE is licensed under BSL 1.1. Installation is permitted for evaluation and non-production use. Commercial deployment requires a separate agreement.

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
import { createEngine } from 'ade-decision-engine';

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
console.log(response.decision.selected_action);   // 'action-a'
console.log(response.decision.payload.rationale); // 'Based on your engagement...'
console.log(response.audit.replay_token);         // 'rpl_...'
```

## The 9-Stage Pipeline

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

## Authority Separation

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

## Execution Modes

| Mode | Description |
|------|-------------|
| `deterministic_only` | Template-based rationale, no LLM |
| `skill_enhanced` | LLM-powered rationale (with fallback) |

Deterministic mode is always available. Skill-enhanced mode falls back to deterministic if validation fails.

## Project Structure

```
├── docs/                    # V1 Specification documents
├── engine/                  # Reference implementation (npm package)
│   ├── src/
│   │   ├── core/           # Pipeline, envelope, types
│   │   ├── stages/         # 9-stage implementations
│   │   ├── api/            # HTTP handlers
│   │   ├── learning/       # V2 learner interface (alpha)
│   │   └── tests/          # Golden vectors
│   └── examples/           # Integration examples
├── scenarios/              # Example scenario definitions
└── skills/                 # Example skill implementations
```

## Documentation

- [V1 Overview](docs/ADE-V1-Overview.md)
- [Cycle Definition](docs/ADE-Cycle-Definition-v1.md)
- [Scenario Schema](docs/ADE-Scenario-Schema-v1.md)
- [Scoring Model](docs/ADE-Scoring-Model-v1.md)
- [Skill Execution Contract](docs/ADE-Skill-Execution-Contract-v1.md)
- [Validators](docs/ADE-Validators-v1.md)
- [API Specification](docs/ADE-API-Specification-v1.md)

## Tags

- `ade-v1.0.0` — Production-ready V1 release
- `ade-v2-learning-alpha` — V2 learning interface (non-authoritative)

## License

Business Source License 1.1 — See [LICENSE](engine/LICENSE) and [COMMERCIAL.md](COMMERCIAL.md)

## Philosophy

> "The decision system never changes. Only the evidence it observes can grow."

ADE is designed for environments where:
- Decisions must be explainable
- Replay must be exact
- Authority must be bounded
- Compliance is non-negotiable

This includes finance, healthcare, safety-critical systems, and any domain where "the AI decided" is not an acceptable answer.
