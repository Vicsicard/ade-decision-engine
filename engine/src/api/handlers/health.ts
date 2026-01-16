/**
 * /health Handler
 * 
 * Handles GET /v1/health requests.
 * 
 * @version 1.0.0
 */

export interface HealthHandlerConfig {
  version: string;
  startTime: number;
}

export interface HealthResult {
  status: number;
  body: HealthResponse;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  timestamp: string;
  components: {
    engine: ComponentHealth;
    audit_store: ComponentHealth;
    memory_store: ComponentHealth;
    executors: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms: number | null;
}

/**
 * Handle /health request
 */
export function handleHealth(config: HealthHandlerConfig): HealthResult {
  const now = Date.now();
  const uptimeSeconds = Math.floor((now - config.startTime) / 1000);
  
  // For V1, all components are healthy if engine is running
  const response: HealthResponse = {
    status: 'healthy',
    version: config.version,
    uptime_seconds: uptimeSeconds,
    timestamp: new Date().toISOString(),
    components: {
      engine: {
        status: 'healthy',
        latency_ms: null,
      },
      audit_store: {
        status: 'healthy',
        latency_ms: null,
      },
      memory_store: {
        status: 'healthy',
        latency_ms: null,
      },
      executors: {
        status: 'healthy',
        latency_ms: null,
      },
    },
  };
  
  return {
    status: 200,
    body: response,
  };
}
