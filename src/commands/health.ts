export interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  updatedAt?: string;
  details?: Record<string, unknown>;
}

export interface HealthSummary {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  uptime: number;
  checks: Record<string, HealthCheck>;
  daemon?: string;
  gateway?: string;
  mainSessionKey?: string;
}

export function summarizeHealthStatus(checks: Record<string, HealthCheck>): HealthSummary["status"] {
  const values = Object.values(checks);
  if (values.some((check) => check.status === "unhealthy")) return "unhealthy";
  if (values.some((check) => check.status === "degraded")) return "degraded";
  return "healthy";
}
