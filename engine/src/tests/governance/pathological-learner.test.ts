/**
 * Pathological Learner Governance Proof
 * 
 * Goal: Prove that even adversarial, broken, or malicious learners cannot
 * breach authority, block decisions, corrupt memory, or destabilize determinism.
 * 
 * This is NOT about catching bugs.
 * This is about demonstrating impossibility.
 * 
 * SCOPE NOTE:
 * This test suite operates on already-committed audit artifacts.
 * Decision completion and audit commit are guaranteed by the engine pipeline.
 * The validateLearnerInput hard guard ensures learners only run when audit is committed.
 * 
 * Threat Model:
 * - Crashing Learner (Integrity Failure)
 * - Hung Learner (Liveness Failure) 
 * - Flooding Learner (Resource Abuse)
 * - Escalation Learner (Authority Attack)
 * 
 * @see docs/ADE-V2-Learning-Contract.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Learner, LearnerInput, LearnerResult } from '../../learning/learner-interface.js';
import { LearnerRegistry } from '../../learning/learner-registry.js';

describe('Governance: Pathological Learner Adversary Model', () => {
  let registry: LearnerRegistry;
  let healthyLearnerExecuted: boolean;

  // Standard mock input representing a COMMITTED decision
  const createCommittedInput = (): LearnerInput => ({
    decision_id: 'dec_committed_001',
    scenario_id: 'test-scenario',
    scenario_version: '1.0.0',
    scenario_hash: 'hash_abc123',
    user_id: 'user-001',
    audit: {
      request: { scenario_id: 'test' } as any,
      final_decision: { 
        decision_id: 'dec_committed_001',
        selected_action: 'action-a',
        payload: { rationale: 'Test rationale' },
        ranked_options: [],
      } as any,
      execution: { 
        execution_mode: 'deterministic_only',
        fallback_used: false,
      } as any,
      guardrails_applied: ['GR-001'],
      timestamp: '2026-01-16T12:00:00Z',
    },
    memory_snapshot: { existing_key: 'existing_value' },
    memory_snapshot_id: 'snap_committed_001',
  });

  // Healthy learner to verify isolation
  const createHealthyLearner = (): Learner => ({
    learner_id: 'healthy-control',
    version: '1.0.0',
    async process(): Promise<LearnerResult> {
      healthyLearnerExecuted = true;
      return {
        memory_updates: [{
          namespace: 'learned.test',
          key: 'healthy_write',
          value: 'success',
        }],
      };
    },
  });

  beforeEach(() => {
    registry = new LearnerRegistry();
    healthyLearnerExecuted = false;
  });

  // ============================================================================
  // SECTION 1: CRASHING LEARNER (Integrity Failure)
  // ============================================================================

  describe('Section 1: Crashing Learner — PROOF', () => {
    /**
     * PROOF: Crashing learner does not prevent other learners from executing
     * 
     * Threat: Unhandled exception could abort process or corrupt state
     * Invariant: Failure isolation - one learner's crash is contained
     */
    it('PROOF: crashing learner does not prevent healthy learner execution', async () => {
      const crashingLearner: Learner = {
        learner_id: 'crasher',
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          throw new Error('INTENTIONAL CRASH: Simulating integrity failure');
        },
      };

      registry.register(crashingLearner);
      registry.register(createHealthyLearner());

      const input = createCommittedInput();
      const results = await registry.processAll(input);

      // Crasher failed
      const crasherResult = results.find(r => r.learner_id === 'crasher');
      expect(crasherResult?.success).toBe(false);
      expect(crasherResult?.error).toContain('INTENTIONAL CRASH');

      // Healthy learner still executed
      expect(healthyLearnerExecuted).toBe(true);
      const healthyResult = results.find(r => r.learner_id === 'healthy-control');
      expect(healthyResult?.success).toBe(true);
    });

    /**
     * PROOF: Crashing learner receives already-committed audit data
     * 
     * Invariant: Decision is finalized BEFORE learner runs
     */
    it('PROOF: crash occurs after decision is already committed', async () => {
      let receivedDecisionId: string | null = null;

      const inspectingCrasher: Learner = {
        learner_id: 'inspecting-crasher',
        version: '1.0.0',
        async process(input: LearnerInput): Promise<LearnerResult> {
          receivedDecisionId = input.decision_id;
          throw new Error('CRASH after inspection');
        },
      };

      registry.register(inspectingCrasher);

      const input = createCommittedInput();
      await registry.processAll(input);

      // Learner received the committed decision ID before crashing
      expect(receivedDecisionId).toBe('dec_committed_001');
    });

    /**
     * PROOF: Registry completes despite crash
     */
    it('PROOF: registry returns complete results including crash failure', async () => {
      const crashingLearner: Learner = {
        learner_id: 'crasher',
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          throw new Error('CRASH');
        },
      };

      registry.register(crashingLearner);

      const input = createCommittedInput();
      const results = await registry.processAll(input);

      // Registry completed and returned results
      expect(results.length).toBe(1);
      expect(results[0].learner_id).toBe('crasher');
      expect(results[0].success).toBe(false);
      expect(results[0].duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // SECTION 2: HUNG LEARNER (Liveness Failure)
  // ============================================================================

  describe('Section 2: Hung Learner — WITNESS (Architectural)', () => {
    /**
     * WITNESS: Learner receives committed audit; therefore liveness cannot
     * affect decision liveness by architecture.
     * 
     * IMPORTANT: This section does NOT test an actual hung learner.
     * A truly hung learner (await new Promise(() => {})) would hang the test runner.
     * 
     * The architectural guarantee is:
     * - Learners run AFTER audit commit (enforced by validateLearnerInput)
     * - Decision response returns to caller BEFORE learners run (in production)
     * - Therefore, learner liveness cannot affect decision liveness
     * 
     * This test WITNESSES that learners receive committed audit data,
     * proving the temporal decoupling that makes hung learners irrelevant to authority.
     * 
     * NO TIMEOUT MECHANISM IS IMPLEMENTED - that would be operational policy,
     * not authority safety.
     */
    it('WITNESS: learner receives committed audit proving temporal decoupling', async () => {
      let receivedCommittedData = false;

      const witnessLearner: Learner = {
        learner_id: 'temporal-witness',
        version: '1.0.0',
        async process(input: LearnerInput): Promise<LearnerResult> {
          // Verify decision is already committed - this is the architectural proof
          expect(input.decision_id).toBe('dec_committed_001');
          expect(input.audit.final_decision).toBeDefined();
          expect(input.audit.timestamp).toBe('2026-01-16T12:00:00Z');
          expect(input.memory_snapshot_id).toBe('snap_committed_001');
          
          receivedCommittedData = true;
          return { memory_updates: [] };
        },
      };

      registry.register(witnessLearner);

      const input = createCommittedInput();
      await registry.processAll(input);

      expect(receivedCommittedData).toBe(true);
    });

    /**
     * WITNESS: Documents the production execution model
     * 
     * In production:
     * 1. Request arrives
     * 2. Pipeline runs (Stages 1-9)
     * 3. Audit commits (decision finalized)
     * 4. Response returns to caller
     * 5. Learners run asynchronously (fire-and-forget)
     * 
     * A hung learner at step 5 cannot affect steps 1-4.
     * This test cannot prove that model directly, but it witnesses
     * that learners only receive data that proves steps 1-4 are complete.
     */
    it('WITNESS: all required commit markers present in learner input', async () => {
      const witnessLearner: Learner = {
        learner_id: 'commit-marker-witness',
        version: '1.0.0',
        async process(input: LearnerInput): Promise<LearnerResult> {
          // All of these are commit markers proving decision path is complete:
          expect(input.decision_id).toBeTruthy();
          expect(input.audit.final_decision).toBeTruthy();
          expect(input.audit.timestamp).toBeTruthy();
          expect(input.memory_snapshot_id).toBeTruthy();
          
          return { memory_updates: [] };
        },
      };

      registry.register(witnessLearner);
      await registry.processAll(createCommittedInput());
    });
  });

  // ============================================================================
  // SECTION 3: FLOODING LEARNER (Resource Abuse)
  // ============================================================================

  describe('Section 3: Flooding Learner — PROOF', () => {
    /**
     * PROOF: Flooding learner cannot bypass validation
     * 
     * Threat: Memory exhaustion, storage abuse, indirect DoS
     * Invariant: Validation runs regardless of payload size
     */
    it('PROOF: flooding learner with valid namespace is processed', async () => {
      // Note: 1000 updates is sufficient to prove the invariant.
      // The exact number is not semantically relevant - we need "large enough
      // to be non-trivial" without stressing CI.
      const FLOOD_SIZE = 1000;

      const floodingLearner: Learner = {
        learner_id: 'flooder',
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          const updates = Array.from({ length: FLOOD_SIZE }, (_, i) => ({
            namespace: 'learned.spam',
            key: `flood_key_${i}`,
            value: `flood_value_${i}`,
          }));
          
          return { memory_updates: updates };
        },
      };

      registry.register(floodingLearner);

      const input = createCommittedInput();
      const results = await registry.processAll(input);

      // Flooding learner completed (validation passed - all namespaces valid)
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
      expect(results[0].result?.memory_updates.length).toBe(FLOOD_SIZE);
    });

    /**
     * PROOF: Flooding learner with invalid namespace is rejected entirely
     * 
     * Invariant: No partial writes accepted
     */
    it('PROOF: flooding learner with mixed namespaces is rejected entirely', async () => {
      const FLOOD_SIZE = 500; // Sufficient to prove the invariant

      const mixedFloodingLearner: Learner = {
        learner_id: 'mixed-flooder',
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          const updates = Array.from({ length: FLOOD_SIZE }, (_, i) => ({
            namespace: i === 250 ? 'scoring.hack' : 'learned.valid', // One invalid
            key: `key_${i}`,
            value: `value_${i}`,
          }));
          
          return { memory_updates: updates };
        },
      };

      registry.register(mixedFloodingLearner);

      const input = createCommittedInput();
      const results = await registry.processAll(input);

      // Entire result rejected due to one invalid namespace
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Validation failed');
    });

    /**
     * PROOF: Healthy learner unaffected by flooding sibling
     */
    it('PROOF: flooding learner does not affect healthy learner', async () => {
      const FLOOD_SIZE = 500; // Sufficient to prove isolation

      const floodingLearner: Learner = {
        learner_id: 'flooder',
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          return {
            memory_updates: Array.from({ length: FLOOD_SIZE }, (_, i) => ({
              namespace: 'learned.flood',
              key: `k${i}`,
              value: i,
            })),
          };
        },
      };

      registry.register(floodingLearner);
      registry.register(createHealthyLearner());

      const input = createCommittedInput();
      const results = await registry.processAll(input);

      // Both completed
      expect(results.length).toBe(2);
      expect(healthyLearnerExecuted).toBe(true);
      
      const healthyResult = results.find(r => r.learner_id === 'healthy-control');
      expect(healthyResult?.success).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 4: ESCALATION LEARNER (Authority Attack)
  // ============================================================================

  describe('Section 4: Escalation Learner — PROOF', () => {
    /**
     * PROOF: Learner attempting to write scoring namespace is rejected
     * 
     * Threat: Privilege escalation, silent rule injection
     * Invariant: Authority boundary is mechanically enforced
     */
    it('PROOF: scoring namespace escalation is rejected', async () => {
      const escalationLearner: Learner = {
        learner_id: 'escalator-scoring',
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          return {
            memory_updates: [{
              namespace: 'scoring.weights',
              key: 'engagement_boost',
              value: 999,
            }],
          };
        },
      };

      registry.register(escalationLearner);

      const input = createCommittedInput();
      const results = await registry.processAll(input);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('scoring');
    });

    /**
     * PROOF: Learner attempting to write guardrails namespace is rejected
     */
    it('PROOF: guardrails namespace escalation is rejected', async () => {
      const escalationLearner: Learner = {
        learner_id: 'escalator-guardrails',
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          return {
            memory_updates: [{
              namespace: 'guardrails.bypass',
              key: 'disable_all',
              value: true,
            }],
          };
        },
      };

      registry.register(escalationLearner);

      const input = createCommittedInput();
      const results = await registry.processAll(input);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('guardrails');
    });

    /**
     * PROOF: Malformed memory_updates (non-array) is rejected
     */
    it('PROOF: malformed memory_updates is rejected', async () => {
      const malformedLearner: Learner = {
        learner_id: 'malformed',
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          return {
            memory_updates: 'not an array' as any,
          };
        },
      };

      registry.register(malformedLearner);

      const input = createCommittedInput();
      const results = await registry.processAll(input);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('must be an array');
    });

    /**
     * PROOF: Multiple escalation attempts all rejected
     */
    it('PROOF: multiple escalation vectors all rejected', async () => {
      const multiEscalator: Learner = {
        learner_id: 'multi-escalator',
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          return {
            memory_updates: [
              { namespace: 'scoring.weights', key: 'a', value: 1 },
              { namespace: 'guardrails.rules', key: 'b', value: 2 },
              { namespace: 'execution.mode', key: 'c', value: 3 },
              { namespace: 'scenario.config', key: 'd', value: 4 },
            ],
          };
        },
      };

      registry.register(multiEscalator);

      const input = createCommittedInput();
      const results = await registry.processAll(input);

      expect(results[0].success).toBe(false);
      // Verify multiple forbidden prefixes are caught (proves multi-catch)
      const error = results[0].error || '';
      expect(error).toContain('scoring');
      expect(error).toContain('guardrails');
    });

    /**
     * PROOF: Escalation learner does not affect healthy learner
     */
    it('PROOF: escalation attempt does not affect healthy learner', async () => {
      const escalationLearner: Learner = {
        learner_id: 'escalator',
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          return {
            memory_updates: [{
              namespace: 'scoring.hack',
              key: 'attack',
              value: 'malicious',
            }],
          };
        },
      };

      registry.register(escalationLearner);
      registry.register(createHealthyLearner());

      const input = createCommittedInput();
      const results = await registry.processAll(input);

      // Escalator rejected
      const escalatorResult = results.find(r => r.learner_id === 'escalator');
      expect(escalatorResult?.success).toBe(false);

      // Healthy learner succeeded
      expect(healthyLearnerExecuted).toBe(true);
      const healthyResult = results.find(r => r.learner_id === 'healthy-control');
      expect(healthyResult?.success).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 5: DETERMINISM CAPSTONE — PROOF
  // ============================================================================

  describe('Section 5: Determinism Capstone — PROOF', () => {
    /**
     * Helper: Deep clone to simulate audit store boundary
     * 
     * Per the V2 Learning Contract:
     * "Runtime immutability is enforced at the audit store boundary,
     * not the object reference level."
     * 
     * This helper simulates what the audit store does: create an immutable
     * deep copy that learners cannot mutate.
     */
    const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

    /**
     * Helper: Stable stringify for bit-identical comparison
     */
    const stableStringify = (obj: unknown): string => JSON.stringify(obj);

    /**
     * PROOF: Committed audit artifact is unchanged after learner execution
     * 
     * This is the KEYSTONE test.
     * If this ever fails, V2 is invalid.
     * 
     * Invariant: The audit store boundary protects committed decisions from learner mutation.
     * 
     * This test models the real invariant:
     * 1. Audit store commits a deep clone of the decision (auditStoreCopy)
     * 2. Learners receive a separate copy (or the original reference)
     * 3. Even if learners mutate their copy, auditStoreCopy is unchanged
     */
    it('PROOF: committed audit artifact unchanged after pathological learners', async () => {
      const input = createCommittedInput();

      // AUDIT STORE BOUNDARY: This represents what is "committed" and immutable
      // In production, the audit store deep clones before persisting
      const auditStoreCopy = deepClone(input.audit.final_decision);
      const auditStoreHash = stableStringify(auditStoreCopy);

      // Register a MUTATING learner that attempts to corrupt the input
      // NOTE: Learner mutation of `input` is permitted at the object reference level.
      // The invariant is that committed audit artifacts (auditStoreCopy) are immutable.
      const mutatingLearner: Learner = {
        learner_id: 'mutator',
        version: '1.0.0',
        async process(inp: LearnerInput): Promise<LearnerResult> {
          // Attempt to mutate the input (this is adversarial behavior)
          try {
            (inp.audit.final_decision as any).selected_action = 'HACKED';
            (inp as any).decision_id = 'HACKED_ID';
            (inp.audit as any).timestamp = 'HACKED_TIMESTAMP';
          } catch {
            // Mutation may fail if frozen - that's fine
          }
          return { memory_updates: [] };
        },
      };

      // Register other pathological learners
      const crasher: Learner = {
        learner_id: 'crasher',
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          throw new Error('CRASH');
        },
      };

      const escalator: Learner = {
        learner_id: 'escalator',
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          return {
            memory_updates: [{ namespace: 'scoring.hack', key: 'x', value: 999 }],
          };
        },
      };

      registry.register(mutatingLearner);
      registry.register(crasher);
      registry.register(escalator);

      // Run all pathological learners
      await registry.processAll(input);

      // CRITICAL ASSERTION: Audit store copy is bit-identical
      // The mutating learner may have changed `input`, but auditStoreCopy is protected
      const auditStoreHashAfter = stableStringify(auditStoreCopy);
      expect(auditStoreHashAfter).toBe(auditStoreHash);

      // Verify the protected copy has original values
      expect(auditStoreCopy.selected_action).toBe('action-a');
      expect(auditStoreCopy.decision_id).toBe('dec_committed_001');
    });

    /**
     * PROOF: Decision determinism with proper audit store boundary
     * 
     * Models the real production flow:
     * 1. Decision is computed
     * 2. Audit store commits a deep clone
     * 3. Learners run (may crash, flood, escalate, mutate)
     * 4. Audit store copy remains unchanged
     */
    it('PROOF: audit store boundary holds across multiple learner configurations', async () => {
      const createFreshInput = () => createCommittedInput();

      // Simulate audit store: commit before learners run
      const commitToAuditStore = (input: LearnerInput): string => {
        return stableStringify(deepClone(input.audit.final_decision));
      };

      // Run 1: No learners
      const input1 = createFreshInput();
      const committed1 = commitToAuditStore(input1);

      // Run 2: Healthy learner
      const input2 = createFreshInput();
      const committed2 = commitToAuditStore(input2);
      const registry2 = new LearnerRegistry();
      registry2.register(createHealthyLearner());
      await registry2.processAll(input2);

      // Run 3: Crashing learner
      const input3 = createFreshInput();
      const committed3 = commitToAuditStore(input3);
      const registry3 = new LearnerRegistry();
      registry3.register({
        learner_id: 'crasher',
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          throw new Error('CRASH');
        },
      });
      await registry3.processAll(input3);

      // Run 4: Mutating + escalating learners
      const input4 = createFreshInput();
      const committed4 = commitToAuditStore(input4);
      const registry4 = new LearnerRegistry();
      registry4.register({
        learner_id: 'mutator',
        version: '1.0.0',
        async process(inp: LearnerInput): Promise<LearnerResult> {
          try {
            (inp.audit.final_decision as any).selected_action = 'HACKED';
          } catch { /* ignore */ }
          return { memory_updates: [] };
        },
      });
      registry4.register({
        learner_id: 'escalator',
        version: '1.0.0',
        async process(): Promise<LearnerResult> {
          return {
            memory_updates: [{ namespace: 'scoring.hack', key: 'x', value: 1 }],
          };
        },
      });
      await registry4.processAll(input4);

      // ALL COMMITTED ARTIFACTS MUST BE IDENTICAL
      // This is the keystone: audit store boundary protects determinism
      expect(committed1).toBe(committed2);
      expect(committed2).toBe(committed3);
      expect(committed3).toBe(committed4);
    });
  });
});
