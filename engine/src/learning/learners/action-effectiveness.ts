/**
 * Action Effectiveness Learner
 * 
 * Computes historical success ratios for actions based on post-decision feedback.
 * 
 * PURPOSE:
 * This learner answers: "When this action is selected, how often does it succeed?"
 * It does NOT answer: "What should we do next?"
 * 
 * GOVERNANCE:
 * - Post-decision only (uses finalized audit)
 * - Non-causal (decision unchanged if learner vanishes)
 * - Evidence-only (descriptive statistics, not prescriptions)
 * - Overwrite-safe (idempotent per event; replayable with ordered history)
 * - Domain-agnostic (works for any action-based system)
 * 
 * FEEDBACK TRUST:
 * Feedback is treated as an untrusted, optional signal.
 * This learner does not validate, normalize, or act upon feedback beyond counting.
 * 
 * DOWNSTREAM COUPLING (FORBIDDEN):
 * No engine component may read learned.effectiveness.* during decision selection.
 * This is enforced by governance declaration per the V2 Learning Contract.
 * 
 * WHAT THIS LEARNER EXPLICITLY DOES NOT DO:
 * ❌ Does not compute weights
 * ❌ Does not rank actions
 * ❌ Does not suggest decisions
 * ❌ Does not block outcomes
 * ❌ Does not read scenario config
 * ❌ Does not modify memory outside learned.*
 * 
 * @see docs/ADE-V2-Learning-Contract.md
 */

import type { Learner, LearnerInput, LearnerResult, MemoryUpdate } from '../learner-interface.js';

/**
 * Effectiveness data for a single action
 */
export interface ActionEffectivenessData {
  /** Total number of times this action was selected */
  attempt_count: number;
  /** Number of times feedback indicated success */
  success_count: number;
  /** Computed success ratio (success_count / attempt_count) */
  success_rate: number;
  /** ISO timestamp of last successful outcome */
  last_success_ts: string | null;
  /** ISO timestamp of last attempt */
  last_attempt_ts: string;
}

/**
 * Namespace for effectiveness data
 */
const NAMESPACE = 'learned.effectiveness';

/**
 * Action Effectiveness Learner
 * 
 * Deliberately boring. Just accounting.
 * No prediction. No intelligence. No optimization.
 */
export const ActionEffectivenessLearner: Learner = {
  learner_id: 'action-effectiveness',
  version: '1.0.0',

  async process(input: LearnerInput): Promise<LearnerResult> {
    const memoryUpdates: MemoryUpdate[] = [];

    // Extract selected action from finalized audit
    const selectedAction = input.audit.final_decision?.selected_action;
    if (!selectedAction) {
      // No action to track - return empty (valid, not an error)
      return { memory_updates: [] };
    }

    // Extract feedback signal (optional)
    // NOTE: Feedback is treated as an untrusted, optional signal.
    // This learner does not validate, normalize, or act upon feedback beyond counting.
    const feedback = input.feedback;
    const isSuccess = feedback?.completed === true;
    const timestamp = input.audit.timestamp;

    // Read existing effectiveness data from memory snapshot
    const existingKey = `${selectedAction}_effectiveness`;
    const existingData = input.memory_snapshot?.[`${NAMESPACE}.${existingKey}`] as ActionEffectivenessData | undefined;

    // Compute updated effectiveness data
    const attemptCount = (existingData?.attempt_count ?? 0) + 1;
    const successCount = (existingData?.success_count ?? 0) + (isSuccess ? 1 : 0);
    const successRate = attemptCount > 0 ? successCount / attemptCount : 0;

    const updatedData: ActionEffectivenessData = {
      attempt_count: attemptCount,
      success_count: successCount,
      success_rate: successRate,
      last_success_ts: isSuccess ? timestamp : (existingData?.last_success_ts ?? null),
      last_attempt_ts: timestamp,
    };

    // Write updated effectiveness data
    memoryUpdates.push({
      namespace: NAMESPACE,
      key: existingKey,
      value: updatedData,
    });

    // Optionally include metadata about this learner run
    memoryUpdates.push({
      namespace: NAMESPACE,
      key: '_last_update',
      value: {
        learner_id: 'action-effectiveness',
        version: '1.0.0',
        timestamp,
        decision_id: input.decision_id,
      },
    });

    return {
      memory_updates: memoryUpdates,
      metadata: {
        computed_at: timestamp,
        notes: `action=${selectedAction}, feedback=${!!feedback}, success=${isSuccess}`,
      },
    };
  },
};

/**
 * Factory function for creating the learner
 */
export function createActionEffectivenessLearner(): Learner {
  return ActionEffectivenessLearner;
}
