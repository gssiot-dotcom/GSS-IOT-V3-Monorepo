import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AssignmentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreateGatewayDto,
  CreateNodeDto,
  UpdateGatewayDto,
  UpdateNodeDto,
} from "./dto/devices.dto";

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

  listGateways() {
    return this.prisma.gateway.findMany({
      orderBy: { serialNumber: "asc" },
      select: gatewaySelect,
    });
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

  listNodes() {
    return this.prisma.node.findMany({ orderBy: { number: "asc" }, select: nodeSelect });
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
      const oldAssignment = await this.endActiveGatewayCompanyAssignment(gatewayId, tx);
      await this.endActiveGatewayBuildingAssignment(gatewayId, tx);
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
      const oldAssignment = await this.endActiveNodeCompanyAssignment(nodeId, tx);
      await this.endActiveNodeGatewayAssignment(nodeId, tx);
      await this.auditLog.record(
        actor,
        {
          action: "node.company.unassign",
          entityId: nodeId,
          entityType: "Node",
          oldValue: { assignment: oldAssignment },
        },
        tx,
      );
      return this.getNodeOrThrow(nodeId, tx);
    });
  }

  assignNodeToGateway(actor: AuthTokenPayload, nodeId: string, gatewayId: string) {
    return this.prisma.$transaction(async (tx) => {
      const [nodeCompany, gatewayCompany] = await Promise.all([
        this.getActiveNodeCompanyAssignment(nodeId, tx),
        this.getActiveGatewayCompanyAssignment(gatewayId, tx),
      ]);
      if (nodeCompany.companyId !== gatewayCompany.companyId) {
        throw new ForbiddenException("Node and gateway must belong to the same company.");
      }
      await this.endActiveNodeGatewayAssignment(nodeId, tx);
      const assignment = await tx.nodeGatewayAssignment.create({ data: { gatewayId, nodeId } });
      await this.auditLog.record(
        actor,
        {
          action: "node.gateway.assign",
          entityId: nodeId,
          entityType: "Node",
          newValue: { assignment },
        },
        tx,
      );
      return this.getNodeOrThrow(nodeId, tx);
    });
  }

  unassignNodeFromGateway(actor: AuthTokenPayload, nodeId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.getNodeOrThrow(nodeId, tx);
      const oldAssignment = await this.endActiveNodeGatewayAssignment(nodeId, tx);
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

  async listCompanyDevices(companyUserId: string) {
    const { companyId } = await this.getCompanyUserContext(companyUserId);
    return this.listCompanyDeviceSnapshot({ companyId });
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

  private async getActiveNodeCompanyAssignment(nodeId: string, executor: PrismaExecutor) {
    await this.getNodeOrThrow(nodeId, executor);
    const assignment = await executor.companyDeviceAssignment.findFirst({
      where: { nodeId, status: AssignmentStatus.ACTIVE },
    });
    if (!assignment) {
      throw new ConflictException("The node must be assigned to a company first.");
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
    return executor.companyDeviceAssignment.update({
      where: { id: assignmentId },
      data: { activeKey: assignmentId, status: AssignmentStatus.ENDED, unassignedAt: new Date() },
    });
  }

  private async endActiveGatewayBuildingAssignment(gatewayId: string, executor: PrismaExecutor) {
    const assignment = await executor.gatewayBuildingAssignment.findFirst({
      where: { gatewayId, status: AssignmentStatus.ACTIVE },
    });
    return assignment
      ? executor.gatewayBuildingAssignment.update({
          where: { id: assignment.id },
          data: {
            activeKey: assignment.id,
            status: AssignmentStatus.ENDED,
            unassignedAt: new Date(),
          },
        })
      : null;
  }

  private async endActiveNodeGatewayAssignment(nodeId: string, executor: PrismaExecutor) {
    const assignment = await executor.nodeGatewayAssignment.findFirst({
      where: { nodeId, status: AssignmentStatus.ACTIVE },
    });
    return assignment
      ? executor.nodeGatewayAssignment.update({
          where: { id: assignment.id },
          data: {
            activeKey: assignment.id,
            status: AssignmentStatus.ENDED,
            unassignedAt: new Date(),
          },
        })
      : null;
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
}
