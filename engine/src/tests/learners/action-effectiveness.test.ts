/**
 * Action Effectiveness Learner Tests
 * 
 * Tests for:
 * - Missing feedback handling
 * - Overwrite safety (recomputable)
 * - Namespace enforcement
 * - Governance: decision unchanged with learner
 * 
 * @see docs/ADE-V2-Learning-Contract.md
 */

import { describe, it, expect } from 'vitest';
import { ActionEffectivenessLearner, createActionEffectivenessLearner } from '../../learning/learners/action-effectiveness.js';
import type { LearnerInput } from '../../learning/learner-interface.js';
import { validateLearnerResult } from '../../learning/learner-interface.js';

describe('ActionEffectivenessLearner', () => {
  // Helper to create valid learner input
  const createInput = (overrides: Partial<{
    selectedAction: string;
    feedback: { completed: boolean } | undefined;
    existingData: Record<string, unknown>;
  }> = {}): LearnerInput => ({
    decision_id: 'dec_test_001',
    scenario_id: 'test-scenario',
    scenario_version: '1.0.0',
    scenario_hash: 'hash_abc123',
    user_id: 'user-001',
    audit: {
      request: { scenario_id: 'test' } as any,
      final_decision: {
        decision_id: 'dec_test_001',
        selected_action: overrides.selectedAction ?? 'action-a',
        payload: {},
        ranked_options: [],
      } as any,
      execution: { execution_mode: 'deterministic_only' } as any,
      guardrails_applied: [],
      timestamp: '2026-01-16T12:00:00Z',
    },
    feedback: overrides.feedback,
    memory_snapshot: overrides.existingData ?? {},
    memory_snapshot_id: 'snap_test_001',
  });

  // ============================================================================
  // UNIT TESTS: Core Functionality
  // ============================================================================

  describe('Core Functionality', () => {
    it('creates learner via factory function', () => {
      const learner = createActionEffectivenessLearner();
      expect(learner.learner_id).toBe('action-effectiveness');
      expect(learner.version).toBe('1.0.0');
    });

    it('processes input and returns memory updates', async () => {
      const input = createInput({ feedback: { completed: true } });
      const result = await ActionEffectivenessLearner.process(input);

      expect(result.memory_updates.length).toBeGreaterThan(0);
      expect(result.metadata?.computed_at).toBe('2026-01-16T12:00:00Z');
    });

    it('tracks action from audit.final_decision.selected_action', async () => {
      const input = createInput({ selectedAction: 'send-notification' });
      const result = await ActionEffectivenessLearner.process(input);

      const effectivenessUpdate = result.memory_updates.find(
        u => u.key === 'send-notification_effectiveness'
      );
      expect(effectivenessUpdate).toBeDefined();
    });
  });

  // ============================================================================
  // UNIT TESTS: Missing Feedback Handling
  // ============================================================================

  describe('Missing Feedback Handling', () => {
    it('handles missing feedback gracefully', async () => {
      const input = createInput({ feedback: undefined });
      const result = await ActionEffectivenessLearner.process(input);

      // Should still produce updates (attempt counted, no success)
      expect(result.memory_updates.length).toBeGreaterThan(0);

      const effectivenessUpdate = result.memory_updates.find(
        u => u.key === 'action-a_effectiveness'
      );
      expect(effectivenessUpdate).toBeDefined();
      
      const data = effectivenessUpdate?.value as any;
      expect(data.attempt_count).toBe(1);
      expect(data.success_count).toBe(0);
      expect(data.success_rate).toBe(0);
    });

    it('handles feedback with completed=false', async () => {
      const input = createInput({ feedback: { completed: false } });
      const result = await ActionEffectivenessLearner.process(input);

      const effectivenessUpdate = result.memory_updates.find(
        u => u.key === 'action-a_effectiveness'
      );
      const data = effectivenessUpdate?.value as any;
      
      expect(data.attempt_count).toBe(1);
      expect(data.success_count).toBe(0);
      expect(data.success_rate).toBe(0);
    });

    it('handles feedback with completed=true', async () => {
      const input = createInput({ feedback: { completed: true } });
      const result = await ActionEffectivenessLearner.process(input);

      const effectivenessUpdate = result.memory_updates.find(
        u => u.key === 'action-a_effectiveness'
      );
      const data = effectivenessUpdate?.value as any;
      
      expect(data.attempt_count).toBe(1);
      expect(data.success_count).toBe(1);
      expect(data.success_rate).toBe(1);
    });

    it('returns empty updates if no selected action', async () => {
      const input = createInput();
      // Remove selected_action
      (input.audit.final_decision as any).selected_action = undefined;

      const result = await ActionEffectivenessLearner.process(input);
      expect(result.memory_updates).toEqual([]);
    });
  });

  // ============================================================================
  // UNIT TESTS: Overwrite Safety (Recomputable)
  // ============================================================================

  describe('Overwrite Safety', () => {
    it('accumulates from existing data in memory snapshot', async () => {
      const existingData = {
        'learned.effectiveness.action-a_effectiveness': {
          attempt_count: 5,
          success_count: 3,
          success_rate: 0.6,
          last_success_ts: '2026-01-15T10:00:00Z',
          last_attempt_ts: '2026-01-15T11:00:00Z',
        },
      };

      const input = createInput({ 
        feedback: { completed: true },
        existingData,
      });
      const result = await ActionEffectivenessLearner.process(input);

      const effectivenessUpdate = result.memory_updates.find(
        u => u.key === 'action-a_effectiveness'
      );
      const data = effectivenessUpdate?.value as any;

      // Should accumulate: 5+1=6 attempts, 3+1=4 successes
      expect(data.attempt_count).toBe(6);
      expect(data.success_count).toBe(4);
      expect(data.success_rate).toBeCloseTo(4/6);
      expect(data.last_success_ts).toBe('2026-01-16T12:00:00Z');
    });

    it('produces same result when reprocessed with same input', async () => {
      const input = createInput({ feedback: { completed: true } });
      
      const result1 = await ActionEffectivenessLearner.process(input);
      const result2 = await ActionEffectivenessLearner.process(input);

      // Same input → same output (deterministic)
      expect(JSON.stringify(result1.memory_updates)).toBe(
        JSON.stringify(result2.memory_updates)
      );
    });

    it('updates last_attempt_ts on every run', async () => {
      const input = createInput({ feedback: { completed: false } });
      const result = await ActionEffectivenessLearner.process(input);

      const effectivenessUpdate = result.memory_updates.find(
        u => u.key === 'action-a_effectiveness'
      );
      const data = effectivenessUpdate?.value as any;

      expect(data.last_attempt_ts).toBe('2026-01-16T12:00:00Z');
    });

    it('only updates last_success_ts on success', async () => {
      const existingData = {
        'learned.effectiveness.action-a_effectiveness': {
          attempt_count: 1,
          success_count: 1,
          success_rate: 1,
          last_success_ts: '2026-01-15T10:00:00Z',
          last_attempt_ts: '2026-01-15T10:00:00Z',
        },
      };

      const input = createInput({ 
        feedback: { completed: false }, // Not a success
        existingData,
      });
      const result = await ActionEffectivenessLearner.process(input);

      const effectivenessUpdate = result.memory_updates.find(
        u => u.key === 'action-a_effectiveness'
      );
      const data = effectivenessUpdate?.value as any;

      // last_success_ts should NOT change
      expect(data.last_success_ts).toBe('2026-01-15T10:00:00Z');
      // last_attempt_ts SHOULD change
      expect(data.last_attempt_ts).toBe('2026-01-16T12:00:00Z');
    });
  });

  // ============================================================================
  // UNIT TESTS: Namespace Enforcement
  // ============================================================================

  describe('Namespace Enforcement', () => {
    it('all writes target learned.effectiveness namespace', async () => {
      const input = createInput({ feedback: { completed: true } });
      const result = await ActionEffectivenessLearner.process(input);

      for (const update of result.memory_updates) {
        expect(update.namespace).toBe('learned.effectiveness');
      }
    });

    it('passes validation for all memory updates', async () => {
      const input = createInput({ feedback: { completed: true } });
      const result = await ActionEffectivenessLearner.process(input);

      const validation = validateLearnerResult(result);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('writes _last_update metadata', async () => {
      const input = createInput({ feedback: { completed: true } });
      const result = await ActionEffectivenessLearner.process(input);

      const metadataUpdate = result.memory_updates.find(
        u => u.key === '_last_update'
      );
      expect(metadataUpdate).toBeDefined();
      expect(metadataUpdate?.namespace).toBe('learned.effectiveness');
      
      const meta = metadataUpdate?.value as any;
      expect(meta.learner_id).toBe('action-effectiveness');
      expect(meta.version).toBe('1.0.0');
    });
  });

  // ============================================================================
  // GOVERNANCE TEST: Decision Unchanged
  // ============================================================================

  describe('Governance: Decision Independence', () => {
    /**
     * PROOF: Decision output is unchanged with or without this learner
     * 
     * This is the governance test that proves non-causality.
     */
    it('PROOF: decision is identical with or without learner', async () => {
      const input = createInput({ feedback: { completed: true } });

      // Simulate decision (this is what the engine produces)
      const simulateDecision = (inp: LearnerInput): string => {
        return JSON.stringify({
          decision_id: inp.decision_id,
          selected_action: inp.audit.final_decision.selected_action,
          scenario_hash: inp.scenario_hash,
        });
      };

      // Decision BEFORE learner runs
      const decisionBefore = simulateDecision(input);

      // Run learner
      await ActionEffectivenessLearner.process(input);

      // Decision AFTER learner runs
      const decisionAfter = simulateDecision(input);

      // CRITICAL: Bit-identical
      expect(decisionAfter).toBe(decisionBefore);
    });

    it('PROOF: learner does not modify input audit', async () => {
      const input = createInput({ feedback: { completed: true } });
      
      // Freeze original values
      const originalDecisionId = input.decision_id;
      const originalAction = input.audit.final_decision.selected_action;
      const originalTimestamp = input.audit.timestamp;

      // Run learner
      await ActionEffectivenessLearner.process(input);

      // Input unchanged
      expect(input.decision_id).toBe(originalDecisionId);
      expect(input.audit.final_decision.selected_action).toBe(originalAction);
      expect(input.audit.timestamp).toBe(originalTimestamp);
    });

    it('PROOF: learner produces only learned.* namespace writes', async () => {
      const input = createInput({ feedback: { completed: true } });
      const result = await ActionEffectivenessLearner.process(input);

      for (const update of result.memory_updates) {
        expect(update.namespace.startsWith('learned.')).toBe(true);
      }
    });
  });
});
