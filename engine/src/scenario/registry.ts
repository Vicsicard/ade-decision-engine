/**
 * Scenario Registry
 * 
 * In-memory registry for loaded scenarios.
 * 
 * @version 1.0.0
 */

import type { ScenarioRegistry, ScenarioReference } from './loader.js';
import type { Scenario } from '../core/types.js';

export class InMemoryScenarioRegistry implements ScenarioRegistry {
  private readonly scenarios: Map<string, Scenario> = new Map();
  private readonly hashIndex: Map<string, string> = new Map(); // hash -> key
  
  register(scenario: Scenario, hash: string): void {
    const key = this.buildKey(scenario.scenario_id, scenario.version);
    
    // Enforce immutability: if scenario exists, hash must match
    const existing = this.scenarios.get(key);
    if (existing) {
      // Find existing hash
      for (const [existingHash, existingKey] of this.hashIndex) {
        if (existingKey === key && existingHash !== hash) {
          throw new Error(
            `Scenario ${scenario.scenario_id}@${scenario.version} hash mismatch: ` +
            `existing=${existingHash}, new=${hash}. Scenarios are immutable once registered.`
          );
        }
      }
      // Same hash, no-op
      return;
    }
    
    this.scenarios.set(key, scenario);
    this.hashIndex.set(hash, key);
  }
  
  get(scenario_id: string, version: string): Scenario | null {
    // Handle 'latest' version
    if (version === 'latest') {
      return this.getLatest(scenario_id);
    }
    
    const key = this.buildKey(scenario_id, version);
    return this.scenarios.get(key) ?? null;
  }
  
  getByHash(hash: string): Scenario | null {
    const key = this.hashIndex.get(hash);
    if (!key) return null;
    return this.scenarios.get(key) ?? null;
  }
  
  list(): ScenarioReference[] {
    const refs: ScenarioReference[] = [];
    
    for (const [key, scenario] of this.scenarios) {
      // Find hash for this scenario
      let hash = '';
      for (const [h, k] of this.hashIndex) {
        if (k === key) {
          hash = h;
          break;
        }
      }
      
      refs.push({
        scenario_id: scenario.scenario_id,
        version: scenario.version,
        hash,
      });
    }
    
    return refs;
  }
  
  private getLatest(scenario_id: string): Scenario | null {
    // Find all versions of this scenario
    const versions: Array<{ version: string; scenario: Scenario }> = [];
    
    for (const [key, scenario] of this.scenarios) {
      if (key.startsWith(`${scenario_id}@`)) {
        versions.push({ version: scenario.version, scenario });
      }
    }
    
    if (versions.length === 0) return null;
    
    // Sort by semantic version (simple comparison)
    versions.sort((a, b) => this.compareVersions(b.version, a.version));
    
    return versions[0]?.scenario ?? null;
  }
  
  private buildKey(scenario_id: string, version: string): string {
    return `${scenario_id}@${version}`;
  }
  
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
      if (diff !== 0) return diff;
    }
    
    return 0;
  }
  
  /**
   * Clear all scenarios (for testing)
   */
  clear(): void {
    this.scenarios.clear();
    this.hashIndex.clear();
  }
}

export function createScenarioRegistry(): InMemoryScenarioRegistry {
  return new InMemoryScenarioRegistry();
}
