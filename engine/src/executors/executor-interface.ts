/**
 * Executor Interface
 * 
 * Defines the contract for skill executors.
 * All executors (deterministic and LLM) must implement this interface.
 * 
 * @version 1.0.0
 */

import type { SkillInputEnvelope, SkillOutput, ExecutionMode } from '../core/types.js';

/**
 * Executor Interface - all skill executors must implement this
 */
export interface Executor {
  /**
   * Executor type identifier
   */
  readonly type: ExecutionMode;
  
  /**
   * Check if this executor is available
   */
  isAvailable(): boolean;
  
  /**
   * Get estimated latency for this executor
   */
  getLatencyEstimate(): number;
  
  /**
   * Execute a skill and return output
   */
  execute(
    skill_id: string,
    skill_version: string,
    input: SkillInputEnvelope,
    timeout_ms: number
  ): Promise<ExecutorResult>;
}

/**
 * Result of executor execution
 */
export interface ExecutorResult {
  success: boolean;
  output: SkillOutput | null;
  error: ExecutorError | null;
  execution_ms: number;
  token_count: number;
}

/**
 * Executor error details
 */
export interface ExecutorError {
  code: 'TIMEOUT' | 'SKILL_NOT_FOUND' | 'EXECUTION_ERROR' | 'VALIDATION_ERROR';
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Executor registry - manages available executors
 */
export interface ExecutorRegistry {
  /**
   * Register an executor
   */
  register(executor: Executor): void;
  
  /**
   * Get executor for a given mode
   */
  get(mode: ExecutionMode): Executor | null;
  
  /**
   * Check if an executor is available for a mode
   */
  isAvailable(mode: ExecutionMode): boolean;
  
  /**
   * Get the best available executor (prefers skill_enhanced if available)
   */
  getBestAvailable(): Executor | null;
}
