import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");
const defaultDevelopmentCorsOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const reportStorageProviderSchema = z.enum(["memory", "local", "s3"]);
const optionalBooleanStringSchema = z.enum(["true", "false", "1", "0"]).optional();

const booleanStringSchema = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((value) => value === "true" || value === "1");

function parseCorsAllowedOrigins(value: string | undefined, nodeEnv: string): string[] {
  const rawOrigins =
    value && value.trim().length > 0
      ? value.split(",").map((origin) => origin.trim())
      : nodeEnv === "production"
        ? []
        : defaultDevelopmentCorsOrigins;

  const origins = rawOrigins
    .filter((origin) => origin.length > 0)
    .map((origin) => {
      const parsed = new URL(origin);
      const normalized = parsed.origin;
      if (origin.replace(/\/$/, "") !== normalized) {
        throw new Error(
          `Invalid CORS origin "${origin}". Use only scheme, host and optional port.`,
        );
      }
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error(`Invalid CORS origin "${origin}". Only http and https are supported.`);
      }
      return normalized;
    });

  return [...new Set(origins)];
}

const rawApiEnvSchema = z
  .object({
    CORS_ALLOWED_ORIGINS: z.string().optional(),
    DATABASE_URL: z.string().url(),
    GSS_SUPER_ADMIN_EMAIL: z.string().email(),
    GSS_SUPER_ADMIN_PASSWORD: z.string().min(12),
    JWT_EXPIRES_IN: z.coerce.number().int().positive().default(900),
    JWT_SECRET: z.string().min(32),
    MQTT_BROKER_URL: z.string().url(),
    MQTT_CLIENT_ID: z.string().min(1).default("gss-iot-v3-api"),
    MQTT_COMMAND_ACK_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    MQTT_COMMAND_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(300),
    MQTT_ENABLED: booleanStringSchema.default(false),
    MQTT_FAKE_ACK: booleanStringSchema.default(false),
    MQTT_MAX_PUBLISH_ATTEMPTS: z.coerce.number().int().positive().default(3),
    MQTT_PASSWORD: z.string().optional(),
    MQTT_PUBLISH_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
    MQTT_TOPIC_BASE: z.string().min(1),
    MQTT_USERNAME: z.string().optional(),
    NODE_ENV: nodeEnvSchema,
    PORT: z.coerce.number().int().positive().default(3000),
    REPORT_CLEANUP_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(100),
    REPORT_CLEANUP_ENABLED: optionalBooleanStringSchema,
    REPORT_CLEANUP_INTERVAL_MS: z.coerce.number().int().min(1_000).default(300_000),
    REPORT_LOCAL_STORAGE_DIR: z.string().min(1).optional(),
    REPORT_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    REPORT_S3_BUCKET: z.string().min(1).optional(),
    REPORT_S3_ENDPOINT: z.string().url().optional(),
    REPORT_S3_FORCE_PATH_STYLE: optionalBooleanStringSchema,
    REPORT_S3_REGION: z.string().min(1).optional(),
    REPORT_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    REPORT_STORAGE_PROVIDER: reportStorageProviderSchema.optional(),
    REPORT_WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),
    REPORT_WORKER_ENABLED: optionalBooleanStringSchema,
    REPORT_WORKER_INTERVAL_MS: z.coerce.number().int().min(1_000).default(30_000),
    REDIS_URL: z.string().url(),
  })
  .superRefine((env, context) => {
    const provider =
      env.REPORT_STORAGE_PROVIDER ?? (env.NODE_ENV === "production" ? "s3" : "local");
    if (env.NODE_ENV === "production" && provider !== "s3") {
      context.addIssue({
        code: "custom",
        message: "Production report storage must use the s3 provider.",
        path: ["REPORT_STORAGE_PROVIDER"],
      });
    }
    if (provider === "s3") {
      for (const [key, value] of [
        ["REPORT_S3_ACCESS_KEY_ID", env.REPORT_S3_ACCESS_KEY_ID],
        ["REPORT_S3_BUCKET", env.REPORT_S3_BUCKET],
        ["REPORT_S3_REGION", env.REPORT_S3_REGION],
        ["REPORT_S3_SECRET_ACCESS_KEY", env.REPORT_S3_SECRET_ACCESS_KEY],
      ] as const) {
        if (!value) {
          context.addIssue({
            code: "custom",
            message: `${key} is required when REPORT_STORAGE_PROVIDER=s3.`,
            path: [key],
          });
        }
      }
    }
  });

export const apiEnvSchema = rawApiEnvSchema.transform((env) => ({
  ...env,
  CORS_ALLOWED_ORIGINS: parseCorsAllowedOrigins(env.CORS_ALLOWED_ORIGINS, env.NODE_ENV),
  REPORT_CLEANUP_ENABLED:
    env.REPORT_CLEANUP_ENABLED === undefined
      ? true
      : env.REPORT_CLEANUP_ENABLED === "true" || env.REPORT_CLEANUP_ENABLED === "1",
  REPORT_LOCAL_STORAGE_DIR: env.REPORT_LOCAL_STORAGE_DIR ?? ".data/report-exports",
  REPORT_S3_FORCE_PATH_STYLE:
    env.REPORT_S3_FORCE_PATH_STYLE === "true" || env.REPORT_S3_FORCE_PATH_STYLE === "1",
  REPORT_STORAGE_PROVIDER:
    env.REPORT_STORAGE_PROVIDER ??
    (env.NODE_ENV === "production" ? "s3" : env.NODE_ENV === "test" ? "memory" : "local"),
  REPORT_WORKER_ENABLED:
    env.REPORT_WORKER_ENABLED === undefined
      ? env.NODE_ENV !== "test"
      : env.REPORT_WORKER_ENABLED === "true" || env.REPORT_WORKER_ENABLED === "1",
}));

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(source);
}
