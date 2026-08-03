import { describe, expect, it } from "vitest";

import { loadApiEnv } from "../src";

describe("loadApiEnv", () => {
  it("validates required infrastructure configuration", () => {
    const env = loadApiEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
      GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
      GSS_SUPER_ADMIN_PASSWORD: "change-this-super-admin-password",
      JWT_ACCESS_EXPIRES_IN: "900",
      JWT_ACCESS_SECRET: "test-only-access-secret-that-is-at-least-32-characters",
      JWT_REFRESH_SECRET: "test-only-refresh-secret-that-is-at-least-32-characters",
      MQTT_BROKER_URL: "mqtt://localhost:1883",
      MQTT_TOPIC_BASE: "GSSIOT/01030369081",
      NODE_ENV: "test",
      REDIS_URL: "redis://localhost:6379",
    });

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("test");
    expect(env.ASSET_STORAGE_PROVIDER).toBe("memory");
    expect(env.REPORT_STORAGE_PROVIDER).toBe("memory");
    expect(env.REPORT_WORKER_ENABLED).toBe(false);
    expect(env.DELETION_WORKER_ENABLED).toBe(false);
    expect(env.NODE_OFFLINE_BATCH_SIZE).toBe(250);
    expect(env.NODE_OFFLINE_EVALUATOR_ENABLED).toBe(false);
    expect(env.NODE_OFFLINE_SWEEP_INTERVAL_MS).toBe(10_000);
    expect(env.SENSOR_RETENTION_DAYS).toBe(180);
    expect(env.SENSOR_RETENTION_DRY_RUN).toBe(true);
    expect(env.SENSOR_RETENTION_ENABLED).toBe(false);
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
    expect(env.AUTH_COOKIE_SECURE).toBe(false);
    expect(env.JWT_REFRESH_EXPIRES_IN).toBe(2_592_000);
  });

  it("rejects shared auth secrets and insecure SameSite=None cookies", () => {
    const base = {
      DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
      GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
      GSS_SUPER_ADMIN_PASSWORD: "change-this-super-admin-password",
      JWT_ACCESS_SECRET: "same-test-secret-that-is-at-least-32-characters",
      JWT_REFRESH_SECRET: "same-test-secret-that-is-at-least-32-characters",
      MQTT_BROKER_URL: "mqtt://localhost:1883",
      MQTT_TOPIC_BASE: "GSSIOT/test",
      NODE_ENV: "test",
      REDIS_URL: "redis://localhost:6379",
    };
    expect(() => loadApiEnv(base)).toThrow("must be different");
    expect(() =>
      loadApiEnv({
        ...base,
        AUTH_COOKIE_SAME_SITE: "none",
        JWT_REFRESH_SECRET: "different-refresh-secret-at-least-32-characters",
      }),
    ).toThrow("SameSite=None");
  });

  it("rejects a retention cycle cap smaller than its batch size", () => {
    expect(() =>
      loadApiEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
        GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
        GSS_SUPER_ADMIN_PASSWORD: "change-this-super-admin-password",
        JWT_ACCESS_SECRET: "test-only-access-secret-that-is-at-least-32-characters",
        JWT_REFRESH_SECRET: "test-only-refresh-secret-that-is-at-least-32-characters",
        MQTT_BROKER_URL: "mqtt://localhost:1883",
        MQTT_TOPIC_BASE: "GSSIOT/test",
        NODE_ENV: "test",
        REDIS_URL: "redis://localhost:6379",
        SENSOR_RETENTION_BATCH_SIZE: "1000",
        SENSOR_RETENTION_MAX_ROWS_PER_CYCLE: "500",
      }),
    ).toThrow("SENSOR_RETENTION_MAX_ROWS_PER_CYCLE");
  });

  it("rejects a deletion lease that cannot cover two heartbeat intervals", () => {
    expect(() =>
      loadApiEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
        DELETION_WORKER_HEARTBEAT_MS: "5000",
        DELETION_WORKER_LEASE_MS: "10000",
        GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
        GSS_SUPER_ADMIN_PASSWORD: "change-this-super-admin-password",
        JWT_ACCESS_SECRET: "test-only-access-secret-that-is-at-least-32-characters",
        JWT_REFRESH_SECRET: "test-only-refresh-secret-that-is-at-least-32-characters",
        MQTT_BROKER_URL: "mqtt://localhost:1883",
        MQTT_TOPIC_BASE: "GSSIOT/test",
        NODE_ENV: "test",
        REDIS_URL: "redis://localhost:6379",
      }),
    ).toThrow("DELETION_WORKER_LEASE_MS");
  });

  it("trims, validates and deduplicates configured CORS origins", () => {
    const env = loadApiEnv({
      CORS_ALLOWED_ORIGINS: " http://localhost:5173, http://127.0.0.1:5173, http://localhost:5173 ",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
      GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
      GSS_SUPER_ADMIN_PASSWORD: "change-this-super-admin-password",
      JWT_ACCESS_SECRET: "test-only-access-secret-that-is-at-least-32-characters",
      JWT_REFRESH_SECRET: "test-only-refresh-secret-that-is-at-least-32-characters",
      MQTT_BROKER_URL: "mqtt://localhost:1883",
      MQTT_TOPIC_BASE: "GSSIOT/01030369081",
      NODE_ENV: "development",
      REDIS_URL: "redis://localhost:6379",
    });

    expect(env.CORS_ALLOWED_ORIGINS).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
  });

  it("does not allow browser origins by default in production", () => {
    const env = loadApiEnv({
      ASSET_S3_ACCESS_KEY_ID: "access-key",
      ASSET_S3_BUCKET: "asset-bucket",
      ASSET_S3_REGION: "ap-northeast-2",
      ASSET_S3_SECRET_ACCESS_KEY: "secret-key",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
      GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
      GSS_SUPER_ADMIN_PASSWORD: "change-this-super-admin-password",
      JWT_ACCESS_SECRET: "test-only-access-secret-that-is-at-least-32-characters",
      JWT_REFRESH_SECRET: "test-only-refresh-secret-that-is-at-least-32-characters",
      MQTT_BROKER_URL: "mqtt://localhost:1883",
      MQTT_TOPIC_BASE: "GSSIOT/01030369081",
      NODE_ENV: "production",
      REPORT_S3_ACCESS_KEY_ID: "access-key",
      REPORT_S3_BUCKET: "report-bucket",
      REPORT_S3_REGION: "ap-northeast-2",
      REPORT_S3_SECRET_ACCESS_KEY: "secret-key",
      REDIS_URL: "redis://localhost:6379",
    });

    expect(env.CORS_ALLOWED_ORIGINS).toEqual([]);
    expect(env.AUTH_COOKIE_SECURE).toBe(true);
    expect(env.ASSET_STORAGE_PROVIDER).toBe("s3");
    expect(env.REPORT_STORAGE_PROVIDER).toBe("s3");
  });

  it("requires private S3 configuration for production report storage", () => {
    expect(() =>
      loadApiEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
        ASSET_S3_ACCESS_KEY_ID: "access-key",
        ASSET_S3_BUCKET: "asset-bucket",
        ASSET_S3_REGION: "ap-northeast-2",
        ASSET_S3_SECRET_ACCESS_KEY: "secret-key",
        GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
        GSS_SUPER_ADMIN_PASSWORD: "change-this-super-admin-password",
        JWT_ACCESS_SECRET: "test-only-access-secret-that-is-at-least-32-characters",
        JWT_REFRESH_SECRET: "test-only-refresh-secret-that-is-at-least-32-characters",
        MQTT_BROKER_URL: "mqtt://localhost:1883",
        MQTT_TOPIC_BASE: "GSSIOT/01030369081",
        NODE_ENV: "production",
        REDIS_URL: "redis://localhost:6379",
      }),
    ).toThrow("REPORT_S3_BUCKET is required");
  });

  it("requires private S3 configuration for production company-logo assets", () => {
    expect(() =>
      loadApiEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
        GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
        GSS_SUPER_ADMIN_PASSWORD: "change-this-super-admin-password",
        JWT_ACCESS_SECRET: "test-only-access-secret-that-is-at-least-32-characters",
        JWT_REFRESH_SECRET: "test-only-refresh-secret-that-is-at-least-32-characters",
        MQTT_BROKER_URL: "mqtt://localhost:1883",
        MQTT_TOPIC_BASE: "GSSIOT/01030369081",
        NODE_ENV: "production",
        REPORT_S3_ACCESS_KEY_ID: "access-key",
        REPORT_S3_BUCKET: "report-bucket",
        REPORT_S3_REGION: "ap-northeast-2",
        REPORT_S3_SECRET_ACCESS_KEY: "secret-key",
        REDIS_URL: "redis://localhost:6379",
      }),
    ).toThrow("ASSET_S3_BUCKET is required");
  });

  it("rejects malformed CORS origins", () => {
    expect(() =>
      loadApiEnv({
        CORS_ALLOWED_ORIGINS: "http://localhost:5173/path",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
        GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
        GSS_SUPER_ADMIN_PASSWORD: "change-this-super-admin-password",
        JWT_ACCESS_SECRET: "test-only-access-secret-that-is-at-least-32-characters",
        JWT_REFRESH_SECRET: "test-only-refresh-secret-that-is-at-least-32-characters",
        MQTT_BROKER_URL: "mqtt://localhost:1883",
        MQTT_TOPIC_BASE: "GSSIOT/01030369081",
        NODE_ENV: "development",
        REDIS_URL: "redis://localhost:6379",
      }),
    ).toThrow("Invalid CORS origin");
  });
});
