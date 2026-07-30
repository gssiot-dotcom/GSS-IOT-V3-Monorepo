import { Inject, Injectable } from "@nestjs/common";
import { AuditActorType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AUTH_CONTEXT } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

export interface AuditEntry {
  action: string;
  entityId?: string;
  entityType: string;
  newValue?: Prisma.InputJsonValue;
  oldValue?: Prisma.InputJsonValue;
  scope?: {
    areaId?: string;
    buildingId?: string;
    companyId?: string;
    snapshot?: Prisma.InputJsonObject;
  };
}

@Injectable()
export class AuditLogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(
    actor: AuthTokenPayload,
    entry: AuditEntry,
    executor: PrismaExecutor = this.prisma,
  ): Promise<void> {
    const inferred = inferScope(entry);
    await executor.auditLog.create({
      data: {
        action: entry.action,
        actorId: actor.sub,
        actorType:
          actor.context === AUTH_CONTEXT.gssAdmin
            ? AuditActorType.GSS_ADMIN
            : AuditActorType.COMPANY_USER,
        entityId: entry.entityId,
        entityType: entry.entityType,
        areaId: entry.scope?.areaId ?? inferred.areaId,
        buildingId: entry.scope?.buildingId ?? inferred.buildingId,
        companyId: entry.scope?.companyId ?? inferred.companyId,
        scopeSnapshot:
          entry.scope?.snapshot ??
          ({
            areaId: entry.scope?.areaId ?? inferred.areaId ?? null,
            buildingId: entry.scope?.buildingId ?? inferred.buildingId ?? null,
            companyId: entry.scope?.companyId ?? inferred.companyId ?? null,
          } satisfies Prisma.InputJsonObject),
        newValue: entry.newValue,
        oldValue: entry.oldValue,
      },
    });
  }
}

function inferScope(entry: AuditEntry) {
  const values = [entry.newValue, entry.oldValue]
    .filter((value): value is Prisma.InputJsonObject => isJsonObject(value))
    .flatMap((value) => [value, isJsonObject(value.company) ? value.company : undefined])
    .filter((value): value is Prisma.InputJsonObject => Boolean(value));
  const read = (key: "areaId" | "buildingId" | "companyId") =>
    values.map((value) => value[key]).find((value): value is string => typeof value === "string");
  return {
    areaId:
      read("areaId") ?? (entry.entityType === "ConstructionArea" ? entry.entityId : undefined),
    buildingId:
      read("buildingId") ??
      (entry.entityType === "ConstructionBuilding" ? entry.entityId : undefined),
    companyId: read("companyId") ?? (entry.entityType === "Company" ? entry.entityId : undefined),
  };
}

function isJsonObject(
  value: Prisma.InputJsonValue | null | undefined,
): value is Prisma.InputJsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
