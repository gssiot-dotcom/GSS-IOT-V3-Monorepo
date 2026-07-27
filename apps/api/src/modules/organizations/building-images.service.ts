import { createHash, randomUUID } from "node:crypto";

import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AccessLevel, AuditActorType, BuildingImageDeletionState, Prisma } from "@prisma/client";
import type { BuildingImageKind } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AUTH_CONTEXT } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { PrivateAssetStorageService } from "../private-assets/private-asset-storage.service";
import { PrivateAssetStorageError } from "../private-assets/private-asset-storage.service";
import { BUILDING_IMAGE_MAX_PER_KIND, type ValidatedBuildingImage } from "./building-image-file";

const RETRY_INTERVAL_MS = 60_000;
const RETRY_BATCH_SIZE = 50;

const imageInternalSelect = {
  building: { select: { areaId: true, companyId: true, id: true, title: true } },
  buildingId: true,
  byteSize: true,
  contentType: true,
  createdAt: true,
  deletionAttemptCount: true,
  deletionRequestedAt: true,
  deletionRequestedById: true,
  deletionRequestedByType: true,
  deletionState: true,
  height: true,
  id: true,
  kind: true,
  orderIndex: true,
  storageKey: true,
  width: true,
} satisfies Prisma.BuildingPlanImageSelect;

type ImageInternal = Prisma.BuildingPlanImageGetPayload<{ select: typeof imageInternalSelect }>;

@Injectable()
export class BuildingImagesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BuildingImagesService.name);
  private retryTimer?: ReturnType<typeof setInterval>;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(PrivateAssetStorageService) private readonly storage: PrivateAssetStorageService,
  ) {}

  onModuleInit(): void {
    void this.retryPendingDeletions();
    this.retryTimer = setInterval(() => void this.retryPendingDeletions(), RETRY_INTERVAL_MS);
    this.retryTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.retryTimer) clearInterval(this.retryTimer);
  }

  async list(auth: AuthTokenPayload, buildingId: string) {
    const building = await this.getBuilding(buildingId);
    await this.assertScope(auth, building, false);
    const images = await this.prisma.buildingPlanImage.findMany({
      orderBy: [{ kind: "asc" }, { orderIndex: "asc" }, { id: "asc" }],
      select: imageInternalSelect,
      where: { buildingId, deletionState: BuildingImageDeletionState.ACTIVE },
    });
    return images.map((image) => this.toPublic(image, auth));
  }

  async upload(
    auth: AuthTokenPayload,
    buildingId: string,
    kind: BuildingImageKind,
    image: ValidatedBuildingImage,
  ) {
    const building = await this.getBuilding(buildingId);
    await this.assertScope(auth, building, true);
    const key = `building-images/${building.companyId}/${buildingId}/${kind.toLowerCase()}/${randomUUID()}.${image.extension}`;
    await this.storage.put(key, image.body, image.contentType);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`${buildingId}:${kind}`}))::text AS "lock"`,
        );
        const existing = await tx.buildingPlanImage.findMany({
          orderBy: [{ orderIndex: "desc" }, { id: "asc" }],
          select: { id: true, orderIndex: true },
          where: { buildingId, deletionState: BuildingImageDeletionState.ACTIVE, kind },
        });
        if (existing.length >= BUILDING_IMAGE_MAX_PER_KIND) {
          throw new ConflictException({
            code: "BUILDING_IMAGE_LIMIT_REACHED",
            message: `A building can contain at most ${BUILDING_IMAGE_MAX_PER_KIND} ${kind} images.`,
          });
        }
        const record = await tx.buildingPlanImage.create({
          data: {
            buildingId,
            byteSize: image.body.length,
            contentType: image.contentType,
            kind,
            orderIndex: (existing[0]?.orderIndex ?? -1) + 1,
            storageKey: key,
          },
          select: imageInternalSelect,
        });
        await this.auditLog.record(
          auth,
          {
            action: "building-image.upload",
            entityId: record.id,
            entityType: "BuildingPlanImage",
            newValue: {
              buildingId,
              byteSize: image.body.length,
              contentType: image.contentType,
              kind,
              orderIndex: record.orderIndex,
            },
          },
          tx,
        );
        return record;
      });
      return this.toPublic(created, auth);
    } catch (error) {
      await this.storage.remove(key).catch(() => {
        this.logger.error(
          `Building image rollback cleanup failed keyPrefix=building-images/${building.companyId}/${buildingId}.`,
        );
      });
      throw error;
    }
  }

  async content(auth: AuthTokenPayload, imageId: string) {
    const image = await this.getActiveImage(imageId);
    await this.assertScope(auth, image.building, false);
    if (!image.contentType || !image.storageKey.startsWith("building-images/")) {
      throw new NotFoundException("The building image content is not available.");
    }
    const object = await this.storage.get(image.storageKey);
    if (!object) throw new NotFoundException("The building image content was not found.");
    return {
      ...object,
      etag: `"${createHash("sha256").update(object.body).digest("hex")}"`,
    };
  }

  async requestDelete(auth: AuthTokenPayload, imageId: string): Promise<void> {
    const image = await this.prisma.buildingPlanImage.findUnique({
      select: imageInternalSelect,
      where: { id: imageId },
    });
    if (!image) return;
    await this.assertScope(auth, image.building, true);
    const actorType = this.actorType(auth);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.buildingPlanImage.updateMany({
        data: {
          deletionFailureCode: null,
          deletionRequestedAt: new Date(),
          deletionRequestedById: auth.sub,
          deletionRequestedByType: actorType,
          deletionState: BuildingImageDeletionState.PENDING_DELETE,
        },
        where: {
          id: imageId,
          deletionState: {
            in: [BuildingImageDeletionState.ACTIVE, BuildingImageDeletionState.DELETE_FAILED],
          },
        },
      });
      if (updated.count) {
        await this.auditLog.record(
          auth,
          {
            action: "building-image.delete-requested",
            entityId: imageId,
            entityType: "BuildingPlanImage",
            oldValue: this.auditImage(image),
          },
          tx,
        );
      }
    });
    await this.completeDeletion(imageId, auth);
  }

  async retryPendingDeletions(): Promise<number> {
    const pending = await this.prisma.buildingPlanImage.findMany({
      orderBy: [{ deletionRequestedAt: "asc" }, { id: "asc" }],
      select: { id: true },
      take: RETRY_BATCH_SIZE,
      where: {
        deletionState: {
          in: [BuildingImageDeletionState.PENDING_DELETE, BuildingImageDeletionState.DELETE_FAILED],
        },
      },
    });
    let completed = 0;
    for (const image of pending) {
      try {
        await this.completeDeletion(image.id);
        completed += 1;
      } catch {
        this.logger.warn(`Building image deletion retry failed imageId=${image.id}.`);
      }
    }
    return completed;
  }

  private async completeDeletion(imageId: string, actor?: AuthTokenPayload): Promise<void> {
    const image = await this.prisma.buildingPlanImage.findUnique({
      select: imageInternalSelect,
      where: { id: imageId },
    });
    if (!image) return;
    if (image.deletionState === BuildingImageDeletionState.ACTIVE) {
      throw new ConflictException("The building image deletion was not requested.");
    }
    try {
      await this.storage.remove(image.storageKey);
    } catch (error) {
      await this.recordDeletionFailure(image, actor);
      if (error instanceof PrivateAssetStorageError) {
        throw new ServiceUnavailableException({
          code: "BUILDING_IMAGE_STORAGE_DELETE_FAILED",
          message:
            "The image could not be removed from private storage. The deletion is queued for retry.",
        });
      }
      throw error;
    }

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.buildingPlanImage.deleteMany({
        where: {
          id: imageId,
          deletionState: {
            in: [
              BuildingImageDeletionState.PENDING_DELETE,
              BuildingImageDeletionState.DELETE_FAILED,
            ],
          },
        },
      });
      if (!deleted.count) return;
      await this.recordStoredActorAudit(tx, image, actor, "building-image.delete-completed", {
        ...this.auditImage(image),
        storageObjectRemoved: true,
      });
    });
  }

  private async recordDeletionFailure(image: ImageInternal, actor?: AuthTokenPayload) {
    await this.prisma.$transaction(async (tx) => {
      await tx.buildingPlanImage.update({
        data: {
          deletionAttemptCount: { increment: 1 },
          deletionFailureCode: "ASSET_STORAGE_DELETE_FAILED",
          deletionState: BuildingImageDeletionState.DELETE_FAILED,
        },
        where: { id: image.id },
      });
      await this.recordStoredActorAudit(tx, image, actor, "building-image.delete-failed", {
        code: "ASSET_STORAGE_DELETE_FAILED",
        retryScheduled: true,
      });
    });
  }

  private async recordStoredActorAudit(
    tx: Prisma.TransactionClient,
    image: ImageInternal,
    actor: AuthTokenPayload | undefined,
    action: string,
    newValue: Prisma.InputJsonValue,
  ) {
    const actorType = actor ? this.actorType(actor) : image.deletionRequestedByType;
    const actorId = actor?.sub ?? image.deletionRequestedById;
    await tx.auditLog.create({
      data: {
        action,
        actorId,
        actorType: actorType ?? AuditActorType.SYSTEM,
        entityId: image.id,
        entityType: "BuildingPlanImage",
        newValue,
      },
    });
  }

  private async getBuilding(buildingId: string) {
    const building = await this.prisma.constructionBuilding.findUnique({
      select: { areaId: true, companyId: true, id: true, title: true },
      where: { id: buildingId },
    });
    if (!building) throw new NotFoundException("The construction building was not found.");
    return building;
  }

  private async getImage(imageId: string): Promise<ImageInternal> {
    const image = await this.prisma.buildingPlanImage.findUnique({
      select: imageInternalSelect,
      where: { id: imageId },
    });
    if (!image) throw new NotFoundException("The building image was not found.");
    return image;
  }

  private async getActiveImage(imageId: string): Promise<ImageInternal> {
    const image = await this.getImage(imageId);
    if (image.deletionState !== BuildingImageDeletionState.ACTIVE) {
      throw new NotFoundException("The building image was not found.");
    }
    return image;
  }

  private async assertScope(
    auth: AuthTokenPayload,
    building: { areaId: string; companyId: string; id: string },
    manage: boolean,
  ): Promise<void> {
    if (auth.context === AUTH_CONTEXT.gssAdmin) return;
    const user = await this.prisma.companyUser.findUnique({
      include: {
        areaAccess: true,
        buildingAccess: true,
        role: { select: { isCompanyOwnerRole: true } },
      },
      where: { id: auth.sub },
    });
    if (!user || user.companyId !== building.companyId) {
      throw new ForbiddenException("The building image belongs to another company.");
    }
    if (user.role.isCompanyOwnerRole) return;
    const required = manage ? AccessLevel.MANAGE : undefined;
    const direct = user.buildingAccess.some(
      (access) =>
        access.buildingId === building.id && (!required || access.accessLevel === required),
    );
    const inherited = user.areaAccess.some(
      (access) =>
        access.areaId === building.areaId && (!required || access.accessLevel === required),
    );
    if (!direct && !inherited) {
      throw new ForbiddenException("The building image is outside the assigned building scope.");
    }
  }

  private toPublic(image: ImageInternal, auth: AuthTokenPayload) {
    const prefix = auth.context === AUTH_CONTEXT.gssAdmin ? "/admin" : "/company";
    return {
      byteSize: image.byteSize,
      contentPath: `${prefix}/building-images/${image.id}/content`,
      contentType: image.contentType,
      createdAt: image.createdAt,
      height: image.height,
      id: image.id,
      kind: image.kind,
      orderIndex: image.orderIndex,
      width: image.width,
    };
  }

  private auditImage(image: ImageInternal) {
    return {
      buildingId: image.buildingId,
      byteSize: image.byteSize,
      contentType: image.contentType,
      kind: image.kind,
      orderIndex: image.orderIndex,
    };
  }

  private actorType(auth: AuthTokenPayload): AuditActorType {
    return auth.context === AUTH_CONTEXT.gssAdmin
      ? AuditActorType.GSS_ADMIN
      : AuditActorType.COMPANY_USER;
  }
}
