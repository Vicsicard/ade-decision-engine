/**
 * Memory Store Interface
 * 
 * Defines the contract for short-term memory storage.
 * Memory is non-authoritative - decisions must succeed even if memory is unavailable.
 * 
 * @version 1.0.0
 */

import type { MemoryEntry } from '../core/types.js';

/**
 * Memory Store Interface - non-authoritative user memory
 */
export interface MemoryStore {
  /**
   * Get memory for a user
   * Returns null if not found (cold start)
   */
  get(platform_id: string, user_id: string): Promise<MemoryEntry | null>;
  
  /**
   * Store/update memory for a user
   */
  set(platform_id: string, user_id: string, entry: MemoryEntry): Promise<void>;
  
  /**
   * Delete memory for a user
   */
  delete(platform_id: string, user_id: string): Promise<void>;
  
  /**
   * Check if memory exists
   */
  exists(platform_id: string, user_id: string): Promise<boolean>;

  /**
   * Get all memory data for a user as a flat record.
   * Used for creating memory snapshots for V2 learning.
   */
  getAll(user_id: string): Promise<Record<string, unknown>>;
}

/**
 * Memory Store configuration
 */
export interface MemoryStoreConfig {
  type: 'local' | 'kv' | 'memory';
  ttl_days: number;
  max_history_entries: number;
}

/**
 * Build memory key from platform and user IDs
 */
export function buildMemoryKey(platform_id: string, user_id: string): string {
  return `ade:memory:${platform_id}:${user_id}`;
}
