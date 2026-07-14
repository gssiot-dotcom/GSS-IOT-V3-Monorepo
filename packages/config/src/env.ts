import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");

export const apiEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  GSS_SUPER_ADMIN_EMAIL: z.string().email(),
  GSS_SUPER_ADMIN_PASSWORD: z.string().min(12),
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(900),
  JWT_SECRET: z.string().min(32),
  MQTT_BROKER_URL: z.string().url(),
  MQTT_TOPIC_BASE: z.string().min(1),
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().positive().default(3000),
  REDIS_URL: z.string().url(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(source);
}
