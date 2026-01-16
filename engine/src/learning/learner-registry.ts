/**
 * Learner Registry
 * 
 * Manages registered learners and orchestrates their execution.
 * Learners are invoked asynchronously after decisions are finalized.
 */

import type { Learner, LearnerInput, LearnerResult } from './learner-interface.js';
import { validateLearnerResult, validateLearnerInput } from './learner-interface.js';

/**
 * Result of processing a learner
 */
export interface LearnerExecutionResult {
  learner_id: string;
  version: string;
  success: boolean;
  result?: LearnerResult | undefined;
  error?: string | undefined;
  duration_ms: number;
}

/**
 * Registry for managing learners
 */
export class LearnerRegistry {
  private learners: Map<string, Learner> = new Map();

  /**
   * Register a learner
   */
  register(learner: Learner): void {
    const key = `${learner.learner_id}@${learner.version}`;
    
    if (this.learners.has(key)) {
      throw new Error(`Learner already registered: ${key}`);
    }

    this.learners.set(key, learner);
  }

  /**
   * Unregister a learner
   */
  unregister(learner_id: string, version: string): boolean {
    const key = `${learner_id}@${version}`;
    return this.learners.delete(key);
  }

  /**
   * Get a specific learner
   */
  get(learner_id: string, version: string): Learner | undefined {
    const key = `${learner_id}@${version}`;
    return this.learners.get(key);
  }

  /**
   * List all registered learners
   */
  list(): Array<{ learner_id: string; version: string }> {
    return Array.from(this.learners.values()).map(l => ({
      learner_id: l.learner_id,
      version: l.version,
    }));
  }

  /**
   * Process input through all registered learners.
   * Each learner runs independently; failures are isolated.
   * 
   * HARD GUARD: Input must contain finalized audit data.
   * This enforces the temporal boundary: learners CANNOT execute before audit commit.
   */
  async processAll(input: LearnerInput): Promise<LearnerExecutionResult[]> {
    // Validate input contains required audit artifacts
    const inputValidation = validateLearnerInput(input);
    if (!inputValidation.valid) {
      throw new Error(
        `Learner execution blocked: ${inputValidation.errors.join('; ')}`
      );
    }

    const results: LearnerExecutionResult[] = [];

    for (const learner of this.learners.values()) {
      const startTime = Date.now();
      
      try {
        const result = await learner.process(input);
        
        // Validate the result before accepting it
        const validation = validateLearnerResult(result);
        
        if (!validation.valid) {
          results.push({
            learner_id: learner.learner_id,
            version: learner.version,
            success: false,
            error: `Validation failed: ${validation.errors.join('; ')}`,
            duration_ms: Date.now() - startTime,
          });
          continue;
        }

        results.push({
          learner_id: learner.learner_id,
          version: learner.version,
          success: true,
          result,
          duration_ms: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          learner_id: learner.learner_id,
          version: learner.version,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration_ms: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * Clear all registered learners
   */
  clear(): void {
    this.learners.clear();
  }
}

/**
 * Create a new learner registry
 */
export function createLearnerRegistry(): LearnerRegistry {
  return new LearnerRegistry();
}
