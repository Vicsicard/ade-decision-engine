/**
 * ADE API Routes
 * 
 * Thin HTTP adapter layer for the ADE engine.
 * Handlers validate requests and delegate to the engine.
 * No business logic lives here.
 * 
 * @version 1.0.0
 */

import type { Engine } from '../engine.js';
import type { AuditStore } from '../storage/audit-store.js';
import { handleDecide } from './handlers/decide.js';
import { handleReplay, handleReplayByToken } from './handlers/replay.js';
import { handleHealth } from './handlers/health.js';
import { handleFeedback } from './handlers/feedback.js';

/**
 * Router configuration
 */
export interface RouterConfig {
  engine: Engine;
  auditStore: AuditStore;
  version: string;
  startTime: number;
}

/**
 * HTTP Request abstraction
 */
export interface HttpRequest {
  method: string;
  path: string;
  body: unknown;
  params: Record<string, string>;
  query: Record<string, string>;
}

/**
 * HTTP Response abstraction
 */
export interface HttpResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

/**
 * Route handler function
 */
export type RouteHandler = (req: HttpRequest, config: RouterConfig) => Promise<HttpResponse>;

/**
 * Route the request to the appropriate handler
 */
export async function route(req: HttpRequest, config: RouterConfig): Promise<HttpResponse> {
  const { method, path } = req;
  
  // Health check
  if (method === 'GET' && path === '/v1/health') {
    const result = handleHealth({
      version: config.version,
      startTime: config.startTime,
    });
    return {
      status: result.status,
      body: result.body,
      headers: { 'Content-Type': 'application/json' },
    };
  }
  
  // Decision endpoint
  if (method === 'POST' && path === '/v1/decide') {
    const result = await handleDecide(req.body, { engine: config.engine });
    return {
      status: result.status,
      body: result.body,
      headers: { 'Content-Type': 'application/json' },
    };
  }
  
  // Replay by decision_id
  if (method === 'GET' && path.startsWith('/v1/replay/')) {
    const decision_id = path.replace('/v1/replay/', '');
    
    // Check if it's a token-based replay
    if (decision_id.startsWith('rpl_')) {
      const result = await handleReplayByToken(decision_id, {
        auditStore: config.auditStore,
      });
      return {
        status: result.status,
        body: result.body,
        headers: { 
          'Content-Type': 'application/json',
          'X-Replay-Only': 'true', // Document that this is read-only
        },
      };
    }
    
    const result = await handleReplay(decision_id, {
      auditStore: config.auditStore,
    });
    return {
      status: result.status,
      body: result.body,
      headers: { 
        'Content-Type': 'application/json',
        'X-Replay-Only': 'true', // Document that this is read-only
      },
    };
  }
  
  // Feedback endpoint
  if (method === 'POST' && path === '/v1/feedback') {
    const result = await handleFeedback(req.body, {
      auditStore: config.auditStore,
    });
    return {
      status: result.status,
      body: result.body,
      headers: { 'Content-Type': 'application/json' },
    };
  }
  
  // Not found
  return {
    status: 404,
    body: {
      error: {
        code: 'NOT_FOUND',
        message: `Route not found: ${method} ${path}`,
      },
    },
    headers: { 'Content-Type': 'application/json' },
  };
}

/**
 * Create a router with the given configuration
 */
export function createRouter(config: RouterConfig): (req: HttpRequest) => Promise<HttpResponse> {
  return (req: HttpRequest) => route(req, config);
}
