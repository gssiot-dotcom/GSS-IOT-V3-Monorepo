import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { AuthTokenPayload } from "../../common/auth.types";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateCompanySettingsDto } from "./dto/company-settings.dto";

const companySettingsSelect = {
  address: true,
  code: true,
  email: true,
  id: true,
  name: true,
  phone: true,
  status: true,
} satisfies Prisma.CompanySelect;

@Injectable()
export class CompanySettingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  async getForUser(userId: string) {
    const context = await this.getContext(userId);
    return context.company;
  }

  async updateForUser(actor: AuthTokenPayload, dto: UpdateCompanySettingsDto) {
    const context = await this.getContext(actor.sub);
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id: context.company.id },
        data: {
          address: dto.address,
          email: dto.email?.trim().toLowerCase(),
          phone: dto.phone,
        },
        select: companySettingsSelect,
      });
      await this.auditLog.record(
        actor,
        {
          action: "company-settings.update",
          entityId: company.id,
          entityType: "Company",
          newValue: company,
          oldValue: context.company,
        },
        tx,
      );
      return company;
    });
  }

  private async getContext(userId: string) {
    const user = await this.prisma.companyUser.findUnique({
      where: { id: userId },
      select: { company: { select: companySettingsSelect } },
    });
    if (!user) throw new NotFoundException("The authenticated company was not found.");
    return user;
  }
}
