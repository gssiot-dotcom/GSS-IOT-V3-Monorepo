import "./setup-env";

import { execSync } from "node:child_process";
import { resolve } from "node:path";

process.env.MQTT_ENABLED = "false";
process.env.MQTT_FAKE_ACK = "true";
process.env.REPORT_WORKER_ENABLED = "false";

const e2eSchema = process.env.GSS_E2E_SCHEMA ?? "gss_iot_v3_e2e";
const baseDatabaseUrl = process.env.DATABASE_URL!;
const databaseUrl = new URL(baseDatabaseUrl);
databaseUrl.searchParams.set("schema", e2eSchema);
process.env.GSS_E2E_BASE_DATABASE_URL ??= baseDatabaseUrl;
process.env.DATABASE_URL = databaseUrl.toString();

if (process.env.GSS_E2E_SKIP_MIGRATE !== "true" && process.env.GSS_E2E_MIGRATED !== "true") {
  execSync("pnpm exec prisma migrate deploy", {
    cwd: resolve(__dirname, ".."),
    env: process.env,
    stdio: "inherit",
  });
  process.env.GSS_E2E_MIGRATED = "true";
}
