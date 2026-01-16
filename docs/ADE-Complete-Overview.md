# ADE — Complete Overview

**Authority Decision Engine**  
**Version:** 1.1.0 (with V2 Learning)  
**Status:** Production-Ready  
**Last Updated:** 2026-01-16

---

## Executive Summary

ADE (Authority Decision Engine) is a **deterministic decision system with bounded, non-authoritative learning**.

It solves a problem most systems cannot:

> **How do you make decisions that are auditable, reproducible, and legally defensible — while still learning from outcomes?**

ADE's answer: **Separate authority from observation.**

- **Authority** decides, commits, and is accountable
- **Learning** observes, records, and illuminates — but never decides

This separation is not just a design choice. It is mechanically enforced, governance-locked, and institutionally permanent.

---

## What We Built

### Core System (V1)

A 9-stage decision pipeline with:

| Component | Purpose |
|-----------|---------|
| **Scenario Schema** | Pluggable decision contexts |
| **State Dimensions** | Core + scenario-specific state |
| **Scoring Model** | Objective-based action ranking |
| **Guardrails** | Hard constraints that cannot be bypassed |
| **Selection Lock** | Immutable after Stage 4 |
| **Skill Execution** | Deterministic or LLM-enhanced rationale |
| **Audit Trace** | Complete, immutable decision record |
| **Replay System** | Bit-identical decision reproduction |

### Learning System (V2)

A post-decision evidence accumulation system with:

| Component | Purpose |
|-----------|---------|
| **Learner Interface** | Async, post-decision, evidence-only |
| **Learner Registry** | Isolated execution, failure-tolerant |
| **Memory Snapshots** | Point-in-time, replay-safe |
| **Namespace Enforcement** | `learned.*` only, authority namespaces forbidden |
| **Governance Tests** | Proofs and witnesses for invariants |
| **Pathological Learner Proof** | Adversary model proving boundary holds |
| **Two Canonical Learners** | HourSuccessRate, ActionEffectiveness |

### Governance Documents

| Document | Purpose |
|----------|---------|
| **V2 Learning Contract** | Technical boundary definition |
| **V2 Learning Permanence** | Institutional boundary declaration |
| **Learner Safety Docs** | Per-learner governance compliance |

---

## What It's For

### Primary Use Cases

1. **Regulated Decision-Making**
   - Healthcare recommendations
   - Financial advice
   - Legal document routing
   - Compliance-sensitive workflows

2. **Auditable AI Systems**
   - Decisions that must be explained
   - Decisions that must be reproduced
   - Decisions that must survive legal scrutiny

3. **Deterministic Automation**
   - Notification timing
   - Task prioritization
   - Resource allocation
   - Workflow routing

4. **Learning Without Risk**
   - Accumulate evidence over time
   - Inform humans, not machines
   - Improve insight without changing authority

### What ADE Is NOT For

- Real-time optimization loops
- Reinforcement learning
- Adaptive scoring
- Autonomous policy evolution

Those systems exist. ADE is intentionally not one of them.

---

## Who It's For

### Primary Audiences

| Audience | Why ADE Matters |
|----------|-----------------|
| **Regulated Industries** | Auditable, reproducible, legally defensible |
| **Enterprise Compliance** | Deterministic decisions with governance artifacts |
| **AI Safety Teams** | Bounded learning with proven non-causality |
| **Product Teams** | Decisions that don't break under pressure |
| **Auditors & Regulators** | Verification procedures, not just promises |

### Specific Roles

| Role | Value Proposition |
|------|-------------------|
| **CTO / VP Engineering** | System that says "no" to authority drift |
| **Compliance Officer** | Audit trail + governance documents |
| **ML Engineer** | Learning that can't break production |
| **Product Manager** | Decisions that are explainable to users |
| **Legal Counsel** | Reproducible decisions for litigation defense |

---

## How to Get It Out

### Distribution Channels

#### 1. npm (Published)

```bash
npm install ade-decision-engine
```

- **Current:** `ade-decision-engine@1.0.0` (V1 only)
- **Next:** `ade-decision-engine@1.1.0` (V1 + V2 Learning)

#### 2. GitHub (Public)

```
https://github.com/Vicsicard/ade-decision-engine
```

- Full source code
- Governance documents
- Example scenarios
- Reference learners

#### 3. Documentation (In-Repo)

| Document | Location |
|----------|----------|
| README | `/README.md` |
| V1 Overview | `/docs/ADE-V1-Overview.md` |
| V2 Learning Contract | `/docs/ADE-V2-Learning-Contract.md` |
| V2 Learning Permanence | `/docs/ADE-V2-Learning-Permanence.md` |
| Learner Safety Docs | `/docs/learners/` |

### Go-To-Market Strategy

#### Phase 1: Developer Adoption (Current)

- npm package published
- GitHub repo public
- MIT license (open source)
- Documentation complete

#### Phase 2: Enterprise Outreach

- Target regulated industries
- Emphasize governance artifacts
- Offer compliance consultation
- Provide audit support

#### Phase 3: Ecosystem Growth

- Community learners (within governance)
- Scenario library
- Integration guides
- Case studies

### Messaging Framework

#### One-Liner

> "Deterministic decisions with bounded learning."

#### Elevator Pitch

> "ADE is a decision engine that separates authority from observation. Decisions are deterministic, auditable, and reproducible. Learning exists but can never influence decisions. This makes ADE suitable for regulated industries, compliance-sensitive workflows, and any system where decisions must survive legal scrutiny."

#### Technical Pitch

> "ADE implements a 9-stage decision pipeline with selection lock at Stage 4, deterministic replay, and a V2 learning system that is mechanically proven to be non-causal. Learners run post-decision, write only to `learned.*` namespaces, and are validated against governance invariants. The system includes pathological learner proofs demonstrating that even adversarial learners cannot affect decision authority."

#### Governance Pitch

> "ADE is the only decision system we know of that has a Learning Permanence Declaration — a binding governance document that states learning will never become authority, with explicit refusal posture and future maintainer warnings. This is not just a design choice; it's an institutional commitment."

---

## Repository Structure

```
ADE DECISION LOOP/
├── README.md                          # GitHub display
├── docs/
│   ├── ADE-V1-Overview.md             # V1 specification
│   ├── ADE-V2-Learning-Contract.md    # V2 technical boundary
│   ├── ADE-V2-Learning-Permanence.md  # V2 institutional boundary
│   ├── ADE-Cycle-Definition-v1.md     # 9-stage pipeline
│   ├── ADE-Scoring-Model-v1.md        # Objective-based ranking
│   ├── ADE-Scenario-Schema-v1.md      # Pluggable scenarios
│   └── learners/
│       └── action-effectiveness-safety.md
├── engine/
│   ├── src/
│   │   ├── core/                      # Decision pipeline
│   │   ├── learning/                  # V2 learning system
│   │   │   ├── learner-interface.ts
│   │   │   ├── learner-registry.ts
│   │   │   ├── memory-snapshot.ts
│   │   │   └── learners/
│   │   │       ├── hour-success-rate.ts
│   │   │       └── action-effectiveness.ts
│   │   ├── storage/                   # Memory adapters
│   │   └── tests/
│   │       ├── governance/            # Invariant proofs
│   │       │   ├── temporal-boundary.test.ts
│   │       │   ├── learner-isolation.test.ts
│   │       │   ├── non-causality.test.ts
│   │       │   ├── forbidden-namespace.test.ts
│   │       │   └── pathological-learner.test.ts
│   │       └── learners/
│   │           └── action-effectiveness.test.ts
│   └── package.json
├── scenarios/                         # Example scenarios
└── skills/                            # Execution skills
```

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| `1.0.0` | 2026-01-16 | V1 authority kernel (npm published) |
| `ade-v2-learning-alpha` | 2026-01-16 | V2 learning interface (Git tag) |
| `1.1.0` | Pending | V1 + V2 Learning (optional, off by default) |

---

## Key Differentiators

| Feature | ADE | Typical ML Systems |
|---------|-----|-------------------|
| Deterministic | ✅ Always | ❌ Rarely |
| Auditable | ✅ Complete trace | ⚠️ Partial |
| Reproducible | ✅ Bit-identical replay | ❌ No |
| Learning | ✅ Bounded, non-causal | ❌ Causal, authoritative |
| Governance | ✅ Institutional documents | ❌ None |
| Adversary-tested | ✅ Pathological proofs | ❌ No |

---

## Next Steps

1. **Prepare 1.1.0 Release**
   - Learning optional, off by default
   - Feature flag for enabling
   - Governance tests included

2. **Create Release Notes**
   - Changelog
   - Migration guide (none needed)
   - Governance summary

3. **Publish to npm**
   - `npm publish --access public`

4. **Announce**
   - GitHub release
   - Developer communities
   - Regulated industry channels

---

## Contact

- **Repository:** https://github.com/Vicsicard/ade-decision-engine
- **npm:** https://www.npmjs.com/package/ade-decision-engine
- **License:** MIT

---

## Summary

ADE is a **deterministic decision system with bounded learning**.

It proves that:
- Decisions can be auditable, reproducible, and legally defensible
- Learning can exist without becoming authority
- Governance can be institutional, not just technical

This is not a framework. It is an institution.
