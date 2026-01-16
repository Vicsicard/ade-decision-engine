/**
 * Forbidden Namespace Governance Test
 * 
 * Invariant: Learners cannot escalate authority by writing to forbidden namespaces.
 * 
 * This is not a unit test. It is a governance invariant encoded as executable proof.
 * 
 * @see docs/ADE-V2-Learning-Contract.md Section 4 (Data Boundary)
 */

import { describe, it, expect } from 'vitest';
import type { Learner, LearnerInput, LearnerResult } from '../../learning/learner-interface.js';
import { LearnerRegistry } from '../../learning/learner-registry.js';
import { validateLearnerResult, isValidLearnerNamespace } from '../../learning/learner-interface.js';

describe('Governance: Forbidden Namespace', () => {
  /**
   * Test 4: Forbidden Namespace Rejection
   * 
   * Proves: Learners cannot escalate authority.
   * Failure: If validation accepts writes to forbidden namespaces.
   */
  it('rejects writes to scoring namespace', () => {
    const maliciousResult: LearnerResult = {
      memory_updates: [{
        namespace: 'scoring.weights',
        key: 'engagement_boost',
        value: 1.5,
      }],
    };

    const validation = validateLearnerResult(maliciousResult);

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors[0]).toContain('scoring');
  });

  it('rejects writes to guardrails namespace', () => {
    const maliciousResult: LearnerResult = {
      memory_updates: [{
        namespace: 'guardrails.rules',
        key: 'bypass_flag',
        value: true,
      }],
    };

    const validation = validateLearnerResult(maliciousResult);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('guardrails'))).toBe(true);
  });

  it('rejects writes to execution namespace', () => {
    const maliciousResult: LearnerResult = {
      memory_updates: [{
        namespace: 'execution.mode',
        key: 'override',
        value: 'skill_enhanced',
      }],
    };

    const validation = validateLearnerResult(maliciousResult);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('execution'))).toBe(true);
  });

  it('rejects writes to scenario namespace', () => {
    const maliciousResult: LearnerResult = {
      memory_updates: [{
        namespace: 'scenario.config',
        key: 'version',
        value: '999.0.0',
      }],
    };

    const validation = validateLearnerResult(maliciousResult);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('scenario'))).toBe(true);
  });

  /**
   * Test 4b: Accepts valid learned.* namespaces
   * 
   * Proves: Validation correctly allows legitimate writes.
   */
  it('accepts writes to learned.* namespaces', () => {
    const validResult: LearnerResult = {
      memory_updates: [
        {
          namespace: 'learned.engagement',
          key: 'hour_success_rate',
          value: { '14': 0.85 },
        },
        {
          namespace: 'learned.delivery',
          key: 'best_send_window',
          value: [9, 10, 11],
        },
        {
          namespace: 'learned.content',
          key: 'read_depth_trend',
          value: 0.72,
        },
      ],
    };

    const validation = validateLearnerResult(validResult);

    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  /**
   * Test 4c: Empty writes are valid
   * 
   * Proves: Learners can legitimately return no updates.
   */
  it('accepts empty memory_updates array', () => {
    const emptyResult: LearnerResult = {
      memory_updates: [],
    };

    const validation = validateLearnerResult(emptyResult);

    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  /**
   * Test 4d: Registry rejects malicious learner output
   * 
   * Proves: Even if a learner returns forbidden writes, the registry rejects them.
   */
  it('registry rejects learner with forbidden namespace writes', async () => {
    const registry = new LearnerRegistry();

    const maliciousLearner: Learner = {
      learner_id: 'authority-escalator',
      version: '1.0.0',
      async process(): Promise<LearnerResult> {
        return {
          memory_updates: [{
            namespace: 'scoring.weights',
            key: 'hack',
            value: 999,
          }],
        };
      },
    };

    registry.register(maliciousLearner);

    const mockInput: LearnerInput = {
      decision_id: 'malicious-test',
      scenario_id: 'test',
      scenario_version: '1.0.0',
      scenario_hash: 'hash',
      user_id: 'user',
      audit: {
        request: {} as any,
        final_decision: {} as any,
        execution: {} as any,
        guardrails_applied: [],
        timestamp: new Date().toISOString(),
      },
      memory_snapshot: {},
      memory_snapshot_id: 'snap_malicious',
    };

    const results = await registry.processAll(mockInput);

    // Learner was processed but REJECTED due to validation
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('Validation failed');
  });

  /**
   * Test 4e: Namespace validation function correctness
   * 
   * Proves: isValidLearnerNamespace correctly identifies valid/invalid namespaces.
   */
  it('namespace validation is correct', () => {
    // Valid namespaces
    expect(isValidLearnerNamespace('learned.engagement')).toBe(true);
    expect(isValidLearnerNamespace('learned.delivery')).toBe(true);
    expect(isValidLearnerNamespace('learned.content')).toBe(true);
    expect(isValidLearnerNamespace('learned.custom.deep.path')).toBe(true);

    // Invalid namespaces
    expect(isValidLearnerNamespace('scoring.weights')).toBe(false);
    expect(isValidLearnerNamespace('guardrails.rules')).toBe(false);
    expect(isValidLearnerNamespace('execution.mode')).toBe(false);
    expect(isValidLearnerNamespace('scenario.config')).toBe(false);
    expect(isValidLearnerNamespace('user.data')).toBe(false);
    expect(isValidLearnerNamespace('learn.typo')).toBe(false); // Note: not 'learned.'
    expect(isValidLearnerNamespace('')).toBe(false);
  });

  /**
   * Test 4f: Mixed valid and invalid writes
   * 
   * Proves: A single invalid write invalidates the entire result.
   */
  it('rejects result with any invalid namespace', () => {
    const mixedResult: LearnerResult = {
      memory_updates: [
        {
          namespace: 'learned.engagement',
          key: 'valid_key',
          value: 1,
        },
        {
          namespace: 'scoring.weights', // INVALID
          key: 'invalid_key',
          value: 2,
        },
        {
          namespace: 'learned.delivery',
          key: 'another_valid',
          value: 3,
        },
      ],
    };

    const validation = validateLearnerResult(mixedResult);

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});
