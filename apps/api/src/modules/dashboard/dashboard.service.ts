import { Inject, Injectable } from "@nestjs/common";
import { AlarmEventStatus, AssignmentStatus, SensorReadingStatus } from "@prisma/client";
import type { DashboardRange, DashboardSummary } from "@gss-iot/contracts";
import type { Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AUTH_CONTEXT } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionResolverService } from "../rbac/permission-resolver.service";
import { ReportScopeService } from "../reports/report-scope.service";

const rangeDays: Record<DashboardRange, number> = { "7d": 7, "30d": 30, "90d": 90 };
const severityKeys: SensorReadingStatus[] = [
  SensorReadingStatus.SAFE,
  SensorReadingStatus.CAUTION,
  SensorReadingStatus.WARNING,
  SensorReadingStatus.DANGER,
  SensorReadingStatus.OFFLINE,
  SensorReadingStatus.UNCONFIGURED,
];

interface DashboardScope {
  areaIds?: string[];
  buildingIds?: string[];
  companyId?: string;
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PermissionResolverService) private readonly permissions: PermissionResolverService,
    @Inject(ReportScopeService) private readonly reportScope: ReportScopeService,
  ) {}

  async getSummary(auth: AuthTokenPayload, range: DashboardRange): Promise<DashboardSummary> {
    const now = new Date();
    const from = new Date(now.getTime() - rangeDays[range] * 24 * 60 * 60 * 1000);
    const resolution = await this.permissions.resolve(auth.context, auth.sub);
    const can = (permission: string) =>
      resolution.isSuperAdmin || resolution.permissions.has(permission);
    const scope: DashboardScope =
      auth.context === AUTH_CONTEXT.companyUser ? await this.resolveCompanyScope(auth) : {};
    const summary: DashboardSummary = {
      kpis: {},
      range: { from: from.toISOString(), key: range, to: now.toISOString() },
    };

    if (auth.context === AUTH_CONTEXT.gssAdmin && can("companies.view")) {
      const [activeCompanies, activeSites, activeBuildings] = await Promise.all([
        this.prisma.company.count({ where: { status: "ACTIVE" } }),
        this.prisma.constructionArea.count({ where: { status: "ACTIVE" } }),
        this.prisma.constructionBuilding.count({ where: { status: "ACTIVE" } }),
      ]);
      summary.kpis.activeCompanies = activeCompanies;
      summary.kpis.activeSites = activeSites;
      summary.kpis.activeBuildings = activeBuildings;
    } else if (auth.context === AUTH_CONTEXT.companyUser) {
      const locationWhere = this.locationWhere(scope);
      const [activeSites, activeBuildings] = await Promise.all([
        this.prisma.constructionArea.count({
          where: { companyId: scope.companyId, id: { in: scope.areaIds ?? [] }, status: "ACTIVE" },
        }),
        this.prisma.constructionBuilding.count({ where: { ...locationWhere, status: "ACTIVE" } }),
      ]);
      summary.kpis.activeSites = activeSites;
      summary.kpis.activeBuildings = activeBuildings;
    }

    if (can(auth.context === AUTH_CONTEXT.gssAdmin ? "devices.view" : "company-devices.view")) {
      const deviceSummary = await this.deviceSummary(
        scope,
        now,
        auth.context === AUTH_CONTEXT.gssAdmin,
      );
      summary.kpis = { ...summary.kpis, ...deviceSummary.kpis };
      summary.gateways = deviceSummary.gateways;
      summary.nodesByLifecycle = deviceSummary.nodesByLifecycle;
    }

    if (can("monitoring.view")) {
      const monitoring = await this.monitoringSummary(scope, from);
      summary.kpis = { ...summary.kpis, ...monitoring.kpis };
      summary.severityDistribution = monitoring.severityDistribution;
      summary.telemetryTrend = monitoring.telemetryTrend;
    }

    if (can("alarms.view")) {
      summary.openAlarmsBySeverity = await this.alarmSummary(scope);
    }

    if (auth.context === AUTH_CONTEXT.gssAdmin && can("mqtt-commands.view")) {
      const commandSummary = await this.commandSummary(scope, from);
      summary.commandStatus = commandSummary.status;
      summary.recentCommandFailures = commandSummary.failures;
    }

    return summary;
  }

  private async deviceSummary(scope: DashboardScope, now: Date, global: boolean) {
    const gatewayWhere = this.gatewayWhere(scope, global);
    const nodeWhere = this.nodeWhere(scope, global);
    const [gateways, offlineGateways, unassignedGateways, nodes, unassignedNodes, lifecycle] =
      await Promise.all([
        this.prisma.gateway.count({ where: gatewayWhere }),
        this.prisma.gateway.count({
          where: {
            AND: [
              gatewayWhere,
              {
                OR: [
                  { lastSeenAt: null },
                  { lastSeenAt: { lt: new Date(now.getTime() - 5 * 60 * 1000) } },
                ],
              },
            ],
          },
        }),
        this.prisma.gateway.count({
          where: {
            ...gatewayWhere,
            companyAssignments: { none: { status: AssignmentStatus.ACTIVE } },
            buildingAssignments: { none: { status: AssignmentStatus.ACTIVE } },
          },
        }),
        this.prisma.node.count({ where: nodeWhere }),
        this.prisma.node.count({
          where: {
            ...nodeWhere,
            companyAssignments: { none: { status: AssignmentStatus.ACTIVE } },
            gatewayAssignments: { none: { status: AssignmentStatus.ACTIVE } },
          },
        }),
        this.prisma.node.groupBy({ by: ["status"], _count: { _all: true }, where: nodeWhere }),
      ]);
    return {
      gateways: {
        offline: offlineGateways,
        online: Math.max(0, gateways - offlineGateways),
        unassigned: unassignedGateways,
      },
      kpis: { gateways, gatewaysOffline: offlineGateways, nodes, nodesUnassigned: unassignedNodes },
      nodesByLifecycle: Object.fromEntries(
        lifecycle.map((item) => [item.status, item._count._all]),
      ),
    } satisfies Partial<DashboardSummary>;
  }

  private async resolveCompanyScope(auth: AuthTokenPayload): Promise<DashboardScope> {
    const resolved = await this.reportScope.resolve(auth, {});
    return {
      areaIds: resolved.allowedAreaIds ?? [],
      buildingIds: resolved.allowedBuildingIds ?? [],
      companyId: resolved.companyId,
    };
  }

  private async monitoringSummary(scope: DashboardScope, from: Date) {
    const where = this.locationReadingWhere(scope);
    const [readings, states, trendRows] = await Promise.all([
      this.prisma.sensorReading.count({ where: { ...where, receivedAt: { gte: from } } }),
      this.prisma.latestNodeState.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: this.locationStateWhere(scope),
      }),
      this.prisma.sensorReading.findMany({
        orderBy: { receivedAt: "asc" },
        select: { receivedAt: true },
        take: 10000,
        where: { ...where, receivedAt: { gte: from } },
      }),
    ]);
    const distribution = Object.fromEntries(
      severityKeys.map((key) => [key.toLowerCase(), 0]),
    ) as Record<string, number>;
    for (const state of states) {
      distribution[state.status.toLowerCase()] = state._count?._all ?? 0;
    }
    const trend = new Map<string, number>();
    for (const row of trendRows) {
      const date = row.receivedAt.toISOString().slice(0, 10);
      trend.set(date, (trend.get(date) ?? 0) + 1);
    }
    return {
      kpis: { telemetryReadings: readings },
      severityDistribution: distribution as DashboardSummary["severityDistribution"],
      telemetryTrend: [...trend.entries()].map(([date, count]) => ({ count, date })),
    } satisfies Partial<DashboardSummary>;
  }

  private async alarmSummary(scope: DashboardScope) {
    const rows = await this.prisma.alarmEvent.groupBy({
      _count: { _all: true },
      by: ["severity"],
      where: {
        ...this.locationAlarmWhere(scope),
        status: { in: [AlarmEventStatus.OPEN, AlarmEventStatus.ACKNOWLEDGED] },
      },
    });
    return Object.fromEntries(rows.map((row) => [row.severity, row._count._all])) as Record<
      "CAUTION" | "WARNING" | "DANGER",
      number
    >;
  }

  private async commandSummary(scope: DashboardScope, from: Date) {
    const where = { createdAt: { gte: from }, gateway: this.gatewayWhere(scope, true) };
    const [statuses, failures] = await Promise.all([
      this.prisma.gatewayCommand.groupBy({ _count: { _all: true }, by: ["status"], where }),
      this.prisma.gatewayCommand.findMany({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, failureReason: true, id: true },
        take: 5,
        where: { ...where, status: "FAILED" },
      }),
    ]);
    return {
      failures: failures.map((failure) => ({
        ...failure,
        createdAt: failure.createdAt.toISOString(),
      })),
      status: Object.fromEntries(statuses.map((status) => [status.status, status._count._all])),
    };
  }

  private locationWhere(scope: DashboardScope): Prisma.ConstructionBuildingWhereInput {
    return {
      ...(scope.companyId ? { companyId: scope.companyId } : {}),
      ...(scope.buildingIds ? { id: { in: scope.buildingIds } } : {}),
    };
  }

  private locationReadingWhere(scope: DashboardScope): Prisma.SensorReadingWhereInput {
    return {
      ...(scope.companyId ? { companyId: scope.companyId } : {}),
      ...(scope.buildingIds ? { buildingId: { in: scope.buildingIds } } : {}),
    };
  }

  private locationStateWhere(scope: DashboardScope): Prisma.LatestNodeStateWhereInput {
    return {
      ...(scope.companyId ? { companyId: scope.companyId } : {}),
      ...(scope.buildingIds ? { buildingId: { in: scope.buildingIds } } : {}),
    };
  }

  private locationAlarmWhere(scope: DashboardScope): Prisma.AlarmEventWhereInput {
    return {
      ...(scope.companyId ? { companyId: scope.companyId } : {}),
      ...(scope.buildingIds ? { buildingId: { in: scope.buildingIds } } : {}),
    };
  }

  private gatewayWhere(scope: DashboardScope, global: boolean): Prisma.GatewayWhereInput {
    if (global) return {};
    return {
      OR: [
        {
          companyAssignments: {
            some: { companyId: scope.companyId, status: AssignmentStatus.ACTIVE },
          },
        },
        {
          buildingAssignments: {
            some: {
              building: { companyId: scope.companyId, id: { in: scope.buildingIds ?? [] } },
              status: AssignmentStatus.ACTIVE,
            },
          },
        },
      ],
    };
  }

  private nodeWhere(scope: DashboardScope, global: boolean): Prisma.NodeWhereInput {
    if (global) return {};
    return {
      OR: [
        {
          companyAssignments: {
            some: { companyId: scope.companyId, status: AssignmentStatus.ACTIVE },
          },
        },
        {
          gatewayAssignments: {
            some: {
              gateway: this.gatewayWhere(scope, false),
              status: AssignmentStatus.ACTIVE,
            },
          },
        },
      ],
    };
  }
}
