/**
 * Local Memory Store
 * 
 * In-memory store for local development and testing.
 * 
 * @version 1.0.0
 */

import type { MemoryStore } from '../memory-store.js';
import type { MemoryEntry } from '../../core/types.js';
import { buildMemoryKey } from '../memory-store.js';

export class LocalMemoryStore implements MemoryStore {
  private readonly entries: Map<string, MemoryEntry> = new Map();
  
  async get(platform_id: string, user_id: string): Promise<MemoryEntry | null> {
    const key = buildMemoryKey(platform_id, user_id);
    return this.entries.get(key) ?? null;
  }
  
  async set(platform_id: string, user_id: string, entry: MemoryEntry): Promise<void> {
    const key = buildMemoryKey(platform_id, user_id);
    this.entries.set(key, entry);
  }
  
  async delete(platform_id: string, user_id: string): Promise<void> {
    const key = buildMemoryKey(platform_id, user_id);
    this.entries.delete(key);
  }
  
  async exists(platform_id: string, user_id: string): Promise<boolean> {
    const key = buildMemoryKey(platform_id, user_id);
    return this.entries.has(key);
  }

  async getAll(user_id: string): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    
    // Find all entries for this user across all platforms
    for (const [key, entry] of this.entries) {
      if (key.includes(`:${user_id}`)) {
        // Flatten the memory entry into the result
        // MemoryEntry has: schema_version, scenario_id, last_updated, interaction_history, custom_memory
        result[`${key}.schema_version`] = entry.schema_version;
        result[`${key}.scenario_id`] = entry.scenario_id;
        result[`${key}.last_updated`] = entry.last_updated;
        result[`${key}.interaction_history`] = entry.interaction_history;
        
        // Flatten custom_memory
        if (entry.custom_memory) {
          for (const [k, v] of Object.entries(entry.custom_memory)) {
            result[`custom_memory.${k}`] = v;
          }
        }
      }
    }
    
    return result;
  }
  
  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.entries.clear();
  }
  
  /**
   * Seed memory for testing
   */
  seed(platform_id: string, user_id: string, entry: MemoryEntry): void {
    const key = buildMemoryKey(platform_id, user_id);
    this.entries.set(key, entry);
  }
}

export function createLocalMemoryStore(): LocalMemoryStore {
  return new LocalMemoryStore();
}
