/**
 * Local Audit Store
 * 
 * In-memory audit store for local development and testing.
 * 
 * @version 1.0.0
 */

import type { AuditStore } from '../audit-store.js';
import type { AuditTrace } from '../../core/types.js';

export class LocalAuditStore implements AuditStore {
  private readonly traces: Map<string, AuditTrace> = new Map();
  private readonly tokenIndex: Map<string, string> = new Map(); // replay_token -> decision_id
  
  async store(trace: AuditTrace): Promise<void> {
    this.traces.set(trace.decision_id, trace);
    
    // Index by replay token if available
    const replayToken = trace.final_decision.audit.replay_token;
    if (replayToken) {
      this.tokenIndex.set(replayToken, trace.decision_id);
    }
  }
  
  async retrieve(decision_id: string): Promise<AuditTrace | null> {
    return this.traces.get(decision_id) ?? null;
  }
  
  async retrieveByToken(replay_token: string): Promise<AuditTrace | null> {
    const decisionId = this.tokenIndex.get(replay_token);
    if (!decisionId) return null;
    return this.traces.get(decisionId) ?? null;
  }
  
  async exists(decision_id: string): Promise<boolean> {
    return this.traces.has(decision_id);
  }
  
  async storeVerification(decision_id: string, verified: boolean): Promise<void> {
    const trace = this.traces.get(decision_id);
    if (trace) {
      trace.determinism_verified = verified;
    }
  }
  
  /**
   * Clear all traces (for testing)
   */
  clear(): void {
    this.traces.clear();
    this.tokenIndex.clear();
  }
  
  /**
   * Get all traces (for testing)
   */
  getAll(): AuditTrace[] {
    return Array.from(this.traces.values());
  }
}

export function createLocalAuditStore(): LocalAuditStore {
  return new LocalAuditStore();
}
