/**
 * Test Utilities Index
 * 
 * Exports golden vector runner and replay comparator tooling.
 * 
 * @version 1.0.0
 */

// Golden Vector Runner
export {
  runVector,
  runVectorSuite,
  formatRunResult,
  getExitCode,
} from './golden-vector-runner.js';
export type {
  VectorResult,
  AssertionResult,
  RunResult,
} from './golden-vector-runner.js';

// Replay Comparator
export {
  compareTraces,
  formatComparisonResult,
} from './replay-comparator.js';
export type {
  ComparisonResult,
  FieldDiff,
  StageDiff,
} from './replay-comparator.js';

// Golden Vectors
export { FITNESS_GOLDEN_VECTORS } from './golden-vectors/fitness-vectors.js';
export { NOTIFICATION_GOLDEN_VECTORS } from './golden-vectors/notification-vectors.js';
export type { GoldenVector } from './golden-vectors/fitness-vectors.js';
