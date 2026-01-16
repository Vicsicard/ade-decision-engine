/**
 * ADE V2 Learner Interface
 * 
 * Design Principle (Non-Negotiable):
 * Learners may write evidence. They may never write rules.
 * 
 * The learner:
 * - Never runs inside the decision pipeline
 * - Never modifies scenarios
 * - Never changes scoring, guardrails, or selection
 * - Never executes synchronously with a decision
 * 
 * It is post-decision, pre-next-decision only.
 */

import type { DecisionRequest, Decision, ExecutionInfo } from '../core/types.js';

/**
 * Outcome signal from feedback endpoint
 */
export interface OutcomeSignal {
  completed: boolean;
  rating?: number | undefined;
  duration_seconds?: number | undefined;
  custom?: Record<string, unknown> | undefined;
}

/**
 * LearnerInterface
 *
 * V2 learners consume audit + feedback and write derived features
 * into the memory store. They NEVER influence the current decision.
 */
export interface Learner {
  /**
   * Unique learner identifier
   */
  learner_id: string;

  /**
   * Version of the learner logic
   */
  version: string;

  /**
   * Called asynchronously after a decision is finalized and audited.
   * Must be side-effect isolated.
   */
  process(input: LearnerInput): Promise<LearnerResult>;
}

/**
 * Input provided to a learner for processing
 */
export interface LearnerInput {
  decision_id: string;

  scenario_id: string;
  scenario_version: string;
  scenario_hash: string;

  user_id: string;

  /**
   * Immutable audit artifacts
   */
  audit: {
    request: DecisionRequest;
    final_decision: Decision;
    execution: ExecutionInfo;
    guardrails_applied: string[];
    timestamp: string;
  };

  /**
   * Optional feedback (may arrive later)
   */
  feedback?: OutcomeSignal | undefined;

  /**
   * Read-only snapshot of memory at time of decision.
   * Learners read memory snapshots, never live memory.
   */
  memory_snapshot: Record<string, unknown>;

  /**
   * Unique identifier for the memory snapshot used in this decision.
   * Required for deterministic replay.
   */
  memory_snapshot_id: string;
}

/**
 * Memory update operation from a learner
 */
export interface MemoryUpdate {
  /**
   * Namespace for the memory key (must be "learned.*")
   * e.g. "learned.engagement", "learned.delivery"
   */
  namespace: string;

  /**
   * Key within the namespace
   * e.g. "hour_success_rate", "best_send_window"
   */
  key: string;

  /**
   * Value to write
   */
  value: unknown;

  /**
   * Optional TTL in seconds
   */
  ttl_seconds?: number | undefined;
}

/**
 * Result returned by a learner after processing
 */
export interface LearnerResult {
  /**
   * Memory writes are namespaced and additive.
   * All writes must target "learned.*" namespaces.
   */
  memory_updates: MemoryUpdate[];

  /**
   * Optional metadata for observability
   */
  metadata?: {
    computed_at: string;
    confidence?: number | undefined;
    notes?: string | undefined;
  } | undefined;
}

/**
 * Memory Namespace Rules (Enforced):
 * 
 * | Rule                                              | Status     |
 * |---------------------------------------------------|------------|
 * | Learners write only to learned.* namespaces       | ✅ Required |
 * | Engine never depends on learned memory            | ✅ Required |
 * | All learned values must be optional               | ✅ Required |
 * | Missing learned memory must not fail a decision   | ✅ Required |
 * | Memory writes are overwrite-safe                  | ✅ Required |
 * 
 * Example valid keys:
 * - learned.engagement.hour_success_rate
 * - learned.delivery.best_send_window
 * - learned.content.read_depth_trend
 * 
 * Forbidden namespaces:
 * - scoring.*
 * - guardrails.*
 * - execution.*
 * - scenario.*
 * 
 * Namespace + Key Resolution Rule (Canonical):
 * 
 * When a learner writes:
 *   { namespace: 'learned.engagement', key: 'hour_success_rate', value: ... }
 * 
 * The full memory key is resolved as:
 *   full_key = `${namespace}.${key}`
 *   // → 'learned.engagement.hour_success_rate'
 * 
 * When reading from memory_snapshot, use the full resolved key:
 *   snapshot['learned.engagement.hour_success_rate']
 * 
 * This rule ensures consistent key resolution across all learners and memory stores.
 */

/**
 * Validates that a namespace is in the allowed "learned.*" format
 */
export function isValidLearnerNamespace(namespace: string): boolean {
  return namespace.startsWith('learned.');
}

/**
 * Validates that LearnerInput contains required audit artifacts.
 * This is a hard guard: learners CANNOT execute without finalized audit data.
 */
export function validateLearnerInput(input: LearnerInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.decision_id) {
    errors.push('decision_id is required: audit must be committed before learner execution');
  }

  if (!input.audit) {
    errors.push('audit is required: learners can only process finalized decisions');
  } else {
    if (!input.audit.timestamp) {
      errors.push('audit.timestamp is required: decision must be finalized');
    }
    if (!input.audit.final_decision) {
      errors.push('audit.final_decision is required: selection must be locked');
    }
  }

  if (!input.memory_snapshot_id) {
    errors.push('memory_snapshot_id is required: replay determinism requires snapshot pinning');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateLearnerResult(result: LearnerResult): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Guard: memory_updates must be an array
  if (!Array.isArray(result.memory_updates)) {
    errors.push('memory_updates must be an array');
    return { valid: false, errors };
  }

  for (const update of result.memory_updates) {
    if (!isValidLearnerNamespace(update.namespace)) {
      errors.push(
        `Invalid namespace "${update.namespace}": learners may only write to "learned.*" namespaces`
      );
    }

    // Check for forbidden namespace prefixes
    const forbiddenPrefixes = ['scoring.', 'guardrails.', 'execution.', 'scenario.'];
    for (const prefix of forbiddenPrefixes) {
      if (update.namespace.startsWith(prefix)) {
        errors.push(
          `Forbidden namespace "${update.namespace}": learners may never write to "${prefix}*"`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
