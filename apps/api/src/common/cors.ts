import type { ApiEnv } from "@gss-iot/config";
import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

export function createCorsOptions(env: Pick<ApiEnv, "CORS_ALLOWED_ORIGINS">): CorsOptions {
  const allowedOrigins = new Set(env.CORS_ALLOWED_ORIGINS);

  return {
    allowedHeaders: ["accept-language", "content-type", "x-csrf-token"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.has(origin));
    },
    optionsSuccessStatus: 204,
  };
}
