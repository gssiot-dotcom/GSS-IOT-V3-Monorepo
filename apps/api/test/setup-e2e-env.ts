import "./setup-env";

import { PrismaClient } from "@prisma/client";
import { beforeAll } from "vitest";

process.env.MQTT_ENABLED = "false";
process.env.MQTT_FAKE_ACK = "true";
process.env.REPORT_WORKER_ENABLED = "false";

const e2eSchema = process.env.GSS_E2E_SCHEMA ?? "gss_iot_v3_e2e";
const baseDatabaseUrl = process.env.DATABASE_URL!;
const databaseUrl = new URL(baseDatabaseUrl);
databaseUrl.searchParams.set("schema", e2eSchema);
process.env.GSS_E2E_BASE_DATABASE_URL ??= baseDatabaseUrl;
process.env.DATABASE_URL = databaseUrl.toString();

beforeAll(async () => {
  if (process.env.GSS_E2E_SKIP_RESET === "true") return;
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw<
      Array<{ schema: string }>
    >`SELECT current_schema() AS schema`;
    const schema = rows[0]?.schema;
    if (schema !== e2eSchema || schema === "public") {
      throw new Error(`Refusing E2E reset for unexpected schema: ${schema ?? "unknown"}`);
    }
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
      ORDER BY tablename
    `;
    if (tables.length) {
      const identifiers = tables
        .map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
        .join(", ");
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await prisma.$disconnect();
  }
});
