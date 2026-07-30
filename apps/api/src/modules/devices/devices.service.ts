import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AlarmEventStatus,
  AssignmentStatus,
  DeviceLifecycleStatus,
  GatewayCommandStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import {
  paginated,
  pageWindow,
  type SearchPaginationQueryDto,
} from "../../common/dto/pagination.dto";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  BulkCreateNodesDto,
  CompanyDeviceInventoryQueryDto,
  CreateGatewayDto,
  CreateNodeDto,
  UpdateGatewayDto,
  UpdateNodeDto,
} from "./dto/devices.dto";
import { parseNodeNumberInput } from "@gss-iot/contracts";

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

const nodeTypeSelect = {
  id: true,
  key: true,
  displayName: true,
  numericCode: true,
  imageAssetKey: true,
} satisfies Prisma.NodeTypeSelect;

const gatewaySelect = {
  id: true,
  serialNumber: true,
  gatewayType: true,
  status: true,
  installedLocation: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
  companyAssignments: {
    where: { status: AssignmentStatus.ACTIVE },
    select: { id: true, companyId: true, assignedAt: true, company: { select: { name: true } } },
  },
  buildingAssignments: {
    where: { status: AssignmentStatus.ACTIVE },
    select: {
      id: true,
      assignedAt: true,
      buildingId: true,
      building: { select: { areaId: true, companyId: true, title: true } },
    },
  },
} satisfies Prisma.GatewaySelect;

const nodeSelect = {
  id: true,
  nodeTypeId: true,
  number: true,
  status: true,
  installedLocation: true,
  batteryLevel: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
  nodeType: { select: nodeTypeSelect },
  companyAssignments: {
    where: { status: AssignmentStatus.ACTIVE },
    select: { id: true, companyId: true, assignedAt: true, company: { select: { name: true } } },
  },
  gatewayAssignments: {
    where: { status: AssignmentStatus.ACTIVE },
    select: {
      id: true,
      assignedAt: true,
      gatewayId: true,
      gateway: { select: { serialNumber: true } },
    },
  },
} satisfies Prisma.NodeSelect;

const provisioningOptionsSelect = {
  areas: {
    orderBy: { name: "asc" as const },
    select: { companyId: true, id: true, name: true, status: true },
    where: { company: { deletedAt: null, status: "ACTIVE" as const }, deletedAt: null },
  },
  buildings: {
    orderBy: { title: "asc" as const },
    select: { areaId: true, companyId: true, id: true, status: true, title: true },
    where: {
      area: { deletedAt: null },
      company: { deletedAt: null, status: "ACTIVE" as const },
      deletedAt: null,
    },
  },
  companies: {
    orderBy: { name: "asc" as const },
    select: { id: true, name: true, status: true },
    where: { deletedAt: null, status: "ACTIVE" as const },
  },
};

@Injectable()
export class DevicesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  listNodeTypes() {
    return this.prisma.nodeType.findMany({
      orderBy: { numericCode: "asc" },
      select: nodeTypeSelect,
    });
  }

  async listGateways(query: SearchPaginationQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.GatewayWhereInput = {
      status: { not: DeviceLifecycleStatus.RETIRED },
      ...(search
        ? {
            OR: [
              { serialNumber: { contains: search, mode: "insensitive" } },
              { installedLocation: { contains: search, mode: "insensitive" } },
              {
                companyAssignments: {
                  some: { company: { name: { contains: search, mode: "insensitive" } } },
                },
              },
              {
                buildingAssignments: {
                  some: { building: { title: { contains: search, mode: "insensitive" } } },
                },
              },
            ],
          }
        : {}),
    };
    const [gateways, total] = await this.prisma.$transaction([
      this.prisma.gateway.findMany({
        orderBy: [{ serialNumber: "asc" }, { id: "asc" }],
        select: gatewaySelect,
        where,
        ...pageWindow(query),
      }),
      this.prisma.gateway.count({ where }),
    ]);
    const items = await Promise.all(
      gateways.map(async (gateway) => ({
        ...gateway,
        deletion: await this.getGatewayDeletionCapability(gateway.id),
      })),
    );
    return paginated(items, total, query);
  }

  createGateway(actor: AuthTokenPayload, dto: CreateGatewayDto) {
    return this.prisma.$transaction(async (tx) => {
      const gateway = await tx.gateway.create({ data: dto, select: gatewaySelect });
      await this.auditLog.record(
        actor,
        {
          action: "gateway.create",
          entityId: gateway.id,
          entityType: "Gateway",
          newValue: gateway,
        },
        tx,
      );
      return gateway;
    });
  }

  updateGateway(actor: AuthTokenPayload, gatewayId: string, dto: UpdateGatewayDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockGateway(gatewayId, tx);
      const oldGateway = await this.getGatewayOrThrow(gatewayId, tx);
      this.assertNormalLifecycleUpdate(oldGateway.status, dto.status, "gateway");
      const gateway = await tx.gateway.update({
        where: { id: gatewayId },
        data: dto,
        select: gatewaySelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "gateway.update",
          entityId: gateway.id,
          entityType: "Gateway",
          newValue: gateway,
          oldValue: oldGateway,
        },
        tx,
      );
      return gateway;
    });
  }

  async deleteGateway(actor: AuthTokenPayload, gatewayId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockGateway(gatewayId, tx);
      const gateway = await tx.gateway.findUnique({
        where: { id: gatewayId },
        select: { id: true, serialNumber: true, status: true },
      });
      if (!gateway) throw new NotFoundException("The gateway was not found.");
      if (gateway.status === DeviceLifecycleStatus.RETIRED) {
        throw new ConflictException("The gateway is already retired.");
      }

      const deletion = await this.getGatewayDeletionCapability(gatewayId, tx);
      if (!deletion.allowed) {
        throw new ConflictException({
          blocker: deletion.blocker,
          code: deletion.code,
          counts: deletion.counts,
          message: deletion.blocker,
          recommendedActions: deletion.recommendedActions,
        });
      }

      if (deletion.mode === "SOFT_DELETE") {
        const retired = await tx.gateway.update({
          where: { id: gatewayId },
          data: { status: DeviceLifecycleStatus.RETIRED },
          select: gatewaySelect,
        });
        await this.auditLog.record(
          actor,
          {
            action: "gateway.retire",
            entityId: gateway.id,
            entityType: "Gateway",
            newValue: retired,
            oldValue: gateway,
          },
          tx,
        );
        return { mode: deletion.mode, status: retired.status };
      }

      await tx.gateway.delete({ where: { id: gatewayId } });
      await this.auditLog.record(
        actor,
        {
          action: "gateway.delete",
          entityId: gateway.id,
          entityType: "Gateway",
          oldValue: gateway,
        },
        tx,
      );
      return { mode: deletion.mode };
    });
  }

  async listNodes(query: SearchPaginationQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.NodeWhereInput = {
      status: { not: DeviceLifecycleStatus.RETIRED },
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: "insensitive" } },
              { installedLocation: { contains: search, mode: "insensitive" } },
              { nodeType: { displayName: { contains: search, mode: "insensitive" } } },
              {
                companyAssignments: {
                  some: { company: { name: { contains: search, mode: "insensitive" } } },
                },
              },
              {
                gatewayAssignments: {
                  some: {
                    gateway: { serialNumber: { contains: search, mode: "insensitive" } },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [nodes, total] = await this.prisma.$transaction([
      this.prisma.node.findMany({
        orderBy: [{ number: "asc" }, { id: "asc" }],
        select: nodeSelect,
        where,
        ...pageWindow(query),
      }),
      this.prisma.node.count({ where }),
    ]);
    const items = await Promise.all(
      nodes.map(async (node) => ({
        ...node,
        deletion: await this.getNodeDeletionCapability(node.id),
      })),
    );
    return paginated(items, total, query);
  }

  async listProvisioningOptions() {
    const [companies, areas, buildings] = await Promise.all([
      this.prisma.company.findMany(provisioningOptionsSelect.companies),
      this.prisma.constructionArea.findMany(provisioningOptionsSelect.areas),
      this.prisma.constructionBuilding.findMany(provisioningOptionsSelect.buildings),
    ]);
    return { areas, buildings, companies };
  }

  createNode(actor: AuthTokenPayload, dto: CreateNodeDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.getNodeTypeOrThrow(dto.nodeTypeId, tx);
      const node = await tx.node.create({ data: dto, select: nodeSelect });
      await this.auditLog.record(
        actor,
        { action: "node.create", entityId: node.id, entityType: "Node", newValue: node },
        tx,
      );
      return node;
    });
  }

  async bulkCreateNodes(actor: AuthTokenPayload, dto: BulkCreateNodesDto) {
    const parsed = parseNodeNumberInput(dto.input);
    if (parsed.errors.length || !parsed.numbers.length) {
      throw new BadRequestException({
        code: "INVALID_NODE_NUMBER_INPUT",
        errors: parsed.errors,
        invalidSegments: parsed.invalidSegments,
        message:
          "Enter positive safe integers using single values, ranges or comma-separated lists.",
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await this.getNodeTypeOrThrow(dto.nodeTypeId, tx);
      const existingNodes = await tx.node.findMany({ select: { id: true, number: true } });
      const existingByCanonicalNumber = new Map<string, string>();
      for (const existingNode of existingNodes) {
        const existingNumber = parseNodeNumberInput(existingNode.number, 1);
        if (!existingNumber.errors.length && existingNumber.numbers[0]) {
          existingByCanonicalNumber.set(existingNumber.numbers[0], existingNode.id);
        }
      }
      const conflicts = parsed.numbers.filter((number) => existingByCanonicalNumber.has(number));
      if (conflicts.length) {
        throw new ConflictException({
          code: "NODE_NUMBER_CONFLICT",
          conflicts,
          message: `Node numbers already exist: ${conflicts.join(", ")}.`,
        });
      }

      const createdNodes = [];
      for (const number of parsed.numbers) {
        createdNodes.push(
          await tx.node.create({
            data: {
              installedLocation: dto.installedLocation,
              nodeTypeId: dto.nodeTypeId,
              number,
            },
            select: nodeSelect,
          }),
        );
      }
      await this.auditLog.record(
        actor,
        {
          action: "node.bulk_create",
          entityId: dto.nodeTypeId,
          entityType: "NodeBatch",
          newValue: {
            createdNodeIds: createdNodes.map((node) => node.id),
            numbers: createdNodes.map((node) => node.number),
            nodeTypeId: dto.nodeTypeId,
          },
        },
        tx,
      );
      return {
        created: createdNodes,
        createdCount: createdNodes.length,
        numbers: createdNodes.map((node) => node.number),
      };
    });
  }

  updateNode(actor: AuthTokenPayload, nodeId: string, dto: UpdateNodeDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockNode(nodeId, tx);
      const oldNode = await this.getNodeOrThrow(nodeId, tx);
      this.assertNormalLifecycleUpdate(oldNode.status, dto.status, "node");
      if (dto.nodeTypeId) {
        await this.getNodeTypeOrThrow(dto.nodeTypeId, tx);
      }
      const node = await tx.node.update({ where: { id: nodeId }, data: dto, select: nodeSelect });
      await this.auditLog.record(
        actor,
        {
          action: "node.update",
          entityId: node.id,
          entityType: "Node",
          newValue: node,
          oldValue: oldNode,
        },
        tx,
      );
      return node;
    });
  }

  async deleteNode(actor: AuthTokenPayload, nodeId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockNode(nodeId, tx);
      const node = await tx.node.findUnique({
        where: { id: nodeId },
        select: { id: true, number: true, status: true },
      });
      if (!node) throw new NotFoundException("The node was not found.");
      if (node.status === DeviceLifecycleStatus.RETIRED) {
        throw new ConflictException("The node is already retired.");
      }

      const deletion = await this.getNodeDeletionCapability(nodeId, tx);
      if (!deletion.allowed) {
        throw new ConflictException({
          blocker: deletion.blocker,
          code: deletion.code,
          counts: deletion.counts,
          message: deletion.blocker,
          recommendedActions: deletion.recommendedActions,
        });
      }

      if (deletion.mode === "SOFT_DELETE") {
        const retired = await tx.node.update({
          where: { id: nodeId },
          data: { status: DeviceLifecycleStatus.RETIRED },
          select: nodeSelect,
        });
        await this.auditLog.record(
          actor,
          {
            action: "node.retire",
            entityId: node.id,
            entityType: "Node",
            newValue: retired,
            oldValue: node,
          },
          tx,
        );
        return { mode: deletion.mode, status: retired.status };
      }

      await tx.node.delete({ where: { id: nodeId } });
      await this.auditLog.record(
        actor,
        {
          action: "node.delete",
          entityId: node.id,
          entityType: "Node",
          oldValue: node,
        },
        tx,
      );
      return { mode: deletion.mode };
    });
  }

  assignGatewayToCompany(actor: AuthTokenPayload, gatewayId: string, companyId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockGateway(gatewayId, tx);
      await Promise.all([
        this.getAssignableGateway(gatewayId, tx),
        this.getCompanyOrThrow(companyId, tx),
      ]);
      await this.endActiveGatewayCompanyAssignment(gatewayId, tx);
      const assignment = await tx.companyDeviceAssignment.create({
        data: { companyId, gatewayId },
      });
      await this.auditLog.record(
        actor,
        {
          action: "gateway.company.assign",
          entityId: gatewayId,
          entityType: "Gateway",
          newValue: { assignment },
        },
        tx,
      );
      return this.getGatewayOrThrow(gatewayId, tx);
    });
  }

  unassignGatewayFromCompany(actor: AuthTokenPayload, gatewayId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.getGatewayOrThrow(gatewayId, tx);
      const [buildingAssignments, nodeAssignments] = await Promise.all([
        tx.gatewayBuildingAssignment.count({
          where: { gatewayId, status: AssignmentStatus.ACTIVE },
        }),
        tx.nodeGatewayAssignment.count({
          where: { gatewayId, status: AssignmentStatus.ACTIVE },
        }),
      ]);
      if (buildingAssignments > 0 || nodeAssignments > 0) {
        throw new ConflictException({
          blocker: `Unassign ${buildingAssignments} building relationship(s) and ${nodeAssignments} node relationship(s) first.`,
          code: "GATEWAY_COMPANY_UNASSIGN_HAS_CHILD_ASSIGNMENTS",
          counts: { buildingAssignments, nodeAssignments },
          message: "The gateway still has active child assignments.",
          recommendedAlternative: "Unassign the building and nodes before removing the company.",
        });
      }
      const oldAssignment = await this.endActiveGatewayCompanyAssignment(gatewayId, tx);
      if (!oldAssignment) {
        throw new ConflictException({
          blocker: "The gateway has no active company assignment.",
          code: "GATEWAY_COMPANY_ASSIGNMENT_NOT_ACTIVE",
          message: "The gateway is already unassigned.",
        });
      }
      await this.auditLog.record(
        actor,
        {
          action: "gateway.company.unassign",
          entityId: gatewayId,
          entityType: "Gateway",
          oldValue: { assignment: oldAssignment },
        },
        tx,
      );
      return this.getGatewayOrThrow(gatewayId, tx);
    });
  }

  assignGatewayToBuilding(actor: AuthTokenPayload, gatewayId: string, buildingId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockGateway(gatewayId, tx);
      await this.getAssignableGateway(gatewayId, tx);
      const [gatewayCompany, building] = await Promise.all([
        this.getActiveGatewayCompanyAssignment(gatewayId, tx),
        this.getBuildingOrThrow(buildingId, tx),
      ]);
      if (gatewayCompany.companyId !== building.companyId) {
        throw new ForbiddenException("Gateway and building must belong to the same company.");
      }
      await this.endActiveGatewayBuildingAssignment(gatewayId, tx);
      const assignment = await tx.gatewayBuildingAssignment.create({
        data: { buildingId, gatewayId },
      });
      await this.auditLog.record(
        actor,
        {
          action: "gateway.building.assign",
          entityId: gatewayId,
          entityType: "Gateway",
          newValue: { assignment },
        },
        tx,
      );
      return this.getGatewayOrThrow(gatewayId, tx);
    });
  }

  unassignGatewayFromBuilding(actor: AuthTokenPayload, gatewayId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.getGatewayOrThrow(gatewayId, tx);
      const oldAssignment = await this.endActiveGatewayBuildingAssignment(gatewayId, tx);
      if (!oldAssignment) {
        throw new ConflictException({
          blocker: "The gateway has no active building assignment.",
          code: "GATEWAY_BUILDING_ASSIGNMENT_NOT_ACTIVE",
          message: "The gateway is already unassigned from a building.",
        });
      }
      await this.auditLog.record(
        actor,
        {
          action: "gateway.building.unassign",
          entityId: gatewayId,
          entityType: "Gateway",
          oldValue: { assignment: oldAssignment },
        },
        tx,
      );
      return this.getGatewayOrThrow(gatewayId, tx);
    });
  }

  assignNodeToCompany(actor: AuthTokenPayload, nodeId: string, companyId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockNode(nodeId, tx);
      await Promise.all([
        this.getAssignableNode(nodeId, tx),
        this.getCompanyOrThrow(companyId, tx),
      ]);
      await this.endActiveNodeCompanyAssignment(nodeId, tx);
      const assignment = await tx.companyDeviceAssignment.create({ data: { companyId, nodeId } });
      await this.auditLog.record(
        actor,
        {
          action: "node.company.assign",
          entityId: nodeId,
          entityType: "Node",
          newValue: { assignment },
        },
        tx,
      );
      return this.getNodeOrThrow(nodeId, tx);
    });
  }

  unassignNodeFromCompany(actor: AuthTokenPayload, nodeId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.getNodeOrThrow(nodeId, tx);
      const oldGatewayAssignment = await this.endActiveNodeGatewayAssignment(nodeId, tx);
      const oldAssignment = await this.endActiveNodeCompanyAssignment(nodeId, tx);
      if (!oldAssignment) {
        throw new ConflictException({
          blocker: "The node has no active company assignment.",
          code: "NODE_COMPANY_ASSIGNMENT_NOT_ACTIVE",
          message: "The node is already unassigned.",
        });
      }
      await this.auditLog.record(
        actor,
        {
          action: "node.company.unassign",
          entityId: nodeId,
          entityType: "Node",
          newValue: { physicalGatewayMembershipChanged: false },
          oldValue: {
            companyAssignment: oldAssignment,
            gatewayAssignment: oldGatewayAssignment,
          },
        },
        tx,
      );
      return this.getNodeOrThrow(nodeId, tx);
    });
  }

  assignNodeToGateway(actor: AuthTokenPayload, nodeId: string, gatewayId: string) {
    void actor;
    void nodeId;
    void gatewayId;
    throw new BadRequestException("Use MQTT register-nodes provisioning to assign nodes.");
  }

  unassignNodeFromGateway(actor: AuthTokenPayload, nodeId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.getNodeOrThrow(nodeId, tx);
      const oldAssignment = await this.endActiveNodeGatewayAssignment(nodeId, tx);
      if (!oldAssignment) {
        throw new ConflictException({
          blocker: "The node has no active gateway assignment.",
          code: "NODE_GATEWAY_ASSIGNMENT_NOT_ACTIVE",
          message: "The node is already unassigned from a gateway.",
        });
      }
      await this.auditLog.record(
        actor,
        {
          action: "node.gateway.unassign",
          entityId: nodeId,
          entityType: "Node",
          oldValue: { assignment: oldAssignment },
        },
        tx,
      );
      return this.getNodeOrThrow(nodeId, tx);
    });
  }

  async listCompanyDevices(companyUserId: string, query: CompanyDeviceInventoryQueryDto) {
    const { companyId } = await this.getCompanyUserContext(companyUserId);
    const gatewayWhere = {
      companyAssignments: { some: { companyId, status: AssignmentStatus.ACTIVE } },
      status: { not: DeviceLifecycleStatus.RETIRED },
    } satisfies Prisma.GatewayWhereInput;
    const nodeWhere = {
      companyAssignments: { some: { companyId, status: AssignmentStatus.ACTIVE } },
      status: { not: DeviceLifecycleStatus.RETIRED },
    } satisfies Prisma.NodeWhereInput;
    const [gatewayItems, gatewayTotal, nodeItems, nodeTotal] = await this.prisma.$transaction([
      this.prisma.gateway.findMany({
        orderBy: [{ serialNumber: "asc" }, { id: "asc" }],
        select: gatewaySelect,
        skip: (query.gatewayPage - 1) * query.gatewayPageSize,
        take: query.gatewayPageSize,
        where: gatewayWhere,
      }),
      this.prisma.gateway.count({ where: gatewayWhere }),
      this.prisma.node.findMany({
        orderBy: [{ number: "asc" }, { id: "asc" }],
        select: nodeSelect,
        skip: (query.nodePage - 1) * query.nodePageSize,
        take: query.nodePageSize,
        where: nodeWhere,
      }),
      this.prisma.node.count({ where: nodeWhere }),
    ]);
    return {
      gateways: paginated(gatewayItems, gatewayTotal, {
        page: query.gatewayPage,
        pageSize: query.gatewayPageSize,
      }),
      nodes: paginated(nodeItems, nodeTotal, {
        page: query.nodePage,
        pageSize: query.nodePageSize,
      }),
    };
  }

  async listCompanyAreaDevices(companyUserId: string, areaId: string) {
    const { companyId } = await this.getCompanyUserContext(companyUserId);
    await this.assertAreaBelongsToCompany(areaId, companyId);
    return this.listCompanyDeviceSnapshot({ areaId, companyId });
  }

  async listCompanyBuildingDevices(companyUserId: string, buildingId: string) {
    const { companyId } = await this.getCompanyUserContext(companyUserId);
    await this.assertBuildingBelongsToCompany(buildingId, companyId);
    return this.listCompanyDeviceSnapshot({ buildingId, companyId });
  }

  private async listCompanyDeviceSnapshot(filter: {
    areaId?: string;
    buildingId?: string;
    companyId: string;
  }) {
    const gateways = await this.prisma.gateway.findMany({
      where: {
        status: { not: DeviceLifecycleStatus.RETIRED },
        companyAssignments: {
          some: { companyId: filter.companyId, status: AssignmentStatus.ACTIVE },
        },
        ...(filter.areaId || filter.buildingId
          ? {
              buildingAssignments: {
                some: {
                  status: AssignmentStatus.ACTIVE,
                  building: { areaId: filter.areaId, id: filter.buildingId },
                },
              },
            }
          : {}),
      },
      orderBy: { serialNumber: "asc" },
      select: gatewaySelect,
    });
    const gatewayIds = gateways.map(({ id }) => id);
    const nodes = await this.prisma.node.findMany({
      where: {
        status: { not: DeviceLifecycleStatus.RETIRED },
        companyAssignments: {
          some: { companyId: filter.companyId, status: AssignmentStatus.ACTIVE },
        },
        ...(filter.areaId || filter.buildingId
          ? {
              gatewayAssignments: {
                some: {
                  status: AssignmentStatus.ACTIVE,
                  gatewayId: {
                    in: gatewayIds.length ? gatewayIds : ["00000000-0000-0000-0000-000000000000"],
                  },
                },
              },
            }
          : {}),
      },
      orderBy: { number: "asc" },
      select: nodeSelect,
    });
    return { gateways, nodes };
  }

  private async getGatewayOrThrow(gatewayId: string, executor: PrismaExecutor) {
    const gateway = await executor.gateway.findUnique({
      where: { id: gatewayId },
      select: gatewaySelect,
    });
    if (!gateway) {
      throw new NotFoundException("The gateway was not found.");
    }
    return gateway;
  }

  private async getNodeOrThrow(nodeId: string, executor: PrismaExecutor) {
    const node = await executor.node.findUnique({ where: { id: nodeId }, select: nodeSelect });
    if (!node) {
      throw new NotFoundException("The node was not found.");
    }
    return node;
  }

  private async getAssignableGateway(gatewayId: string, executor: PrismaExecutor) {
    const gateway = await this.getGatewayOrThrow(gatewayId, executor);
    if (gateway.status === DeviceLifecycleStatus.RETIRED) {
      throw new ConflictException("Retired gateways cannot receive new assignments.");
    }
    return gateway;
  }

  private async getAssignableNode(nodeId: string, executor: PrismaExecutor) {
    const node = await this.getNodeOrThrow(nodeId, executor);
    if (node.status === DeviceLifecycleStatus.RETIRED) {
      throw new ConflictException("Retired nodes cannot receive new assignments.");
    }
    return node;
  }

  private assertNormalLifecycleUpdate(
    current: DeviceLifecycleStatus,
    requested: DeviceLifecycleStatus | undefined,
    device: "gateway" | "node",
  ) {
    if (current === DeviceLifecycleStatus.RETIRED) {
      throw new ConflictException(`Retired ${device}s cannot be updated or reactivated.`);
    }
    if (requested === DeviceLifecycleStatus.RETIRED) {
      throw new BadRequestException(`Use the ${device} retirement action to retire this device.`);
    }
  }

  private async lockGateway(gatewayId: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT "id" FROM "Gateway" WHERE "id" = ${gatewayId}::uuid FOR UPDATE`;
  }

  private async lockNode(nodeId: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT "id" FROM "Node" WHERE "id" = ${nodeId}::uuid FOR UPDATE`;
  }

  private async getNodeTypeOrThrow(nodeTypeId: string, executor: PrismaExecutor) {
    const nodeType = await executor.nodeType.findUnique({
      where: { id: nodeTypeId },
      select: nodeTypeSelect,
    });
    if (!nodeType) {
      throw new NotFoundException("The node type was not found.");
    }
    return nodeType;
  }

  private async getCompanyOrThrow(companyId: string, executor: PrismaExecutor) {
    const company = await executor.company.findFirst({
      where: { deletedAt: null, id: companyId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException("The company was not found.");
    }
    return company;
  }

  private async getBuildingOrThrow(buildingId: string, executor: PrismaExecutor) {
    const building = await executor.constructionBuilding.findFirst({
      where: {
        area: { deletedAt: null },
        company: { deletedAt: null, status: "ACTIVE" },
        deletedAt: null,
        id: buildingId,
      },
      select: { areaId: true, companyId: true, id: true },
    });
    if (!building) {
      throw new NotFoundException("The construction building was not found.");
    }
    return building;
  }

  private async getActiveGatewayCompanyAssignment(gatewayId: string, executor: PrismaExecutor) {
    await this.getGatewayOrThrow(gatewayId, executor);
    const assignment = await executor.companyDeviceAssignment.findFirst({
      where: {
        company: { deletedAt: null, status: "ACTIVE" },
        gatewayId,
        status: AssignmentStatus.ACTIVE,
      },
    });
    if (!assignment) {
      throw new ConflictException("The gateway must be assigned to a company first.");
    }
    return assignment;
  }

  private async endActiveGatewayCompanyAssignment(gatewayId: string, executor: PrismaExecutor) {
    const assignment = await executor.companyDeviceAssignment.findFirst({
      where: { gatewayId, status: AssignmentStatus.ACTIVE },
    });
    return assignment ? this.endCompanyDeviceAssignment(assignment.id, executor) : null;
  }

  private async endActiveNodeCompanyAssignment(nodeId: string, executor: PrismaExecutor) {
    const assignment = await executor.companyDeviceAssignment.findFirst({
      where: { nodeId, status: AssignmentStatus.ACTIVE },
    });
    return assignment ? this.endCompanyDeviceAssignment(assignment.id, executor) : null;
  }

  private async endCompanyDeviceAssignment(assignmentId: string, executor: PrismaExecutor) {
    const endedAt = new Date();
    const result = await executor.companyDeviceAssignment.updateMany({
      where: { id: assignmentId, status: AssignmentStatus.ACTIVE },
      data: { activeKey: assignmentId, status: AssignmentStatus.ENDED, unassignedAt: endedAt },
    });
    if (result.count !== 1) return null;
    return executor.companyDeviceAssignment.findUnique({ where: { id: assignmentId } });
  }

  private async endActiveGatewayBuildingAssignment(gatewayId: string, executor: PrismaExecutor) {
    const assignment = await executor.gatewayBuildingAssignment.findFirst({
      where: { gatewayId, status: AssignmentStatus.ACTIVE },
    });
    if (!assignment) return null;
    const result = await executor.gatewayBuildingAssignment.updateMany({
      where: { id: assignment.id, status: AssignmentStatus.ACTIVE },
      data: {
        activeKey: assignment.id,
        status: AssignmentStatus.ENDED,
        unassignedAt: new Date(),
      },
    });
    if (result.count !== 1) return null;
    return executor.gatewayBuildingAssignment.findUnique({ where: { id: assignment.id } });
  }

  private async endActiveNodeGatewayAssignment(nodeId: string, executor: PrismaExecutor) {
    const assignment = await executor.nodeGatewayAssignment.findFirst({
      where: { nodeId, status: AssignmentStatus.ACTIVE },
    });
    if (!assignment) return null;
    const result = await executor.nodeGatewayAssignment.updateMany({
      where: { id: assignment.id, status: AssignmentStatus.ACTIVE },
      data: {
        activeKey: assignment.id,
        status: AssignmentStatus.ENDED,
        unassignedAt: new Date(),
      },
    });
    if (result.count !== 1) return null;
    return executor.nodeGatewayAssignment.findUnique({ where: { id: assignment.id } });
  }

  private async getCompanyUserContext(companyUserId: string) {
    const user = await this.prisma.companyUser.findUnique({
      where: { id: companyUserId },
      select: {
        company: { select: { deletedAt: true, status: true } },
        companyId: true,
        deletedAt: true,
        isActive: true,
      },
    });
    if (
      !user ||
      !user.isActive ||
      user.deletedAt ||
      user.company.deletedAt ||
      user.company.status !== "ACTIVE"
    ) {
      throw new NotFoundException("The company user was not found.");
    }
    return user;
  }

  private async assertAreaBelongsToCompany(areaId: string, companyId: string) {
    const area = await this.prisma.constructionArea.findFirst({
      where: {
        company: { deletedAt: null, status: "ACTIVE" },
        companyId,
        deletedAt: null,
        id: areaId,
      },
      select: { id: true },
    });
    if (!area) {
      throw new NotFoundException("The construction area was not found.");
    }
  }

  private async assertBuildingBelongsToCompany(buildingId: string, companyId: string) {
    const building = await this.prisma.constructionBuilding.findFirst({
      where: {
        area: { deletedAt: null },
        company: { deletedAt: null, status: "ACTIVE" },
        companyId,
        deletedAt: null,
        id: buildingId,
      },
      select: { id: true },
    });
    if (!building) {
      throw new NotFoundException("The construction building was not found.");
    }
  }

  private async getGatewayDeletionCapability(
    gatewayId: string,
    executor: PrismaExecutor = this.prisma,
  ) {
    const [
      activeCompanyAssignments,
      activeBuildingAssignments,
      activeNodeAssignments,
      unfinishedCommands,
      unfinishedProvisioningRequests,
      activeAlarmEvents,
      companyAssignments,
      buildingAssignments,
      nodeAssignments,
      commands,
      provisioningRequests,
      alarmEvents,
      alarmLevelApplications,
      faultFilterDesiredStates,
      faultFilterAppliedStates,
      latestNodeStates,
      sensorReadings,
    ] = await Promise.all([
      executor.companyDeviceAssignment.count({
        where: { gatewayId, status: AssignmentStatus.ACTIVE },
      }),
      executor.gatewayBuildingAssignment.count({
        where: { gatewayId, status: AssignmentStatus.ACTIVE },
      }),
      executor.nodeGatewayAssignment.count({
        where: { gatewayId, status: AssignmentStatus.ACTIVE },
      }),
      executor.gatewayCommand.count({
        where: {
          gatewayId,
          status: {
            in: [
              GatewayCommandStatus.PENDING,
              GatewayCommandStatus.SENT,
              GatewayCommandStatus.FAILED,
            ],
          },
        },
      }),
      executor.nodeGatewayProvisioningRequest.count({
        where: {
          gatewayId,
          status: {
            in: [
              GatewayCommandStatus.PENDING,
              GatewayCommandStatus.SENT,
              GatewayCommandStatus.FAILED,
            ],
          },
        },
      }),
      executor.alarmEvent.count({
        where: {
          gatewayId,
          status: { in: [AlarmEventStatus.OPEN, AlarmEventStatus.ACKNOWLEDGED] },
        },
      }),
      executor.companyDeviceAssignment.count({ where: { gatewayId } }),
      executor.gatewayBuildingAssignment.count({ where: { gatewayId } }),
      executor.nodeGatewayAssignment.count({ where: { gatewayId } }),
      executor.gatewayCommand.count({ where: { gatewayId } }),
      executor.nodeGatewayProvisioningRequest.count({ where: { gatewayId } }),
      executor.alarmEvent.count({ where: { gatewayId } }),
      executor.gatewayAlarmLevelApplication.count({ where: { gatewayId } }),
      executor.gatewayFaultFilterDesiredState.count({ where: { gatewayId } }),
      executor.gatewayFaultFilterAppliedState.count({ where: { gatewayId } }),
      executor.latestNodeState.count({ where: { gatewayId } }),
      executor.sensorReading.count({ where: { gatewayId } }),
    ]);

    return deviceDeletionCapability(
      [
        [
          activeCompanyAssignments,
          "activeCompanyAssignments",
          "GATEWAY_ACTIVE_COMPANY_ASSIGNMENT",
          "Unassign the company first.",
        ],
        [
          activeBuildingAssignments,
          "activeBuildingAssignments",
          "GATEWAY_ACTIVE_BUILDING_ASSIGNMENT",
          "Unassign the building first.",
        ],
        [
          activeNodeAssignments,
          "activeNodeAssignments",
          "GATEWAY_ACTIVE_NODE_ASSIGNMENTS",
          `Unassign ${activeNodeAssignments} node(s) from this gateway first.`,
        ],
        [
          unfinishedCommands,
          "unfinishedCommands",
          "GATEWAY_UNFINISHED_COMMANDS",
          `Finish or cancel ${unfinishedCommands} unfinished gateway command(s) first.`,
        ],
        [
          unfinishedProvisioningRequests,
          "unfinishedProvisioningRequests",
          "GATEWAY_UNFINISHED_PROVISIONING",
          `Finish or cancel ${unfinishedProvisioningRequests} unfinished provisioning request(s) first.`,
        ],
        [
          activeAlarmEvents,
          "activeAlarmEvents",
          "GATEWAY_ACTIVE_ALARMS",
          `Resolve ${activeAlarmEvents} active alarm(s) first.`,
        ],
      ],
      {
        alarmConfigurationHistory: alarmLevelApplications,
        alarmHistory: alarmEvents,
        buildingAssignmentHistory: buildingAssignments,
        commandHistory: commands,
        companyAssignmentHistory: companyAssignments,
        faultFilterHistory: faultFilterDesiredStates + faultFilterAppliedStates,
        monitoringHistory: latestNodeStates,
        nodeAssignmentHistory: nodeAssignments,
        provisioningHistory: provisioningRequests,
        sensorHistory: sensorReadings,
      },
    );
  }

  private async getNodeDeletionCapability(nodeId: string, executor: PrismaExecutor = this.prisma) {
    const [
      activeCompanyAssignments,
      activeGatewayAssignments,
      unfinishedProvisioningItems,
      activeAlarmEvents,
      companyAssignments,
      gatewayAssignments,
      provisioningItems,
      faultFilterDesiredStates,
      faultFilterAppliedStates,
      latestStates,
      sensorReadings,
      counterStates,
      alarmEvents,
      policyTriggers,
      notifications,
    ] = await Promise.all([
      executor.companyDeviceAssignment.count({
        where: { nodeId, status: AssignmentStatus.ACTIVE },
      }),
      executor.nodeGatewayAssignment.count({
        where: { nodeId, status: AssignmentStatus.ACTIVE },
      }),
      executor.nodeGatewayProvisioningItem.count({
        where: {
          nodeId,
          request: {
            status: {
              in: [
                GatewayCommandStatus.PENDING,
                GatewayCommandStatus.SENT,
                GatewayCommandStatus.FAILED,
              ],
            },
          },
        },
      }),
      executor.alarmEvent.count({
        where: {
          nodeId,
          status: { in: [AlarmEventStatus.OPEN, AlarmEventStatus.ACKNOWLEDGED] },
        },
      }),
      executor.companyDeviceAssignment.count({ where: { nodeId } }),
      executor.nodeGatewayAssignment.count({ where: { nodeId } }),
      executor.nodeGatewayProvisioningItem.count({ where: { nodeId } }),
      executor.gatewayFaultFilterDesiredState.count({ where: { nodeId } }),
      executor.gatewayFaultFilterAppliedState.count({ where: { nodeId } }),
      executor.latestNodeState.count({ where: { nodeId } }),
      executor.sensorReading.count({ where: { nodeId } }),
      executor.alarmCounterState.count({ where: { nodeId } }),
      executor.alarmEvent.count({ where: { nodeId } }),
      executor.alarmPolicyTrigger.count({ where: { nodeId } }),
      executor.alarmNotification.count({ where: { alarmEvent: { nodeId } } }),
    ]);

    return deviceDeletionCapability(
      [
        [
          activeCompanyAssignments,
          "activeCompanyAssignments",
          "NODE_ACTIVE_COMPANY_ASSIGNMENT",
          "Unassign the company first.",
        ],
        [
          activeGatewayAssignments,
          "activeGatewayAssignments",
          "NODE_ACTIVE_GATEWAY_ASSIGNMENT",
          "Unassign the gateway first.",
        ],
        [
          unfinishedProvisioningItems,
          "unfinishedProvisioningItems",
          "NODE_UNFINISHED_PROVISIONING",
          `Finish or cancel ${unfinishedProvisioningItems} unfinished provisioning request(s) first.`,
        ],
        [
          activeAlarmEvents,
          "activeAlarmEvents",
          "NODE_ACTIVE_ALARMS",
          `Resolve ${activeAlarmEvents} active alarm(s) first.`,
        ],
      ],
      {
        alarmHistory: counterStates + alarmEvents + policyTriggers,
        alarmNotificationHistory: notifications,
        companyAssignmentHistory: companyAssignments,
        faultFilterHistory: faultFilterDesiredStates + faultFilterAppliedStates,
        monitoringHistory: latestStates,
        nodeAssignmentHistory: gatewayAssignments,
        provisioningHistory: provisioningItems,
        sensorHistory: sensorReadings,
      },
    );
  }
}

type ActiveDeviceBlocker = [number, string, string, string];

function deviceDeletionCapability(
  activeBlockers: ActiveDeviceBlocker[],
  historyCounts: Record<string, number>,
): {
  allowed: boolean;
  mode: "HARD_DELETE" | "SOFT_DELETE" | "NOT_ALLOWED";
  blocker: string | null;
  code: string | null;
  counts: Record<string, number>;
  recommendedActions: string[];
} {
  const counts = {
    ...historyCounts,
    ...Object.fromEntries(activeBlockers.map(([count, key]) => [key, count])),
  };
  const blocking = activeBlockers.find(([count]) => count > 0);
  if (blocking) {
    const [, , code, blocker] = blocking;
    return {
      allowed: false,
      blocker,
      code,
      counts,
      mode: "NOT_ALLOWED",
      recommendedActions: activeBlockers
        .filter(([count]) => count > 0)
        .map(([, , , action]) => action),
    };
  }
  const hasHistory = Object.values(historyCounts).some((count) => count > 0);
  return {
    allowed: true,
    blocker: null,
    code: null,
    counts,
    mode: hasHistory ? "SOFT_DELETE" : "HARD_DELETE",
    recommendedActions: [],
  };
}
