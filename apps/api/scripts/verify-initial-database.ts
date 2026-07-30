import { PrismaClient } from "@prisma/client";
import { loadApiEnv } from "@gss-iot/config";

const prisma = new PrismaClient();

type VerificationMode = "empty" | "seeded";

function readMode(): VerificationMode {
  const value = process.argv.find((argument) => argument.startsWith("--mode="))?.split("=")[1];
  if (value === "empty" || value === "seeded") {
    return value;
  }
  throw new Error("Pass --mode=empty or --mode=seeded.");
}

function assertSafeDevelopmentTarget(databaseUrl: string): {
  database: string;
  host: string;
  schema: string;
} {
  const url = new URL(databaseUrl);
  const target = {
    database: url.pathname.replace(/^\//, ""),
    host: url.hostname,
    schema: url.searchParams.get("schema") ?? "public",
  };

  if (
    !["localhost", "127.0.0.1"].includes(target.host) ||
    target.database !== "gss_iot_v3" ||
    target.schema !== "public" ||
    process.env.NODE_ENV === "production"
  ) {
    throw new Error(
      `Unsafe database target: host=${target.host}, database=${target.database}, schema=${target.schema}, NODE_ENV=${process.env.NODE_ENV ?? "unset"}`,
    );
  }

  return target;
}

async function operationalCounts(): Promise<Record<string, number>> {
  const [
    alarmCounterStates,
    alarmDeliveryLogs,
    alarmEvents,
    alarmNotifications,
    alarmRecipientPolicies,
    alarmRules,
    auditLogs,
    buildingImages,
    buildings,
    companyDeviceAssignments,
    companyPositions,
    companyUsers,
    companies,
    constructionSites,
    deletionJobs,
    gatewayBuildingAssignments,
    gatewayCommands,
    gateways,
    latestNodeStates,
    nodeGatewayAssignments,
    nodes,
    provisioningEndedAssignments,
    provisioningItems,
    provisioningRequests,
    purgeReceipts,
    reportExports,
    reportJobs,
    sensorReadings,
    tenantCompanyRoles,
  ] = await Promise.all([
    prisma.alarmCounterState.count(),
    prisma.alarmDeliveryLog.count(),
    prisma.alarmEvent.count(),
    prisma.alarmNotification.count(),
    prisma.alarmRecipientPolicy.count(),
    prisma.alarmRule.count(),
    prisma.auditLog.count(),
    prisma.buildingPlanImage.count(),
    prisma.constructionBuilding.count(),
    prisma.companyDeviceAssignment.count(),
    prisma.companyPosition.count(),
    prisma.companyUser.count(),
    prisma.company.count(),
    prisma.constructionArea.count(),
    prisma.deletionJob.count(),
    prisma.gatewayBuildingAssignment.count(),
    prisma.gatewayCommand.count(),
    prisma.gateway.count(),
    prisma.latestNodeState.count(),
    prisma.nodeGatewayAssignment.count(),
    prisma.node.count(),
    prisma.nodeGatewayProvisioningEndedAssignment.count(),
    prisma.nodeGatewayProvisioningItem.count(),
    prisma.nodeGatewayProvisioningRequest.count(),
    prisma.purgeReceipt.count(),
    prisma.reportExport.count(),
    prisma.reportJob.count(),
    prisma.sensorReading.count(),
    prisma.companyRole.count({ where: { companyId: { not: null } } }),
  ]);

  return {
    alarmCounterStates,
    alarmDeliveryLogs,
    alarmEvents,
    alarmNotifications,
    alarmRecipientPolicies,
    alarmRules,
    auditLogs,
    buildingImages,
    buildings,
    companyDeviceAssignments,
    companyPositions,
    companyUsers,
    companies,
    constructionSites,
    deletionJobs,
    gatewayBuildingAssignments,
    gatewayCommands,
    gateways,
    latestNodeStates,
    nodeGatewayAssignments,
    nodes,
    provisioningEndedAssignments,
    provisioningItems,
    provisioningRequests,
    purgeReceipts,
    reportExports,
    reportJobs,
    sensorReadings,
    tenantCompanyRoles,
  };
}

function assertAllZero(counts: Record<string, number>, label: string): void {
  const nonZero = Object.entries(counts).filter(([, count]) => count !== 0);
  if (nonZero.length > 0) {
    throw new Error(`${label} is not empty: ${JSON.stringify(Object.fromEntries(nonZero))}`);
  }
}

async function main(): Promise<void> {
  const mode = readMode();
  const env = loadApiEnv();
  const target = assertSafeDevelopmentTarget(env.DATABASE_URL);
  const operational = await operationalCounts();
  assertAllZero(operational, "Operational database state");

  const staticCounts = {
    companyRoleTemplates: await prisma.companyRole.count({ where: { companyId: null } }),
    gssAdmins: await prisma.gssAdminUser.count(),
    gssRoles: await prisma.gssRole.count(),
    nodeTypes: await prisma.nodeType.count(),
    permissions: await prisma.permission.count(),
  };

  if (mode === "empty") {
    assertAllZero(staticCounts, "Pre-seed catalog state");
  } else {
    const admin = await prisma.gssAdminUser.findUnique({
      where: { email: env.GSS_SUPER_ADMIN_EMAIL.toLowerCase() },
      select: {
        email: true,
        isActive: true,
        role: { select: { isSuperAdmin: true, key: true } },
      },
    });
    const requiredPermissions = await prisma.permission.findMany({
      where: { key: { in: ["archive.view", "archive.purge", "sensor-readings.purge"] } },
      select: { key: true },
      orderBy: { key: "asc" },
    });

    if (!admin?.isActive || !admin.role.isSuperAdmin || admin.role.key !== "gss_super_admin") {
      throw new Error("The configured seeded GSS Super Admin is missing or inactive.");
    }
    if (requiredPermissions.length !== 3) {
      throw new Error("One or more required archive/retention permissions are missing.");
    }
    if (
      staticCounts.permissions === 0 ||
      staticCounts.gssRoles === 0 ||
      staticCounts.nodeTypes === 0 ||
      staticCounts.companyRoleTemplates === 0
    ) {
      throw new Error(`Seed catalog is incomplete: ${JSON.stringify(staticCounts)}`);
    }

    console.log(
      JSON.stringify(
        {
          admin: { email: admin.email, isActive: admin.isActive, role: admin.role.key },
          requiredPermissions: requiredPermissions.map(({ key }) => key),
          staticCounts,
        },
        null,
        2,
      ),
    );
  }

  console.log(JSON.stringify({ mode, operational, target }, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
