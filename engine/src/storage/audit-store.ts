/**
 * Audit Store Interface
 * 
 * Defines the contract for audit trace storage.
 * Implementations can target D1, filesystem, or other backends.
 * 
 * @version 1.0.0
 */

import type { AuditTrace } from '../core/types.js';

/**
 * Audit Store Interface - authoritative decision storage
 */
export interface AuditStore {
  /**
   * Store a complete audit trace
   */
  store(trace: AuditTrace): Promise<void>;
  
  /**
   * Retrieve an audit trace by decision_id
   */
  retrieve(decision_id: string): Promise<AuditTrace | null>;
  
  /**
   * Retrieve an audit trace by replay_token
   */
  retrieveByToken(replay_token: string): Promise<AuditTrace | null>;
  
  /**
   * Check if a decision exists
   */
  exists(decision_id: string): Promise<boolean>;
  
  /**
   * Store determinism verification result
   */
  storeVerification(decision_id: string, verified: boolean): Promise<void>;
}

/**
 * Audit Store configuration
 */
export interface AuditStoreConfig {
  type: 'local' | 'd1' | 'memory';
  retention_days: number;
  path?: string; // For local filesystem
}
