import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildApiEnv } from "./render-api-env.mjs";

const required = {
  ASSET_S3_ACCESS_KEY_ID: "asset-access-key",
  ASSET_S3_BUCKET: "gss-assets",
  ASSET_S3_REGION: "ap-northeast-2",
  ASSET_S3_SECRET_ACCESS_KEY: "asset-secret-key",
  CORS_ALLOWED_ORIGINS: "https://app.example.com",
  DATABASE_URL: "postgresql://gss:password@db.internal:5432/gss_iot_v3",
  GSS_SUPER_ADMIN_EMAIL: "admin@example.com",
  GSS_SUPER_ADMIN_PASSWORD: "a-production-password-with-32-characters",
  JWT_ACCESS_SECRET: "a-distinct-access-secret-with-at-least-32-characters",
  JWT_REFRESH_SECRET: "a-distinct-refresh-secret-with-at-least-32-characters",
  MQTT_BROKER_URL: "mqtt://gssiot.iptime.org:10200?token=$literal-value",
  MQTT_CLIENT_ID: "gss-iot-v3-production-api",
  MQTT_TOPIC_BASE: "GSSIOT/01030369081",
  REPORT_S3_ACCESS_KEY_ID: "report-access-key",
  REPORT_S3_BUCKET: "gss-reports",
  REPORT_S3_REGION: "ap-northeast-2",
  REPORT_S3_SECRET_ACCESS_KEY: "report-secret-key",
};

describe("production API environment renderer", () => {
  it("uses exact application keys and fail-safe production defaults", () => {
    const output = buildApiEnv(required);

    assert.match(output, /^NODE_ENV=production$/m);
    assert.match(
      output,
      /^DATABASE_URL=postgresql:\/\/gss:password@db\.internal:5432\/gss_iot_v3$/m,
    );
    assert.match(output, /^MQTT_BROKER_URL=.*\$literal-value$/m);
    assert.match(output, /^MQTT_ENABLED=true$/m);
    assert.match(output, /^MQTT_FAKE_ACK=false$/m);
    assert.match(output, /^DELETION_WORKER_ENABLED=false$/m);
    assert.match(output, /^SENSOR_RETENTION_ENABLED=false$/m);
    assert.doesNotMatch(output, /^AUTH_COOKIE_DOMAIN=/m);
    assert.doesNotMatch(output, /REDIS_URL/);
  });

  it("rejects missing secrets, unsafe production switches and multiline values", () => {
    assert.throws(() => buildApiEnv({ ...required, DATABASE_URL: "" }), /DATABASE_URL is required/);
    assert.throws(
      () => buildApiEnv({ ...required, MQTT_FAKE_ACK: "true" }),
      /MQTT_FAKE_ACK must be false/,
    );
    assert.throws(
      () => buildApiEnv({ ...required, MQTT_PASSWORD: "first\nsecond" }),
      /single-line value/,
    );
    assert.throws(
      () => buildApiEnv({ ...required, MQTT_PASSWORD: " trailing-space " }),
      /surrounding whitespace/,
    );
    assert.throws(
      () => buildApiEnv({ ...required, AUTH_COOKIE_DOMAIN: ".infogssiot.com" }),
      /AUTH_COOKIE_DOMAIN must be omitted/,
    );
  });
});
