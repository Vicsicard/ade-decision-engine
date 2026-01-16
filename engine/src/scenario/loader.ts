/**
 * Scenario Loader Interface
 * 
 * Defines the contract for loading and validating scenarios.
 * Scenarios are loaded at deploy time, not runtime.
 * 
 * @version 1.0.0
 */

import type { Scenario } from '../core/types.js';

/**
 * Scenario Loader Interface
 */
export interface ScenarioLoader {
  /**
   * Load a scenario by ID and version
   */
  load(scenario_id: string, version: string): Promise<Scenario>;
  
  /**
   * Load the latest version of a scenario
   */
  loadLatest(scenario_id: string): Promise<Scenario>;
  
  /**
   * List all available scenarios
   */
  list(): Promise<ScenarioReference[]>;
  
  /**
   * Check if a scenario exists
   */
  exists(scenario_id: string, version: string): Promise<boolean>;
  
  /**
   * Get scenario hash for replay verification
   */
  getHash(scenario_id: string, version: string): Promise<string>;
}

/**
 * Scenario reference (ID + version)
 */
export interface ScenarioReference {
  scenario_id: string;
  version: string;
  hash: string;
}

/**
 * Scenario registry - holds loaded scenarios in memory
 */
export interface ScenarioRegistry {
  /**
   * Register a scenario
   */
  register(scenario: Scenario, hash: string): void;
  
  /**
   * Get a registered scenario
   */
  get(scenario_id: string, version: string): Scenario | null;
  
  /**
   * Get scenario by hash (for replay)
   */
  getByHash(hash: string): Scenario | null;
  
  /**
   * List all registered scenarios
   */
  list(): ScenarioReference[];
}

/**
 * Compute SHA256 hash of scenario content
 */
export async function computeScenarioHash(scenario: Scenario): Promise<string> {
  const content = JSON.stringify(scenario);
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  
  // Use Web Crypto API (available in Workers and Node 20+)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `sha256:${hashHex}`;
}
