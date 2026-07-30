import { createHash } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ArchiveEntityType, GatewayCommandStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { paginated, pageWindow } from "../../common/dto/pagination.dto";
import { PrismaService } from "../../prisma/prisma.service";
import type { ListArchiveQueryDto } from "./dto/archive.dto";
import type { SensorReadingPurgeFilterDto } from "./dto/archive.dto";

const terminalCommands: GatewayCommandStatus[] = [
  GatewayCommandStatus.ACKNOWLEDGED,
  GatewayCommandStatus.FAILED,
  GatewayCommandStatus.EXPIRED,
  GatewayCommandStatus.CANCELLED,
];

@Injectable()
export class ArchiveQueryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: ListArchiveQueryDto) {
    if (!query.entityType) {
      return this.groupSummary(query);
    }
    const where = this.archiveMetadataWhere(query);
    switch (query.entityType) {
      case ArchiveEntityType.COMPANY:
        return this.listModel(
          this.prisma.company as unknown as ArchiveDelegate,
          { ...where, ...(query.companyId ? { id: query.companyId } : {}) },
          query,
          "name",
        );
      case ArchiveEntityType.CONSTRUCTION_AREA:
        return this.listAreas(query);
      case ArchiveEntityType.CONSTRUCTION_BUILDING:
        return this.listBuildings(query);
      case ArchiveEntityType.COMPANY_USER:
        return this.listModel(
          this.prisma.companyUser as unknown as ArchiveDelegate,
          { ...where, companyId: query.companyId },
          query,
          "name",
        );
      case ArchiveEntityType.COMPANY_POSITION:
        return this.listModel(
          this.prisma.companyPosition as unknown as ArchiveDelegate,
          { ...where, companyId: query.companyId },
          query,
          "name",
        );
      case ArchiveEntityType.COMPANY_ROLE:
        return this.listModel(
          this.prisma.companyRole as unknown as ArchiveDelegate,
          { ...where, companyId: query.companyId },
          query,
          "name",
        );
      case ArchiveEntityType.ALARM_RULE:
        return this.listModel(
          this.prisma.alarmRule as unknown as ArchiveDelegate,
          {
            ...where,
            areaId: query.areaId,
            buildingId: query.buildingId,
            companyId: query.companyId,
          },
          query,
          "name",
        );
      case ArchiveEntityType.ALARM_RECIPIENT_POLICY:
        return this.listModel(
          this.prisma.alarmRecipientPolicy as unknown as ArchiveDelegate,
          {
            ...where,
            ...(query.companyId || query.areaId || query.buildingId
              ? {
                  rule: {
                    areaId: query.areaId,
                    buildingId: query.buildingId,
                    companyId: query.companyId,
                  },
                }
              : {}),
          },
          query,
          undefined,
        );
      case ArchiveEntityType.ALARM_EVENT:
        return this.listModel(
          this.prisma.alarmEvent as unknown as ArchiveDelegate,
          {
            ...where,
            areaId: query.areaId,
            buildingId: query.buildingId,
            companyId: query.companyId,
          },
          query,
          undefined,
        );
      case ArchiveEntityType.ALARM_NOTIFICATION:
        return this.listModel(
          this.prisma.alarmNotification as unknown as ArchiveDelegate,
          {
            ...where,
            ...(query.companyId || query.areaId || query.buildingId
              ? {
                  alarmEvent: {
                    areaId: query.areaId,
                    buildingId: query.buildingId,
                    companyId: query.companyId,
                  },
                }
              : {}),
          },
          query,
          "title",
        );
      case ArchiveEntityType.GATEWAY_COMMAND:
        return this.listModel(
          this.prisma.gatewayCommand as unknown as ArchiveDelegate,
          {
            ...where,
            areaId: query.areaId,
            buildingId: query.buildingId,
            companyId: query.companyId,
            status: { in: terminalCommands },
          },
          query,
          "commandType",
        );
      case ArchiveEntityType.SENSOR_READING_FILTER:
        return paginated([], 0, query);
    }
  }

  async exportEvidence(filters: Record<string, string>, maxRows: number) {
    const selectedType = filters.archiveEntityType as ArchiveEntityType | undefined;
    const types = selectedType
      ? [selectedType]
      : Object.values(ArchiveEntityType).filter(
          (type) => type !== ArchiveEntityType.SENSOR_READING_FILTER,
        );
    const rows: Array<Record<string, unknown>> = [];
    for (const entityType of types) {
      let page = 1;
      for (;;) {
        const result = (await this.list({
          areaId: filters.areaId,
          archivedBy: filters.archivedBy,
          archivedFrom: filters.archivedFrom ?? filters.from,
          archivedTo: filters.archivedTo ?? filters.to,
          buildingId: filters.buildingId,
          companyId: filters.companyId,
          entityType,
          page,
          pageSize: 100,
          search: filters.search,
        })) as { items: Array<Record<string, unknown>>; total: number };
        rows.push(...result.items.map((item) => ({ entityType, ...item })));
        if (rows.length > maxRows) {
          throw new ConflictException({
            code: "REPORT_ROW_LIMIT_EXCEEDED",
            message: `The archive export exceeds the ${maxRows} row limit. Narrow the filters.`,
          });
        }
        if (page * 100 >= result.total) break;
        page += 1;
      }
    }
    return rows;
  }

  async detail(rootType: ArchiveEntityType, rootId: string) {
    const root = await this.resolveRoot(rootType, rootId);
    const counts = await this.dependencyCounts(rootType, rootId);
    let subtree: Record<string, unknown> | undefined;
    if (rootType === ArchiveEntityType.COMPANY) {
      const [sites, buildings] = await Promise.all([
        this.prisma.constructionArea.findMany({
          orderBy: { name: "asc" },
          select: { deleteReason: true, deletedAt: true, id: true, name: true },
          where: { companyId: rootId },
        }),
        this.prisma.constructionBuilding.findMany({
          orderBy: { title: "asc" },
          select: { areaId: true, deleteReason: true, deletedAt: true, id: true, title: true },
          where: { companyId: rootId },
        }),
      ]);
      subtree = { buildings, sites };
    } else if (rootType === ArchiveEntityType.CONSTRUCTION_AREA) {
      subtree = {
        buildings: await this.prisma.constructionBuilding.findMany({
          orderBy: { title: "asc" },
          select: { deleteReason: true, deletedAt: true, id: true, title: true },
          where: { areaId: rootId },
        }),
      };
    } else if (rootType === ArchiveEntityType.CONSTRUCTION_BUILDING) {
      const [images, rules, events] = await Promise.all([
        this.prisma.buildingPlanImage.findMany({
          orderBy: [{ kind: "asc" }, { orderIndex: "asc" }],
          select: { byteSize: true, id: true, kind: true, orderIndex: true },
          where: { buildingId: rootId },
        }),
        this.prisma.alarmRule.findMany({
          orderBy: { createdAt: "desc" },
          select: { deletedAt: true, id: true, name: true, severity: true },
          where: { buildingId: rootId },
        }),
        this.prisma.alarmEvent.findMany({
          orderBy: { openedAt: "desc" },
          select: { deletedAt: true, id: true, openedAt: true, severity: true, status: true },
          take: 100,
          where: { buildingId: rootId },
        }),
      ]);
      subtree = { events, images, rules };
    }
    return { counts, root, rootType, subtree };
  }

  async preview(rootType: ArchiveEntityType, rootId: string) {
    const root = await this.resolveRoot(rootType, rootId);
    const counts = await this.dependencyCounts(rootType, rootId);
    const globalDevicesPreserved = {
      gateways: counts.assignedGateways ?? 0,
      nodes: counts.assignedNodes ?? 0,
    };
    const payload = {
      counts,
      globalDevicesPreserved,
      parentCompanyId: root.companyId ?? (rootType === ArchiveEntityType.COMPANY ? root.id : null),
      rootId,
      rootName: root.name ?? root.title ?? root.commandType ?? root.id,
      rootType,
    };
    return {
      ...payload,
      estimatedDeletionRows: Object.values(counts).reduce((sum, count) => sum + count, 1),
      previewHash: createHash("sha256").update(stableJson(payload)).digest("hex"),
    };
  }

  async sensorReadingPreview(filters: SensorReadingPurgeFilterDto) {
    const where = sensorReadingFilterWhere(filters);
    const from = new Date(filters.from);
    const to = new Date(filters.to);
    if (from >= to) throw new BadRequestException("The sensor purge range must be increasing.");
    const [matched, eligible] = await Promise.all([
      this.prisma.sensorReading.count({ where }),
      this.prisma.sensorReading.count({ where: { ...where, ...unreferencedReadingWhere } }),
    ]);
    const payload = {
      filters: canonicalSensorFilters(filters),
      matched,
      eligible,
      preservedReferenced: matched - eligible,
    };
    return {
      ...payload,
      confirmation: `DELETE ${eligible}`,
      estimatedDeletionRows: eligible,
      estimatedSizeBytes: eligible * 512,
      previewHash: createHash("sha256").update(stableJson(payload)).digest("hex"),
    };
  }

  async resolveRoot(rootType: ArchiveEntityType, rootId: string): Promise<ArchiveRoot> {
    let root: ArchiveRoot | null = null;
    switch (rootType) {
      case ArchiveEntityType.COMPANY:
        root = await this.prisma.company.findUnique({ where: { id: rootId } });
        break;
      case ArchiveEntityType.CONSTRUCTION_AREA:
        root = await this.prisma.constructionArea.findUnique({
          include: { company: { select: { deletedAt: true } } },
          where: { id: rootId },
        });
        break;
      case ArchiveEntityType.CONSTRUCTION_BUILDING:
        root = await this.prisma.constructionBuilding.findUnique({
          include: {
            area: { select: { deletedAt: true } },
            company: { select: { deletedAt: true } },
          },
          where: { id: rootId },
        });
        break;
      case ArchiveEntityType.COMPANY_USER:
        root = await this.prisma.companyUser.findUnique({ where: { id: rootId } });
        break;
      case ArchiveEntityType.COMPANY_POSITION:
        root = await this.prisma.companyPosition.findUnique({ where: { id: rootId } });
        break;
      case ArchiveEntityType.COMPANY_ROLE:
        root = await this.prisma.companyRole.findUnique({ where: { id: rootId } });
        break;
      case ArchiveEntityType.ALARM_RULE:
        root = await this.prisma.alarmRule.findUnique({ where: { id: rootId } });
        break;
      case ArchiveEntityType.ALARM_RECIPIENT_POLICY:
        root = await this.prisma.alarmRecipientPolicy.findUnique({
          include: { rule: { select: { areaId: true, buildingId: true, companyId: true } } },
          where: { id: rootId },
        });
        if (root && "rule" in root && root.rule) root = { ...root, ...root.rule };
        break;
      case ArchiveEntityType.ALARM_EVENT:
        root = await this.prisma.alarmEvent.findUnique({ where: { id: rootId } });
        break;
      case ArchiveEntityType.ALARM_NOTIFICATION:
        root = await this.prisma.alarmNotification.findUnique({
          include: { alarmEvent: { select: { areaId: true, buildingId: true, companyId: true } } },
          where: { id: rootId },
        });
        if (root && "alarmEvent" in root && root.alarmEvent) {
          root = { ...root, ...root.alarmEvent };
        }
        break;
      case ArchiveEntityType.GATEWAY_COMMAND:
        root = await this.prisma.gatewayCommand.findUnique({ where: { id: rootId } });
        break;
      case ArchiveEntityType.SENSOR_READING_FILTER:
        break;
    }
    if (!root || !this.isArchived(root)) {
      throw new NotFoundException("The archived entity was not found.");
    }
    return root;
  }

  private isArchived(root: ArchiveRoot): boolean {
    return Boolean(
      root.deletedAt ||
      ("company" in root && root.company?.deletedAt) ||
      ("area" in root && root.area?.deletedAt),
    );
  }

  private async dependencyCounts(
    rootType: ArchiveEntityType,
    rootId: string,
  ): Promise<Record<string, number>> {
    if (rootType === ArchiveEntityType.ALARM_NOTIFICATION) {
      return {
        deliveryLogs: await this.prisma.alarmDeliveryLog.count({
          where: { notificationId: rootId },
        }),
        notifications: 1,
      };
    }
    if (rootType === ArchiveEntityType.ALARM_EVENT) {
      const [notifications, deliveryLogs, triggers] = await Promise.all([
        this.prisma.alarmNotification.count({ where: { alarmEventId: rootId } }),
        this.prisma.alarmDeliveryLog.count({
          where: { notification: { alarmEventId: rootId } },
        }),
        this.prisma.alarmPolicyTrigger.count({ where: { alarmEventId: rootId } }),
      ]);
      return { alarmEvents: 1, deliveryLogs, notifications, policyTriggers: triggers };
    }
    if (rootType === ArchiveEntityType.ALARM_RULE) {
      const [policies, counters, events, triggers, notifications, deliveryLogs] = await Promise.all(
        [
          this.prisma.alarmRecipientPolicy.count({ where: { ruleId: rootId } }),
          this.prisma.alarmCounterState.count({ where: { ruleId: rootId } }),
          this.prisma.alarmEvent.count({ where: { ruleId: rootId } }),
          this.prisma.alarmPolicyTrigger.count({ where: { ruleId: rootId } }),
          this.prisma.alarmNotification.count({ where: { policy: { ruleId: rootId } } }),
          this.prisma.alarmDeliveryLog.count({
            where: { notification: { policy: { ruleId: rootId } } },
          }),
        ],
      );
      return {
        alarmEvents: events,
        counters,
        deliveryLogs,
        notifications,
        policies,
        policyTriggers: triggers,
        rules: 1,
      };
    }
    if (rootType === ArchiveEntityType.ALARM_RECIPIENT_POLICY) {
      const [counters, triggers, notifications, deliveryLogs] = await Promise.all([
        this.prisma.alarmCounterState.count({ where: { policyId: rootId } }),
        this.prisma.alarmPolicyTrigger.count({ where: { policyId: rootId } }),
        this.prisma.alarmNotification.count({ where: { policyId: rootId } }),
        this.prisma.alarmDeliveryLog.count({ where: { notification: { policyId: rootId } } }),
      ]);
      return { counters, deliveryLogs, notifications, policies: 1, policyTriggers: triggers };
    }
    if (rootType === ArchiveEntityType.GATEWAY_COMMAND) return { commands: 1 };
    if (
      rootType === ArchiveEntityType.COMPANY_USER ||
      rootType === ArchiveEntityType.COMPANY_POSITION ||
      rootType === ArchiveEntityType.COMPANY_ROLE
    ) {
      return { records: 1 };
    }
    const scope =
      rootType === ArchiveEntityType.COMPANY
        ? { companyId: rootId }
        : rootType === ArchiveEntityType.CONSTRUCTION_AREA
          ? { areaId: rootId }
          : { buildingId: rootId };
    const siteCountPromise =
      rootType === ArchiveEntityType.COMPANY
        ? this.prisma.constructionArea.count({ where: { companyId: rootId } })
        : rootType === ArchiveEntityType.CONSTRUCTION_AREA
          ? Promise.resolve(1)
          : Promise.resolve(0);
    const buildingScope =
      rootType === ArchiveEntityType.COMPANY
        ? { companyId: rootId }
        : rootType === ArchiveEntityType.CONSTRUCTION_AREA
          ? { areaId: rootId }
          : { id: rootId };
    const userCountPromise =
      rootType === ArchiveEntityType.COMPANY
        ? this.prisma.companyUser.count({ where: { companyId: rootId } })
        : Promise.resolve(0);
    const [sites, buildings, users, readings, rules, events, notifications, commands, reports] =
      await Promise.all([
        siteCountPromise,
        this.prisma.constructionBuilding.count({ where: buildingScope }),
        userCountPromise,
        this.prisma.sensorReading.count({ where: scope }),
        this.prisma.alarmRule.count({ where: scope }),
        this.prisma.alarmEvent.count({ where: scope }),
        this.prisma.alarmNotification.count({ where: { alarmEvent: scope } }),
        this.prisma.gatewayCommand.count({ where: scope }),
        this.prisma.reportJob.count({ where: scope }),
      ]);
    const [assignedGatewayRows, assignedNodeRows, images, auditRows] = await Promise.all([
      rootType === ArchiveEntityType.COMPANY
        ? this.prisma.companyDeviceAssignment.findMany({
            distinct: ["gatewayId"],
            select: { gatewayId: true },
            where: { companyId: rootId, gatewayId: { not: null } },
          })
        : this.prisma.gatewayBuildingAssignment.findMany({
            distinct: ["gatewayId"],
            select: { gatewayId: true },
            where: {
              building:
                rootType === ArchiveEntityType.CONSTRUCTION_AREA
                  ? { areaId: rootId }
                  : { id: rootId },
            },
          }),
      rootType === ArchiveEntityType.COMPANY
        ? this.prisma.companyDeviceAssignment.findMany({
            distinct: ["nodeId"],
            select: { nodeId: true },
            where: { companyId: rootId, nodeId: { not: null } },
          })
        : this.prisma.nodeGatewayAssignment.findMany({
            distinct: ["nodeId"],
            select: { nodeId: true },
            where: {
              gateway: {
                buildingAssignments: {
                  some: {
                    building:
                      rootType === ArchiveEntityType.CONSTRUCTION_AREA
                        ? { areaId: rootId }
                        : { id: rootId },
                  },
                },
              },
            },
          }),
      this.prisma.buildingPlanImage.count({
        where: {
          building:
            rootType === ArchiveEntityType.COMPANY
              ? { companyId: rootId }
              : rootType === ArchiveEntityType.CONSTRUCTION_AREA
                ? { areaId: rootId }
                : { id: rootId },
        },
      }),
      this.prisma.auditLog.count({ where: scope }),
    ]);
    const assignedGateways = assignedGatewayRows.length;
    const assignedNodes = assignedNodeRows.length;
    return {
      alarmEvents: events,
      assignedGateways,
      assignedNodes,
      auditRows,
      buildings,
      commands,
      images,
      notifications,
      reports,
      rules,
      sensorReadings: readings,
      sites,
      users,
    };
  }

  private async groupSummary(query: ListArchiveQueryDto) {
    const scope = { companyId: query.companyId };
    const [
      companies,
      sites,
      buildings,
      users,
      positions,
      roles,
      rules,
      policies,
      events,
      notifications,
      commands,
    ] = await Promise.all([
      this.prisma.company.count({ where: { deletedAt: { not: null } } }),
      this.prisma.constructionArea.count({
        where: {
          ...scope,
          OR: [{ deletedAt: { not: null } }, { company: { deletedAt: { not: null } } }],
        },
      }),
      this.prisma.constructionBuilding.count({
        where: {
          ...scope,
          OR: [
            { deletedAt: { not: null } },
            { area: { deletedAt: { not: null } } },
            { company: { deletedAt: { not: null } } },
          ],
        },
      }),
      this.prisma.companyUser.count({
        where: {
          ...scope,
          OR: [{ deletedAt: { not: null } }, { company: { deletedAt: { not: null } } }],
        },
      }),
      this.prisma.companyPosition.count({
        where: {
          ...scope,
          OR: [{ deletedAt: { not: null } }, { company: { deletedAt: { not: null } } }],
        },
      }),
      this.prisma.companyRole.count({
        where: {
          ...scope,
          OR: [{ deletedAt: { not: null } }, { company: { deletedAt: { not: null } } }],
        },
      }),
      this.prisma.alarmRule.count({
        where: {
          ...scope,
          OR: [{ deletedAt: { not: null } }, { company: { deletedAt: { not: null } } }],
        },
      }),
      this.prisma.alarmRecipientPolicy.count({
        where: { deletedAt: { not: null }, ...(query.companyId ? { rule: scope } : {}) },
      }),
      this.prisma.alarmEvent.count({ where: { ...scope, deletedAt: { not: null } } }),
      this.prisma.alarmNotification.count({
        where: { deletedAt: { not: null }, ...(query.companyId ? { alarmEvent: scope } : {}) },
      }),
      this.prisma.gatewayCommand.count({ where: { ...scope, deletedAt: { not: null } } }),
    ]);
    return {
      groups: {
        alarmConfiguration: { policies, rules },
        alarmOperations: { events, notifications },
        companyManagement: { positions, roles, users },
        deviceOperations: { commands },
        organizations: { buildings, companies, sites },
      },
      total:
        companies +
        sites +
        buildings +
        users +
        positions +
        roles +
        rules +
        policies +
        events +
        notifications +
        commands,
    };
  }

  private archiveMetadataWhere(query: ListArchiveQueryDto): Record<string, unknown> {
    return {
      deletedAt: {
        gte: query.archivedFrom ? new Date(query.archivedFrom) : undefined,
        lte: query.archivedTo ? new Date(query.archivedTo) : undefined,
        not: null,
      },
      deletedById: query.archivedBy,
    };
  }

  private archiveMetadataConditions(query: ListArchiveQueryDto) {
    return {
      deletedAt: {
        gte: query.archivedFrom ? new Date(query.archivedFrom) : undefined,
        lte: query.archivedTo ? new Date(query.archivedTo) : undefined,
        not: null,
      },
      deletedById: query.archivedBy,
    };
  }

  private async listAreas(query: ListArchiveQueryDto) {
    const metadata = this.archiveMetadataConditions(query);
    const where = {
      companyId: query.companyId,
      id: query.areaId,
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {}),
      OR: [{ ...metadata }, { company: { ...metadata } }],
    };
    const [items, total] = await Promise.all([
      this.prisma.constructionArea.findMany({
        include: {
          company: {
            select: { deleteReason: true, deletedAt: true, deletedById: true, deletedByType: true },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        where,
        ...pageWindow(query),
      }),
      this.prisma.constructionArea.count({ where }),
    ]);
    return paginated(
      items.map(({ company, ...item }) => ({
        deleteReason: item.deleteReason ?? company.deleteReason,
        deletedAt: item.deletedAt ?? company.deletedAt,
        deletedById: item.deletedById ?? company.deletedById,
        deletedByType: item.deletedByType ?? company.deletedByType,
        id: item.id,
        name: item.name,
        parentDerived: !item.deletedAt,
      })),
      total,
      query,
    );
  }

  private async listBuildings(query: ListArchiveQueryDto) {
    const metadata = this.archiveMetadataConditions(query);
    const where = {
      areaId: query.areaId,
      companyId: query.companyId,
      id: query.buildingId,
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" as const } } : {}),
      OR: [{ ...metadata }, { area: { ...metadata } }, { company: { ...metadata } }],
    };
    const [items, total] = await Promise.all([
      this.prisma.constructionBuilding.findMany({
        include: {
          area: {
            select: {
              deleteReason: true,
              deletedAt: true,
              deletedById: true,
              deletedByType: true,
              name: true,
            },
          },
          company: {
            select: {
              deleteReason: true,
              deletedAt: true,
              deletedById: true,
              deletedByType: true,
              name: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        where,
        ...pageWindow(query),
      }),
      this.prisma.constructionBuilding.count({ where }),
    ]);
    return paginated(
      items.map(({ area, company, ...item }) => {
        const source = item.deletedAt ? item : area.deletedAt ? area : company;
        return {
          areaId: item.areaId,
          areaName: area.name,
          companyId: item.companyId,
          companyName: company.name,
          deleteReason: source.deleteReason,
          deletedAt: source.deletedAt,
          deletedById: source.deletedById,
          deletedByType: source.deletedByType,
          id: item.id,
          parentDerived: !item.deletedAt,
          title: item.title,
        };
      }),
      total,
      query,
    );
  }

  private async listModel(
    model: ArchiveDelegate,
    rawWhere: Record<string, unknown>,
    query: ListArchiveQueryDto,
    searchField?: string,
  ) {
    const where = stripUndefined({
      ...rawWhere,
      ...(query.search && searchField
        ? { [searchField]: { contains: query.search, mode: "insensitive" } }
        : {}),
    });
    const [items, total] = await Promise.all([
      model.findMany({
        orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
        select: {
          deleteReason: true,
          deletedAt: true,
          deletedById: true,
          deletedByType: true,
          id: true,
          ...(searchField ? { [searchField]: true } : {}),
        },
        where,
        ...pageWindow(query),
      }),
      model.count({ where }),
    ]);
    return paginated(items, total, query);
  }
}

type ArchiveDelegate = {
  count(args: { where: Record<string, unknown> }): Promise<number>;
  findMany(args: Record<string, unknown>): Promise<unknown[]>;
};

type ArchiveRoot = Record<string, unknown> & {
  area?: { deletedAt?: Date | null } | null;
  company?: { deletedAt?: Date | null } | null;
  companyId?: string | null;
  commandType?: string;
  deletedAt?: Date | null;
  id: string;
  name?: string | null;
  title?: string | null;
};

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const unreferencedReadingWhere = {
  firstCounterStates: { none: {} },
  firstPolicyTriggers: { none: {} },
  lastCounterStates: { none: {} },
  lastPolicyTriggers: { none: {} },
  triggerReadings: { none: {} },
} satisfies Prisma.SensorReadingWhereInput;

export function sensorReadingFilterWhere(
  filters: SensorReadingPurgeFilterDto,
): Prisma.SensorReadingWhereInput {
  return {
    areaId: filters.areaId,
    buildingId: filters.buildingId,
    companyId: filters.companyId,
    faultFiltered: filters.faultFiltered,
    nodeId: filters.nodeId,
    nodeTypeId: filters.nodeTypeId,
    receivedAt: { gte: new Date(filters.from), lt: new Date(filters.to) },
    status: filters.status,
  };
}

export function unreferencedSensorReadingWhere(): Prisma.SensorReadingWhereInput {
  return unreferencedReadingWhere;
}

function canonicalSensorFilters(filters: SensorReadingPurgeFilterDto) {
  return Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}
