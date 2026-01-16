/**
 * Memory Snapshot Management
 * 
 * Provides memory snapshot creation and retrieval for deterministic replay.
 * 
 * Determinism Definition (V2):
 * Given: scenario_hash + request + memory_snapshot_id
 * → the decision is identical.
 */

import { createHash } from 'crypto';
import type { MemoryStore } from '../storage/memory-store.js';

/**
 * A frozen snapshot of memory at a point in time
 */
export interface MemorySnapshot {
  /**
   * Unique identifier for this snapshot
   */
  snapshot_id: string;

  /**
   * User ID this snapshot belongs to
   */
  user_id: string;

  /**
   * Timestamp when snapshot was created
   */
  created_at: string;

  /**
   * The actual memory data (deep cloned, immutable)
   */
  data: Record<string, unknown>;

  /**
   * Hash of the data for integrity verification
   */
  data_hash: string;
}

/**
 * Storage interface for memory snapshots
 */
export interface MemorySnapshotStore {
  /**
   * Store a snapshot
   */
  store(snapshot: MemorySnapshot): Promise<void>;

  /**
   * Retrieve a snapshot by ID
   */
  get(snapshot_id: string): Promise<MemorySnapshot | null>;

  /**
   * Check if a snapshot exists
   */
  exists(snapshot_id: string): Promise<boolean>;
}

/**
 * In-memory implementation of snapshot store (for development/testing)
 */
export class LocalMemorySnapshotStore implements MemorySnapshotStore {
  private snapshots: Map<string, MemorySnapshot> = new Map();

  async store(snapshot: MemorySnapshot): Promise<void> {
    // Deep clone to ensure immutability
    const frozen: MemorySnapshot = {
      snapshot_id: snapshot.snapshot_id,
      user_id: snapshot.user_id,
      created_at: snapshot.created_at,
      data: JSON.parse(JSON.stringify(snapshot.data)),
      data_hash: snapshot.data_hash,
    };
    this.snapshots.set(snapshot.snapshot_id, frozen);
  }

  async get(snapshot_id: string): Promise<MemorySnapshot | null> {
    const snapshot = this.snapshots.get(snapshot_id);
    if (!snapshot) return null;
    
    // Return deep clone to prevent mutation
    return {
      snapshot_id: snapshot.snapshot_id,
      user_id: snapshot.user_id,
      created_at: snapshot.created_at,
      data: JSON.parse(JSON.stringify(snapshot.data)),
      data_hash: snapshot.data_hash,
    };
  }

  async exists(snapshot_id: string): Promise<boolean> {
    return this.snapshots.has(snapshot_id);
  }

  /**
   * Clear all snapshots (for testing)
   */
  clear(): void {
    this.snapshots.clear();
  }
}

/**
 * Create a memory snapshot from the current memory state
 */
export async function createMemorySnapshot(
  user_id: string,
  memoryStore: MemoryStore
): Promise<MemorySnapshot> {
  // Get all memory for user
  const data = await memoryStore.getAll(user_id);
  
  // Deep clone to ensure immutability
  const frozenData = JSON.parse(JSON.stringify(data));
  
  // Compute hash for integrity
  const dataHash = computeDataHash(frozenData);
  
  // Generate snapshot ID
  const timestamp = new Date().toISOString();
  const snapshotId = generateSnapshotId(user_id, timestamp, dataHash);

  return {
    snapshot_id: snapshotId,
    user_id,
    created_at: timestamp,
    data: frozenData,
    data_hash: dataHash,
  };
}

/**
 * Stable JSON stringify that sorts keys at all levels.
 * Required for deterministic hashing across runtimes.
 */
function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map(stableStringify).join(',')}]`;
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return `{${keys.map(k => `"${k}":${stableStringify((obj as Record<string, unknown>)[k])}`).join(',')}}`;
}

/**
 * Compute a hash of the memory data for integrity verification.
 * Uses stable stringify to ensure determinism across runtimes.
 */
function computeDataHash(data: Record<string, unknown>): string {
  const serialized = stableStringify(data);
  return createHash('sha256').update(serialized).digest('hex').slice(0, 16);
}

/**
 * Generate a unique snapshot ID
 */
function generateSnapshotId(user_id: string, timestamp: string, dataHash: string): string {
  const input = `${user_id}:${timestamp}:${dataHash}`;
  const hash = createHash('sha256').update(input).digest('hex').slice(0, 12);
  return `snap_${hash}`;
}

/**
 * Verify a snapshot's integrity
 */
export function verifySnapshotIntegrity(snapshot: MemorySnapshot): boolean {
  const computedHash = computeDataHash(snapshot.data);
  return computedHash === snapshot.data_hash;
}
