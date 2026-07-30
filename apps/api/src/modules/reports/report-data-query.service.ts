import { Inject, Injectable } from "@nestjs/common";
import { AssignmentStatus, ReportType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { ArchiveQueryService } from "../archive/archive-query.service";
import {
  REPORT_LIMITS,
  type NormalizedReportDataset,
  type ReportExecutionScope,
  type ReportJobForExecution,
  type ReportValue,
  reportExecutionScope,
  reportFilters,
} from "./report-types";

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

const companyColumns = [
  { key: "companyId", header: "Company ID" },
  { key: "companyCode", header: "Company code" },
  { key: "companyName", header: "Company name" },
  { key: "status", header: "Status" },
  { key: "siteCount", header: "Site count" },
  { key: "buildingCount", header: "Building count" },
  { key: "activeUserCount", header: "Active user count" },
  { key: "createdAt", header: "Created at" },
];

const siteColumns = [
  { key: "siteId", header: "Site ID" },
  { key: "companyId", header: "Company ID" },
  { key: "companyName", header: "Company name" },
  { key: "siteName", header: "Site name" },
  { key: "status", header: "Status" },
  { key: "buildingCount", header: "Building count" },
  { key: "createdAt", header: "Created at" },
];

const buildingColumns = [
  { key: "buildingId", header: "Building ID" },
  { key: "companyId", header: "Company ID" },
  { key: "companyName", header: "Company name" },
  { key: "siteId", header: "Site ID" },
  { key: "siteName", header: "Site name" },
  { key: "buildingTitle", header: "Building" },
  { key: "buildingNumber", header: "Building number" },
  { key: "status", header: "Status" },
  { key: "gatewayCount", header: "Active gateway count" },
  { key: "nodeCount", header: "Latest node count" },
  { key: "createdAt", header: "Created at" },
];

const deviceColumns = [
  { key: "deviceKind", header: "Device kind" },
  { key: "deviceId", header: "Device ID" },
  { key: "serialOrNumber", header: "Serial / node number" },
  { key: "nodeType", header: "Node type" },
  { key: "lifecycleStatus", header: "Inventory status" },
  { key: "companyId", header: "Company ID" },
  { key: "companyName", header: "Company name" },
  { key: "siteId", header: "Site ID" },
  { key: "siteName", header: "Site name" },
  { key: "buildingId", header: "Building ID" },
  { key: "buildingTitle", header: "Building" },
  { key: "gatewayId", header: "Gateway ID" },
  { key: "gatewaySerial", header: "Gateway serial" },
  { key: "lastSeenAt", header: "Last seen at" },
];

const sensorColumns = [
  { key: "readingId", header: "Reading ID" },
  { key: "receivedAt", header: "Received at" },
  { key: "measuredAt", header: "Measured at" },
  { key: "status", header: "Classified status" },
  { key: "faultFiltered", header: "Fault filtered" },
  { key: "companyId", header: "Company ID" },
  { key: "siteId", header: "Site ID" },
  { key: "buildingId", header: "Building ID" },
  { key: "buildingTitle", header: "Building" },
  { key: "gatewayId", header: "Gateway ID" },
  { key: "gatewaySerial", header: "Gateway serial" },
  { key: "nodeId", header: "Node ID" },
  { key: "nodeNumber", header: "Node number" },
  { key: "nodeType", header: "Node type" },
  { key: "sensorValues", header: "Sensor values" },
];

const latestColumns = [
  { key: "deviceKind", header: "Device kind" },
  { key: "deviceId", header: "Device ID" },
  { key: "serialOrNumber", header: "Serial / node number" },
  { key: "nodeType", header: "Node type" },
  { key: "status", header: "Latest status" },
  { key: "faultFiltered", header: "Fault filtered" },
  { key: "companyId", header: "Company ID" },
  { key: "siteId", header: "Site ID" },
  { key: "buildingId", header: "Building ID" },
  { key: "buildingTitle", header: "Building" },
  { key: "gatewayId", header: "Gateway ID" },
  { key: "gatewaySerial", header: "Gateway serial" },
  { key: "lastSeenAt", header: "Last seen at" },
  { key: "sensorValues", header: "Latest sensor values" },
];

const alarmColumns = [
  { key: "alarmId", header: "Alarm ID" },
  { key: "severity", header: "Severity" },
  { key: "status", header: "Status" },
  { key: "openedAt", header: "Opened at" },
  { key: "lastTriggeredAt", header: "Last triggered at" },
  { key: "acknowledgedAt", header: "Acknowledged at" },
  { key: "acknowledgedBy", header: "Acknowledged by" },
  { key: "resolvedAt", header: "Resolved at" },
  { key: "resolvedBy", header: "Resolved by" },
  { key: "companyId", header: "Company ID" },
  { key: "siteId", header: "Site ID" },
  { key: "buildingId", header: "Building ID" },
  { key: "buildingTitle", header: "Building" },
  { key: "gatewayId", header: "Gateway ID" },
  { key: "nodeId", header: "Node ID" },
  { key: "nodeType", header: "Node type" },
  { key: "occurrenceEvidence", header: "Occurrence evidence" },
];

const commandColumns = [
  { key: "commandId", header: "Command ID" },
  { key: "commandType", header: "Command type" },
  { key: "cmd", header: "cmd" },
  { key: "requestId", header: "Request ID" },
  { key: "status", header: "Status" },
  { key: "gatewayId", header: "Gateway ID" },
  { key: "gatewaySerial", header: "Gateway serial" },
  { key: "createdAt", header: "Created at" },
  { key: "sentAt", header: "Sent at" },
  { key: "acknowledgedAt", header: "Acknowledged at" },
  { key: "failedAt", header: "Failed at" },
  { key: "ackLatencyMs", header: "ACK latency (ms)" },
  { key: "responseSummary", header: "Safe response summary" },
  { key: "failureReason", header: "Failure reason" },
];

const auditColumns = [
  { key: "auditId", header: "Audit ID" },
  { key: "actorType", header: "Actor type" },
  { key: "actorId", header: "Actor ID" },
  { key: "action", header: "Action" },
  { key: "entityType", header: "Entity" },
  { key: "entityId", header: "Entity ID" },
  { key: "scope", header: "Scope" },
  { key: "oldSummary", header: "Safe old summary" },
  { key: "newSummary", header: "Safe new summary" },
  { key: "createdAt", header: "Timestamp" },
];

const archiveColumns = [
  { key: "entityType", header: "Entity type" },
  { key: "id", header: "Entity ID" },
  { key: "name", header: "Name" },
  { key: "title", header: "Title" },
  { key: "companyId", header: "Company ID" },
  { key: "areaId", header: "Site ID" },
  { key: "buildingId", header: "Building ID" },
  { key: "deletedAt", header: "Archived at" },
  { key: "deletedByType", header: "Archived by type" },
  { key: "deletedById", header: "Archived by ID" },
  { key: "deleteReason", header: "Archive reason" },
  { key: "parentDerived", header: "Parent-derived" },
];

@Injectable()
export class ReportDataQueryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ArchiveQueryService) private readonly archive: ArchiveQueryService,
  ) {}

  async generate(job: ReportJobForExecution): Promise<NormalizedReportDataset> {
    const scope = reportExecutionScope(job);
    const filters = reportFilters(job.filters);
    switch (job.reportType) {
      case ReportType.COMPANY_SUMMARY:
        return this.companySummary(scope);
      case ReportType.SITE_SUMMARY:
        return this.siteSummary(scope);
      case ReportType.BUILDING_SUMMARY:
        return this.buildingSummary(scope);
      case ReportType.DEVICE_INVENTORY:
        return this.deviceInventory(scope, filters);
      case ReportType.DEVICE_ASSIGNMENT_HISTORY:
        return this.deviceAssignmentHistory(scope, filters);
      case ReportType.GATEWAY_STATUS_HISTORY:
        return this.gatewayStatus(scope, filters);
      case ReportType.NODE_STATUS_HISTORY:
        return this.nodeStatus(scope, filters);
      case ReportType.SENSOR_HISTORY:
        return this.sensorHistory(scope, filters);
      case ReportType.ALARM_HISTORY:
        return this.alarmHistory(scope, filters);
      case ReportType.MQTT_COMMAND_HISTORY:
        return this.commandHistory(scope, filters);
      case ReportType.USER_ACTIVITY:
      case ReportType.AUDIT_LOG:
        return this.auditHistory(filters);
      case ReportType.ARCHIVE_EVIDENCE:
        return this.archiveEvidence(filters);
    }
  }

  async archiveEvidence(filters: Record<string, string>): Promise<NormalizedReportDataset> {
    return {
      columns: archiveColumns,
      rows: (await this.archive.exportEvidence(filters, REPORT_LIMITS.maxRows)) as Record<
        string,
        ReportValue
      >[],
    };
  }

  async companySummary(scope: ReportExecutionScope): Promise<NormalizedReportDataset> {
    const companies = await this.prisma.company.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { code: true, createdAt: true, id: true, name: true, status: true },
      take: REPORT_LIMITS.maxRows + 1,
      where: scope.companyId ? { id: scope.companyId } : {},
    });
    this.assertRowLimit(companies.length);
    const companyIds = companies.map((company) => company.id);
    const [areas, buildings, users] = await Promise.all([
      this.prisma.constructionArea.groupBy({
        _count: { _all: true },
        by: ["companyId"],
        where: { companyId: { in: companyIds }, ...this.areaScopeWhere(scope) },
      }),
      this.prisma.constructionBuilding.groupBy({
        _count: { _all: true },
        by: ["companyId"],
        where: { companyId: { in: companyIds }, ...this.locationWhere(scope) },
      }),
      this.prisma.companyUser.groupBy({
        _count: { _all: true },
        by: ["companyId"],
        where: { companyId: { in: companyIds }, isActive: true, ...this.userScopeWhere(scope) },
      }),
    ]);
    return {
      columns: companyColumns,
      rows: companies.map((company) => ({
        activeUserCount: this.countBy(users, company.id),
        buildingCount: this.countBy(buildings, company.id),
        companyCode: company.code,
        companyId: company.id,
        companyName: company.name,
        createdAt: company.createdAt,
        siteCount: this.countBy(areas, company.id),
        status: company.status,
      })),
    };
  }

  async siteSummary(scope: ReportExecutionScope): Promise<NormalizedReportDataset> {
    const sites = await this.prisma.constructionArea.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        company: { select: { id: true, name: true } },
        companyId: true,
        createdAt: true,
        id: true,
        name: true,
        status: true,
      },
      take: REPORT_LIMITS.maxRows + 1,
      where: { ...this.areaScopeWhere(scope) },
    });
    this.assertRowLimit(sites.length);
    const counts = await this.prisma.constructionBuilding.groupBy({
      _count: { _all: true },
      by: ["areaId"],
      where: { areaId: { in: sites.map((site) => site.id) }, ...this.locationWhere(scope) },
    });
    return {
      columns: siteColumns,
      rows: sites.map((site) => ({
        buildingCount: this.countBy(counts, site.id, "areaId"),
        companyId: site.company.id,
        companyName: site.company.name,
        createdAt: site.createdAt,
        siteId: site.id,
        siteName: site.name,
        status: site.status,
      })),
    };
  }

  async buildingSummary(scope: ReportExecutionScope): Promise<NormalizedReportDataset> {
    const buildings = await this.prisma.constructionBuilding.findMany({
      orderBy: [{ title: "asc" }, { id: "asc" }],
      select: {
        area: { select: { id: true, name: true } },
        address: true,
        company: { select: { id: true, name: true } },
        companyId: true,
        createdAt: true,
        id: true,
        number: true,
        status: true,
        title: true,
      },
      take: REPORT_LIMITS.maxRows + 1,
      where: { ...this.locationWhere(scope) },
    });
    this.assertRowLimit(buildings.length);
    const ids = buildings.map((building) => building.id);
    const [gateways, nodes] = await Promise.all([
      this.prisma.gatewayBuildingAssignment.groupBy({
        _count: { _all: true },
        by: ["buildingId"],
        where: { buildingId: { in: ids }, status: AssignmentStatus.ACTIVE },
      }),
      this.prisma.latestNodeState.groupBy({
        _count: { _all: true },
        by: ["buildingId"],
        where: { buildingId: { in: ids } },
      }),
    ]);
    return {
      columns: buildingColumns,
      rows: buildings.map((building) => ({
        buildingId: building.id,
        buildingNumber: building.number,
        buildingTitle: building.title,
        companyId: building.company.id,
        companyName: building.company.name,
        createdAt: building.createdAt,
        gatewayCount: this.countBy(gateways, building.id, "buildingId"),
        nodeCount: this.countBy(nodes, building.id, "buildingId"),
        siteId: building.area.id,
        siteName: building.area.name,
        status: building.status,
      })),
    };
  }

  async deviceInventory(
    scope: ReportExecutionScope,
    filters: Record<string, string>,
  ): Promise<NormalizedReportDataset> {
    const [gateways, nodes] = await Promise.all([
      this.prisma.gateway.findMany({
        orderBy: [{ serialNumber: "asc" }, { id: "asc" }],
        select: {
          buildingAssignments: {
            orderBy: { assignedAt: "desc" },
            select: {
              assignedAt: true,
              building: {
                select: {
                  area: { select: { id: true, name: true } },
                  company: { select: { id: true, name: true } },
                  id: true,
                  title: true,
                },
              },
            },
            where: { status: AssignmentStatus.ACTIVE },
          },
          companyAssignments: {
            orderBy: { assignedAt: "desc" },
            select: { assignedAt: true, company: { select: { id: true, name: true } } },
            where: { status: AssignmentStatus.ACTIVE },
          },
          id: true,
          lastSeenAt: true,
          serialNumber: true,
          status: true,
        },
        take: REPORT_LIMITS.maxRows + 1,
        where: this.gatewayWhere(scope, filters.gatewayId),
      }),
      this.prisma.node.findMany({
        orderBy: [{ number: "asc" }, { id: "asc" }],
        select: {
          companyAssignments: {
            orderBy: { assignedAt: "desc" },
            select: { assignedAt: true, company: { select: { id: true, name: true } } },
            where: { status: AssignmentStatus.ACTIVE },
          },
          gatewayAssignments: {
            orderBy: { assignedAt: "desc" },
            select: {
              assignedAt: true,
              gateway: {
                select: {
                  buildingAssignments: {
                    select: {
                      building: {
                        select: {
                          area: { select: { id: true, name: true } },
                          company: { select: { id: true, name: true } },
                          id: true,
                          title: true,
                        },
                      },
                    },
                    where: { status: AssignmentStatus.ACTIVE },
                  },
                  id: true,
                  serialNumber: true,
                },
              },
            },
            where: { status: AssignmentStatus.ACTIVE },
          },
          id: true,
          lastSeenAt: true,
          nodeType: { select: { displayName: true, key: true } },
          number: true,
          status: true,
        },
        take: REPORT_LIMITS.maxRows + 1,
        where: this.nodeWhere(scope, filters),
      }),
    ]);
    this.assertRowLimit(gateways.length + nodes.length);
    const gatewayRows = gateways.map((gateway) => {
      const building = gateway.buildingAssignments[0]?.building;
      const company = gateway.companyAssignments[0]?.company ?? building?.company;
      return {
        companyId: company?.id,
        companyName: company?.name,
        deviceId: gateway.id,
        deviceKind: "gateway",
        gatewayId: gateway.id,
        gatewaySerial: gateway.serialNumber,
        lastSeenAt: gateway.lastSeenAt,
        lifecycleStatus: gateway.status,
        nodeType: null,
        serialOrNumber: gateway.serialNumber,
        siteId: building?.area.id,
        siteName: building?.area.name,
        buildingId: building?.id,
        buildingTitle: building?.title,
      };
    });
    const nodeRows = nodes.map((node) => {
      const assignment = node.gatewayAssignments[0];
      const building = assignment?.gateway.buildingAssignments[0]?.building;
      const company = node.companyAssignments[0]?.company ?? building?.company;
      return {
        companyId: company?.id,
        companyName: company?.name,
        deviceId: node.id,
        deviceKind: "node",
        gatewayId: assignment?.gateway.id,
        gatewaySerial: assignment?.gateway.serialNumber,
        lastSeenAt: node.lastSeenAt,
        lifecycleStatus: node.status,
        nodeType: node.nodeType.displayName,
        serialOrNumber: node.number,
        siteId: building?.area.id,
        siteName: building?.area.name,
        buildingId: building?.id,
        buildingTitle: building?.title,
      };
    });
    return {
      columns: deviceColumns,
      rows: [...gatewayRows, ...nodeRows].sort(
        (a, b) =>
          String(a.serialOrNumber).localeCompare(String(b.serialOrNumber)) ||
          String(a.deviceId).localeCompare(String(b.deviceId)),
      ),
    };
  }

  async deviceAssignmentHistory(
    scope: ReportExecutionScope,
    filters: Record<string, string>,
  ): Promise<NormalizedReportDataset> {
    const assignments = await this.prisma.companyDeviceAssignment.findMany({
      select: {
        assignedAt: true,
        company: { select: { id: true, name: true } },
        gateway: { select: { id: true, serialNumber: true } },
        id: true,
        node: { select: { id: true, number: true, nodeType: { select: { displayName: true } } } },
        status: true,
        unassignedAt: true,
      },
      orderBy: [{ assignedAt: "asc" }, { id: "asc" }],
      take: REPORT_LIMITS.maxRows + 1,
      where: {
        companyId: scope.companyId,
        assignedAt: this.dateFilter(filters.from, filters.to),
        ...(filters.gatewayId ? { gatewayId: filters.gatewayId } : {}),
        ...(filters.nodeId ? { nodeId: filters.nodeId } : {}),
        ...(scope.allowedBuildingIds
          ? {
              OR: [
                {
                  gateway: {
                    buildingAssignments: {
                      some: {
                        buildingId: { in: scope.allowedBuildingIds },
                        status: AssignmentStatus.ACTIVE,
                      },
                    },
                  },
                },
                {
                  node: {
                    gatewayAssignments: {
                      some: {
                        gateway: {
                          buildingAssignments: {
                            some: {
                              buildingId: { in: scope.allowedBuildingIds },
                              status: AssignmentStatus.ACTIVE,
                            },
                          },
                        },
                        status: AssignmentStatus.ACTIVE,
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
    });
    this.assertRowLimit(assignments.length);
    return {
      columns: [
        ...deviceColumns,
        { key: "assignedAt", header: "Assigned at" },
        { key: "unassignedAt", header: "Unassigned at" },
        { key: "assignmentStatus", header: "Assignment status" },
      ],
      rows: assignments.map((item) => {
        return {
          assignmentStatus: item.status,
          assignedAt: item.assignedAt,
          companyId: item.company.id,
          companyName: item.company.name,
          deviceId: item.gateway?.id ?? item.node?.id,
          deviceKind: item.gateway ? "gateway" : "node",
          gatewayId: item.gateway?.id ?? null,
          gatewaySerial: item.gateway?.serialNumber ?? null,
          lastSeenAt: null,
          lifecycleStatus: null,
          nodeType: item.node?.nodeType.displayName ?? null,
          serialOrNumber: item.gateway?.serialNumber ?? item.node?.number,
          siteId: null,
          siteName: null,
          buildingId: null,
          buildingTitle: null,
          unassignedAt: item.unassignedAt,
        };
      }),
    };
  }

  async gatewayStatus(
    scope: ReportExecutionScope,
    filters: Record<string, string>,
  ): Promise<NormalizedReportDataset> {
    const gateways = await this.prisma.gateway.findMany({
      orderBy: [{ lastSeenAt: "asc" }, { id: "asc" }],
      select: {
        buildingAssignments: {
          select: {
            building: { select: { area: { select: { id: true } }, id: true, title: true } },
          },
          where: { status: AssignmentStatus.ACTIVE },
        },
        companyAssignments: {
          select: { companyId: true },
          where: { status: AssignmentStatus.ACTIVE },
        },
        id: true,
        lastSeenAt: true,
        serialNumber: true,
        status: true,
      },
      take: REPORT_LIMITS.maxRows + 1,
      where: {
        ...this.gatewayWhere(scope, filters.gatewayId),
        lastSeenAt: this.dateFilter(filters.from, filters.to),
      },
    });
    this.assertRowLimit(gateways.length);
    return {
      columns: deviceColumns,
      rows: gateways.map((gateway) => {
        const building = gateway.buildingAssignments[0]?.building;
        return {
          deviceKind: "gateway",
          deviceId: gateway.id,
          serialOrNumber: gateway.serialNumber,
          nodeType: null,
          lifecycleStatus: gateway.status,
          companyId: gateway.companyAssignments[0]?.companyId,
          companyName: null,
          siteId: building?.area.id,
          siteName: null,
          buildingId: building?.id,
          buildingTitle: building?.title,
          gatewayId: gateway.id,
          gatewaySerial: gateway.serialNumber,
          lastSeenAt: gateway.lastSeenAt,
        };
      }),
    };
  }

  async nodeStatus(
    scope: ReportExecutionScope,
    filters: Record<string, string>,
  ): Promise<NormalizedReportDataset> {
    const states = await this.prisma.latestNodeState.findMany({
      orderBy: [{ lastSeenAt: "asc" }, { nodeId: "asc" }],
      select: {
        areaId: true,
        buildingId: true,
        building: { select: { title: true } },
        companyId: true,
        faultFiltered: true,
        gateway: { select: { id: true, serialNumber: true } },
        gatewayId: true,
        lastSeenAt: true,
        node: { select: { id: true, number: true } },
        nodeId: true,
        nodeType: { select: { displayName: true } },
        nodeTypeId: true,
        status: true,
        values: true,
      },
      take: REPORT_LIMITS.maxRows + 1,
      where: {
        ...this.stateLocationWhere(scope),
        ...(filters.gatewayId ? { gatewayId: filters.gatewayId } : {}),
        ...(filters.nodeId ? { nodeId: filters.nodeId } : {}),
        ...(filters.nodeTypeId ? { nodeTypeId: filters.nodeTypeId } : {}),
        lastSeenAt: this.dateFilter(filters.from, filters.to),
      },
    });
    this.assertRowLimit(states.length);
    return {
      columns: latestColumns,
      rows: states.map((state) => ({
        deviceKind: "node",
        deviceId: state.nodeId,
        serialOrNumber: state.node.number,
        nodeType: state.nodeType.displayName,
        status: state.status,
        faultFiltered: state.faultFiltered,
        companyId: state.companyId,
        siteId: state.areaId,
        buildingId: state.buildingId,
        buildingTitle: state.building.title,
        gatewayId: state.gatewayId,
        gatewaySerial: state.gateway.serialNumber,
        lastSeenAt: state.lastSeenAt,
        sensorValues: safeJson(state.values),
      })),
    };
  }

  async sensorHistory(
    scope: ReportExecutionScope,
    filters: Record<string, string>,
  ): Promise<NormalizedReportDataset> {
    const readings = await this.prisma.sensorReading.findMany({
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      select: {
        areaId: true,
        buildingId: true,
        building: { select: { title: true } },
        companyId: true,
        faultFiltered: true,
        gateway: { select: { id: true, serialNumber: true } },
        gatewayId: true,
        id: true,
        measuredAt: true,
        node: { select: { id: true, number: true } },
        nodeId: true,
        nodeType: { select: { displayName: true } },
        receivedAt: true,
        status: true,
        values: true,
      },
      take: REPORT_LIMITS.maxRows + 1,
      where: {
        ...this.stateLocationWhere(scope),
        ...(filters.gatewayId ? { gatewayId: filters.gatewayId } : {}),
        ...(filters.nodeId ? { nodeId: filters.nodeId } : {}),
        ...(filters.nodeTypeId ? { nodeTypeId: filters.nodeTypeId } : {}),
        receivedAt: this.dateFilter(filters.from, filters.to),
      },
    });
    this.assertRowLimit(readings.length);
    return {
      columns: sensorColumns,
      rows: readings.map((reading) => ({
        buildingId: reading.buildingId,
        buildingTitle: reading.building.title,
        companyId: reading.companyId,
        faultFiltered: reading.faultFiltered,
        gatewayId: reading.gatewayId,
        gatewaySerial: reading.gateway.serialNumber,
        measuredAt: reading.measuredAt,
        nodeId: reading.nodeId,
        nodeNumber: reading.node.number,
        nodeType: reading.nodeType.displayName,
        receivedAt: reading.receivedAt,
        readingId: reading.id,
        sensorValues: safeJson(reading.values),
        siteId: reading.areaId,
        status: reading.status,
      })),
    };
  }

  async alarmHistory(
    scope: ReportExecutionScope,
    filters: Record<string, string>,
  ): Promise<NormalizedReportDataset> {
    const alarms = await this.prisma.alarmEvent.findMany({
      orderBy: [{ openedAt: "asc" }, { id: "asc" }],
      select: {
        acknowledgedAt: true,
        acknowledgedById: true,
        acknowledgedByType: true,
        areaId: true,
        building: { select: { id: true, title: true } },
        buildingId: true,
        companyId: true,
        evidence: true,
        gatewayId: true,
        id: true,
        lastTriggeredAt: true,
        node: { select: { id: true, number: true } },
        nodeId: true,
        nodeType: { select: { displayName: true } },
        openedAt: true,
        policyTriggers: {
          select: { countIntervalSeconds: true, triggerOccurrenceCount: true, triggeredAt: true },
          orderBy: { triggeredAt: "asc" },
        },
        resolvedAt: true,
        resolvedById: true,
        resolvedByType: true,
        severity: true,
        status: true,
      },
      take: REPORT_LIMITS.maxRows + 1,
      where: {
        ...this.stateLocationWhere(scope),
        ...(filters.gatewayId ? { gatewayId: filters.gatewayId } : {}),
        ...(filters.nodeId ? { nodeId: filters.nodeId } : {}),
        ...(filters.nodeTypeId ? { nodeTypeId: filters.nodeTypeId } : {}),
        openedAt: this.dateFilter(filters.from, filters.to),
      },
    });
    this.assertRowLimit(alarms.length);
    return {
      columns: alarmColumns,
      rows: alarms.map((alarm) => ({
        alarmId: alarm.id,
        acknowledgedAt: alarm.acknowledgedAt,
        acknowledgedBy: actor(alarm.acknowledgedByType, alarm.acknowledgedById),
        buildingId: alarm.buildingId,
        buildingTitle: alarm.building.title,
        companyId: alarm.companyId,
        gatewayId: alarm.gatewayId,
        lastTriggeredAt: alarm.lastTriggeredAt,
        nodeId: alarm.nodeId,
        nodeType: alarm.nodeType.displayName,
        occurrenceEvidence: safeJson({ event: alarm.evidence, triggers: alarm.policyTriggers }),
        openedAt: alarm.openedAt,
        resolvedAt: alarm.resolvedAt,
        resolvedBy: actor(alarm.resolvedByType, alarm.resolvedById),
        severity: alarm.severity,
        siteId: alarm.areaId,
        status: alarm.status,
      })),
    };
  }

  async commandHistory(
    scope: ReportExecutionScope,
    filters: Record<string, string>,
  ): Promise<NormalizedReportDataset> {
    const commands = await this.prisma.gatewayCommand.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        acknowledgedAt: true,
        commandNumber: true,
        commandType: true,
        createdAt: true,
        failureReason: true,
        failedAt: true,
        gateway: {
          select: {
            id: true,
            serialNumber: true,
            companyAssignments: {
              select: { companyId: true },
              where: { status: AssignmentStatus.ACTIVE },
            },
            buildingAssignments: {
              select: { buildingId: true },
              where: { status: AssignmentStatus.ACTIVE },
            },
          },
        },
        id: true,
        payload: true,
        responsePayload: true,
        sentAt: true,
        status: true,
      },
      take: REPORT_LIMITS.maxRows + 1,
      where: {
        ...(this.hasCommandGatewayRestriction(scope)
          ? { gateway: this.commandGatewayWhere(scope) }
          : {}),
        ...(filters.gatewayId ? { gatewayId: filters.gatewayId } : {}),
        createdAt: this.dateFilter(filters.from, filters.to),
      },
    });
    this.assertRowLimit(commands.length);
    return {
      columns: commandColumns,
      rows: commands.map((command) => {
        const requestId = stringValue(safeObject(command.payload).requestId) ?? command.id;
        return {
          ackLatencyMs:
            command.sentAt && command.acknowledgedAt
              ? command.acknowledgedAt.getTime() - command.sentAt.getTime()
              : null,
          acknowledgedAt: command.acknowledgedAt,
          cmd: command.commandNumber,
          commandId: command.id,
          commandType: command.commandType,
          createdAt: command.createdAt,
          failedAt: command.failedAt,
          failureReason: safeText(command.failureReason),
          gatewayId: command.gateway.id,
          gatewaySerial: command.gateway.serialNumber,
          requestId,
          responseSummary: safeJson(command.responsePayload),
          sentAt: command.sentAt,
          status: command.status,
        };
      }),
    };
  }

  async auditHistory(filters: Record<string, string>): Promise<NormalizedReportDataset> {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        action: true,
        actorId: true,
        actorType: true,
        createdAt: true,
        entityId: true,
        entityType: true,
        id: true,
        newValue: true,
        oldValue: true,
      },
      take: REPORT_LIMITS.maxRows + 1,
      where: { createdAt: this.dateFilter(filters.from, filters.to) },
    });
    this.assertRowLimit(logs.length);
    return {
      columns: auditColumns,
      rows: logs.map((log) => ({
        action: log.action,
        actorId: log.actorId,
        actorType: log.actorType,
        auditId: log.id,
        createdAt: log.createdAt,
        entityId: log.entityId,
        entityType: log.entityType,
        newSummary: safeJson(log.newValue),
        oldSummary: safeJson(log.oldValue),
        scope: null,
      })),
    };
  }

  private gatewayWhere(scope: ReportExecutionScope, gatewayId?: string): Prisma.GatewayWhereInput {
    return {
      ...(gatewayId ? { id: gatewayId } : {}),
      ...(scope.companyId
        ? {
            companyAssignments: {
              some: { companyId: scope.companyId, status: AssignmentStatus.ACTIVE },
            },
          }
        : {}),
      ...(this.hasBuildingRestriction(scope)
        ? {
            buildingAssignments: {
              some: { building: this.buildingScopeWhere(scope), status: AssignmentStatus.ACTIVE },
            },
          }
        : {}),
    };
  }

  private commandGatewayWhere(scope: ReportExecutionScope): Prisma.GatewayWhereInput {
    return {
      ...(scope.companyId
        ? {
            companyAssignments: {
              some: { companyId: scope.companyId, status: AssignmentStatus.ACTIVE },
            },
          }
        : {}),
      ...(this.hasBuildingRestriction(scope)
        ? {
            buildingAssignments: {
              some: { building: this.buildingScopeWhere(scope), status: AssignmentStatus.ACTIVE },
            },
          }
        : {}),
    };
  }

  private hasCommandGatewayRestriction(scope: ReportExecutionScope): boolean {
    return Boolean(scope.companyId || this.hasBuildingRestriction(scope));
  }

  private nodeWhere(
    scope: ReportExecutionScope,
    filters: Record<string, string>,
  ): Prisma.NodeWhereInput {
    return {
      ...(filters.nodeId ? { id: filters.nodeId } : {}),
      ...(filters.nodeTypeId ? { nodeTypeId: filters.nodeTypeId } : {}),
      ...(scope.companyId
        ? {
            companyAssignments: {
              some: { companyId: scope.companyId, status: AssignmentStatus.ACTIVE },
            },
          }
        : {}),
      ...(filters.gatewayId || this.hasBuildingRestriction(scope)
        ? {
            gatewayAssignments: {
              some: {
                gatewayId: filters.gatewayId,
                status: AssignmentStatus.ACTIVE,
                gateway: this.gatewayWhere(scope),
              },
            },
          }
        : {}),
    };
  }

  private locationWhere(scope: ReportExecutionScope): Prisma.ConstructionBuildingWhereInput {
    return {
      ...(scope.companyId ? { companyId: scope.companyId } : {}),
      ...(scope.areaId
        ? { areaId: scope.areaId }
        : scope.allowedAreaIds
          ? { areaId: { in: scope.allowedAreaIds } }
          : {}),
      ...(scope.buildingId
        ? { id: scope.buildingId }
        : scope.allowedBuildingIds
          ? { id: { in: scope.allowedBuildingIds } }
          : {}),
    };
  }

  private stateLocationWhere(scope: ReportExecutionScope): {
    companyId?: string;
    areaId?: string | { in: string[] };
    buildingId?: string | { in: string[] };
  } {
    return {
      ...(scope.companyId ? { companyId: scope.companyId } : {}),
      ...(scope.areaId
        ? { areaId: scope.areaId }
        : scope.allowedAreaIds
          ? { areaId: { in: scope.allowedAreaIds } }
          : {}),
      ...(scope.buildingId
        ? { buildingId: scope.buildingId }
        : scope.allowedBuildingIds
          ? { buildingId: { in: scope.allowedBuildingIds } }
          : {}),
    };
  }

  private areaScopeWhere(scope: ReportExecutionScope): Prisma.ConstructionAreaWhereInput {
    return {
      ...(scope.companyId ? { companyId: scope.companyId } : {}),
      ...(scope.areaId
        ? { id: scope.areaId }
        : scope.allowedAreaIds
          ? { id: { in: scope.allowedAreaIds } }
          : {}),
    };
  }

  private userScopeWhere(scope: ReportExecutionScope): Prisma.CompanyUserWhereInput {
    if (!scope.allowedBuildingIds) return {};
    if (!scope.allowedBuildingIds.length) return { id: EMPTY_UUID };
    return {
      OR: [
        { role: { isCompanyOwnerRole: true } },
        { buildingAccess: { some: { buildingId: { in: scope.allowedBuildingIds } } } },
        { areaAccess: { some: { areaId: { in: scope.allowedAreaIds ?? [] } } } },
      ],
    };
  }

  private buildingScopeWhere(scope: ReportExecutionScope): Prisma.ConstructionBuildingWhereInput {
    return this.locationWhere(scope);
  }

  private hasBuildingRestriction(scope: ReportExecutionScope): boolean {
    return Boolean(
      scope.buildingId || scope.areaId || scope.allowedBuildingIds || scope.allowedAreaIds,
    );
  }

  private dateFilter(from?: string, to?: string): Prisma.DateTimeFilter {
    return { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  }

  private countBy(
    rows: Array<{
      _count: { _all: number };
      companyId?: string;
      areaId?: string;
      buildingId?: string;
    }>,
    value: string,
    key: "companyId" | "areaId" | "buildingId" = "companyId",
  ): number {
    return rows.find((row) => row[key] === value)?._count._all ?? 0;
  }

  private assertRowLimit(count: number): void {
    if (count > REPORT_LIMITS.maxRows)
      throw new Error(`Report row limit exceeded (${REPORT_LIMITS.maxRows}).`);
  }
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function safeText(value: string | null): string | null {
  if (!value) return value;
  return value.replaceAll(/password|passwd|secret|token|credential/gi, "[redacted]").slice(0, 500);
}

function safeJson(value: unknown, depth = 0): ReportValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return safeText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth > 3) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => safeJson(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key]) => !/password|passwd|secret|token|credential|storagePath|storageKey/i.test(key),
      )
      .slice(0, 50)
      .map(([key, item]) => [key, safeJson(item, depth + 1)]),
  );
}

function actor(type: string | null, id: string | null): string | null {
  return type || id ? `${type ?? "unknown"}:${id ?? "unknown"}` : null;
}
