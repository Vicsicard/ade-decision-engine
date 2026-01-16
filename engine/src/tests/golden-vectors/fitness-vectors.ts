/**
 * Golden Vectors: Fitness Daily Session Scenario
 * 
 * These vectors are the proof of correctness for the ADE engine.
 * Each vector defines inputs and expected outputs that must match exactly.
 * 
 * @version 1.0.0
 */

import type { DecisionRequest } from '../../core/types.js';

export interface GoldenVector {
  id: string;
  name: string;
  description: string;
  request: DecisionRequest;
  /**
   * Pre-loaded memory state for this vector.
   * Memory values must come from memory, not signals.
   * Golden vectors must not cheat state derivation.
   */
  memory?: Record<string, unknown>;
  expected: {
    selected_action: string;
    /**
     * Guardrails that were triggered and applied.
     * NOTE: Comparison should be SET-BASED, not order-dependent.
     * The engine does not guarantee ordering of guardrails_applied.
     */
    guardrails_applied: string[];
    execution_mode: 'deterministic_only' | 'skill_enhanced';
    fallback_used: boolean;
  };
}

/**
 * Vector 1: Normal case - moderate engagement user
 */
export const FITNESS_NORMAL_CASE: GoldenVector = {
  id: 'fitness-normal-001',
  name: 'Normal Case - Moderate Engagement',
  description: 'User with moderate engagement, no guardrails triggered',
  request: {
    scenario_id: 'fitness-daily-session',
    user_id: 'test-user-001',
    actions: [
      {
        action_id: 'workout-hiit-30',
        type_id: 'workout_session',
        attributes: {
          intensity: 'high',
          duration_minutes: 30,
          session_type: 'hiit',
        },
      },
      {
        action_id: 'workout-yoga-45',
        type_id: 'workout_session',
        attributes: {
          intensity: 'low',
          duration_minutes: 45,
          session_type: 'yoga',
        },
      },
      {
        action_id: 'workout-strength-40',
        type_id: 'workout_session',
        attributes: {
          intensity: 'moderate',
          duration_minutes: 40,
          session_type: 'strength',
        },
      },
    ],
    signals: {
      sessions_completed_7d: 4,
      sessions_recommended_7d: 5,
      hours_since_last_session: 24,
      sessions_completed_total: 25,
      rest_days_last_7d: 2,
      current_program_progress_pct: 60,
    },
    context: {
      current_time: '2026-01-16T10:00:00Z',
      timezone: 'America/Denver',
      platform_constraints: undefined,
    },
    options: {
      execution_mode_override: 'deterministic_only',
      include_rationale: true,
      include_score_breakdown: true,
      max_ranked_options: undefined,
    },
  },
  expected: {
    selected_action: 'workout-strength-40', // Moderate intensity scores best for moderate engagement
    guardrails_applied: [],
    execution_mode: 'deterministic_only',
    fallback_used: false,
  },
};

/**
 * Vector 2: Guardrail Force - Rest day required
 */
export const FITNESS_GUARDRAIL_FORCE: GoldenVector = {
  id: 'fitness-guardrail-force-001',
  name: 'Guardrail Force - Rest Day Required',
  description: 'User has not had rest day in 7 days, guardrail forces rest',
  request: {
    scenario_id: 'fitness-daily-session',
    user_id: 'test-user-002',
    actions: [
      {
        action_id: 'workout-hiit-30',
        type_id: 'workout_session',
        attributes: {
          intensity: 'high',
          duration_minutes: 30,
          session_type: 'hiit',
        },
      },
      {
        action_id: 'rest-passive',
        type_id: 'rest_day',
        attributes: {
          recovery_type: 'passive',
        },
      },
    ],
    signals: {
      sessions_completed_7d: 7,
      sessions_recommended_7d: 7,
      hours_since_last_session: 20,
      sessions_completed_total: 50,
      rest_days_last_7d: 0, // No rest days - triggers GR-REST-MIN
      current_program_progress_pct: 80,
    },
    context: {
      current_time: '2026-01-16T10:00:00Z',
      timezone: 'America/Denver',
      platform_constraints: undefined,
    },
    options: {
      execution_mode_override: 'deterministic_only',
      include_rationale: true,
      include_score_breakdown: false,
      max_ranked_options: undefined,
    },
  },
  expected: {
    selected_action: 'rest-passive', // Forced by GR-REST-MIN
    guardrails_applied: ['GR-REST-MIN'],
    execution_mode: 'deterministic_only',
    fallback_used: false,
  },
};

/**
 * Vector 3: Guardrail Block - High intensity blocked
 */
export const FITNESS_GUARDRAIL_BLOCK: GoldenVector = {
  id: 'fitness-guardrail-block-001',
  name: 'Guardrail Block - High Intensity Blocked',
  description: 'User has high fatigue from consecutive high intensity sessions, high intensity actions blocked',
  request: {
    scenario_id: 'fitness-daily-session',
    user_id: 'test-user-003',
    actions: [
      {
        action_id: 'workout-hiit-30',
        type_id: 'workout_session',
        attributes: {
          intensity: 'high',
          duration_minutes: 30,
          session_type: 'hiit',
        },
      },
      {
        action_id: 'workout-yoga-45',
        type_id: 'workout_session',
        attributes: {
          intensity: 'low',
          duration_minutes: 45,
          session_type: 'yoga',
        },
      },
    ],
    signals: {
      sessions_completed_7d: 6,
      sessions_recommended_7d: 5,
      hours_since_last_session: 20,
      sessions_completed_total: 100,
      rest_days_last_7d: 1,
      current_program_progress_pct: 90,
    },
    context: {
      current_time: '2026-01-16T10:00:00Z',
      timezone: 'America/Denver',
      platform_constraints: undefined,
    },
    options: {
      execution_mode_override: 'deterministic_only',
      include_rationale: true,
      include_score_breakdown: false,
      max_ranked_options: undefined,
    },
  },
  /**
   * Memory state: consecutive_high_intensity must come from memory, not signals.
   * This value triggers GR-INTENSITY-CAP guardrail.
   */
  memory: {
    consecutive_high_intensity: 2,
  },
  expected: {
    selected_action: 'workout-yoga-45', // High intensity blocked, yoga selected
    guardrails_applied: ['GR-INTENSITY-CAP'],
    execution_mode: 'deterministic_only',
    fallback_used: false,
  },
};

/**
 * Vector 4: Tie-break resolution
 * 
 * IMPORTANT: Tie-break assumes identical intensity and duration after scoring and guardrails.
 * The scenario defines tie_breaking: ["intensity_asc", "duration_asc", "action_id_asc"]
 * Since both actions have identical intensity and duration, action_id_asc is the final tiebreaker.
 */
export const FITNESS_TIE_BREAK: GoldenVector = {
  id: 'fitness-tie-break-001',
  name: 'Tie-Break Resolution',
  description: 'Two actions with identical scores, tie-break by intensity then duration',
  request: {
    scenario_id: 'fitness-daily-session',
    user_id: 'test-user-004',
    actions: [
      {
        action_id: 'workout-moderate-a',
        type_id: 'workout_session',
        attributes: {
          intensity: 'moderate',
          duration_minutes: 30,
          session_type: 'cardio',
        },
      },
      {
        action_id: 'workout-moderate-b',
        type_id: 'workout_session',
        attributes: {
          intensity: 'moderate',
          duration_minutes: 30,
          session_type: 'strength',
        },
      },
    ],
    signals: {
      sessions_completed_7d: 3,
      sessions_recommended_7d: 5,
      hours_since_last_session: 48,
      sessions_completed_total: 15,
      rest_days_last_7d: 2,
      current_program_progress_pct: 40,
    },
    context: {
      current_time: '2026-01-16T10:00:00Z',
      timezone: 'America/Denver',
      platform_constraints: undefined,
    },
    options: {
      execution_mode_override: 'deterministic_only',
      include_rationale: true,
      include_score_breakdown: true,
      max_ranked_options: undefined,
    },
  },
  expected: {
    selected_action: 'workout-moderate-a', // Tie-break by action_id_asc
    guardrails_applied: [],
    execution_mode: 'deterministic_only',
    fallback_used: false,
  },
};

/**
 * Vector 5: New user (cold start)
 */
export const FITNESS_NEW_USER: GoldenVector = {
  id: 'fitness-new-user-001',
  name: 'New User - Cold Start',
  description: 'Brand new user with no history',
  request: {
    scenario_id: 'fitness-daily-session',
    user_id: 'test-user-005',
    actions: [
      {
        action_id: 'workout-beginner-20',
        type_id: 'workout_session',
        attributes: {
          intensity: 'low',
          duration_minutes: 20,
          session_type: 'intro',
        },
      },
      {
        action_id: 'workout-moderate-30',
        type_id: 'workout_session',
        attributes: {
          intensity: 'moderate',
          duration_minutes: 30,
          session_type: 'cardio',
        },
      },
    ],
    signals: {
      sessions_completed_7d: 0,
      sessions_recommended_7d: 0,
      hours_since_last_session: 999, // Never completed
      sessions_completed_total: 0,
      rest_days_last_7d: 7,
      current_program_progress_pct: 0,
    },
    context: {
      current_time: '2026-01-16T10:00:00Z',
      timezone: 'America/Denver',
      platform_constraints: undefined,
    },
    options: {
      execution_mode_override: 'deterministic_only',
      include_rationale: true,
      include_score_breakdown: false,
      max_ranked_options: undefined,
    },
  },
  expected: {
    selected_action: 'workout-beginner-20', // Low intensity for new user
    guardrails_applied: [],
    execution_mode: 'deterministic_only',
    fallback_used: false,
  },
};

/**
 * All fitness golden vectors
 */
export const FITNESS_GOLDEN_VECTORS: GoldenVector[] = [
  FITNESS_NORMAL_CASE,
  FITNESS_GUARDRAIL_FORCE,
  FITNESS_GUARDRAIL_BLOCK,
  FITNESS_TIE_BREAK,
  FITNESS_NEW_USER,
];
