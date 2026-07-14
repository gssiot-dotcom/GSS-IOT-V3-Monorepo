import "reflect-metadata";
import "dotenv/config";

import { NestFactory } from "@nestjs/core";
import { loadApiEnv } from "@gss-iot/config";

import { AppModule } from "./app.module";
import { configureApiApp } from "./bootstrap";

async function bootstrap(): Promise<void> {
  const env = loadApiEnv();
  const app = await NestFactory.create(AppModule);

  configureApiApp(app, env);

  await app.listen(env.PORT);
}

void bootstrap();
