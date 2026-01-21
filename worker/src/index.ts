/**
 * DDR Runtime Worker
 * Phase 5.2: Cloudflare Workers Deployment
 *
 * This Worker hosts the DDR decision runtime ONLY.
 * - Accepts decision requests
 * - Returns deterministic decisions
 * - Logs events to D1 (async, best-effort)
 * - Does NOT modify decisions based on logging failures
 *
 * DCG (contract authoring) stays in Control Plane.
 */

import { createEngine, type Engine } from 'ade-decision-engine';
import { fitnessDailySessionScenario } from './scenarios/fitness-daily-session';

/**
 * Create and initialize engine with scenario.
 * 
 * Note: Cloudflare Workers are stateless. Each request may get a fresh isolate.
 * We create the engine and register the scenario on each request to ensure
 * the scenario is always available. The engine creation is fast (~1ms).
 */
async function createInitializedEngine(): Promise<Engine> {
  const engine = await createEngine();
  await engine.registerScenario(fitnessDailySessionScenario);
  return engine;
}

// =============================================================================
// Types
// =============================================================================

interface Env {
  // Environment variables
  ENVIRONMENT: string;
  SCENARIO_ID: string;
  SCENARIO_VERSION: string;
  COHORT_MODE: string;

  // Bindings
  SESSION_STATE: KVNamespace;
  DB: D1Database;
}

interface DecideRequest {
  user_id: string;
  session_id?: string;
  actions: Array<{
    action_id: string;
    type_id: string;
    attributes: Record<string, unknown>;
  }>;
  signals: Record<string, unknown>;
  context?: {
    local_time?: string;
    [key: string]: unknown;
  };
  cohort?: 'control' | 'treatment';
  options?: {
    execution_mode_override?: 'deterministic_only' | 'skill_enhanced';
    include_rationale?: boolean;
  };
}

interface DecisionEvent {
  id: string;
  timestamp: string;
  user_id: string;
  scenario_id: string;
  scenario_version: string;
  selected_action_id: string;
  decision_code: string;
  guardrail_flags: string; // JSON
  latency_ms: number;
  cohort: string;
}

// =============================================================================
// Handlers
// =============================================================================

async function handleHealth(env: Env): Promise<Response> {
  return Response.json({
    status: 'ok',
    service: 'ddr-runtime',
    version: '0.1.0',
    environment: env.ENVIRONMENT,
    scenario: {
      id: env.SCENARIO_ID,
      version: env.SCENARIO_VERSION,
    },
    timestamp: new Date().toISOString(),
  });
}

async function handleDecide(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const startTime = Date.now();

  // Parse request
  let body: DecideRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!body.user_id || !body.actions || !Array.isArray(body.actions)) {
    return Response.json(
      { error: 'Missing required fields: user_id, actions' },
      { status: 400 }
    );
  }

  // Make decision using full ADE engine
  try {
    const engine = await createInitializedEngine();

    const response = await engine.decide({
      scenario_id: env.SCENARIO_ID,
      user_id: body.user_id,
      actions: body.actions,
      signals: body.signals ?? {},
      context: {
        current_time: new Date().toISOString(),
        timezone: undefined,
        platform_constraints: undefined,
      },
      options: {
        execution_mode_override: body.options?.execution_mode_override ?? 'deterministic_only',
        include_rationale: body.options?.include_rationale ?? true,
        include_score_breakdown: undefined,
        max_ranked_options: undefined,
      },
    });

    const latencyMs = Date.now() - startTime;
    const cohort = body.cohort ?? env.COHORT_MODE;

    // Log decision event to D1 (async, best-effort)
    // Decision is NOT modified based on logging success/failure
    // Use ctx.waitUntil to ensure the write completes after response is sent
    ctx.waitUntil(
      logDecisionEvent(env, {
        id: response.decision.decision_id,
        timestamp: new Date().toISOString(),
        user_id: body.user_id,
        scenario_id: env.SCENARIO_ID,
        scenario_version: env.SCENARIO_VERSION,
        selected_action_id: response.decision.selected_action,
        decision_code: 'APPROVE',
        guardrail_flags: JSON.stringify(response.guardrails_applied ?? []),
        latency_ms: latencyMs,
        cohort: cohort,
      }).catch((err) => {
        console.error('[DDR] Failed to log decision event:', err);
      })
    );

    // Response format per Phase 5.3 API contract
    return Response.json({
      decision_id: response.decision.decision_id,
      decision_code: 'APPROVE',
      selected_action: {
        action_id: response.decision.selected_action,
        type: body.actions.find(a => a.action_id === response.decision.selected_action)?.type_id ?? 'unknown',
        duration_minutes: (body.actions.find(a => a.action_id === response.decision.selected_action)?.attributes?.duration_minutes as number) ?? 30,
      },
      audit: {
        replay_token: response.audit?.replay_token,
        stage_path: ['ingest', 'derive', 'guardrails', 'score', 'select', 'skill', 'validate', 'audit'],
        guardrails_triggered: response.guardrails_applied ?? [],
        scenario_id: env.SCENARIO_ID,
        scenario_version: env.SCENARIO_VERSION,
        latency_ms: latencyMs,
        cohort: cohort,
      },
    });
  } catch (err) {
    console.error('[DDR] Decision error:', err);
    return Response.json(
      { error: 'Decision failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

async function handleOutcome(
  request: Request,
  env: Env
): Promise<Response> {
  // Parse request - Phase 5.3 API contract
  let body: {
    decision_id: string;
    user_id: string;
    outcome: 'completed' | 'skipped' | 'abandoned';
    completion_percentage: number;
    duration_minutes: number;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Validate required fields per Phase 5.3 contract
  if (!body.decision_id || !body.user_id || !body.outcome) {
    return Response.json(
      { error: 'Missing required fields: decision_id, user_id, outcome' },
      { status: 400 }
    );
  }

  const timestamp = new Date().toISOString();

  try {
    await env.DB.prepare(`
      INSERT INTO outcome_events (
        id, timestamp, decision_event_id, user_id, outcome_type, outcome_metadata
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      timestamp,
      body.decision_id,
      body.user_id,
      body.outcome,
      JSON.stringify({
        completion_percentage: body.completion_percentage ?? 0,
        duration_minutes: body.duration_minutes ?? 0,
      })
    ).run();

    return Response.json({
      recorded: true,
      timestamp,
    });
  } catch (err) {
    console.error('[DDR] Outcome logging error:', err);
    return Response.json(
      { error: 'Failed to record outcome', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

async function handleMetrics(env: Env): Promise<Response> {
  try {
    // Basic aggregates from D1
    const result = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_decisions,
        COUNT(CASE WHEN decision_code = 'APPROVE' THEN 1 END) as approvals,
        COUNT(CASE WHEN decision_code = 'REFUSE' THEN 1 END) as refusals,
        AVG(latency_ms) as avg_latency_ms,
        cohort
      FROM decision_events
      WHERE timestamp > datetime('now', '-24 hours')
      GROUP BY cohort
    `).all();

    return Response.json({
      period: '24h',
      aggregates: result.results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[DDR] Metrics error:', err);
    return Response.json(
      { error: 'Metrics unavailable', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// =============================================================================
// Observability Endpoints (Phase 5.4)
// =============================================================================

async function handleObsSummary(env: Env): Promise<Response> {
  try {
    // Completion rates by cohort
    const cohortStats = await env.DB.prepare(`
      SELECT
        d.cohort,
        COUNT(DISTINCT d.id) as sessions,
        COUNT(CASE WHEN o.outcome_type = 'completed' THEN 1 END) as completed
      FROM decision_events d
      LEFT JOIN outcome_events o ON d.id = o.decision_event_id
      WHERE d.timestamp > datetime('now', '-24 hours')
      GROUP BY d.cohort
    `).all();

    // Guardrail triggers
    const guardrails = await env.DB.prepare(`
      SELECT
        json_each.value AS guardrail,
        COUNT(*) AS triggered
      FROM decision_events,
           json_each(decision_events.guardrail_flags)
      WHERE timestamp > datetime('now', '-24 hours')
        AND guardrail_flags != '[]'
      GROUP BY guardrail
    `).all();

    // Latency stats
    const latency = await env.DB.prepare(`
      SELECT
        AVG(latency_ms) as avg,
        MAX(latency_ms) as max
      FROM decision_events
      WHERE timestamp > datetime('now', '-24 hours')
    `).first();

    // Build response
    const control = cohortStats.results.find((r: Record<string, unknown>) => r.cohort === 'control') as Record<string, number> | undefined;
    const treatment = cohortStats.results.find((r: Record<string, unknown>) => r.cohort === 'treatment') as Record<string, number> | undefined;

    const guardrailMap: Record<string, number> = {};
    for (const row of guardrails.results as Array<{ guardrail: string; triggered: number }>) {
      guardrailMap[row.guardrail] = row.triggered;
    }

    return Response.json({
      window: '24h',
      control: {
        sessions: control?.sessions ?? 0,
        completion_rate: control?.sessions ? (control.completed / control.sessions) : 0,
      },
      treatment: {
        sessions: treatment?.sessions ?? 0,
        completion_rate: treatment?.sessions ? (treatment.completed / treatment.sessions) : 0,
      },
      guardrails: guardrailMap,
      latency_ms: {
        avg: Math.round((latency?.avg as number) ?? 0),
        max: (latency?.max as number) ?? 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[DDR] Obs summary error:', err);
    return Response.json(
      { error: 'Summary unavailable', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

async function handleObsCohorts(env: Env): Promise<Response> {
  try {
    // Completion rates by cohort
    const cohortStats = await env.DB.prepare(`
      SELECT
        d.cohort,
        o.outcome_type,
        COUNT(*) as count
      FROM decision_events d
      LEFT JOIN outcome_events o ON d.id = o.decision_event_id
      WHERE d.timestamp > datetime('now', '-7 days')
      GROUP BY d.cohort, o.outcome_type
    `).all();

    return Response.json({
      window: '7d',
      cohorts: cohortStats.results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[DDR] Obs cohorts error:', err);
    return Response.json(
      { error: 'Cohorts unavailable', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

async function handleObsLatency(env: Env): Promise<Response> {
  try {
    // Latency distribution by cohort
    const latencyStats = await env.DB.prepare(`
      SELECT
        cohort,
        AVG(latency_ms) as avg,
        MAX(latency_ms) as max,
        MIN(latency_ms) as min,
        COUNT(*) as count
      FROM decision_events
      WHERE timestamp > datetime('now', '-24 hours')
      GROUP BY cohort
    `).all();

    // Approximate p95 (simple approach: get 95th percentile value)
    const p95 = await env.DB.prepare(`
      SELECT latency_ms
      FROM decision_events
      WHERE timestamp > datetime('now', '-24 hours')
      ORDER BY latency_ms DESC
      LIMIT 1 OFFSET (
        SELECT CAST(COUNT(*) * 0.05 AS INTEGER)
        FROM decision_events
        WHERE timestamp > datetime('now', '-24 hours')
      )
    `).first();

    return Response.json({
      window: '24h',
      by_cohort: latencyStats.results,
      p95_ms: (p95?.latency_ms as number) ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[DDR] Obs latency error:', err);
    return Response.json(
      { error: 'Latency unavailable', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// =============================================================================
// D1 Logging (async, best-effort)
// =============================================================================

async function logDecisionEvent(env: Env, event: DecisionEvent): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO decision_events (
      id, timestamp, user_id, scenario_id, scenario_version,
      selected_action_id, decision_code, guardrail_flags, latency_ms, cohort
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    event.id,
    event.timestamp,
    event.user_id,
    event.scenario_id,
    event.scenario_version,
    event.selected_action_id,
    event.decision_code,
    event.guardrail_flags,
    event.latency_ms,
    event.cohort
  ).run();
}

// =============================================================================
// Router
// =============================================================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for dev
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    let response: Response;

    // Route requests
    if (path === '/health' && request.method === 'GET') {
      response = await handleHealth(env);
    } else if (path === '/v1/decide' && request.method === 'POST') {
      response = await handleDecide(request, env, ctx);
    } else if (path === '/v1/outcome' && request.method === 'POST') {
      response = await handleOutcome(request, env);
    } else if (path === '/v1/metrics' && request.method === 'GET') {
      response = await handleMetrics(env);
    } else if (path === '/v1/obs/summary' && request.method === 'GET') {
      response = await handleObsSummary(env);
    } else if (path === '/v1/obs/cohorts' && request.method === 'GET') {
      response = await handleObsCohorts(env);
    } else if (path === '/v1/obs/latency' && request.method === 'GET') {
      response = await handleObsLatency(env);
    } else {
      response = Response.json(
        { error: 'Not found', path },
        { status: 404 }
      );
    }

    // Add CORS headers to response
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  },
};
