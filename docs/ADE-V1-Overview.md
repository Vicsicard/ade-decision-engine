# Adaptive Decision Engine (ADE) V1 Overview

**Version:** 1.0.0  
**Status:** Canonical  
**Date:** January 16, 2026

---

## What ADE Is

**Adaptive Decision Engine (ADE)** is a **decision containment runtime** — a system that determines what should happen next for a user within strict authority boundaries.

ADE is:
- **A control system**, not an analytics tool
- **Industry-agnostic** — fitness, gaming, notifications, finance, healthcare all use the same core
- **Deterministic** — same inputs always produce same outputs
- **Auditable** — every decision is logged with full replay capability
- **Model-agnostic** — works with any LLM, or none at all

---

## What ADE Is Not

ADE does **not**:
- Generate content
- Render UI
- Own users or data
- Store media
- Handle payments
- Replace the platform
- Make recommendations (it makes **decisions**)

It **only decides** what should happen next, within defined boundaries.

**Key distinction:** A decision in ADE is a system action, not advice.

---

## The Core Separation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DECISION AUTHORITY                                    │
│                        (ADE Engine)                                          │
│                                                                             │
│  • Evaluates state                                                          │
│  • Applies guardrails                                                       │
│  • Scores and ranks actions                                                 │
│  • Selects the action                                                       │
│  • IMMUTABLE after selection                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                        NARRATIVE AUTHORITY                                   │
│                        (Skills)                                              │
│                                                                             │
│  • Explains the decision                                                    │
│  • Contextualizes for the user                                              │
│  • Humanizes the output                                                     │
│  • CANNOT change the decision                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

This separation is **machine-enforced** by validators, not trusted to executors.

---

## V1 Architecture

### The 9-Stage Decision Cycle

Every ADE decision traverses these stages in order:

1. **Ingest** — Normalize request into canonical format
2. **Derive State** — Compute user state from signals (deterministic)
3. **Evaluate Guardrails** — Filter actions by hard constraints
4. **Score and Rank** — Compute scores, select action (**SELECTION LOCKS HERE**)
5. **Resolve Skills** — Determine which skill will enrich the response
6. **Execute Skill** — Run skill (LLM or deterministic)
7. **Validate Output** — Enforce SEC and authority boundaries
8. **Fallback** — If validation fails, use deterministic fallback
9. **Audit and Replay** — Store trace, return response

### Key Architectural Components

| Component | Purpose |
|-----------|---------|
| **Cycle Definition** | The 9-stage pipeline with authority boundaries |
| **Skill Execution Contract (SEC)** | Formal agreement between ADE and skill executors |
| **Validators** | Enforcement mechanism for SEC and authority |
| **Scenario Schema** | Pluggable configuration for any domain |
| **State Schema** | Core + scenario-specific user dimensions |
| **Scoring Model** | Objective-based ranking framework |

---

## Industry Agnosticism

ADE is **not** a fitness engine, notification engine, or any domain-specific tool.

The engine is constant. Only these change per domain:
- **Scenarios** — Configuration defining the decision problem
- **Skills** — Bounded executors that enrich responses
- **Prohibitions** — Domain-specific content restrictions

### Example Scenarios

| Scenario | Domain | Decision |
|----------|--------|----------|
| `fitness-daily-session` | Fitness | Which workout session today? |
| `notification-timing` | Engagement | When to send this notification? |
| `game-difficulty-adjust` | Gaming | What difficulty for next level? |
| `onboarding-next-step` | SaaS | Which onboarding step next? |

All use the **same ADE engine**.

---

## Containment Guarantees

### What ADE Guarantees

| Guarantee | How |
|-----------|-----|
| Decision immutability | Selection locks at Stage 4, validators reject changes |
| Deterministic replay | Same inputs + scenario hash = same output |
| Safe degradation | Fallback always returns lawful decision |
| Audit completeness | Full trace stored for every decision |
| Model independence | Executor interface abstracts LLM provider |

### What Skills Cannot Do

Skills are bounded executors. They **cannot**:
- Change the selected action
- Access external state
- Make network calls
- Reference scores or rankings
- Suggest alternatives
- Override guardrails

Violations are **rejected by validators**, not trusted to executors.

---

## V1 Specification Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `ADE-Cycle-Definition-v1.md` | Canonical 9-stage cycle | ✅ Canonical |
| `ADE-Skill-Execution-Contract-v1.md` | Skill containment rules | ✅ Canonical |
| `ADE-Validators-v1.md` | Validation pipeline | ✅ Canonical |
| `ADE-Scenario-Schema-v1.md` | Pluggable scenario format | ✅ Canonical |
| `ADE-State-Schema-v1.md` | User state model | ✅ Canonical |
| `ADE-Scoring-Model-v1.md` | Ranking framework | ✅ Canonical |
| `ADE-API-Specification-v1.md` | Public API contract | ✅ Canonical |

---

## Execution Modes

| Mode | Description | Latency Target |
|------|-------------|----------------|
| `deterministic_only` | No LLM, template-based skills | <50ms |
| `skill_enhanced` | LLM-powered skill execution | <300ms |

Mode can be set at:
1. Request level (override)
2. Scenario level (default)
3. Engine level (fallback)

Deterministic mode is always available as fallback.

**Offline capability:** ADE can run fully offline when deterministic-only skills are used.

---

## Why This Architecture

### The Problem with "Smart" Systems

Most AI-powered systems fail because:
- LLMs are unpredictable
- Authority boundaries are unclear
- Audit trails are incomplete
- Fallback is undefined

### The ADE Solution

ADE treats intelligence as a **bounded executor**, not a decision-maker:
- Clear authority separation
- Machine-enforced boundaries
- Deterministic fallback
- Complete audit trail

This enables:
- Regulated industry deployment
- Offline/local operation
- Model swapping without risk
- Predictable behavior

---

## Value Proposition

ADE delivers:
- **Higher retention** — Optimal timing and pacing
- **Better conversion** — Right action at right moment
- **Reduced churn** — Fatigue-aware decisions
- **Audit compliance** — Full decision traceability
- **Model independence** — No vendor lock-in

---

## What V1 Includes

- Complete 9-stage decision cycle
- Skill containment with SEC
- Validator pipeline with authority enforcement
- Pluggable scenario system
- Deterministic and skill-enhanced modes
- Full audit and replay
- Two example scenarios (fitness, notification)
- Deterministic and LLM skill stubs

## What V1 Does Not Include

- Full LLM provider integration (stub only)
- Runtime scenario hot-swap
- ML-based weight learning
- Dashboard or UI
- Multi-scenario per request

These are V2+ features.

---

## Canonical Statement

> ADE is a decision containment runtime that determines what should happen next for a user within strict authority boundaries.
>
> Intelligence can execute. Intelligence cannot decide.
>
> That separation is what makes ADE safe, auditable, and deployable in any industry.

---

## Next Steps

With V1 specifications complete, implementation can proceed:

1. Engine implementation (Cloudflare Workers)
2. Scenario validation tooling
3. Skill executor implementations
4. Integration testing
5. Pilot deployment

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-16 | Initial V1 canonical overview |
