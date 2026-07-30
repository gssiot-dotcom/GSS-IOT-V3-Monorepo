import "./setup-env";

import { execSync } from "node:child_process";
import { resolve } from "node:path";

process.env.NODE_ENV = "test";
process.env.MQTT_ENABLED = "false";
process.env.REPORT_WORKER_ENABLED = "false";
process.env.SENSOR_RETENTION_BATCH_SIZE = "1000";
process.env.SENSOR_RETENTION_DAYS = "1";
process.env.SENSOR_RETENTION_DRY_RUN = "false";
process.env.SENSOR_RETENTION_ENABLED = "false";
process.env.SENSOR_RETENTION_MAX_ROWS_PER_CYCLE = "100000";

const databaseUrl = new URL(process.env.DATABASE_URL!);
databaseUrl.searchParams.set(
  "schema",
  process.env.GSS_PERFORMANCE_SCHEMA ?? "gss_iot_v3_performance",
);
process.env.DATABASE_URL = databaseUrl.toString();

execSync("pnpm exec prisma migrate deploy", {
  cwd: resolve(__dirname, ".."),
  env: process.env,
  stdio: "inherit",
});
