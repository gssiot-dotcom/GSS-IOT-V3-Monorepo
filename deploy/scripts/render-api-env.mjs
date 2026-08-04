import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const definitions = [
  ["NODE_ENV", { defaultValue: "production" }],
  ["PORT", { defaultValue: "3000" }],
  ["CORS_ALLOWED_ORIGINS", { required: true }],
  ["DATABASE_URL", { required: true }],
  ["DELETION_WORKER_ENABLED", { defaultValue: "false" }],
  ["DELETION_WORKER_INTERVAL_MS", { defaultValue: "5000" }],
  ["DELETION_WORKER_BATCH_SIZE", { defaultValue: "250" }],
  ["DELETION_WORKER_HEARTBEAT_MS", { defaultValue: "5000" }],
  ["DELETION_WORKER_LEASE_MS", { defaultValue: "30000" }],
  ["ASSET_STORAGE_PROVIDER", { defaultValue: "s3" }],
  ["ASSET_S3_ENDPOINT", { optional: true }],
  ["ASSET_S3_REGION", { required: true }],
  ["ASSET_S3_BUCKET", { required: true }],
  ["ASSET_S3_ACCESS_KEY_ID", { required: true }],
  ["ASSET_S3_SECRET_ACCESS_KEY", { required: true }],
  ["ASSET_S3_FORCE_PATH_STYLE", { defaultValue: "false" }],
  ["REPORT_STORAGE_PROVIDER", { defaultValue: "s3" }],
  ["REPORT_S3_ENDPOINT", { optional: true }],
  ["REPORT_S3_REGION", { required: true }],
  ["REPORT_S3_BUCKET", { required: true }],
  ["REPORT_S3_ACCESS_KEY_ID", { required: true }],
  ["REPORT_S3_SECRET_ACCESS_KEY", { required: true }],
  ["REPORT_S3_FORCE_PATH_STYLE", { defaultValue: "false" }],
  ["REPORT_WORKER_ENABLED", { defaultValue: "true" }],
  ["REPORT_WORKER_INTERVAL_MS", { defaultValue: "30000" }],
  ["REPORT_WORKER_BATCH_SIZE", { defaultValue: "10" }],
  ["REPORT_CLEANUP_ENABLED", { defaultValue: "true" }],
  ["REPORT_CLEANUP_INTERVAL_MS", { defaultValue: "300000" }],
  ["REPORT_CLEANUP_BATCH_SIZE", { defaultValue: "100" }],
  ["MQTT_BROKER_URL", { required: true }],
  ["MQTT_CLIENT_ID", { required: true }],
  ["MQTT_COMMAND_ACK_TIMEOUT_MS", { defaultValue: "30000" }],
  ["MQTT_COMMAND_EXPIRES_IN_SECONDS", { defaultValue: "300" }],
  ["MQTT_ENABLED", { defaultValue: "true" }],
  ["MQTT_FAKE_ACK", { defaultValue: "false" }],
  ["MQTT_MAX_PUBLISH_ATTEMPTS", { defaultValue: "3" }],
  ["MQTT_PASSWORD", { optional: true }],
  ["MQTT_PUBLISH_TIMEOUT_MS", { defaultValue: "5000" }],
  ["MQTT_TOPIC_BASE", { required: true }],
  ["MQTT_USERNAME", { optional: true }],
  ["NODE_OFFLINE_BATCH_SIZE", { defaultValue: "250" }],
  ["NODE_OFFLINE_EVALUATOR_ENABLED", { defaultValue: "true" }],
  ["NODE_OFFLINE_SWEEP_INTERVAL_MS", { defaultValue: "10000" }],
  ["JWT_ACCESS_SECRET", { required: true }],
  ["JWT_REFRESH_SECRET", { required: true }],
  ["JWT_ACCESS_EXPIRES_IN", { defaultValue: "900" }],
  ["JWT_REFRESH_EXPIRES_IN", { defaultValue: "2592000" }],
  ["AUTH_COOKIE_SECURE", { defaultValue: "true" }],
  ["AUTH_COOKIE_SAME_SITE", { defaultValue: "lax" }],
  ["AUTH_COOKIE_DOMAIN", { optional: true }],
  ["AUTH_ACCESS_COOKIE_NAME", { defaultValue: "gss_access" }],
  ["AUTH_REFRESH_COOKIE_NAME", { defaultValue: "gss_refresh" }],
  ["AUTH_CSRF_COOKIE_NAME", { defaultValue: "gss_csrf" }],
  ["GSS_SUPER_ADMIN_EMAIL", { required: true }],
  ["GSS_SUPER_ADMIN_PASSWORD", { required: true }],
  ["SENSOR_RETENTION_BATCH_SIZE", { defaultValue: "1000" }],
  ["SENSOR_RETENTION_DAYS", { defaultValue: "180" }],
  ["SENSOR_RETENTION_DRY_RUN", { defaultValue: "true" }],
  ["SENSOR_RETENTION_ENABLED", { defaultValue: "false" }],
  ["SENSOR_RETENTION_INTERVAL_MS", { defaultValue: "3600000" }],
  ["SENSOR_RETENTION_MAX_ROWS_PER_CYCLE", { defaultValue: "10000" }],
];

const enforcedProductionValues = new Map([
  ["ASSET_STORAGE_PROVIDER", "s3"],
  ["AUTH_COOKIE_SECURE", "true"],
  ["DELETION_WORKER_ENABLED", "false"],
  ["MQTT_ENABLED", "true"],
  ["MQTT_FAKE_ACK", "false"],
  ["NODE_ENV", "production"],
  ["REPORT_STORAGE_PROVIDER", "s3"],
  ["SENSOR_RETENTION_DRY_RUN", "true"],
  ["SENSOR_RETENTION_ENABLED", "false"],
]);

function readValue(source, name, definition) {
  const candidate = source[name];
  const value = candidate === undefined || candidate === "" ? definition.defaultValue : candidate;

  if ((value === undefined || value === "") && definition.required) {
    throw new Error(`${name} is required.`);
  }
  if ((value === undefined || value === "") && definition.optional) return undefined;
  if (value === undefined) return undefined;
  if (value.includes("\n") || value.includes("\r") || value.includes("\0")) {
    throw new Error(`${name} must be a single-line value.`);
  }
  if (value.trim() !== value) throw new Error(`${name} must not have surrounding whitespace.`);
  return value;
}

export function buildApiEnv(source = process.env) {
  const entries = definitions.flatMap(([name, definition]) => {
    const value = readValue(source, name, definition);
    if (value === undefined) return [];
    return [[name, value]];
  });
  const values = new Map(entries);

  for (const [name, expected] of enforcedProductionValues) {
    if (values.get(name) !== expected) {
      throw new Error(`${name} must be ${expected} for the approved production deployment.`);
    }
  }
  if (values.get("JWT_ACCESS_SECRET") === values.get("JWT_REFRESH_SECRET")) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.");
  }
  if (values.has("AUTH_COOKIE_DOMAIN")) {
    throw new Error(
      "AUTH_COOKIE_DOMAIN must be omitted so V3 auth cookies remain host-only on the API domain.",
    );
  }

  return `${entries.map(([name, value]) => `${name}=${value}`).join("\n")}\n`;
}

export async function writeApiEnv(targetPath, source = process.env) {
  const resolvedTarget = resolve(targetPath);
  await mkdir(dirname(resolvedTarget), { recursive: true });
  await writeFile(resolvedTarget, buildApiEnv(source), { encoding: "utf8", mode: 0o600 });
  await chmod(resolvedTarget, 0o600);
  return resolvedTarget;
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const targetPath = process.argv[2];
  if (!targetPath) throw new Error("Usage: node render-api-env.mjs <target-path>");
  const writtenPath = await writeApiEnv(targetPath);
  process.stdout.write(`Rendered production API environment to ${writtenPath}\n`);
}
