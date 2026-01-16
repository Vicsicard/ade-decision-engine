/**
 * Replay Re-execution
 * 
 * Provides determinism verification by re-executing decisions
 * with stored inputs and pinned scenario hashes.
 * 
 * @version 1.0.0
 */

import type { AuditTrace, DecisionResponse } from '../core/types.js';

/**
 * Replay result
 */
export interface ReplayResult {
  original_decision_id: string;
  replay_decision_id: string;
  determinism_verified: boolean;
  differences: ReplayDifference[];
  replay_duration_ms: number;
}

/**
 * Difference found during replay
 */
export interface ReplayDifference {
  path: string;
  original_value: unknown;
  replay_value: unknown;
  severity: 'critical' | 'minor';
}

/**
 * Replay executor interface
 */
export interface ReplayExecutor {
  /**
   * Re-execute a decision from its audit trace
   */
  reexecute(trace: AuditTrace): Promise<ReplayResult>;
  
  /**
   * Compare two decision responses for determinism
   */
  compare(
    original: DecisionResponse,
    replay: DecisionResponse
  ): ReplayDifference[];
}

/**
 * Fields that must match for determinism verification
 */
export const DETERMINISM_CRITICAL_FIELDS = [
  'decision.selected_action',
  'decision.ranked_options',
  'guardrails_applied',
  'state.core',
  'state.scenario_extensions',
] as const;

/**
 * Fields that may differ (timestamps, IDs)
 */
export const DETERMINISM_IGNORED_FIELDS = [
  'decision.decision_id',
  'audit.decision_id',
  'audit.trace_id',
  'audit.replay_token',
  'meta.request_id',
  'meta.timestamp',
  'meta.total_duration_ms',
] as const;

/**
 * Compare two values at a given path
 */
export function compareValues(
  path: string,
  original: unknown,
  replay: unknown
): ReplayDifference | null {
  // Check if this path should be ignored
  if (DETERMINISM_IGNORED_FIELDS.some(f => path.startsWith(f))) {
    return null;
  }
  
  // Deep equality check
  if (JSON.stringify(original) !== JSON.stringify(replay)) {
    const isCritical = DETERMINISM_CRITICAL_FIELDS.some(f => path.startsWith(f));
    return {
      path,
      original_value: original,
      replay_value: replay,
      severity: isCritical ? 'critical' : 'minor',
    };
  }
  
  return null;
}
