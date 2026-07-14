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
      REDIS_URL: "redis://localhost:6379",
    });

    expect(env.CORS_ALLOWED_ORIGINS).toEqual([]);
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
