import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");
const defaultDevelopmentCorsOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

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

const rawApiEnvSchema = z.object({
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
  REDIS_URL: z.string().url(),
});

export const apiEnvSchema = rawApiEnvSchema.transform((env) => ({
  ...env,
  CORS_ALLOWED_ORIGINS: parseCorsAllowedOrigins(env.CORS_ALLOWED_ORIGINS, env.NODE_ENV),
}));

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(source);
}
