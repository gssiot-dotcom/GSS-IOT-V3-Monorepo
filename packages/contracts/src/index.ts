export const HEALTH_STATUS = {
  ok: "ok",
} as const;

export type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];

export interface HealthResponse {
  service: "api";
  status: HealthStatus;
}
