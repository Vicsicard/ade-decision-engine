/**
 * DDR Client
 * Minimal client for calling the DDR Runtime API
 * 
 * Host app responsibilities:
 * - Generate session_id
 * - Assign cohort deterministically
 * - Send raw signals only
 * - Report outcomes
 */

const DDR_RUNTIME_URL = process.env.NEXT_PUBLIC_DDR_RUNTIME_URL || 'https://ddr-runtime-dev.vicsicard.workers.dev';

// =============================================================================
// Types
// =============================================================================

export interface DecideRequest {
  user_id: string;
  session_id: string;
  signals: {
    days_since_last_session: number;
    recent_completion_rate: number;
    fatigue_score: number;
  };
  context: {
    local_time: string;
  };
  cohort: 'control' | 'treatment';
  actions: Array<{
    action_id: string;
    type_id: string;
    attributes: Record<string, unknown>;
  }>;
}

export interface DecideResponse {
  decision_id: string;
  decision_code: 'APPROVE' | 'REFUSE';
  selected_action: {
    action_id: string;
    type: string;
    duration_minutes: number;
  };
  audit: {
    replay_token: string;
    stage_path: string[];
    guardrails_triggered: string[];
    scenario_id: string;
    scenario_version: string;
    latency_ms: number;
    cohort: string;
  };
}

export interface OutcomeRequest {
  decision_id: string;
  user_id: string;
  outcome: 'completed' | 'skipped' | 'abandoned';
  completion_percentage: number;
  duration_minutes: number;
}

export interface OutcomeResponse {
  recorded: boolean;
  timestamp: string;
}

// =============================================================================
// Cohort Assignment
// =============================================================================

/**
 * Deterministic cohort assignment based on user_id hash.
 * hash(user_id) % 2 === 0 -> control
 * hash(user_id) % 2 === 1 -> treatment
 */
export function assignCohort(userId: string): 'control' | 'treatment' {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 2 === 0 ? 'control' : 'treatment';
}

/**
 * Generate a session ID for today.
 */
export function generateSessionId(userId: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `${userId}-${today}`;
}

// =============================================================================
// API Client
// =============================================================================

/**
 * Call DDR /v1/decide endpoint.
 * Host app must NOT branch on rationale - only on decision_code and selected_action.
 */
export async function decide(request: DecideRequest): Promise<DecideResponse> {
  const response = await fetch(`${DDR_RUNTIME_URL}/v1/decide`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`DDR decide failed: ${error.error || response.statusText}`);
  }

  return response.json();
}

/**
 * Call DDR /v1/outcome endpoint.
 * This is pure observation - outcome failure must never retroactively change decisions.
 */
export async function reportOutcome(request: OutcomeRequest): Promise<OutcomeResponse> {
  const response = await fetch(`${DDR_RUNTIME_URL}/v1/outcome`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`DDR outcome failed: ${error.error || response.statusText}`);
  }

  return response.json();
}

// =============================================================================
// Control Cohort Logic
// =============================================================================

/**
 * Static decision logic for control cohort.
 * Always returns the same workout (workout-a, strength, 30 min).
 * Same UI, same outcome reporting - just no DDR involvement.
 */
export function controlDecision(userId: string, sessionId: string): DecideResponse {
  return {
    decision_id: `control-${sessionId}`,
    decision_code: 'APPROVE',
    selected_action: {
      action_id: 'workout-a',
      type: 'strength',
      duration_minutes: 30,
    },
    audit: {
      replay_token: '',
      stage_path: ['static'],
      guardrails_triggered: [],
      scenario_id: 'control',
      scenario_version: '1.0.0',
      latency_ms: 0,
      cohort: 'control',
    },
  };
}
