import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import type { ApiEnv } from "@gss-iot/config";

export function createCorsOptions(env: Pick<ApiEnv, "CORS_ALLOWED_ORIGINS">): CorsOptions {
  const allowedOrigins = new Set(env.CORS_ALLOWED_ORIGINS);

  return {
    allowedHeaders: ["authorization", "content-type"],
    credentials: false,
    methods: ["GET", "POST", "OPTIONS"],
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
