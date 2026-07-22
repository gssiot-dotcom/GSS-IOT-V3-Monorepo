import { describe, expect, it } from "vitest";

import { loadApiEnv } from "../src";

describe("loadApiEnv", () => {
  it("validates required infrastructure configuration", () => {
    const env = loadApiEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
      GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
      GSS_SUPER_ADMIN_PASSWORD: "change-this-super-admin-password",
      JWT_EXPIRES_IN: "900",
      JWT_SECRET: "test-only-jwt-secret-that-is-at-least-32-characters",
      MQTT_BROKER_URL: "mqtt://localhost:1883",
      MQTT_TOPIC_BASE: "GSSIOT/01030369081",
      NODE_ENV: "test",
      REDIS_URL: "redis://localhost:6379",
    });

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("test");
    expect(env.REPORT_STORAGE_PROVIDER).toBe("memory");
    expect(env.REPORT_WORKER_ENABLED).toBe(false);
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
  });

  it("trims, validates and deduplicates configured CORS origins", () => {
    const env = loadApiEnv({
      CORS_ALLOWED_ORIGINS: " http://localhost:5173, http://127.0.0.1:5173, http://localhost:5173 ",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
      GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
      GSS_SUPER_ADMIN_PASSWORD: "change-this-super-admin-password",
      JWT_SECRET: "test-only-jwt-secret-that-is-at-least-32-characters",
      MQTT_BROKER_URL: "mqtt://localhost:1883",
      MQTT_TOPIC_BASE: "GSSIOT/01030369081",
      NODE_ENV: "development",
      REDIS_URL: "redis://localhost:6379",
    });

    expect(env.CORS_ALLOWED_ORIGINS).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
  });

  it("does not allow browser origins by default in production", () => {
    const env = loadApiEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
      GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
      GSS_SUPER_ADMIN_PASSWORD: "change-this-super-admin-password",
      JWT_SECRET: "test-only-jwt-secret-that-is-at-least-32-characters",
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
    expect(env.REPORT_STORAGE_PROVIDER).toBe("s3");
  });

  it("requires private S3 configuration for production report storage", () => {
    expect(() =>
      loadApiEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
        GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
        GSS_SUPER_ADMIN_PASSWORD: "change-this-super-admin-password",
        JWT_SECRET: "test-only-jwt-secret-that-is-at-least-32-characters",
        MQTT_BROKER_URL: "mqtt://localhost:1883",
        MQTT_TOPIC_BASE: "GSSIOT/01030369081",
        NODE_ENV: "production",
        REDIS_URL: "redis://localhost:6379",
      }),
    ).toThrow("REPORT_S3_BUCKET is required");
  });

  it("rejects malformed CORS origins", () => {
    expect(() =>
      loadApiEnv({
        CORS_ALLOWED_ORIGINS: "http://localhost:5173/path",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
        GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
        GSS_SUPER_ADMIN_PASSWORD: "change-this-super-admin-password",
        JWT_SECRET: "test-only-jwt-secret-that-is-at-least-32-characters",
        MQTT_BROKER_URL: "mqtt://localhost:1883",
        MQTT_TOPIC_BASE: "GSSIOT/01030369081",
        NODE_ENV: "development",
        REDIS_URL: "redis://localhost:6379",
      }),
    ).toThrow("Invalid CORS origin");
  });
});
