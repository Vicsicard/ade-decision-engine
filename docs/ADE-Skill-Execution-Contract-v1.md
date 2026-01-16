# ADE Skill Execution Contract (SEC) v1

**Version:** 1.0.0  
**Status:** Canonical  
**Date:** January 16, 2026  
**Depends On:** ADE-Cycle-Definition-v1.md

---

## Overview

This document defines the **Skill Execution Contract (SEC)** — the formal agreement between ADE and any Skill executor (LLM or deterministic). The SEC is what makes ADE **model-agnostic** and **safe**.

**Core Principles:**
- Skills are **bounded executors**, not decision-makers
- Every Skill operates under a **contract** that defines inputs, outputs, and constraints
- Contracts are **enforced by validators**, not trusted to executors
- Violation of contract triggers **fallback**, not failure

**Normative Statement:** This document is normative. Any Skill output that violates this contract MUST be rejected, regardless of executor behavior.

**Philosophical Foundation:** The SEC exists to ensure intelligence can execute without ever acquiring authority.

---

## What Is a Skill?

A **Skill** is a versioned, self-contained module that:
- Receives structured input (action context, user state)
- Produces structured output (payload enrichment)
- Operates within strict boundaries (cannot alter decisions)
- May use LLM or deterministic logic (contract is the same)

### Skill Identity

```json
{
  "skill_id": "decision_rationale_generator",
  "version": "1.0.0",
  "type": "llm | deterministic",
  "description": "Generates human-readable rationale for session recommendations"
}
```

---

## The Skill Execution Contract (SEC)

Every Skill MUST have an associated SEC that defines:

1. **Input Envelope** — what the Skill receives
2. **Output Schema** — what the Skill must return
3. **Invariants** — rules that must always hold
4. **Prohibited Outputs** — what the Skill must never produce
5. **Timeout Behavior** — what happens on slow execution
6. **Fallback Definition** — what happens on failure/rejection

---

## 1. Input Envelope

The input envelope is the **only data** a Skill receives. Skills cannot access external state.

**Enforcement Note:** Executors are responsible for sandboxing. Validators assume the executor respected isolation; violations are considered executor faults.

### Standard Input Envelope Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["decision_context", "user_state", "skill_config"],
  "properties": {
    "decision_context": {
      "type": "object",
      "required": ["decision_id", "selected_action", "action_metadata", "ranked_options"],
      "properties": {
        "decision_id": {
          "type": "string",
          "format": "uuid",
          "description": "Unique identifier for this decision"
        },
        "selected_action": {
          "type": "string",
          "description": "The action ID that was selected (IMMUTABLE)"
        },
        "action_metadata": {
          "type": "object",
          "description": "Metadata about the selected action from scenario"
        },
        "ranked_options": {
          "type": "array",
          "description": "Top N ranked actions with scores. Read-only context only. Presence of ranked_options does not imply the Skill may compare or evaluate alternatives.",
          "items": {
            "type": "object",
            "properties": {
              "action_id": { "type": "string" },
              "score": { "type": "number" },
              "rank": { "type": "integer" }
            }
          }
        },
        "guardrails_applied": {
          "type": "array",
          "items": { "type": "string" },
          "description": "List of guardrails that affected eligibility"
        }
      }
    },
    "user_state": {
      "type": "object",
      "required": ["core", "scenario_extensions"],
      "properties": {
        "core": {
          "type": "object",
          "description": "Core state dimensions (engagement, recency, etc.)"
        },
        "scenario_extensions": {
          "type": "object",
          "description": "Scenario-specific state dimensions"
        }
      }
    },
    "skill_config": {
      "type": "object",
      "properties": {
        "skill_id": { "type": "string" },
        "skill_version": { "type": "string" },
        "execution_mode": { 
          "type": "string",
          "enum": ["deterministic_only", "skill_enhanced"]
        },
        "max_output_tokens": { "type": "integer" },
        "timeout_ms": { "type": "integer" },
        "custom_parameters": { "type": "object" }
      }
    }
  }
}
```

### Input Envelope Invariants

| Rule | Description |
|------|-------------|
| `selected_action` is read-only | Skill receives it but cannot modify it |
| No raw user data | PII is never passed to Skills |
| No external access | Skills cannot make network calls or access storage |
| Deterministic seeding | If randomness is needed, seed is provided in config |

---

## 2. Output Schema

Every Skill MUST return output conforming to its declared schema.

### Standard Output Envelope Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["payload", "metadata"],
  "properties": {
    "payload": {
      "type": "object",
      "description": "The enrichment content produced by the Skill",
      "properties": {
        "rationale": {
          "type": "string",
          "maxLength": 500,
          "description": "Human-readable explanation of the decision"
        },
        "display_title": {
          "type": "string",
          "maxLength": 100,
          "description": "Short title for UI display"
        },
        "display_parameters": {
          "type": "object",
          "description": "Structured parameters for UI rendering"
        },
        "confidence_statement": {
          "type": "string",
          "maxLength": 200,
          "description": "Optional confidence framing"
        }
      }
    },
    "metadata": {
      "type": "object",
      "required": ["skill_id", "skill_version", "generated_at"],
      "properties": {
        "skill_id": { "type": "string" },
        "skill_version": { "type": "string" },
        "generated_at": { "type": "string", "format": "date-time" },
        "token_count": { "type": "integer" },
        "generation_ms": { "type": "integer" }
      }
    }
  },
  "additionalProperties": false
}
```

### Output Schema Rules

| Rule | Enforcement |
|------|-------------|
| Schema conformance | Validator rejects non-conforming output |
| No extra fields | `additionalProperties: false` enforced |
| Length limits | All string fields have `maxLength` |
| Required fields | Missing required fields trigger rejection |

---

## 3. Invariants

Invariants are **non-negotiable rules** that every Skill output must satisfy.

### Universal Invariants (Apply to ALL Skills)

| ID | Invariant | Check |
|----|-----------|-------|
| `INV-001` | Output must not reference action selection | No field named `selected_action`, `recommended_action`, `action_id` in payload |
| `INV-002` | Output must not contain scoring data | No field named `score`, `ranking`, `probability` in payload |
| `INV-003` | Output must not attempt state mutation | No field named `state`, `update_state`, `set_*` in payload |
| `INV-004` | Output must not reference guardrail bypass | No content suggesting guardrail override |
| `INV-005` | Output must be self-contained | No external URLs, no references to "see more" |
| `INV-006` | Output must respect length limits | All strings within declared maxLength |

### Skill-Specific Invariants

Each Skill may define additional invariants in its SEC. Examples:

```json
{
  "skill_invariants": [
    {
      "id": "FIT-001",
      "description": "Rationale must mention the session name",
      "check": "payload.rationale CONTAINS decision_context.action_metadata.name"
    },
    {
      "id": "FIT-002", 
      "description": "Must not mention fatigue if user didn't report it",
      "check": "IF user_state.scenario_extensions.user_reported_fatigue IS NULL THEN payload.rationale NOT CONTAINS 'fatigue'"
    }
  ]
}
```

---

## 4. Prohibited Outputs

Explicit blocklist of content that triggers immediate rejection.

### Universal Prohibitions

| Category | Examples | Reason |
|----------|----------|--------|
| **Decision override** | "I recommend a different session", "You should do X instead" | Authority boundary violation |
| **Medical/legal advice** | "This will cure...", "Legally you should..." | Liability |
| **Competitor references** | Mentioning other apps/services by name | Policy |
| **Personal data echo** | Repeating user's name, email, location | Privacy |
| **Urgency manipulation** | "Act now!", "Limited time!" | Dark pattern |
| **Negative framing** | "You failed to...", "You're behind..." | User experience |

### Prohibition Check Implementation

```json
{
  "prohibited_patterns": [
    {
      "id": "PROHIB-001",
      "pattern": "(?i)(i recommend|you should|instead of)",
      "type": "regex",
      "reason": "Decision override attempt"
    },
    {
      "id": "PROHIB-002",
      "pattern": "(?i)(cure|treat|diagnose|medical advice)",
      "type": "regex",
      "reason": "Medical claim"
    }
  ]
}
```

---

## 5. Timeout Behavior

Skills have strict time budgets. Timeout triggers fallback, not failure.

### Timeout Configuration

| Execution Mode | Default Timeout | Hard Limit |
|----------------|-----------------|------------|
| `deterministic_only` | 20ms | 50ms |
| `llm_enhanced` | 300ms | 500ms |

### Timeout Handling

```
IF execution_time > timeout_ms:
  1. Terminate Skill execution
  2. Log timeout event with partial output (if any)
  3. Trigger fallback Skill
  4. Set fallback_reason_code = "timeout"
  5. Continue to validation (fallback output)
```

### Timeout Invariant

```
A Skill timeout NEVER causes decision failure.
Fallback ensures a valid response is always returned.
```

---

## 6. Fallback Definition

Every Skill MUST have a defined fallback. Fallbacks are always deterministic.

### Fallback Tiers (V1)

```
Tier 1: Primary Skill (LLM or deterministic)
   │
   ▼ (on failure/timeout/rejection)
Tier 2: Deterministic Fallback Skill
   │
   ▼ (on catastrophic failure - should never happen)
Tier 3: Minimal Safe Output (hardcoded)
```

### Fallback Skill Requirements

| Requirement | Description |
|-------------|-------------|
| Must be deterministic | No LLM, no external calls |
| Must be fast | < 20ms execution |
| Must be valid | Output guaranteed to pass validation |
| Must be meaningful | Not empty or placeholder |

### Fallback Output Example

```json
{
  "payload": {
    "rationale": "We selected {action_name} based on your recent activity and preferences.",
    "display_title": "{action_name}",
    "display_parameters": {
      "template_used": true,
      "personalization_level": "low"
    }
  },
  "metadata": {
    "skill_id": "decision_rationale_template",
    "skill_version": "1.0.0",
    "generated_at": "2026-01-16T12:00:00Z",
    "token_count": 0,
    "generation_ms": 2
  }
}
```

### Fallback Reason Codes

| Code | Meaning |
|------|---------|
| `timeout` | Primary Skill exceeded time limit |
| `validation_failed` | Output failed schema/invariant checks |
| `executor_error` | LLM or executor returned error |
| `prohibited_content` | Output contained prohibited patterns |
| `mode_override` | Request specified deterministic_only |

---

## SEC Document Structure

Every Skill must have an SEC document with this structure:

```json
{
  "sec_version": "1.0.0",
  "skill_id": "decision_rationale_generator",
  "skill_version": "1.0.0",
  "skill_type": "llm | deterministic",
  
  "input_schema": {
    "$ref": "#/definitions/standard_input_envelope"
  },
  
  "output_schema": {
    "type": "object",
    "required": ["payload", "metadata"],
    "properties": {}
  },
  
  "invariants": {
    "universal": ["INV-001", "INV-002", "INV-003", "INV-004", "INV-005", "INV-006"],
    "skill_specific": []
  },
  
  "prohibitions": {
    "universal": true,
    "skill_specific": []
  },
  
  "timeout": {
    "default_ms": 300,
    "hard_limit_ms": 500
  },
  
  "fallback": {
    "skill_id": "decision_rationale_template",
    "skill_version": "1.0.0"
  },
  
  "audit": {
    "log_input": true,
    "log_output": true,
    "log_output_hash": true,
    "retention_days": 90
  }
}
```

---

## Executor Interface

Skills are executed through a standard interface, enabling model-agnostic operation.

### Executor Interface Definition

```typescript
interface SkillExecutor {
  // Identity
  executor_id: string;
  executor_type: "deterministic" | "llm_stub" | "cloud_llm" | "local_llm";
  
  // Execution
  execute(
    input: SkillInputEnvelope,
    sec: SkillExecutionContract,
    timeout_ms: number
  ): Promise<SkillOutput | ExecutorError>;
  
  // Health
  isAvailable(): boolean;
  getLatencyEstimate(): number;
}
```

### Executor Types (V1)

| Type | Description | V1 Status |
|------|-------------|-----------|
| `deterministic` | Template-based, no AI | Implemented |
| `llm_stub` | Mock LLM for testing | Implemented |
| `cloud_llm` | Cloud LLM API (OpenAI, Anthropic, etc.) | Interface defined |
| `local_llm` | Local model execution | Future |

### Executor Selection Logic

```
1. Check execution_mode_override from request
2. Check scenario default execution_mode
3. Check executor availability (isAvailable())
4. Check latency budget (getLatencyEstimate() < remaining_budget)
5. Select highest-capability available executor
6. If no executor available, use deterministic fallback
```

---

## Model-Agnostic Guarantees

The SEC architecture ensures ADE is **not dependent on any specific LLM**.

### What Model-Agnostic Means

| Guarantee | How SEC Enables It |
|-----------|-------------------|
| Vendor independence | Executor interface abstracts provider |
| Cost control | Can route to cheaper models for low-risk Skills |
| Offline operation | Deterministic fallback always available |
| Quality consistency | Validators enforce output quality regardless of model |
| Audit equivalence | Same audit trail whether LLM or deterministic |

### Swapping Models

To swap from one LLM provider to another:

1. Implement new executor with `SkillExecutor` interface
2. Register executor in executor registry
3. Update executor selection priority (optional)
4. **No changes to Skills, SECs, or validators required**

---

## V1 Skill Inventory

### Required Skills for V1

| Skill ID | Type | Purpose |
|----------|------|---------|
| `decision_rationale_template` | deterministic | Template-based rationale generation |
| `decision_rationale_llm` | llm | LLM-enhanced rationale generation |
| `null_skill` | deterministic | Pass-through (no enrichment) |

### Skill: `decision_rationale_template`

```json
{
  "skill_id": "decision_rationale_template",
  "version": "1.0.0",
  "type": "deterministic",
  "description": "Generates rationale using parameterized templates",
  "templates": {
    "default": "We selected {action_name} based on your recent activity.",
    "high_engagement": "Great momentum! {action_name} will help you maintain your streak.",
    "recovery_needed": "{action_name} is a good choice to help you recover.",
    "new_user": "Welcome! {action_name} is a great way to get started."
  },
  "template_selection_logic": "Based on user_state.core.engagement_level and scenario_extensions"
}
```

### Skill: `decision_rationale_llm`

```json
{
  "skill_id": "decision_rationale_llm",
  "version": "1.0.0",
  "type": "llm",
  "description": "Generates personalized rationale using LLM",
  "prompt_template": "Generate a brief, encouraging rationale for why {action_name} was selected for a user with {state_summary}. Keep it under 100 words. Do not mention scores or rankings.",
  "fallback_skill": "decision_rationale_template@1.0.0"
}
```

---

## Testing Requirements

### SEC Validation Tests

Every SEC must pass these tests before deployment:

| Test | Description |
|------|-------------|
| Schema validity | SEC document conforms to SEC meta-schema |
| Input schema validity | Input schema is valid JSON Schema |
| Output schema validity | Output schema is valid JSON Schema |
| Invariant parsability | All invariants can be parsed and evaluated |
| Prohibition parsability | All prohibition patterns are valid regex |
| Fallback existence | Fallback skill exists and is deterministic |
| Timeout sanity | Timeout values within acceptable range |

### Skill Execution Tests

| Test | Description |
|------|-------------|
| Happy path | Valid input → valid output |
| Timeout handling | Slow execution → fallback triggered |
| Invalid output | Bad output → validation fails → fallback |
| Prohibited content | Prohibited pattern → rejection → fallback |
| Invariant violation | Invariant broken → rejection → fallback |

---

## What Flows From This Specification

| Artifact | Status |
|----------|--------|
| ADE-Validators-v1.md | Unblocked |
| Skill implementations | Unblocked |
| Executor implementations | Unblocked |
| SEC validation tooling | Unblocked |

---

## Appendix A: Full SEC Example (Fitness Rationale)

```json
{
  "sec_version": "1.0.0",
  "skill_id": "fitness_session_rationale",
  "skill_version": "1.0.0",
  "skill_type": "llm",
  
  "description": "Generates personalized rationale for fitness session recommendations",
  
  "input_schema": {
    "$ref": "#/definitions/standard_input_envelope",
    "properties": {
      "decision_context": {
        "properties": {
          "action_metadata": {
            "properties": {
              "session_name": { "type": "string" },
              "intensity": { "type": "string", "enum": ["low", "moderate", "high"] },
              "duration_minutes": { "type": "integer" },
              "session_type": { "type": "string" }
            }
          }
        }
      }
    }
  },
  
  "output_schema": {
    "type": "object",
    "required": ["payload", "metadata"],
    "properties": {
      "payload": {
        "type": "object",
        "required": ["rationale"],
        "properties": {
          "rationale": {
            "type": "string",
            "maxLength": 200,
            "minLength": 20
          },
          "encouragement": {
            "type": "string",
            "maxLength": 100
          },
          "display_parameters": {
            "type": "object",
            "properties": {
              "tone": { "type": "string", "enum": ["supportive", "energetic", "calm"] },
              "highlight_recovery": { "type": "boolean" }
            }
          }
        }
      },
      "metadata": {
        "$ref": "#/definitions/standard_metadata"
      }
    },
    "additionalProperties": false
  },
  
  "invariants": {
    "universal": ["INV-001", "INV-002", "INV-003", "INV-004", "INV-005", "INV-006"],
    "skill_specific": [
      {
        "id": "FIT-001",
        "description": "Rationale must mention the session name or type",
        "check": "payload.rationale CONTAINS_ANY [action_metadata.session_name, action_metadata.session_type]"
      },
      {
        "id": "FIT-002",
        "description": "Must not mention specific fatigue numbers",
        "check": "payload.rationale NOT MATCHES '\\d+(\\.\\d+)?\\s*(fatigue|tired)'"
      },
      {
        "id": "FIT-003",
        "description": "Must not promise specific outcomes",
        "check": "payload.rationale NOT CONTAINS_ANY ['guarantee', 'will definitely', 'proven to']"
      }
    ]
  },
  
  "prohibitions": {
    "universal": true,
    "skill_specific": [
      {
        "id": "FIT-PROHIB-001",
        "pattern": "(?i)(injury|pain|hurt|damage)",
        "reason": "Medical safety - do not reference injury"
      },
      {
        "id": "FIT-PROHIB-002",
        "pattern": "(?i)(weight loss|lose weight|burn fat)",
        "reason": "Avoid weight-focused messaging"
      }
    ]
  },
  
  "timeout": {
    "default_ms": 300,
    "hard_limit_ms": 500
  },
  
  "fallback": {
    "skill_id": "decision_rationale_template",
    "skill_version": "1.0.0"
  },
  
  "audit": {
    "log_input": true,
    "log_output": true,
    "log_output_hash": true,
    "retention_days": 90
  }
}
```

---

## Appendix B: Invariant Check Language

Invariant checks use a simple expression language:

| Operator | Meaning | Example |
|----------|---------|---------|
| `CONTAINS` | String contains substring | `payload.rationale CONTAINS "yoga"` |
| `CONTAINS_ANY` | String contains any of list | `payload.rationale CONTAINS_ANY ["yoga", "stretch"]` |
| `NOT CONTAINS` | String does not contain | `payload.rationale NOT CONTAINS "score"` |
| `MATCHES` | Regex match | `payload.rationale MATCHES "\\d+ minutes"` |
| `NOT MATCHES` | Regex does not match | `payload.rationale NOT MATCHES "\\d+%"` |
| `IS NULL` | Field is null/missing | `user_state.fatigue IS NULL` |
| `IS NOT NULL` | Field exists | `action_metadata.name IS NOT NULL` |
| `EQUALS` | Exact match | `payload.tone EQUALS "supportive"` |
| `LENGTH <` | String length less than | `payload.rationale LENGTH < 200` |

**Design Note:** Invariant expressions are intentionally non-Turing-complete and side-effect free.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-16 | Initial specification |
