import { describe, expect, it } from "vitest";

import { loadApiEnv } from "../src";

describe("loadApiEnv", () => {
  it("validates required infrastructure configuration", () => {
    const env = loadApiEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/gss_iot_v3",
      MQTT_BROKER_URL: "mqtt://localhost:1883",
      MQTT_TOPIC_BASE: "GSSIOT/01030369081",
      NODE_ENV: "test",
      REDIS_URL: "redis://localhost:6379",
    });

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("test");
  });
});
