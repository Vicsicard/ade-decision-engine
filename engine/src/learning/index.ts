/**
 * ADE V2 Learning Module
 * 
 * Learners may write evidence. They may never write rules.
 * 
 * @version 2.0.0
 */

// Core interfaces
export type {
  Learner,
  LearnerInput,
  LearnerResult,
  MemoryUpdate,
  OutcomeSignal,
} from './learner-interface.js';

export {
  isValidLearnerNamespace,
  validateLearnerInput,
  validateLearnerResult,
} from './learner-interface.js';

// Registry
export type { LearnerExecutionResult } from './learner-registry.js';
export { LearnerRegistry, createLearnerRegistry } from './learner-registry.js';

// Memory snapshots
export type {
  MemorySnapshot,
  MemorySnapshotStore,
} from './memory-snapshot.js';

export {
  LocalMemorySnapshotStore,
  createMemorySnapshot,
  verifySnapshotIntegrity,
} from './memory-snapshot.js';

// Canonical learners
export {
  HourSuccessRateLearner,
  createHourSuccessRateLearner,
} from './learners/hour-success-rate.js';
export { ActionEffectivenessLearner, createActionEffectivenessLearner } from './learners/action-effectiveness.js';
export type { ActionEffectivenessData } from './learners/action-effectiveness.js';
