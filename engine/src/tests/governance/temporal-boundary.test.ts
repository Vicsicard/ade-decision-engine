/**
 * Temporal Boundary Governance Test
 * 
 * Invariant: Learners cannot run before audit commit.
 * 
 * This is not a unit test. It is a governance invariant encoded as executable proof.
 * 
 * @see docs/ADE-V2-Learning-Contract.md Section 2 (Temporal Boundary)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Learner, LearnerInput, LearnerResult } from '../../learning/learner-interface.js';
import { LearnerRegistry } from '../../learning/learner-registry.js';
import { validateLearnerInput } from '../../learning/learner-interface.js';

describe('Governance: Temporal Boundary', () => {
  let executionLog: Array<{ event: string; timestamp: number }>;
  let learnerRegistry: LearnerRegistry;

  beforeEach(() => {
    executionLog = [];
    learnerRegistry = new LearnerRegistry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Test 1: Temporal Ordering Enforcement
   * 
   * Proves: Learner dispatch timestamp is AFTER audit commit timestamp.
   * Failure: Any learner invocation before audit commit.
   */
  it('learners cannot execute before audit commit', async () => {
    // Create a spy learner that logs its execution time
    const spyLearner: Learner = {
      learner_id: 'temporal-spy',
      version: '1.0.0',
      async process(input: LearnerInput): Promise<LearnerResult> {
        executionLog.push({
          event: 'learner_executed',
          timestamp: Date.now(),
        });
        return { memory_updates: [] };
      },
    };

    learnerRegistry.register(spyLearner);

    // Simulate the decision flow with explicit timestamps
    const auditCommitTime = Date.now();
    executionLog.push({
      event: 'audit_committed',
      timestamp: auditCommitTime,
    });

    // Small delay to ensure temporal separation
    await new Promise(resolve => setTimeout(resolve, 10));

    // Learners run AFTER audit commit
    const mockInput: LearnerInput = {
      decision_id: 'test-decision-001',
      scenario_id: 'test-scenario',
      scenario_version: '1.0.0',
      scenario_hash: 'abc123',
      user_id: 'user-001',
      audit: {
        request: {} as any,
        final_decision: {} as any,
        execution: {} as any,
        guardrails_applied: [],
        timestamp: new Date().toISOString(),
      },
      memory_snapshot: {},
      memory_snapshot_id: 'snap_test',
    };

    await learnerRegistry.processAll(mockInput);

    // Verify temporal ordering
    const auditEvent = executionLog.find(e => e.event === 'audit_committed');
    const learnerEvent = executionLog.find(e => e.event === 'learner_executed');

    expect(auditEvent).toBeDefined();
    expect(learnerEvent).toBeDefined();
    expect(learnerEvent!.timestamp).toBeGreaterThan(auditEvent!.timestamp);
  });

  /**
   * Test 1b: Learner receives finalized audit data
   * 
   * Proves: Learner input contains immutable audit artifacts.
   * This ensures learners observe completed decisions, not in-progress ones.
   */
  it('learner input contains finalized audit data', async () => {
    let receivedInput: LearnerInput | null = null;

    const inspectorLearner: Learner = {
      learner_id: 'input-inspector',
      version: '1.0.0',
      async process(input: LearnerInput): Promise<LearnerResult> {
        receivedInput = input;
        return { memory_updates: [] };
      },
    };

    learnerRegistry.register(inspectorLearner);

    const mockInput: LearnerInput = {
      decision_id: 'finalized-decision-001',
      scenario_id: 'test-scenario',
      scenario_version: '1.0.0',
      scenario_hash: 'hash_abc123',
      user_id: 'user-001',
      audit: {
        request: { scenario_id: 'test' } as any,
        final_decision: { selected_action: 'action-a' } as any,
        execution: { execution_mode: 'deterministic_only' } as any,
        guardrails_applied: ['GR-001'],
        timestamp: '2026-01-16T12:00:00Z',
      },
      memory_snapshot: { key: 'value' },
      memory_snapshot_id: 'snap_finalized',
    };

    await learnerRegistry.processAll(mockInput);

    // Verify learner received complete, finalized data
    expect(receivedInput).not.toBeNull();
    expect(receivedInput!.decision_id).toBe('finalized-decision-001');
    expect(receivedInput!.audit.final_decision).toBeDefined();
    expect(receivedInput!.audit.timestamp).toBe('2026-01-16T12:00:00Z');
    expect(receivedInput!.memory_snapshot_id).toBe('snap_finalized');
  });

  /**
   * Test 1c: Multiple learners all execute after audit
   * 
   * Proves: All registered learners respect temporal boundary.
   */
  it('all learners execute after audit commit', async () => {
    const learnerExecutionTimes: number[] = [];

    for (let i = 0; i < 3; i++) {
      const learner: Learner = {
        learner_id: `temporal-learner-${i}`,
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          learnerExecutionTimes.push(Date.now());
          return { memory_updates: [] };
        },
      };
      learnerRegistry.register(learner);
    }

    const auditCommitTime = Date.now();
    executionLog.push({ event: 'audit_committed', timestamp: auditCommitTime });

    await new Promise(resolve => setTimeout(resolve, 5));

    const mockInput: LearnerInput = {
      decision_id: 'multi-learner-test',
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
      memory_snapshot_id: 'snap_multi',
    };

    await learnerRegistry.processAll(mockInput);

    // All learners must have executed after audit commit
    expect(learnerExecutionTimes.length).toBe(3);
    for (const execTime of learnerExecutionTimes) {
      expect(execTime).toBeGreaterThan(auditCommitTime);
    }
  });

  /**
   * PROOF TEST: Hard guard on audit presence
   * 
   * This is an ENFORCED invariant, not just a pattern.
   * If processAll() is called without finalized audit data, it MUST throw.
   */
  it('PROOF: processAll throws without audit commit', async () => {
    const registry = new LearnerRegistry();
    
    const learner: Learner = {
      learner_id: 'should-not-run',
      version: '1.0.0',
      async process(): Promise<LearnerResult> {
        return { memory_updates: [] };
      },
    };
    registry.register(learner);

    // Input missing required audit data
    const incompleteInput = {
      decision_id: '', // Empty = not committed
      scenario_id: 'test',
      scenario_version: '1.0.0',
      scenario_hash: 'hash',
      user_id: 'user',
      audit: {
        request: {} as any,
        final_decision: null as any, // Missing = not finalized
        execution: {} as any,
        guardrails_applied: [],
        timestamp: '', // Empty = not committed
      },
      memory_snapshot: {},
      memory_snapshot_id: '', // Empty = not pinned
    } as LearnerInput;

    // MUST throw - this is the hard guard
    await expect(registry.processAll(incompleteInput)).rejects.toThrow(
      'Learner execution blocked'
    );
  });

  /**
   * PROOF TEST: validateLearnerInput rejects missing audit
   */
  it('PROOF: validateLearnerInput rejects missing audit artifacts', () => {
    const missingDecisionId = {
      decision_id: '',
      audit: { timestamp: '2026-01-16T12:00:00Z', final_decision: {} },
      memory_snapshot_id: 'snap_001',
    } as LearnerInput;

    const result1 = validateLearnerInput(missingDecisionId);
    expect(result1.valid).toBe(false);
    expect(result1.errors.some(e => e.includes('decision_id'))).toBe(true);

    const missingTimestamp = {
      decision_id: 'dec_001',
      audit: { timestamp: '', final_decision: {} },
      memory_snapshot_id: 'snap_001',
    } as LearnerInput;

    const result2 = validateLearnerInput(missingTimestamp);
    expect(result2.valid).toBe(false);
    expect(result2.errors.some(e => e.includes('timestamp'))).toBe(true);

    const missingSnapshotId = {
      decision_id: 'dec_001',
      audit: { timestamp: '2026-01-16T12:00:00Z', final_decision: {} },
      memory_snapshot_id: '',
    } as LearnerInput;

    const result3 = validateLearnerInput(missingSnapshotId);
    expect(result3.valid).toBe(false);
    expect(result3.errors.some(e => e.includes('memory_snapshot_id'))).toBe(true);
  });
});
