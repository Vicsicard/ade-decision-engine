/**
 * Executor Registry
 * 
 * Manages available executors for different execution modes.
 * 
 * @version 1.0.0
 */

import type { Executor, ExecutorRegistry } from './executor-interface.js';
import type { ExecutionMode } from '../core/types.js';

export class InMemoryExecutorRegistry implements ExecutorRegistry {
  private readonly executors: Map<ExecutionMode, Executor> = new Map();
  
  register(executor: Executor): void {
    this.executors.set(executor.type, executor);
  }
  
  get(mode: ExecutionMode): Executor | null {
    return this.executors.get(mode) ?? null;
  }
  
  isAvailable(mode: ExecutionMode): boolean {
    const executor = this.executors.get(mode);
    return executor !== undefined && executor.isAvailable();
  }
  
  getBestAvailable(): Executor | null {
    // Prefer skill_enhanced if available
    const enhanced = this.executors.get('skill_enhanced');
    if (enhanced?.isAvailable()) {
      return enhanced;
    }
    
    // Fall back to deterministic
    const deterministic = this.executors.get('deterministic_only');
    if (deterministic?.isAvailable()) {
      return deterministic;
    }
    
    return null;
  }
}

export function createExecutorRegistry(): InMemoryExecutorRegistry {
  return new InMemoryExecutorRegistry();
}
