# ADE Scenario Schema v1

**Version:** 1.0.0  
**Status:** Canonical  
**Date:** January 16, 2026  
**Depends On:** ADE-Cycle-Definition-v1.md, ADE-Skill-Execution-Contract-v1.md, ADE-Validators-v1.md

---

## Overview

This document defines the **Scenario Schema** — the formal structure for pluggable decision scenarios in ADE. A Scenario is a complete configuration that tells ADE how to make decisions for a specific domain or use case.

**Core Principles:**
- Scenarios are **configuration, not code** — the engine remains unchanged
- Scenarios are **versioned and immutable** — deployed versions never change
- Scenarios are **validated at load time** — invalid scenarios are rejected before runtime
- Scenarios are **self-contained** — all dependencies are declared explicitly
- Scenarios **must not cause side effects** — they only describe decision logic

**Normative Statement:** A valid Scenario fully specifies the decision problem. The ADE engine requires no domain knowledge beyond what the Scenario provides.

**Scenario Authority Boundary:** Scenarios may not define:
- Dynamic modification of scoring logic at runtime
- Conditional mutation of guardrails
- Cross-scenario dependencies
- References to external services

All scenario behavior must be statically defined at deploy time in V1.

---

## What Is a Scenario?

A **Scenario** is a versioned configuration bundle that defines:

1. **Metadata** — identity, version, description
2. **State Schema** — what dimensions describe a user
3. **Actions Catalog** — what options ADE can select from
4. **Guardrails** — hard constraints that filter eligibility
5. **Scoring Objectives** — how to rank eligible actions
6. **Skill Mappings** — which Skills enrich which actions
7. **Execution Config** — default modes and timeouts

### Scenario Identity

```
{scenario_id}@{version}
```

Examples:
- `fitness-daily-session@1.0.0`
- `notification-timing@1.0.0`
- `saas-engagement-nudge@2.1.0`

---

## Scenario File Structure

```
/scenarios
└── /{scenario_id}
    └── /{version}
        ├── scenario.json       # Main scenario definition
        ├── state_schema.json   # State dimension definitions
        ├── guardrails.json     # Guardrail definitions
        ├── scoring.json        # Scoring objectives and weights
        └── skills.json         # Skill mappings
```

Alternatively, all can be combined in a single `scenario.json` file.

---

## Complete Scenario Schema

### Root Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": [
    "scenario_id",
    "version",
    "metadata",
    "state_schema",
    "actions",
    "guardrails",
    "scoring",
    "skills",
    "execution"
  ],
  "properties": {
    "scenario_id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Unique scenario identifier (lowercase, hyphenated)"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version"
    },
    "content_hash": {
      "type": "string",
      "description": "SHA-256 hash of scenario content (computed at load)"
    },
    "metadata": { "$ref": "#/definitions/metadata" },
    "state_schema": { "$ref": "#/definitions/state_schema" },
    "actions": { "$ref": "#/definitions/actions" },
    "guardrails": { "$ref": "#/definitions/guardrails" },
    "scoring": { "$ref": "#/definitions/scoring" },
    "skills": { "$ref": "#/definitions/skills" },
    "execution": { "$ref": "#/definitions/execution" }
  }
}
```

---

## Section Definitions

### 1. Metadata

```json
{
  "definitions": {
    "metadata": {
      "type": "object",
      "required": ["name", "description", "domain", "created_at"],
      "properties": {
        "name": {
          "type": "string",
          "description": "Human-readable scenario name"
        },
        "description": {
          "type": "string",
          "description": "What this scenario does"
        },
        "domain": {
          "type": "string",
          "enum": ["fitness", "notification", "engagement", "onboarding", "monetization", "custom"],
          "description": "Primary domain category"
        },
        "created_at": {
          "type": "string",
          "format": "date-time"
        },
        "updated_at": {
          "type": "string",
          "format": "date-time"
        },
        "author": {
          "type": "string"
        },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  }
}
```

---

### 2. State Schema

Defines the dimensions that describe a user's current state.

```json
{
  "definitions": {
    "state_schema": {
      "type": "object",
      "required": ["core_dimensions", "scenario_dimensions"],
      "properties": {
        "core_dimensions": {
          "type": "object",
          "description": "Standard dimensions present in all scenarios",
          "properties": {
            "engagement_level": { "$ref": "#/definitions/dimension" },
            "recency_score": { "$ref": "#/definitions/dimension" },
            "interaction_depth": { "$ref": "#/definitions/dimension" },
            "churn_risk": { "$ref": "#/definitions/dimension" }
          }
        },
        "scenario_dimensions": {
          "type": "object",
          "description": "Scenario-specific dimensions",
          "additionalProperties": { "$ref": "#/definitions/dimension" }
        }
      }
    },
    "dimension": {
      "type": "object",
      "required": ["type", "derivation"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["float", "integer", "boolean", "enum"]
        },
        "range": {
          "type": "object",
          "properties": {
            "min": { "type": "number" },
            "max": { "type": "number" }
          }
        },
        "enum_values": {
          "type": "array",
          "items": { "type": "string" }
        },
        "default": {
          "description": "Default value for cold-start"
        },
        "derivation": {
          "type": "object",
          "required": ["source", "formula"],
          "properties": {
            "source": {
              "type": "string",
              "enum": ["signal", "memory", "computed"]
            },
            "formula": {
              "type": "string",
              "description": "Derivation expression"
            },
            "inputs": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        },
        "description": { "type": "string" }
      }
    }
  }
}
```

#### Example: Fitness State Dimensions

```json
{
  "scenario_dimensions": {
    "fatigue_score": {
      "type": "float",
      "range": { "min": 0.0, "max": 1.0 },
      "default": 0.0,
      "derivation": {
        "source": "computed",
        "formula": "clamp((intensity_load - recovery_factor) / 5.0, 0.0, 1.0)",
        "inputs": ["session_history", "rest_days_last_7d"]
      },
      "description": "Accumulated training load vs recovery"
    },
    "novelty_balance": {
      "type": "float",
      "range": { "min": 0.0, "max": 1.0 },
      "default": 0.5,
      "derivation": {
        "source": "computed",
        "formula": "unique_types / total_sessions",
        "inputs": ["session_history"]
      },
      "description": "Variety vs repetition in recent sessions"
    }
  }
}
```

---

### 3. Actions Catalog

Defines the set of actions ADE can select from.

```json
{
  "definitions": {
    "actions": {
      "type": "object",
      "required": ["action_types", "action_source"],
      "properties": {
        "action_source": {
          "type": "string",
          "enum": ["static", "dynamic"],
          "description": "Whether actions are predefined or provided per-request. Dynamic actions are provided per request but must conform to the declared action_type schema."
        },
        "action_types": {
          "type": "array",
          "items": { "$ref": "#/definitions/action_type" }
        }
      }
    },
    "action_type": {
      "type": "object",
      "required": ["type_id", "display_name"],
      "properties": {
        "type_id": {
          "type": "string",
          "description": "Unique action type identifier"
        },
        "display_name": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "attributes": {
          "type": "object",
          "description": "Schema for action-specific attributes",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "type": { "type": "string" },
              "required": { "type": "boolean" }
            }
          }
        },
        "skill_mapping": {
          "type": "string",
          "description": "Default skill bundle for this action type"
        }
      }
    }
  }
}
```

#### Example: Fitness Actions

```json
{
  "action_source": "dynamic",
  "action_types": [
    {
      "type_id": "workout_session",
      "display_name": "Workout Session",
      "attributes": {
        "intensity": { "type": "enum", "values": ["low", "moderate", "high"], "required": true },
        "duration_minutes": { "type": "integer", "required": true },
        "session_type": { "type": "string", "required": true }
      },
      "skill_mapping": "fitness_session_rationale"
    },
    {
      "type_id": "rest_day",
      "display_name": "Rest Day",
      "attributes": {},
      "skill_mapping": "rest_day_messaging"
    }
  ]
}
```

---

### 4. Guardrails

Defines hard constraints that filter action eligibility.

**Important:** Guardrails operate before selection and may constrain the eligible set, but do not violate selection immutability. Effects like `force_action` shape eligibility, they do not override the scoring/ranking process.

```json
{
  "definitions": {
    "guardrails": {
      "type": "object",
      "required": ["rules"],
      "properties": {
        "rules": {
          "type": "array",
          "items": { "$ref": "#/definitions/guardrail_rule" }
        },
        "fail_behavior": {
          "type": "string",
          "enum": ["reject_action", "force_alternative"],
          "default": "reject_action"
        }
      }
    },
    "guardrail_rule": {
      "type": "object",
      "required": ["rule_id", "description", "condition", "effect"],
      "properties": {
        "rule_id": {
          "type": "string",
          "pattern": "^GR-[A-Z0-9-]+$"
        },
        "description": {
          "type": "string"
        },
        "condition": {
          "type": "string",
          "description": "Boolean expression that triggers the guardrail"
        },
        "effect": {
          "type": "string",
          "enum": ["block_action", "force_action", "cap_intensity", "require_cooldown"]
        },
        "target": {
          "type": "string",
          "description": "Which actions this guardrail applies to (regex or 'all')"
        },
        "parameters": {
          "type": "object",
          "description": "Rule-specific parameters"
        },
        "priority": {
          "type": "integer",
          "description": "Evaluation order (lower = earlier)"
        }
      }
    }
  }
}
```

#### Example: Fitness Guardrails

```json
{
  "rules": [
    {
      "rule_id": "GR-REST-MIN",
      "description": "At least 1 rest day per 7-day window",
      "condition": "rest_days_last_7d < 1",
      "effect": "force_action",
      "target": "rest_day",
      "priority": 1
    },
    {
      "rule_id": "GR-INTENSITY-CAP",
      "description": "No more than 2 high-intensity sessions consecutively",
      "condition": "consecutive_high_intensity >= 2",
      "effect": "block_action",
      "target": "intensity == 'high'",
      "priority": 2
    },
    {
      "rule_id": "GR-FATIGUE-OVERRIDE",
      "description": "Force recovery if fatigue is critical",
      "condition": "fatigue_score > 0.85",
      "effect": "cap_intensity",
      "parameters": { "max_intensity": "low" },
      "priority": 0
    },
    {
      "rule_id": "GR-COOLDOWN",
      "description": "Minimum 18 hours between session recommendations",
      "condition": "hours_since_last_recommendation < 18",
      "effect": "block_action",
      "target": "workout_session",
      "priority": 3
    }
  ]
}
```

---

### 5. Scoring

Defines objectives and weights for ranking eligible actions.

```json
{
  "definitions": {
    "scoring": {
      "type": "object",
      "required": ["objectives", "execution_risk"],
      "properties": {
        "objectives": {
          "type": "array",
          "items": { "$ref": "#/definitions/objective" }
        },
        "execution_risk": {
          "$ref": "#/definitions/execution_risk"
        },
        "tie_breaking": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Ordered list of tie-breaking criteria"
        }
      }
    },
    "objective": {
      "type": "object",
      "required": ["objective_id", "weight", "formula"],
      "properties": {
        "objective_id": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "weight": {
          "type": "number",
          "minimum": 0.05,
          "maximum": 0.50
        },
        "formula": {
          "type": "string",
          "description": "Scoring formula returning 0.0-1.0"
        },
        "inputs": {
          "type": "array",
          "items": { "type": "string" }
        },
        "description": {
          "type": "string"
        }
      }
    },
    "execution_risk": {
      "type": "object",
      "required": ["enabled", "weight"],
      "properties": {
        "enabled": { "type": "boolean" },
        "weight": {
          "type": "number",
          "description": "Penalty weight for execution risk"
        },
        "factors": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "factor": { "type": "string" },
              "penalty": { "type": "number" }
            }
          }
        }
      }
    }
  }
}
```

#### Example: Fitness Scoring

```json
{
  "objectives": [
    {
      "objective_id": "completion_likelihood",
      "name": "Completion Likelihood",
      "weight": 0.35,
      "formula": "(intensity_match * 0.6) + (duration_fit * 0.4)",
      "inputs": ["fatigue_score", "session_depth", "action.intensity", "action.duration"],
      "description": "Probability user completes this session"
    },
    {
      "objective_id": "fatigue_management",
      "name": "Fatigue Management",
      "weight": 0.25,
      "formula": "fatigue_safety_score(fatigue_score, action.intensity)",
      "inputs": ["fatigue_score", "action.intensity"],
      "description": "Avoid overtraining"
    },
    {
      "objective_id": "engagement_momentum",
      "name": "Engagement Momentum",
      "weight": 0.25,
      "formula": "momentum_score(engagement_level, action.intensity)",
      "inputs": ["engagement_level", "action.intensity"],
      "description": "Maintain or build engagement"
    },
    {
      "objective_id": "novelty_optimization",
      "name": "Novelty Optimization",
      "weight": 0.15,
      "formula": "novelty_score(novelty_balance, action.type)",
      "inputs": ["novelty_balance", "action.session_type", "session_history"],
      "description": "Balance variety vs familiarity"
    }
  ],
  "execution_risk": {
    "enabled": true,
    "weight": 0.10,
    "factors": [
      { "factor": "skill_unavailable", "penalty": 0.3 },
      { "factor": "high_latency_mode", "penalty": 0.1 },
      { "factor": "offline_mode", "penalty": 0.2 }
    ]
  },
  "tie_breaking": ["intensity_asc", "duration_asc", "action_id_asc"]
}
```

#### Scoring Constraints

| Constraint | Rule |
|------------|------|
| Weights sum | All objective weights must sum to 1.0 (excluding execution_risk) |
| Weight range | No weight < 0.05, no weight > 0.50 |
| Formula output | All formulas must return value in [0.0, 1.0] |

---

### 6. Skills

Defines which Skills are available and how they map to actions.

```json
{
  "definitions": {
    "skills": {
      "type": "object",
      "required": ["available_skills", "action_mappings", "default_fallback"],
      "properties": {
        "available_skills": {
          "type": "array",
          "items": { "$ref": "#/definitions/skill_reference" }
        },
        "action_mappings": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "primary_skill": { "type": "string" },
              "fallback_skill": { "type": "string" }
            }
          }
        },
        "default_fallback": {
          "type": "string",
          "description": "Fallback skill if action has no mapping"
        }
      }
    },
    "skill_reference": {
      "type": "object",
      "required": ["skill_id", "version"],
      "properties": {
        "skill_id": { "type": "string" },
        "version": { "type": "string" },
        "sec_path": {
          "type": "string",
          "description": "Path to Skill Execution Contract"
        }
      }
    }
  }
}
```

#### Example: Fitness Skills

```json
{
  "available_skills": [
    { "skill_id": "fitness_session_rationale", "version": "1.0.0" },
    { "skill_id": "rest_day_messaging", "version": "1.0.0" },
    { "skill_id": "decision_rationale_template", "version": "1.0.0" }
  ],
  "action_mappings": {
    "workout_session": {
      "primary_skill": "fitness_session_rationale@1.0.0",
      "fallback_skill": "decision_rationale_template@1.0.0"
    },
    "rest_day": {
      "primary_skill": "rest_day_messaging@1.0.0",
      "fallback_skill": "decision_rationale_template@1.0.0"
    }
  },
  "default_fallback": "decision_rationale_template@1.0.0"
}
```

---

### 7. Execution

Defines execution defaults and constraints.

```json
{
  "definitions": {
    "execution": {
      "type": "object",
      "required": ["default_mode"],
      "properties": {
        "default_mode": {
          "type": "string",
          "enum": ["deterministic_only", "skill_enhanced"],
          "description": "Default execution mode for this scenario"
        },
        "allow_mode_override": {
          "type": "boolean",
          "default": true,
          "description": "Whether requests can override execution mode"
        },
        "timeouts": {
          "type": "object",
          "properties": {
            "total_decision_ms": { "type": "integer", "default": 500 },
            "skill_execution_ms": { "type": "integer", "default": 300 },
            "state_derivation_ms": { "type": "integer", "default": 50 }
          }
        },
        "retry_policy": {
          "type": "object",
          "properties": {
            "max_retries": { "type": "integer", "default": 0 },
            "retry_on": { "type": "array", "items": { "type": "string" } }
          }
        }
      }
    }
  }
}
```

---

## Scenario Validation

### Load-Time Validation

When a scenario is loaded, the following checks are performed:

| Check | Description | Failure Behavior |
|-------|-------------|------------------|
| Schema validity | Scenario conforms to this schema | Reject load |
| Version format | Version is valid semver | Reject load |
| Weight sum | Scoring weights sum to 1.0 | Reject load |
| Skill references | All referenced skills exist | Reject load |
| Guardrail syntax | All condition expressions parse | Reject load |
| Formula syntax | All scoring formulas parse | Reject load |
| Dimension references | All formula inputs exist in state schema | Reject load |
| Content hash | Compute and store SHA-256 | Required for replay |

### Validation Result

```json
{
  "valid": true,
  "scenario_id": "fitness-daily-session",
  "version": "1.0.0",
  "content_hash": "sha256:abc123...",
  "warnings": [],
  "errors": [],
  "validated_at": "ISO8601"
}
```

---

## Scenario Versioning

### Version Rules

| Change Type | Version Bump | Backward Compatible |
|-------------|--------------|---------------------|
| Add optional field | Patch | Yes |
| Add new action type | Minor | Yes |
| Add new guardrail | Minor | Yes |
| Change scoring weights | Minor | Yes |
| Remove action type | Major | No |
| Remove guardrail | Major | No |
| Change state dimension semantics | Major | No |
| Change formula behavior | Major | No |

### Content Hash

Every scenario has a `content_hash` (SHA-256) computed from its contents:

```
content_hash = SHA256(canonical_json(scenario))
```

The content hash is used for:
- **Replay integrity** — ensure exact scenario version for replay
- **Cache invalidation** — detect when scenario changed
- **Audit trail** — link decisions to exact scenario content

---

## Scenario Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. AUTHOR                                                                   │
│  Create scenario.json with all required sections                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. VALIDATE                                                                 │
│  Run schema validation + semantic checks                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. TEST                                                                     │
│  Run scenario against test cases                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. DEPLOY                                                                   │
│  Bundle scenario with engine deployment                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. LOAD                                                                     │
│  Engine loads and validates scenario at startup                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. EXECUTE                                                                  │
│  Engine processes decisions using scenario config                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Scenario Hot-Swap (V2+)

V1 loads scenarios at deploy time. Future versions may support runtime hot-swap:

- Load new scenario version without restart
- Validate before activation
- Atomic switch (no partial state)
- Rollback on validation failure

This is **not implemented in V1** but the schema supports it.

---

## What Flows From This Schema

| Artifact | Status |
|----------|--------|
| Scenario validation tooling | Unblocked |
| Scenario examples (fitness, notification) | Unblocked |
| State schema refactoring | Unblocked |
| Scoring model refactoring | Unblocked |
| Engine scenario loader | Unblocked |

---

## Appendix A: Minimal Scenario Example (Notification Timing)

```json
{
  "scenario_id": "notification-timing",
  "version": "1.0.0",
  "metadata": {
    "name": "Notification Timing",
    "description": "Decides when to send notifications to maximize engagement without fatigue",
    "domain": "notification",
    "created_at": "2026-01-16T00:00:00Z"
  },
  "state_schema": {
    "core_dimensions": {
      "engagement_level": {
        "type": "float",
        "range": { "min": 0.0, "max": 1.0 },
        "default": 0.5,
        "derivation": { "source": "signal", "formula": "signals.engagement_7d" }
      },
      "recency_score": {
        "type": "float",
        "range": { "min": 0.0, "max": 1.0 },
        "default": 0.5,
        "derivation": { "source": "computed", "formula": "1.0 - (hours_since_last / 168)" }
      }
    },
    "scenario_dimensions": {
      "notification_fatigue": {
        "type": "float",
        "range": { "min": 0.0, "max": 1.0 },
        "default": 0.0,
        "derivation": { "source": "computed", "formula": "notifications_24h / 5.0" }
      }
    }
  },
  "actions": {
    "action_source": "static",
    "action_types": [
      { "type_id": "send_now", "display_name": "Send Immediately" },
      { "type_id": "delay_1h", "display_name": "Delay 1 Hour" },
      { "type_id": "delay_4h", "display_name": "Delay 4 Hours" },
      { "type_id": "suppress", "display_name": "Suppress Notification" }
    ]
  },
  "guardrails": {
    "rules": [
      {
        "rule_id": "GR-MAX-DAILY",
        "description": "Maximum 3 notifications per day",
        "condition": "notifications_24h >= 3",
        "effect": "force_action",
        "target": "suppress"
      },
      {
        "rule_id": "GR-MIN-GAP",
        "description": "Minimum 2 hours between notifications",
        "condition": "hours_since_last_notification < 2",
        "effect": "block_action",
        "target": "send_now"
      }
    ]
  },
  "scoring": {
    "objectives": [
      {
        "objective_id": "engagement_potential",
        "weight": 0.50,
        "formula": "engagement_level * (1.0 - notification_fatigue)"
      },
      {
        "objective_id": "timing_quality",
        "weight": 0.50,
        "formula": "timing_score(current_hour, user_timezone)"
      }
    ],
    "execution_risk": { "enabled": true, "weight": 0.05 },
    "tie_breaking": ["action_id_asc"]
  },
  "skills": {
    "available_skills": [
      { "skill_id": "decision_rationale_template", "version": "1.0.0" }
    ],
    "action_mappings": {},
    "default_fallback": "decision_rationale_template@1.0.0"
  },
  "execution": {
    "default_mode": "deterministic_only",
    "timeouts": { "total_decision_ms": 100 }
  }
}
```

---

## Appendix B: Full Fitness Scenario Example

See `/scenarios/fitness-daily-session/1.0.0/scenario.json` for the complete reference implementation.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-16 | Initial specification |
