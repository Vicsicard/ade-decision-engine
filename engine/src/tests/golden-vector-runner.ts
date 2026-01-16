/**
 * Golden Vector Runner
 * 
 * Runs all golden vectors against the engine and validates:
 * - selected_action matches expected
 * - guardrails_applied set matches (order-insensitive)
 * - determinism_verified is true via re-execute
 * 
 * This is the CI gate for ADE behavior correctness.
 * 
 * @version 1.0.0
 */

import type { DecisionResponse, Scenario } from '../core/types.js';
import type { GoldenVector } from './golden-vectors/fitness-vectors.js';
import { createEngine } from '../engine.js';

/**
 * Vector test result
 */
export interface VectorResult {
  vector_id: string;
  vector_name: string;
  passed: boolean;
  assertions: AssertionResult[];
  determinism_verified: boolean;
  execution_ms: number;
  error?: string;
}

/**
 * Individual assertion result
 */
export interface AssertionResult {
  field: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

/**
 * Full test run result
 */
export interface RunResult {
  total: number;
  passed: number;
  failed: number;
  vectors: VectorResult[];
  duration_ms: number;
}

/**
 * Run a single golden vector
 */
export async function runVector(
  vector: GoldenVector,
  scenario: Scenario
): Promise<VectorResult> {
  const startTime = performance.now();
  const assertions: AssertionResult[] = [];
  
  try {
    // Create engine and register scenario
    const engine = await createEngine({ traceEnabled: true });
    await engine.registerScenario(scenario);
    
    // TODO: Pre-load memory if vector.memory is defined
    // This requires memory store seeding capability
    
    // Execute decision
    const response = await engine.decide(vector.request);
    
    // Assert selected_action
    assertions.push({
      field: 'selected_action',
      expected: vector.expected.selected_action,
      actual: response.decision.selected_action,
      passed: response.decision.selected_action === vector.expected.selected_action,
    });
    
    // Assert guardrails_applied (SET-BASED comparison)
    const expectedGuardrails = new Set(vector.expected.guardrails_applied);
    const actualGuardrails = new Set(response.guardrails_applied);
    const guardrailsMatch = setsEqual(expectedGuardrails, actualGuardrails);
    assertions.push({
      field: 'guardrails_applied',
      expected: vector.expected.guardrails_applied.sort(),
      actual: response.guardrails_applied.sort(),
      passed: guardrailsMatch,
    });
    
    // Assert execution_mode
    assertions.push({
      field: 'execution_mode',
      expected: vector.expected.execution_mode,
      actual: response.execution.execution_mode,
      passed: response.execution.execution_mode === vector.expected.execution_mode,
    });
    
    // Assert fallback_used
    assertions.push({
      field: 'fallback_used',
      expected: vector.expected.fallback_used,
      actual: response.execution.fallback_used,
      passed: response.execution.fallback_used === vector.expected.fallback_used,
    });
    
    // Verify determinism via re-execute
    const determinismVerified = await verifyDeterminism(engine, vector, response);
    
    const allPassed = assertions.every(a => a.passed) && determinismVerified;
    
    return {
      vector_id: vector.id,
      vector_name: vector.name,
      passed: allPassed,
      assertions,
      determinism_verified: determinismVerified,
      execution_ms: performance.now() - startTime,
    };
    
  } catch (error) {
    return {
      vector_id: vector.id,
      vector_name: vector.name,
      passed: false,
      assertions,
      determinism_verified: false,
      execution_ms: performance.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify determinism by re-executing and comparing
 */
async function verifyDeterminism(
  engine: Awaited<ReturnType<typeof createEngine>>,
  vector: GoldenVector,
  originalResponse: DecisionResponse
): Promise<boolean> {
  // Re-execute the same request
  const replayResponse = await engine.decide(vector.request);
  
  // Compare critical fields
  if (replayResponse.decision.selected_action !== originalResponse.decision.selected_action) {
    return false;
  }
  
  // Compare ranked_options order and scores
  if (replayResponse.decision.ranked_options.length !== originalResponse.decision.ranked_options.length) {
    return false;
  }
  
  for (let i = 0; i < originalResponse.decision.ranked_options.length; i++) {
    const orig = originalResponse.decision.ranked_options[i];
    const replay = replayResponse.decision.ranked_options[i];
    
    if (!orig || !replay) return false;
    if (orig.action_id !== replay.action_id) return false;
    if (orig.rank !== replay.rank) return false;
    // Allow small floating point differences in scores
    if (Math.abs(orig.score - replay.score) > 0.0001) return false;
  }
  
  // Compare guardrails (set-based)
  const origGuardrails = new Set(originalResponse.guardrails_applied);
  const replayGuardrails = new Set(replayResponse.guardrails_applied);
  if (!setsEqual(origGuardrails, replayGuardrails)) {
    return false;
  }
  
  return true;
}

/**
 * Run all vectors in a suite
 */
export async function runVectorSuite(
  vectors: GoldenVector[],
  scenario: Scenario
): Promise<RunResult> {
  const startTime = performance.now();
  const results: VectorResult[] = [];
  
  for (const vector of vectors) {
    const result = await runVector(vector, scenario);
    results.push(result);
  }
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  return {
    total: vectors.length,
    passed,
    failed,
    vectors: results,
    duration_ms: performance.now() - startTime,
  };
}

/**
 * Format run result for console output
 */
export function formatRunResult(result: RunResult): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                    GOLDEN VECTOR TEST RESULTS                  ');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  
  for (const vector of result.vectors) {
    const status = vector.passed ? '✅ PASS' : '❌ FAIL';
    lines.push(`${status} ${vector.vector_id}: ${vector.vector_name}`);
    
    if (!vector.passed) {
      for (const assertion of vector.assertions) {
        if (!assertion.passed) {
          lines.push(`   └─ ${assertion.field}:`);
          lines.push(`      expected: ${JSON.stringify(assertion.expected)}`);
          lines.push(`      actual:   ${JSON.stringify(assertion.actual)}`);
        }
      }
      if (!vector.determinism_verified) {
        lines.push(`   └─ determinism: FAILED (re-execution produced different result)`);
      }
      if (vector.error) {
        lines.push(`   └─ error: ${vector.error}`);
      }
    }
    
    lines.push(`   └─ determinism: ${vector.determinism_verified ? 'verified' : 'FAILED'}`);
    lines.push(`   └─ duration: ${vector.execution_ms.toFixed(2)}ms`);
    lines.push('');
  }
  
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`Total: ${result.total} | Passed: ${result.passed} | Failed: ${result.failed}`);
  lines.push(`Duration: ${result.duration_ms.toFixed(2)}ms`);
  lines.push('───────────────────────────────────────────────────────────────');
  
  if (result.failed > 0) {
    lines.push('');
    lines.push('❌ GOLDEN VECTOR SUITE FAILED');
    lines.push('   Behavior has drifted from canonical expectations.');
    lines.push('   Either fix the implementation or update the vectors.');
  } else {
    lines.push('');
    lines.push('✅ ALL GOLDEN VECTORS PASSED');
    lines.push('   Behavior matches canonical expectations.');
  }
  
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Compare two sets for equality
 */
function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

/**
 * Exit code for CI
 */
export function getExitCode(result: RunResult): number {
  return result.failed > 0 ? 1 : 0;
}
