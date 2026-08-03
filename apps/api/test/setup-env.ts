import "dotenv/config";

process.env.DATABASE_URL ??=
  "postgresql://postgres:yusuf2766@localhost:5432/gss_iot_v3?schema=public";
process.env.GSS_SUPER_ADMIN_EMAIL ??= "admin@example.com";
process.env.GSS_SUPER_ADMIN_PASSWORD ??= "change-this-super-admin-password";
process.env.JWT_ACCESS_EXPIRES_IN ??= "900";
process.env.JWT_ACCESS_SECRET ??= "test-only-access-secret-that-is-at-least-32-characters";
process.env.JWT_REFRESH_EXPIRES_IN ??= "2592000";
process.env.JWT_REFRESH_SECRET ??= "test-only-refresh-secret-that-is-at-least-32-characters";
process.env.MQTT_BROKER_URL ??= "mqtt://localhost:1883";
process.env.MQTT_ENABLED ??= "false";
process.env.MQTT_FAKE_ACK ??= "false";
process.env.MQTT_TOPIC_BASE ??= "GSSIOT/test";
process.env.NODE_OFFLINE_EVALUATOR_ENABLED ??= "false";
process.env.REPORT_STORAGE_PROVIDER ??= "memory";
process.env.REPORT_WORKER_ENABLED ??= "false";
process.env.REDIS_URL ??= "redis://localhost:6379";
