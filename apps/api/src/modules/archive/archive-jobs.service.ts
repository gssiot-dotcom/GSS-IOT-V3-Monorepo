import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ArchiveEntityType,
  AuditActorType,
  DeletionJobStatus,
  GatewayCommandStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { AUTH_CONTEXT, type AuthTokenPayload } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { PermissionResolverService } from "../rbac/permission-resolver.service";
import { archiveDomainPermission } from "./archive-permissions";
import { ArchiveQueryService } from "./archive-query.service";
import type { EnqueuePurgeDto } from "./dto/archive.dto";
import type { EnqueueSensorReadingPurgeDto } from "./dto/archive.dto";

const terminalCommands: GatewayCommandStatus[] = [
  GatewayCommandStatus.ACKNOWLEDGED,
  GatewayCommandStatus.FAILED,
  GatewayCommandStatus.EXPIRED,
  GatewayCommandStatus.CANCELLED,
];

@Injectable()
export class ArchiveJobsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ArchiveQueryService) private readonly query: ArchiveQueryService,
    @Inject(PermissionResolverService) private readonly permissions: PermissionResolverService,
    @Inject(AuditLogService) private readonly audit: AuditLogService,
  ) {}

  async enqueue(actor: AuthTokenPayload, dto: EnqueuePurgeDto) {
    await this.assertPurgePermissions(actor, dto.rootType);
    const existing = await this.prisma.deletionJob.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      if (existing.targetKey !== this.targetKey(dto.rootType, dto.rootId)) {
        throw new ConflictException({
          code: "IDEMPOTENCY_KEY_REUSED",
          message: "The idempotency key is already bound to another purge target.",
        });
      }
      return existing;
    }
    const preview = await this.query.preview(dto.rootType, dto.rootId);
    if (preview.previewHash !== dto.previewHash) {
      throw new ConflictException({
        code: "DELETE_PREVIEW_STALE",
        message: "Archive dependencies changed. Request a new preview before deleting.",
      });
    }
    if (dto.confirmation.trim() !== preview.rootName) {
      throw new ConflictException({
        code: "PURGE_CONFIRMATION_MISMATCH",
        message: "The typed confirmation does not match the archived entity.",
      });
    }
    const root = await this.query.resolveRoot(dto.rootType, dto.rootId);
    const targetKey = this.targetKey(dto.rootType, dto.rootId);
    try {
      const job = await this.prisma.deletionJob.create({
        data: {
          activeKey: "active",
          areaId: root.areaId as string | undefined,
          buildingId: root.buildingId as string | undefined,
          companyId:
            (root.companyId as string | undefined) ??
            (dto.rootType === ArchiveEntityType.COMPANY ? dto.rootId : undefined),
          deletedCounts: {},
          failedCounts: {},
          idempotencyKey: dto.idempotencyKey,
          previewHash: dto.previewHash,
          requesterAdminId: actor.sub,
          rootId: dto.rootId,
          rootType: dto.rootType,
          targetKey,
          totalCounts: preview.counts,
          typedFilter: { rootId: dto.rootId, rootType: dto.rootType },
        },
      });
      await this.audit.record(actor, {
        action: "archive.purge.enqueue",
        entityId: job.id,
        entityType: "DeletionJob",
        newValue: {
          rootId: dto.rootId,
          rootType: dto.rootType,
          targetKey,
        },
        scope: {
          areaId: job.areaId ?? undefined,
          buildingId: job.buildingId ?? undefined,
          companyId: job.companyId ?? undefined,
        },
      });
      return job;
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new ConflictException({
          code: "PURGE_ALREADY_ACTIVE",
          message: "A purge job is already active for this archived entity.",
        });
      }
      throw error;
    }
  }

  async enqueueSensorReadings(actor: AuthTokenPayload, dto: EnqueueSensorReadingPurgeDto) {
    await this.assertPurgePermissions(actor, ArchiveEntityType.SENSOR_READING_FILTER);
    const existing = await this.prisma.deletionJob.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) return existing;
    const { confirmation, idempotencyKey, previewHash, ...filters } = dto;
    const preview = await this.query.sensorReadingPreview(filters);
    if (preview.previewHash !== dto.previewHash) {
      throw new ConflictException({
        code: "DELETE_PREVIEW_STALE",
        message: "The filtered SensorReading dataset changed. Run the dry-run again.",
      });
    }
    if (confirmation.trim() !== preview.confirmation) {
      throw new ConflictException({
        code: "PURGE_CONFIRMATION_MISMATCH",
        message: "The typed confirmation does not match the dry-run result.",
      });
    }
    try {
      const job = await this.prisma.deletionJob.create({
        data: {
          activeKey: "active",
          areaId: filters.areaId,
          buildingId: filters.buildingId,
          companyId: filters.companyId,
          deletedCounts: {},
          failedCounts: {},
          idempotencyKey,
          previewHash,
          requesterAdminId: actor.sub,
          rootType: ArchiveEntityType.SENSOR_READING_FILTER,
          targetKey: "SENSOR_READING_FILTER:GLOBAL",
          totalCounts: {
            matched: preview.matched,
            eligible: preview.eligible,
            preservedReferenced: preview.preservedReferenced,
          },
          typedFilter: filters,
        },
      });
      await this.audit.record(actor, {
        action: "sensor-readings.purge.enqueue",
        entityId: job.id,
        entityType: "DeletionJob",
        newValue: { filters, previewHash },
        scope: {
          areaId: filters.areaId,
          buildingId: filters.buildingId,
          companyId: filters.companyId,
        },
      });
      return job;
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new ConflictException({
          code: "PURGE_ALREADY_ACTIVE",
          message: "Another filtered SensorReading purge is already active.",
        });
      }
      throw error;
    }
  }

  async get(actor: AuthTokenPayload, id: string) {
    await this.assertView(actor);
    const job = await this.prisma.deletionJob.findUnique({
      include: { receipt: true },
      where: { id },
    });
    if (!job) throw new NotFoundException("The deletion job was not found.");
    return job;
  }

  async retry(actor: AuthTokenPayload, id: string) {
    await this.assertView(actor);
    const job = await this.prisma.deletionJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException("The deletion job was not found.");
    await this.assertPurgePermissions(actor, job.rootType);
    if (job.status !== DeletionJobStatus.FAILED) {
      throw new ConflictException("Only failed deletion jobs can be retried.");
    }
    return this.prisma.deletionJob.update({
      data: {
        heartbeatAt: null,
        leaseExpiresAt: null,
        leaseOwner: null,
        safeErrorSummary: null,
        status: DeletionJobStatus.PENDING,
      },
      where: { id },
    });
  }

  async archiveGatewayCommand(actor: AuthTokenPayload, id: string, reason?: string) {
    if (!(await this.permissions.hasPermission(actor.context, actor.sub, "mqtt-commands.manage"))) {
      throw new ForbiddenException("The MQTT command permission is missing.");
    }
    const command = await this.prisma.gatewayCommand.findFirst({
      where: { deletedAt: null, id, status: { in: terminalCommands } },
    });
    if (!command) {
      throw new ConflictException({
        code: "GATEWAY_COMMAND_NOT_TERMINAL",
        message: "Only terminal GatewayCommands can be archived.",
      });
    }
    return this.prisma.gatewayCommand.update({
      data: {
        deleteReason: reason,
        deletedAt: new Date(),
        deletedById: actor.sub,
        deletedByType: AuditActorType.GSS_ADMIN,
      },
      where: { id },
    });
  }

  async assertView(actor: AuthTokenPayload): Promise<void> {
    if (
      actor.context !== AUTH_CONTEXT.gssAdmin ||
      !(await this.permissions.hasPermission(actor.context, actor.sub, "archive.view"))
    ) {
      throw new ForbiddenException("The Archive Center permission is missing.");
    }
  }

  private async assertPurgePermissions(
    actor: AuthTokenPayload,
    rootType: ArchiveEntityType,
  ): Promise<void> {
    if (actor.context !== AUTH_CONTEXT.gssAdmin) {
      throw new ForbiddenException("Only the GSS Admin context can purge archive evidence.");
    }
    const [purge, domain] = await Promise.all([
      this.permissions.hasPermission(actor.context, actor.sub, "archive.purge"),
      this.permissions.hasPermission(actor.context, actor.sub, archiveDomainPermission[rootType]),
    ]);
    if (!purge || !domain) {
      throw new ForbiddenException(
        "Both archive.purge and the entity domain deletion permission are required.",
      );
    }
  }

  private targetKey(rootType: ArchiveEntityType, rootId: string) {
    return `${rootType}:${rootId}`;
  }
}

function isUniqueConstraint(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}
