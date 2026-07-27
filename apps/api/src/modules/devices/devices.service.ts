import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AssignmentStatus } from "@prisma/client";
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
  },
  buildings: {
    orderBy: { title: "asc" as const },
    select: { areaId: true, companyId: true, id: true, status: true, title: true },
  },
  companies: {
    orderBy: { name: "asc" as const },
    select: { id: true, name: true, status: true },
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
    const where: Prisma.GatewayWhereInput = search
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
      : {};
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
      const oldGateway = await this.getGatewayOrThrow(gatewayId, tx);
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

  async deleteGateway(actor: AuthTokenPayload, gatewayId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const gateway = await tx.gateway.findUnique({
        where: { id: gatewayId },
        select: { id: true, serialNumber: true },
      });
      if (!gateway) throw new NotFoundException("The gateway was not found.");

      const deletion = await this.getGatewayDeletionCapability(gatewayId, tx);
      if (!deletion.allowed) {
        throw new ConflictException({
          blocker: deletion.blocker,
          code: "DEVICE_HISTORY_EXISTS",
          lifecycle: "INACTIVE_OR_RETIRED",
          message: "This gateway has business history and cannot be hard-deleted.",
        });
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
    });
  }

  async listNodes(query: SearchPaginationQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.NodeWhereInput = search
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
      : {};
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
      const oldNode = await this.getNodeOrThrow(nodeId, tx);
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

  async deleteNode(actor: AuthTokenPayload, nodeId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const node = await tx.node.findUnique({
        where: { id: nodeId },
        select: { id: true, number: true },
      });
      if (!node) throw new NotFoundException("The node was not found.");

      const deletion = await this.getNodeDeletionCapability(nodeId, tx);
      if (!deletion.allowed) {
        throw new ConflictException({
          blocker: deletion.blocker,
          code: "DEVICE_HISTORY_EXISTS",
          lifecycle: "INACTIVE_OR_RETIRED",
          message: "This node has business history and cannot be hard-deleted.",
        });
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
    });
  }

  assignGatewayToCompany(actor: AuthTokenPayload, gatewayId: string, companyId: string) {
    return this.prisma.$transaction(async (tx) => {
      await Promise.all([
        this.getGatewayOrThrow(gatewayId, tx),
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
      await Promise.all([this.getNodeOrThrow(nodeId, tx), this.getCompanyOrThrow(companyId, tx)]);
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
    } satisfies Prisma.GatewayWhereInput;
    const nodeWhere = {
      companyAssignments: { some: { companyId, status: AssignmentStatus.ACTIVE } },
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
    const company = await executor.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException("The company was not found.");
    }
    return company;
  }

  private async getBuildingOrThrow(buildingId: string, executor: PrismaExecutor) {
    const building = await executor.constructionBuilding.findUnique({
      where: { id: buildingId },
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
      where: { gatewayId, status: AssignmentStatus.ACTIVE },
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
      select: { companyId: true },
    });
    if (!user) {
      throw new NotFoundException("The company user was not found.");
    }
    return user;
  }

  private async assertAreaBelongsToCompany(areaId: string, companyId: string) {
    const area = await this.prisma.constructionArea.findFirst({
      where: { companyId, id: areaId },
      select: { id: true },
    });
    if (!area) {
      throw new NotFoundException("The construction area was not found.");
    }
  }

  private async assertBuildingBelongsToCompany(buildingId: string, companyId: string) {
    const building = await this.prisma.constructionBuilding.findFirst({
      where: { companyId, id: buildingId },
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

    return deletionCapability([
      [companyAssignments, "companyAssignmentHistory"],
      [buildingAssignments, "buildingAssignmentHistory"],
      [nodeAssignments, "nodeAssignmentHistory"],
      [commands, "commandHistory"],
      [provisioningRequests, "provisioningHistory"],
      [alarmEvents, "alarmHistory"],
      [alarmLevelApplications, "alarmConfigurationHistory"],
      [faultFilterDesiredStates, "faultFilterHistory"],
      [faultFilterAppliedStates, "faultFilterHistory"],
      [latestNodeStates, "monitoringHistory"],
      [sensorReadings, "sensorHistory"],
    ]);
  }

  private async getNodeDeletionCapability(nodeId: string, executor: PrismaExecutor = this.prisma) {
    const [
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

    return deletionCapability([
      [companyAssignments, "companyAssignmentHistory"],
      [gatewayAssignments, "nodeAssignmentHistory"],
      [provisioningItems, "provisioningHistory"],
      [faultFilterDesiredStates, "faultFilterHistory"],
      [faultFilterAppliedStates, "faultFilterHistory"],
      [latestStates, "monitoringHistory"],
      [sensorReadings, "sensorHistory"],
      [counterStates, "alarmHistory"],
      [alarmEvents, "alarmHistory"],
      [policyTriggers, "alarmHistory"],
      [notifications, "alarmNotificationHistory"],
    ]);
  }
}

function deletionCapability(blockers: Array<[number, string]>): {
  allowed: boolean;
  blocker: string | null;
} {
  const blocker = blockers.find(([count]) => count > 0)?.[1] ?? null;
  return { allowed: blocker === null, blocker };
}
