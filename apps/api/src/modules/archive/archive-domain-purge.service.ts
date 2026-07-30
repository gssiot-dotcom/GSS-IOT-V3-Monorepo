import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { loadApiEnv } from "@gss-iot/config";
import { ArchiveEntityType, DeletionJobPhase, GatewayCommandStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { PrivateAssetStorageService } from "../private-assets/private-asset-storage.service";
import { ReportStorageService } from "../reports/report-storage.service";
import { sensorReadingFilterWhere, unreferencedSensorReadingWhere } from "./archive-query.service";
import type { SensorReadingPurgeFilterDto } from "./dto/archive.dto";

const terminalCommands: GatewayCommandStatus[] = [
  GatewayCommandStatus.ACKNOWLEDGED,
  GatewayCommandStatus.FAILED,
  GatewayCommandStatus.EXPIRED,
  GatewayCommandStatus.CANCELLED,
];

type PurgeProgress = (
  phase: DeletionJobPhase,
  deletedCounts?: Record<string, number>,
) => Promise<void>;

type PurgeContext = {
  assertLease?: () => Promise<void>;
  resume?: boolean;
  resumeCounts?: Record<string, number>;
  typedFilter?: unknown;
};

@Injectable()
export class ArchiveDomainPurgeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PrivateAssetStorageService)
    private readonly privateStorage: PrivateAssetStorageService,
    @Inject(ReportStorageService) private readonly reportStorage: ReportStorageService,
  ) {}

  async purge(
    rootType: ArchiveEntityType,
    rootId: string | null,
    progress: PurgeProgress = async () => undefined,
    context: PurgeContext = {},
  ): Promise<Record<string, number>> {
    if (rootType === ArchiveEntityType.SENSOR_READING_FILTER) {
      return this.purgeSensorReadingFilter(context.typedFilter, progress, context);
    }
    if (!rootId) {
      throw new ConflictException({
        code: "PURGE_ROOT_REQUIRED",
        message: "This purge adapter requires a persisted root identifier.",
      });
    }
    await context.assertLease?.();
    if (context.resume && !(await this.rootExists(rootType, rootId))) {
      return context.resumeCounts ?? {};
    }
    if (rootType !== ArchiveEntityType.GATEWAY_COMMAND) {
      await this.assertArchivedRoot(rootType, rootId);
    }
    await progress(DeletionJobPhase.OPERATIONAL_TEARDOWN);
    switch (rootType) {
      case ArchiveEntityType.COMPANY_USER:
        return this.purgeCompanyUser(rootId);
      case ArchiveEntityType.COMPANY_POSITION:
        return this.purgeCompanyPosition(rootId);
      case ArchiveEntityType.COMPANY_ROLE:
        return this.purgeCompanyRole(rootId);
      case ArchiveEntityType.ALARM_NOTIFICATION:
        return this.purgeNotification(rootId);
      case ArchiveEntityType.ALARM_EVENT:
        return this.purgeEvent(rootId);
      case ArchiveEntityType.ALARM_RULE:
        return this.purgeRule(rootId);
      case ArchiveEntityType.ALARM_RECIPIENT_POLICY:
        return this.purgePolicy(rootId);
      case ArchiveEntityType.GATEWAY_COMMAND:
        return this.purgeGatewayCommand(rootId);
      case ArchiveEntityType.COMPANY:
      case ArchiveEntityType.CONSTRUCTION_AREA:
      case ArchiveEntityType.CONSTRUCTION_BUILDING:
        return this.purgeOrganization(rootType, rootId, progress, context);
      default:
        throw new ConflictException({
          code: "PURGE_DOMAIN_NOT_AVAILABLE",
          message: "This entity group does not yet have a verified physical purge adapter.",
        });
    }
  }

  private async purgeSensorReadingFilter(
    value: unknown,
    progress: PurgeProgress,
    context: PurgeContext,
  ) {
    const filters = readSensorFilters(value);
    const where = sensorReadingFilterWhere(filters);
    const referenced = await this.prisma.sensorReading.count({
      where: { ...where, NOT: unreferencedSensorReadingWhere() },
    });
    const env = loadApiEnv();
    let sensorReadings = context.resumeCounts?.sensorReadings ?? 0;
    await progress(DeletionJobPhase.SENSOR_READINGS, {
      preservedReferenced: referenced,
      sensorReadings,
    });
    for (;;) {
      await context.assertLease?.();
      const rows = await this.prisma.sensorReading.findMany({
        orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
        select: { id: true },
        take: env.DELETION_WORKER_BATCH_SIZE,
        where: { ...where, ...unreferencedSensorReadingWhere() },
      });
      if (!rows.length) break;
      const deleted = await this.prisma.sensorReading.deleteMany({
        where: { id: { in: rows.map(({ id }) => id) }, ...unreferencedSensorReadingWhere() },
      });
      sensorReadings += deleted.count;
      await progress(DeletionJobPhase.SENSOR_READINGS, {
        preservedReferenced: referenced,
        sensorReadings,
      });
      if (rows.length < env.DELETION_WORKER_BATCH_SIZE) break;
    }
    return { preservedReferenced: referenced, sensorReadings };
  }

  private async rootExists(rootType: ArchiveEntityType, rootId: string): Promise<boolean> {
    switch (rootType) {
      case ArchiveEntityType.COMPANY:
        return Boolean(
          await this.prisma.company.findUnique({ select: { id: true }, where: { id: rootId } }),
        );
      case ArchiveEntityType.CONSTRUCTION_AREA:
        return Boolean(
          await this.prisma.constructionArea.findUnique({
            select: { id: true },
            where: { id: rootId },
          }),
        );
      case ArchiveEntityType.CONSTRUCTION_BUILDING:
        return Boolean(
          await this.prisma.constructionBuilding.findUnique({
            select: { id: true },
            where: { id: rootId },
          }),
        );
      case ArchiveEntityType.COMPANY_USER:
        return Boolean(
          await this.prisma.companyUser.findUnique({ select: { id: true }, where: { id: rootId } }),
        );
      case ArchiveEntityType.COMPANY_POSITION:
        return Boolean(
          await this.prisma.companyPosition.findUnique({
            select: { id: true },
            where: { id: rootId },
          }),
        );
      case ArchiveEntityType.COMPANY_ROLE:
        return Boolean(
          await this.prisma.companyRole.findUnique({ select: { id: true }, where: { id: rootId } }),
        );
      case ArchiveEntityType.ALARM_RULE:
        return Boolean(
          await this.prisma.alarmRule.findUnique({ select: { id: true }, where: { id: rootId } }),
        );
      case ArchiveEntityType.ALARM_RECIPIENT_POLICY:
        return Boolean(
          await this.prisma.alarmRecipientPolicy.findUnique({
            select: { id: true },
            where: { id: rootId },
          }),
        );
      case ArchiveEntityType.ALARM_EVENT:
        return Boolean(
          await this.prisma.alarmEvent.findUnique({ select: { id: true }, where: { id: rootId } }),
        );
      case ArchiveEntityType.ALARM_NOTIFICATION:
        return Boolean(
          await this.prisma.alarmNotification.findUnique({
            select: { id: true },
            where: { id: rootId },
          }),
        );
      case ArchiveEntityType.GATEWAY_COMMAND:
        return Boolean(
          await this.prisma.gatewayCommand.findUnique({
            select: { id: true },
            where: { id: rootId },
          }),
        );
      case ArchiveEntityType.SENSOR_READING_FILTER:
        return true;
    }
  }

  private async assertArchivedRoot(rootType: ArchiveEntityType, rootId: string): Promise<void> {
    let archived = false;
    switch (rootType) {
      case ArchiveEntityType.COMPANY:
        archived = Boolean(
          await this.prisma.company.findFirst({ where: { deletedAt: { not: null }, id: rootId } }),
        );
        break;
      case ArchiveEntityType.CONSTRUCTION_AREA:
        archived = Boolean(
          await this.prisma.constructionArea.findFirst({
            where: {
              id: rootId,
              OR: [{ deletedAt: { not: null } }, { company: { deletedAt: { not: null } } }],
            },
          }),
        );
        break;
      case ArchiveEntityType.CONSTRUCTION_BUILDING:
        archived = Boolean(
          await this.prisma.constructionBuilding.findFirst({
            where: {
              id: rootId,
              OR: [
                { deletedAt: { not: null } },
                { area: { deletedAt: { not: null } } },
                { company: { deletedAt: { not: null } } },
              ],
            },
          }),
        );
        break;
      case ArchiveEntityType.COMPANY_USER:
        archived = Boolean(
          await this.prisma.companyUser.findFirst({
            where: { deletedAt: { not: null }, id: rootId },
          }),
        );
        break;
      case ArchiveEntityType.COMPANY_POSITION:
        archived = Boolean(
          await this.prisma.companyPosition.findFirst({
            where: { deletedAt: { not: null }, id: rootId },
          }),
        );
        break;
      case ArchiveEntityType.COMPANY_ROLE:
        archived = Boolean(
          await this.prisma.companyRole.findFirst({
            where: { deletedAt: { not: null }, id: rootId },
          }),
        );
        break;
      case ArchiveEntityType.ALARM_RULE:
        archived = Boolean(
          await this.prisma.alarmRule.findFirst({
            where: { deletedAt: { not: null }, id: rootId },
          }),
        );
        break;
      case ArchiveEntityType.ALARM_RECIPIENT_POLICY:
        archived = Boolean(
          await this.prisma.alarmRecipientPolicy.findFirst({
            where: { deletedAt: { not: null }, id: rootId },
          }),
        );
        break;
      case ArchiveEntityType.ALARM_EVENT:
        archived = Boolean(
          await this.prisma.alarmEvent.findFirst({
            where: { deletedAt: { not: null }, id: rootId },
          }),
        );
        break;
      case ArchiveEntityType.ALARM_NOTIFICATION:
        archived = Boolean(
          await this.prisma.alarmNotification.findFirst({
            where: { deletedAt: { not: null }, id: rootId },
          }),
        );
        break;
      case ArchiveEntityType.GATEWAY_COMMAND:
      case ArchiveEntityType.SENSOR_READING_FILTER:
        archived = true;
        break;
    }
    if (!archived) throw archivedRootConflict(rootType);
  }

  private async purgeCompanyUser(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.companyUser.findFirst({
        select: { id: true },
        where: { deletedAt: { not: null }, id },
      });
      if (!user) throw archivedRootConflict("CompanyUser");
      const activePolicies = await tx.alarmRecipientPolicy.count({
        where: { deletedAt: null, isActive: true, specificUserId: id },
      });
      if (activePolicies) throw activeDependencyConflict("CompanyUser", "recipient policies");
      const detachedPolicies = await tx.alarmRecipientPolicy.updateMany({
        data: { specificUserId: null },
        where: { specificUserId: id },
      });
      const detachedNotifications = await tx.alarmNotification.updateMany({
        data: { recipientUserId: null },
        where: { recipientUserId: id },
      });
      const deleted = await tx.companyUser.deleteMany({ where: { deletedAt: { not: null }, id } });
      return {
        detachedNotifications: detachedNotifications.count,
        detachedPolicies: detachedPolicies.count,
        users: deleted.count,
      };
    });
  }

  private async purgeCompanyPosition(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const position = await tx.companyPosition.findFirst({
        select: { id: true },
        where: { deletedAt: { not: null }, id },
      });
      if (!position) throw archivedRootConflict("CompanyPosition");
      const activePolicies = await tx.alarmRecipientPolicy.count({
        where: { deletedAt: null, isActive: true, positionId: id },
      });
      if (activePolicies) throw activeDependencyConflict("CompanyPosition", "recipient policies");
      const detachedPolicies = await tx.alarmRecipientPolicy.updateMany({
        data: { positionId: null },
        where: { positionId: id },
      });
      const assignments = await tx.companyUserPositionAssignment.deleteMany({
        where: { positionId: id },
      });
      const deleted = await tx.companyPosition.deleteMany({
        where: { deletedAt: { not: null }, id },
      });
      return {
        detachedPolicies: detachedPolicies.count,
        positionAssignments: assignments.count,
        positions: deleted.count,
      };
    });
  }

  private async purgeCompanyRole(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.companyRole.findFirst({
        select: { id: true, isCompanyOwnerRole: true, isSystem: true },
        where: { deletedAt: { not: null }, id },
      });
      if (!role) throw archivedRootConflict("CompanyRole");
      if (role.isSystem || role.isCompanyOwnerRole) {
        throw activeDependencyConflict("CompanyRole", "protected role state");
      }
      const users = await tx.companyUser.count({ where: { roleId: id } });
      if (users) throw activeDependencyConflict("CompanyRole", "assigned users");
      const permissions = await tx.companyRolePermission.deleteMany({ where: { roleId: id } });
      const deleted = await tx.companyRole.deleteMany({ where: { deletedAt: { not: null }, id } });
      return { rolePermissions: permissions.count, roles: deleted.count };
    });
  }

  private async purgeNotification(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const deliveryLogs = await tx.alarmDeliveryLog.deleteMany({ where: { notificationId: id } });
      const notifications = await tx.alarmNotification.deleteMany({
        where: { deletedAt: { not: null }, id },
      });
      return { deliveryLogs: deliveryLogs.count, notifications: notifications.count };
    });
  }

  private async purgeEvent(id: string) {
    const readingIds = await this.readingIds({ alarmEventId: id });
    const counts = await this.prisma.$transaction(async (tx) => {
      const deliveryLogs = await tx.alarmDeliveryLog.deleteMany({
        where: { notification: { alarmEventId: id } },
      });
      const notifications = await tx.alarmNotification.deleteMany({ where: { alarmEventId: id } });
      const policyTriggers = await tx.alarmPolicyTrigger.deleteMany({
        where: { alarmEventId: id },
      });
      const alarmEvents = await tx.alarmEvent.deleteMany({
        where: { deletedAt: { not: null }, id },
      });
      return {
        alarmEvents: alarmEvents.count,
        deliveryLogs: deliveryLogs.count,
        notifications: notifications.count,
        policyTriggers: policyTriggers.count,
      };
    });
    return { ...counts, orphanReadings: await this.deleteOrphanReadings(readingIds) };
  }

  private async purgeRule(id: string) {
    const readingIds = await this.readingIds({ ruleId: id });
    const counts = await this.prisma.$transaction(async (tx) => {
      const deliveryLogs = await tx.alarmDeliveryLog.deleteMany({
        where: { notification: { policy: { ruleId: id } } },
      });
      const notifications = await tx.alarmNotification.deleteMany({
        where: { policy: { ruleId: id } },
      });
      const policyTriggers = await tx.alarmPolicyTrigger.deleteMany({ where: { ruleId: id } });
      const alarmEvents = await tx.alarmEvent.deleteMany({ where: { ruleId: id } });
      const counters = await tx.alarmCounterState.deleteMany({ where: { ruleId: id } });
      const policies = await tx.alarmRecipientPolicy.deleteMany({ where: { ruleId: id } });
      const rules = await tx.alarmRule.deleteMany({ where: { deletedAt: { not: null }, id } });
      return {
        alarmEvents: alarmEvents.count,
        counters: counters.count,
        deliveryLogs: deliveryLogs.count,
        notifications: notifications.count,
        policies: policies.count,
        policyTriggers: policyTriggers.count,
        rules: rules.count,
      };
    });
    return { ...counts, orphanReadings: await this.deleteOrphanReadings(readingIds) };
  }

  private async purgePolicy(id: string) {
    const readingIds = await this.readingIds({ policyId: id });
    const counts = await this.prisma.$transaction(async (tx) => {
      const deliveryLogs = await tx.alarmDeliveryLog.deleteMany({
        where: { notification: { policyId: id } },
      });
      const notifications = await tx.alarmNotification.deleteMany({ where: { policyId: id } });
      const policyTriggers = await tx.alarmPolicyTrigger.deleteMany({ where: { policyId: id } });
      const counters = await tx.alarmCounterState.deleteMany({ where: { policyId: id } });
      const policies = await tx.alarmRecipientPolicy.deleteMany({
        where: { deletedAt: { not: null }, id },
      });
      return {
        counters: counters.count,
        deliveryLogs: deliveryLogs.count,
        notifications: notifications.count,
        policies: policies.count,
        policyTriggers: policyTriggers.count,
      };
    });
    return { ...counts, orphanReadings: await this.deleteOrphanReadings(readingIds) };
  }

  private async purgeGatewayCommand(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const command = await tx.gatewayCommand.findFirst({
        where: { deletedAt: { not: null }, id, status: { in: terminalCommands } },
      });
      if (!command) {
        throw new ConflictException({
          code: "GATEWAY_COMMAND_NOT_ARCHIVED_TERMINAL",
          message: "Only an archived terminal GatewayCommand can be purged.",
        });
      }
      await Promise.all([
        tx.gatewayAlarmLevelApplication.updateMany({
          data: { desiredCommandId: null },
          where: { desiredCommandId: id },
        }),
        tx.gatewayAlarmLevelApplication.updateMany({
          data: { appliedCommandId: null },
          where: { appliedCommandId: id },
        }),
        tx.gatewayFaultFilterDesiredState.updateMany({
          data: { desiredCommandId: null },
          where: { desiredCommandId: id },
        }),
        tx.gatewayFaultFilterAppliedState.updateMany({
          data: { appliedCommandId: null },
          where: { appliedCommandId: id },
        }),
      ]);
      const request = await tx.nodeGatewayProvisioningRequest.findUnique({
        select: { id: true },
        where: { commandId: id },
      });
      if (request) {
        await tx.nodeGatewayProvisioningEndedAssignment.deleteMany({
          where: { requestId: request.id },
        });
        await tx.nodeGatewayProvisioningItem.deleteMany({ where: { requestId: request.id } });
        await tx.nodeGatewayProvisioningRequest.delete({ where: { id: request.id } });
      }
      const result = await tx.gatewayCommand.deleteMany({ where: { id } });
      return { commands: result.count, provisioningRequests: request ? 1 : 0 };
    });
  }

  private async purgeOrganization(
    rootType: ArchiveEntityType,
    rootId: string,
    progress: PurgeProgress,
    context: PurgeContext,
  ) {
    const scope = organizationScope(rootType, rootId);
    const buildingWhere = organizationBuildingWhere(rootType, rootId);
    const commandWhere = organizationCommandWhere(scope);
    const reportWhere = organizationScalarWhere(scope);
    const [company, images, exports, commands] = await Promise.all([
      rootType === ArchiveEntityType.COMPANY
        ? this.prisma.company.findUnique({ select: { logoKey: true }, where: { id: rootId } })
        : null,
      this.prisma.buildingPlanImage.findMany({
        select: { storageKey: true },
        where: { building: buildingWhere },
      }),
      this.prisma.reportExport.findMany({
        select: { storageKey: true },
        where: { reportJob: reportWhere },
      }),
      this.prisma.gatewayCommand.findMany({ select: { id: true }, where: commandWhere }),
    ]);

    await context.assertLease?.();
    await progress(DeletionJobPhase.STORAGE_CLEANUP);
    for (const image of images) {
      await context.assertLease?.();
      await this.privateStorage.remove(image.storageKey);
    }
    if (company?.logoKey) {
      await context.assertLease?.();
      await this.privateStorage.remove(company.logoKey);
    }
    for (const report of exports) {
      await context.assertLease?.();
      await this.reportStorage.remove(report.storageKey);
    }

    const commandIds = commands.map(({ id }) => id);
    await context.assertLease?.();
    await progress(DeletionJobPhase.EVIDENCE);
    const evidenceCounts = await this.prisma.$transaction(async (tx) => {
      const deliveryLogs = await tx.alarmDeliveryLog.deleteMany({
        where: { notification: { alarmEvent: organizationScalarWhere(scope) } },
      });
      const notifications = await tx.alarmNotification.deleteMany({
        where: { alarmEvent: organizationScalarWhere(scope) },
      });
      const triggers = await tx.alarmPolicyTrigger.deleteMany({
        where: { alarmEvent: organizationScalarWhere(scope) },
      });
      const events = await tx.alarmEvent.deleteMany({ where: organizationScalarWhere(scope) });
      const counters = await tx.alarmCounterState.deleteMany({
        where: { rule: organizationScalarWhere(scope) },
      });
      const policies = await tx.alarmRecipientPolicy.deleteMany({
        where: { rule: organizationScalarWhere(scope) },
      });
      const rules = await tx.alarmRule.deleteMany({ where: organizationScalarWhere(scope) });
      return {
        alarmEvents: events.count,
        counters: counters.count,
        deliveryLogs: deliveryLogs.count,
        notifications: notifications.count,
        policies: policies.count,
        policyTriggers: triggers.count,
        rules: rules.count,
      };
    });

    await progress(DeletionJobPhase.SENSOR_READINGS, evidenceCounts);
    const env = loadApiEnv();
    let sensorReadings = 0;
    for (;;) {
      await context.assertLease?.();
      const ids = await this.prisma.sensorReading.findMany({
        orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
        select: { id: true },
        take: env.DELETION_WORKER_BATCH_SIZE,
        where: organizationScalarWhere(scope),
      });
      if (!ids.length) break;
      const deleted = await this.prisma.sensorReading.deleteMany({
        where: { id: { in: ids.map(({ id }) => id) } },
      });
      sensorReadings += deleted.count;
      await progress(DeletionJobPhase.SENSOR_READINGS, {
        ...evidenceCounts,
        sensorReadings,
      });
      if (ids.length < env.DELETION_WORKER_BATCH_SIZE) break;
    }

    await context.assertLease?.();
    await progress(DeletionJobPhase.TENANT_RELATIONS, {
      ...evidenceCounts,
      sensorReadings,
    });
    const finalCounts = await this.prisma.$transaction(async (tx) => {
      const reportExports = await tx.reportExport.deleteMany({
        where: { reportJob: reportWhere },
      });
      const reports = await tx.reportJob.deleteMany({ where: reportWhere });
      const latestStates = await tx.latestNodeState.deleteMany({
        where: organizationScalarWhere(scope),
      });
      const provisioningEnded = await tx.nodeGatewayProvisioningEndedAssignment.deleteMany({
        where: { request: organizationProvisioningWhere(scope) },
      });
      const provisioningItems = await tx.nodeGatewayProvisioningItem.deleteMany({
        where: { request: organizationProvisioningWhere(scope) },
      });
      const provisioning = await tx.nodeGatewayProvisioningRequest.deleteMany({
        where: organizationProvisioningWhere(scope),
      });
      await Promise.all([
        tx.gatewayAlarmLevelApplication.updateMany({
          data: { appliedCommandId: null },
          where: { appliedCommandId: { in: commandIds } },
        }),
        tx.gatewayAlarmLevelApplication.updateMany({
          data: { desiredCommandId: null },
          where: { desiredCommandId: { in: commandIds } },
        }),
        tx.gatewayFaultFilterAppliedState.updateMany({
          data: { appliedCommandId: null },
          where: { appliedCommandId: { in: commandIds } },
        }),
        tx.gatewayFaultFilterDesiredState.updateMany({
          data: { desiredCommandId: null },
          where: { desiredCommandId: { in: commandIds } },
        }),
      ]);
      const deletedCommands = await tx.gatewayCommand.deleteMany({ where: commandWhere });
      const alarmApplications = await tx.gatewayAlarmLevelApplication.deleteMany({
        where: { building: buildingWhere },
      });
      const configurations = await tx.buildingAlarmLevelConfiguration.deleteMany({
        where: { building: buildingWhere },
      });
      const imagesDeleted = await tx.buildingPlanImage.deleteMany({
        where: { building: buildingWhere },
      });
      const positionAssignments = await tx.companyUserPositionAssignment.deleteMany({
        where: organizationPositionAssignmentWhere(rootType, rootId),
      });
      const buildingAccess = await tx.companyUserBuildingAccess.deleteMany({
        where: { building: buildingWhere },
      });
      const areaAccess = await tx.companyUserAreaAccess.deleteMany({
        where:
          rootType === ArchiveEntityType.COMPANY
            ? { area: { companyId: rootId } }
            : rootType === ArchiveEntityType.CONSTRUCTION_AREA
              ? { areaId: rootId }
              : { areaId: "00000000-0000-0000-0000-000000000000" },
      });
      const buildingAssignments = await tx.gatewayBuildingAssignment.deleteMany({
        where: { building: buildingWhere },
      });
      const auditRows = await tx.auditLog.deleteMany({
        where: organizationAuditWhere(rootType, rootId),
      });

      let companyAssignments = { count: 0 };
      let users = { count: 0 };
      let positions = { count: 0 };
      let roles = { count: 0 };
      if (rootType === ArchiveEntityType.COMPANY) {
        companyAssignments = await tx.companyDeviceAssignment.deleteMany({
          where: { companyId: rootId },
        });
        users = await tx.companyUser.deleteMany({ where: { companyId: rootId } });
        positions = await tx.companyPosition.deleteMany({ where: { companyId: rootId } });
        roles = await tx.companyRole.deleteMany({ where: { companyId: rootId } });
      }

      const buildings = await tx.constructionBuilding.deleteMany({ where: buildingWhere });
      const sites =
        rootType === ArchiveEntityType.COMPANY
          ? await tx.constructionArea.deleteMany({ where: { companyId: rootId } })
          : rootType === ArchiveEntityType.CONSTRUCTION_AREA
            ? await tx.constructionArea.deleteMany({ where: { id: rootId } })
            : { count: 0 };
      const companies =
        rootType === ArchiveEntityType.COMPANY
          ? await tx.company.deleteMany({ where: { deletedAt: { not: null }, id: rootId } })
          : { count: 0 };
      return {
        alarmApplications: alarmApplications.count,
        auditRows: auditRows.count,
        buildingAccess: buildingAccess.count,
        buildingAssignments: buildingAssignments.count,
        buildings: buildings.count,
        commands: deletedCommands.count,
        companies: companies.count,
        companyAssignments: companyAssignments.count,
        configurations: configurations.count,
        images: imagesDeleted.count,
        latestStates: latestStates.count,
        positionAssignments: positionAssignments.count,
        positions: positions.count,
        provisioning: provisioning.count,
        provisioningEnded: provisioningEnded.count,
        provisioningItems: provisioningItems.count,
        reportExports: reportExports.count,
        reports: reports.count,
        roles: roles.count,
        sites: sites.count,
        users: users.count,
        areaAccess: areaAccess.count,
      };
    });
    return { ...evidenceCounts, ...finalCounts, sensorReadings };
  }

  private async readingIds(where: { alarmEventId?: string; policyId?: string; ruleId?: string }) {
    const triggers = await this.prisma.alarmPolicyTrigger.findMany({
      select: {
        firstCountedReadingId: true,
        lastCountedReadingId: true,
        triggerReadingId: true,
      },
      where,
    });
    return [
      ...new Set(
        triggers.flatMap((trigger) => [
          trigger.triggerReadingId,
          trigger.firstCountedReadingId,
          trigger.lastCountedReadingId,
        ]),
      ),
    ].filter((id): id is string => Boolean(id));
  }

  private async deleteOrphanReadings(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const result = await this.prisma.sensorReading.deleteMany({
      where: {
        firstCounterStates: { none: {} },
        firstPolicyTriggers: { none: {} },
        id: { in: ids },
        lastCounterStates: { none: {} },
        lastPolicyTriggers: { none: {} },
        triggerReadings: { none: {} },
      },
    });
    return result.count;
  }
}

type OrganizationScope = { companyId: string } | { areaId: string } | { buildingId: string };

function organizationScope(rootType: ArchiveEntityType, rootId: string): OrganizationScope {
  if (rootType === ArchiveEntityType.COMPANY) return { companyId: rootId };
  if (rootType === ArchiveEntityType.CONSTRUCTION_AREA) return { areaId: rootId };
  return { buildingId: rootId };
}

function organizationScalarWhere(scope: OrganizationScope) {
  return scope;
}

function organizationBuildingWhere(
  rootType: ArchiveEntityType,
  rootId: string,
): Prisma.ConstructionBuildingWhereInput {
  if (rootType === ArchiveEntityType.COMPANY) return { companyId: rootId };
  if (rootType === ArchiveEntityType.CONSTRUCTION_AREA) return { areaId: rootId };
  return { id: rootId };
}

function organizationCommandWhere(scope: OrganizationScope): Prisma.GatewayCommandWhereInput {
  if ("companyId" in scope) {
    return {
      OR: [{ companyId: scope.companyId }, { provisioningRequest: { companyId: scope.companyId } }],
    };
  }
  if ("areaId" in scope) {
    return {
      OR: [
        { areaId: scope.areaId },
        { provisioningRequest: { building: { areaId: scope.areaId } } },
      ],
    };
  }
  return {
    OR: [
      { buildingId: scope.buildingId },
      { provisioningRequest: { buildingId: scope.buildingId } },
    ],
  };
}

function organizationProvisioningWhere(
  scope: OrganizationScope,
): Prisma.NodeGatewayProvisioningRequestWhereInput {
  if ("companyId" in scope) return { companyId: scope.companyId };
  if ("areaId" in scope) return { building: { areaId: scope.areaId } };
  return { buildingId: scope.buildingId };
}

function organizationPositionAssignmentWhere(
  rootType: ArchiveEntityType,
  rootId: string,
): Prisma.CompanyUserPositionAssignmentWhereInput {
  if (rootType === ArchiveEntityType.COMPANY) return { companyUser: { companyId: rootId } };
  if (rootType === ArchiveEntityType.CONSTRUCTION_AREA) {
    return { OR: [{ areaId: rootId }, { building: { areaId: rootId } }] };
  }
  return { buildingId: rootId };
}

function organizationAuditWhere(
  rootType: ArchiveEntityType,
  rootId: string,
): Prisma.AuditLogWhereInput {
  if (rootType === ArchiveEntityType.COMPANY) return { companyId: rootId };
  if (rootType === ArchiveEntityType.CONSTRUCTION_AREA) return { areaId: rootId };
  return { buildingId: rootId };
}

function archivedRootConflict(entity: string): ConflictException {
  return new ConflictException({
    code: "PURGE_ROOT_NOT_ARCHIVED",
    message: `${entity} must be archived before permanent purge.`,
  });
}

function activeDependencyConflict(entity: string, dependency: string): ConflictException {
  return new ConflictException({
    code: "PURGE_ACTIVE_DEPENDENCY",
    message: `${entity} still has active or protected ${dependency}.`,
  });
}

function readSensorFilters(value: unknown): SensorReadingPurgeFilterDto {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConflictException({
      code: "PURGE_FILTER_INVALID",
      message: "The persisted sensor filter is invalid.",
    });
  }
  const filter = value as Partial<SensorReadingPurgeFilterDto>;
  if (typeof filter.from !== "string" || typeof filter.to !== "string") {
    throw new ConflictException({
      code: "PURGE_FILTER_INVALID",
      message: "The persisted sensor range is invalid.",
    });
  }
  return filter as SensorReadingPurgeFilterDto;
}
