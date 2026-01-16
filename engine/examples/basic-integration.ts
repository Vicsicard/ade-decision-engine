/**
 * Basic ADE Integration Example
 * 
 * Demonstrates:
 * 1. Creating an engine
 * 2. Registering a scenario
 * 3. Making a decision
 * 4. Inspecting the audit trace
 * 
 * @version 1.0.0
 */

import { createEngine } from '../src/index.js';
import type { Scenario, DecisionRequest } from '../src/core/types.js';

/**
 * Example scenario: Simple notification timing
 */
const notificationScenario: Scenario = {
  scenario_id: 'example-notification',
  version: '1.0.0',
  metadata: {
    name: 'Example Notification Timing',
    description: 'Decides when to send a notification',
    domain: 'engagement',
    created_at: '2026-01-16T00:00:00Z',
    author: 'ADE Team',
    tags: ['example', 'notification'],
  },
  state_schema: {
    core_dimensions: {
      engagement_level: {
        type: 'float',
        range: { min: 0.0, max: 1.0 },
        default: 0.5,
        derivation: {
          source: 'signal',
          formula: 'signals.engagement_score',
          inputs: ['engagement_score'],
        },
        description: 'User engagement level',
      },
      recency_score: {
        type: 'float',
        range: { min: 0.0, max: 1.0 },
        default: 0.5,
        derivation: {
          source: 'computed',
          formula: '1.0 / (1.0 + hours_since_last)',
          inputs: ['hours_since_last'],
        },
        description: 'How recently user was active',
      },
      interaction_depth: {
        type: 'integer',
        range: { min: 0 },
        default: 0,
        derivation: {
          source: 'signal',
          formula: 'signals.total_interactions',
          inputs: ['total_interactions'],
        },
        description: 'Total interaction count',
      },
      depth_factor: {
        type: 'float',
        range: { min: 0.0, max: 1.0 },
        default: 1.0,
        derivation: {
          source: 'computed',
          formula: 'if_else(interaction_depth < 5, 1.0, if_else(interaction_depth < 20, 0.5, 0.2))',
          inputs: ['interaction_depth'],
        },
        description: 'Normalized experience depth factor',
      },
      churn_risk: {
        type: 'float',
        range: { min: 0.0, max: 1.0 },
        default: 0.5,
        derivation: {
          source: 'computed',
          formula: '(1.0 - engagement_level) * 0.6 + depth_factor * 0.4',
          inputs: ['engagement_level', 'depth_factor'],
        },
        description: 'Risk of user churning',
      },
    },
    scenario_dimensions: {},
  },
  actions: {
    action_source: 'dynamic',
    action_types: [
      {
        type_id: 'send_now',
        display_name: 'Send Now',
        description: 'Send notification immediately',
        attributes: {},
        skill_mapping: 'decision_rationale_template@1.0.0',
      },
      {
        type_id: 'delay',
        display_name: 'Delay',
        description: 'Delay notification',
        attributes: {
          delay_minutes: { type: 'integer', range: { min: 1, max: 1440 } },
        },
        skill_mapping: 'decision_rationale_template@1.0.0',
      },
      {
        type_id: 'suppress',
        display_name: 'Suppress',
        description: 'Do not send notification',
        attributes: {},
        skill_mapping: 'decision_rationale_template@1.0.0',
      },
    ],
  },
  guardrails: {
    rules: [
      {
        rule_id: 'GR-LOW-ENGAGEMENT',
        description: 'Suppress if engagement is very low',
        condition: 'state.core.engagement_level < 0.2',
        effect: 'force_action',
        target: 'suppress',
        priority: 1,
      },
    ],
    fail_behavior: 'reject_action',
  },
  scoring: {
    objectives: [
      {
        objective_id: 'engagement_fit',
        name: 'Engagement Fit',
        weight: 0.6,
        formula: 'state.core.engagement_level',
        inputs: ['engagement_level'],
        description: 'Higher engagement = better fit for send_now',
      },
      {
        objective_id: 'churn_prevention',
        name: 'Churn Prevention',
        weight: 0.4,
        formula: '1.0 - state.core.churn_risk',
        inputs: ['churn_risk'],
        description: 'Lower churn risk = better fit',
      },
    ],
    execution_risk: {
      enabled: false,
      weight: 0,
      factors: [],
    },
    tie_breaking: ['action_id_asc'],
  },
  skills: {
    available_skills: [
      { skill_id: 'decision_rationale_template', version: '1.0.0' },
    ],
    action_mappings: {},
    default_fallback: 'decision_rationale_template@1.0.0',
  },
  execution: {
    default_mode: 'deterministic_only',
    allow_mode_override: true,
    timeouts: {
      total_decision_ms: 500,
      skill_execution_ms: 200,
      state_derivation_ms: 50,
    },
    retry_policy: {
      max_retries: 0,
      retry_on: [],
    },
  },
};

/**
 * Example decision request
 */
const exampleRequest: DecisionRequest = {
  scenario_id: 'example-notification',
  user_id: 'user-12345',
  actions: [
    { action_id: 'send-now', type_id: 'send_now', attributes: {} },
    { action_id: 'delay-1h', type_id: 'delay', attributes: { delay_minutes: 60 } },
    { action_id: 'suppress', type_id: 'suppress', attributes: {} },
  ],
  signals: {
    engagement_score: 0.7,
    hours_since_last: 12,
    total_interactions: 25,
  },
  context: {
    current_time: new Date().toISOString(),
    timezone: 'America/Denver',
    platform_constraints: undefined,
  },
  options: {
    execution_mode_override: 'deterministic_only',
    include_rationale: true,
    include_score_breakdown: true,
    max_ranked_options: undefined,
  },
};

/**
 * Main example function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    ADE Basic Integration Example               ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // 1. Create engine
  console.log('1. Creating engine...');
  const engine = await createEngine({ traceEnabled: true });
  console.log('   ✓ Engine created');
  console.log('');

  // 2. Register scenario
  console.log('2. Registering scenario...');
  await engine.registerScenario(notificationScenario);
  console.log(`   ✓ Scenario registered: ${notificationScenario.scenario_id}@${notificationScenario.version}`);
  console.log('');

  // 3. Make decision
  console.log('3. Making decision...');
  console.log(`   User: ${exampleRequest.user_id}`);
  console.log(`   Actions: ${exampleRequest.actions.map(a => a.action_id).join(', ')}`);
  console.log(`   Engagement: ${exampleRequest.signals['engagement_score']}`);
  console.log('');

  const response = await engine.decide(exampleRequest);

  // 4. Display results
  console.log('4. Decision Result:');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`   Selected Action: ${response.decision.selected_action}`);
  console.log(`   Rationale: ${response.decision.payload.rationale}`);
  console.log('');

  console.log('   Ranked Options:');
  for (const option of response.decision.ranked_options) {
    console.log(`     #${option.rank}: ${option.action_id} (score: ${option.score.toFixed(4)})`);
  }
  console.log('');

  console.log('   Execution:');
  console.log(`     Mode: ${response.execution.execution_mode}`);
  console.log(`     Fallback Used: ${response.execution.fallback_used}`);
  console.log(`     Skill: ${response.execution.skill_id}@${response.execution.skill_version}`);
  console.log('');

  console.log('   Guardrails Applied:');
  if (response.guardrails_applied.length === 0) {
    console.log('     (none)');
  } else {
    for (const gr of response.guardrails_applied) {
      console.log(`     - ${gr}`);
    }
  }
  console.log('');

  console.log('   Audit:');
  console.log(`     Decision ID: ${response.audit.decision_id}`);
  console.log(`     Replay Token: ${response.audit.replay_token}`);
  console.log(`     Scenario Hash: ${response.audit.scenario_hash.slice(0, 20)}...`);
  console.log('');

  // 5. Demonstrate replay capability
  // NOTE: This demonstrates deterministic re-execution with identical inputs.
  // Full audit-based replay uses the replay_token to retrieve the original
  // request from the audit store and re-execute with pinned scenario hash.
  console.log('5. Replay Verification:');
  console.log('───────────────────────────────────────────────────────────────');
  const replay = await engine.decide(exampleRequest);
  const determinismVerified = replay.decision.selected_action === response.decision.selected_action;
  console.log(`   Re-executed same request`);
  console.log(`   Original: ${response.decision.selected_action}`);
  console.log(`   Replay:   ${replay.decision.selected_action}`);
  console.log(`   Determinism: ${determinismVerified ? '✓ VERIFIED' : '✗ FAILED'}`);
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                         Example Complete                       ');
  console.log('═══════════════════════════════════════════════════════════════');
}

// Run example
main().catch(console.error);
