/**
 * Governance Tests Index
 * 
 * These are not unit tests. They are governance invariants encoded as executable proofs.
 * 
 * PROOFS (must never regress):
 * - forbidden-namespace.test.ts: Learners cannot escalate authority
 * - temporal-boundary.test.ts (PROOF tests): Hard guard on audit presence
 * - non-causality.test.ts: Learner output cannot affect triggering decision
 * 
 * WITNESSES (demonstrate architecture, not impossibility):
 * - temporal-boundary.test.ts (non-PROOF tests): Temporal ordering demonstration
 * - learner-isolation.test.ts: Failure containment and slow learner tolerance
 * 
 * @see docs/ADE-V2-Learning-Contract.md
 */

// Note: Test files are not exported as modules - they are run by vitest directly
