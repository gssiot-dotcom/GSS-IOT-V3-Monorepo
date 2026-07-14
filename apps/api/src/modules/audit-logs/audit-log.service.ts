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
}

@Injectable()
export class AuditLogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(
    actor: AuthTokenPayload,
    entry: AuditEntry,
    executor: PrismaExecutor = this.prisma,
  ): Promise<void> {
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
        newValue: entry.newValue,
        oldValue: entry.oldValue,
      },
    });
  }
}
