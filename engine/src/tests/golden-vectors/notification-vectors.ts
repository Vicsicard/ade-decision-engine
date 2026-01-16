/**
 * Golden Vectors: Notification Timing Scenario
 * 
 * These vectors are the proof of correctness for the ADE engine.
 * Notification timing is a minimal, policy-heavy scenario.
 * 
 * @version 1.0.0
 */

import type { DecisionRequest } from '../../core/types.js';
import type { GoldenVector } from './fitness-vectors.js';

/**
 * Vector 1: Normal case - send now
 */
export const NOTIFICATION_NORMAL_CASE: GoldenVector = {
  id: 'notification-normal-001',
  name: 'Normal Case - Send Now',
  description: 'User in optimal window, low fatigue, send immediately',
  request: {
    scenario_id: 'notification-timing',
    user_id: 'test-user-001',
    actions: [
      { action_id: 'send-now', type_id: 'send_now', attributes: {} },
      { action_id: 'delay-1h', type_id: 'delay_1h', attributes: { delay_minutes: 60 } },
      { action_id: 'delay-4h', type_id: 'delay_4h', attributes: { delay_minutes: 240 } },
      { action_id: 'suppress', type_id: 'suppress', attributes: {} },
    ],
    signals: {
      interactions_7d: 5,
      notifications_sent_7d: 7,
      hours_since_last_interaction: 12,
      total_interactions: 50,
      notifications_sent_24h: 1,
      hours_since_last_notification: 4,
      content_relevance_score: 0.8,
    },
    context: {
      current_time: '2026-01-16T14:00:00Z',
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
    selected_action: 'send-now',
    guardrails_applied: [],
    execution_mode: 'deterministic_only',
    fallback_used: false,
  },
};

/**
 * Vector 2: Guardrail Force - Max daily notifications
 */
export const NOTIFICATION_MAX_DAILY: GoldenVector = {
  id: 'notification-max-daily-001',
  name: 'Guardrail Force - Max Daily Reached',
  description: 'User already received 3 notifications today, suppress forced',
  request: {
    scenario_id: 'notification-timing',
    user_id: 'test-user-002',
    actions: [
      { action_id: 'send-now', type_id: 'send_now', attributes: {} },
      { action_id: 'delay-1h', type_id: 'delay_1h', attributes: { delay_minutes: 60 } },
      { action_id: 'suppress', type_id: 'suppress', attributes: {} },
    ],
    signals: {
      interactions_7d: 10,
      notifications_sent_7d: 15,
      hours_since_last_interaction: 2,
      total_interactions: 100,
      notifications_sent_24h: 3, // Triggers GR-MAX-DAILY
      hours_since_last_notification: 3,
      content_relevance_score: 0.9,
    },
    context: {
      current_time: '2026-01-16T15:00:00Z',
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
    selected_action: 'suppress', // Forced by GR-MAX-DAILY
    guardrails_applied: ['GR-MAX-DAILY'],
    execution_mode: 'deterministic_only',
    fallback_used: false,
  },
};

/**
 * Vector 3: Guardrail Block - Quiet hours
 */
export const NOTIFICATION_QUIET_HOURS: GoldenVector = {
  id: 'notification-quiet-hours-001',
  name: 'Guardrail Block - Quiet Hours',
  description: 'Late night, send_now blocked, delay selected',
  request: {
    scenario_id: 'notification-timing',
    user_id: 'test-user-003',
    actions: [
      { action_id: 'send-now', type_id: 'send_now', attributes: {} },
      { action_id: 'delay-next-optimal', type_id: 'delay_next_optimal', attributes: { delay_type: 'optimal_window' } },
      { action_id: 'suppress', type_id: 'suppress', attributes: {} },
    ],
    signals: {
      interactions_7d: 5,
      notifications_sent_7d: 5,
      hours_since_last_interaction: 8,
      total_interactions: 30,
      notifications_sent_24h: 0,
      hours_since_last_notification: 12,
      content_relevance_score: 0.7,
    },
    context: {
      current_time: '2026-01-16T05:00:00Z', // 5am - quiet hours (< 8)
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
    selected_action: 'delay-next-optimal', // send_now blocked by GR-QUIET-HOURS
    guardrails_applied: ['GR-QUIET-HOURS'],
    execution_mode: 'deterministic_only',
    fallback_used: false,
  },
};

/**
 * Vector 4: Guardrail Block - Minimum gap
 */
export const NOTIFICATION_MIN_GAP: GoldenVector = {
  id: 'notification-min-gap-001',
  name: 'Guardrail Block - Minimum Gap',
  description: 'Notification sent recently, send_now blocked',
  request: {
    scenario_id: 'notification-timing',
    user_id: 'test-user-004',
    actions: [
      { action_id: 'send-now', type_id: 'send_now', attributes: {} },
      { action_id: 'delay-1h', type_id: 'delay_1h', attributes: { delay_minutes: 60 } },
      { action_id: 'suppress', type_id: 'suppress', attributes: {} },
    ],
    signals: {
      interactions_7d: 8,
      notifications_sent_7d: 10,
      hours_since_last_interaction: 1,
      total_interactions: 80,
      notifications_sent_24h: 2,
      hours_since_last_notification: 1, // < 2 hours, triggers GR-MIN-GAP
      content_relevance_score: 0.85,
    },
    context: {
      current_time: '2026-01-16T12:00:00Z',
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
    selected_action: 'delay-1h', // send_now blocked by GR-MIN-GAP
    guardrails_applied: ['GR-MIN-GAP'],
    execution_mode: 'deterministic_only',
    fallback_used: false,
  },
};

/**
 * Vector 5: Low relevance + fatigue = suppress
 */
export const NOTIFICATION_LOW_RELEVANCE_FATIGUE: GoldenVector = {
  id: 'notification-low-relevance-001',
  name: 'Low Relevance + Fatigue',
  description: 'Low relevance content with moderate fatigue triggers suppress',
  request: {
    scenario_id: 'notification-timing',
    user_id: 'test-user-005',
    actions: [
      { action_id: 'send-now', type_id: 'send_now', attributes: {} },
      { action_id: 'delay-1h', type_id: 'delay_1h', attributes: { delay_minutes: 60 } },
      { action_id: 'suppress', type_id: 'suppress', attributes: {} },
    ],
    signals: {
      interactions_7d: 2,
      notifications_sent_7d: 10,
      hours_since_last_interaction: 48,
      total_interactions: 20,
      notifications_sent_24h: 2,
      hours_since_last_notification: 3,
      content_relevance_score: 0.2, // Low relevance
    },
    context: {
      current_time: '2026-01-16T14:00:00Z',
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
    selected_action: 'suppress', // GR-LOW-RELEVANCE triggered
    guardrails_applied: ['GR-LOW-RELEVANCE'],
    execution_mode: 'deterministic_only',
    fallback_used: false,
  },
};

/**
 * All notification golden vectors
 */
export const NOTIFICATION_GOLDEN_VECTORS: GoldenVector[] = [
  NOTIFICATION_NORMAL_CASE,
  NOTIFICATION_MAX_DAILY,
  NOTIFICATION_QUIET_HOURS,
  NOTIFICATION_MIN_GAP,
  NOTIFICATION_LOW_RELEVANCE_FATIGUE,
];
