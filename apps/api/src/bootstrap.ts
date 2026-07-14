import { ValidationPipe, type INestApplication } from "@nestjs/common";
import type { ApiEnv } from "@gss-iot/config";

import { createCorsOptions } from "./common/cors";

export function configureApiApp(app: INestApplication, env: ApiEnv): void {
  app.enableCors(createCorsOptions(env));

  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
}
