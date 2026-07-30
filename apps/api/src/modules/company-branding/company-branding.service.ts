import { createHash, randomUUID } from "node:crypto";

import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";

import type { AuthTokenPayload } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogService } from "../audit-logs/audit-log.service";
import type { ValidatedCompanyLogo } from "./company-logo-file";
import { CompanyLogoStorageService } from "./company-logo-storage.service";
import { validateCompanyLogoOwnership } from "./company-logo-storage.service";

@Injectable()
export class CompanyBrandingService {
  private readonly logger = new Logger(CompanyBrandingService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(CompanyLogoStorageService) private readonly storage: CompanyLogoStorageService,
  ) {}

  async getCompanyIdForUser(userId: string): Promise<string> {
    const user = await this.prisma.companyUser.findUnique({
      where: { id: userId },
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
      throw new NotFoundException("The authenticated company was not found.");
    }
    return user.companyId;
  }

  async getLogo(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { deletedAt: null, id: companyId, status: "ACTIVE" },
      select: { logoKey: true },
    });
    if (!company) throw new NotFoundException("The company was not found.");
    if (!company.logoKey) throw new NotFoundException("The company logo was not found.");

    const object = await this.storage.get(validateCompanyLogoOwnership(companyId, company.logoKey));
    if (!object) throw new NotFoundException("The company logo was not found.");
    return {
      ...object,
      etag: `"${createHash("sha256").update(object.body).digest("hex")}"`,
    };
  }

  async replaceLogo(actor: AuthTokenPayload, companyId: string, logo: ValidatedCompanyLogo) {
    const newKey = `company-logos/${companyId}/${randomUUID()}.${logo.extension}`;
    await this.assertCompanyExists(companyId);
    await this.storage.put(newKey, logo.body, logo.contentType);

    let oldKey: string | null = null;
    try {
      await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.findFirst({
          where: { deletedAt: null, id: companyId, status: "ACTIVE" },
          select: { logoKey: true },
        });
        if (!company) throw new NotFoundException("The company was not found.");
        oldKey = company.logoKey;
        await tx.company.update({ where: { id: companyId }, data: { logoKey: newKey } });
        await this.auditLog.record(
          actor,
          {
            action: company.logoKey ? "company-logo.replace" : "company-logo.upload",
            entityId: companyId,
            entityType: "Company",
            newValue: { contentType: logo.contentType, hasLogo: true },
            oldValue: { hasLogo: Boolean(company.logoKey) },
          },
          tx,
        );
      });
    } catch (error) {
      await this.storage.remove(newKey).catch(() => {
        this.logger.warn("Failed to clean up a company logo after a database rollback.");
      });
      throw error;
    }

    if (oldKey && oldKey !== newKey) {
      await this.removeOldLogo(companyId, oldKey);
    }
    return { hasLogo: true };
  }

  async removeLogo(actor: AuthTokenPayload, companyId: string) {
    let oldKey: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findFirst({
        where: { deletedAt: null, id: companyId, status: "ACTIVE" },
        select: { logoKey: true },
      });
      if (!company) throw new NotFoundException("The company was not found.");
      oldKey = company.logoKey;
      if (!company.logoKey) return;
      await tx.company.update({ where: { id: companyId }, data: { logoKey: null } });
      await this.auditLog.record(
        actor,
        {
          action: "company-logo.remove",
          entityId: companyId,
          entityType: "Company",
          newValue: { hasLogo: false },
          oldValue: { hasLogo: true },
        },
        tx,
      );
    });
    if (oldKey) await this.removeOldLogo(companyId, oldKey);
    return { hasLogo: false };
  }

  private async assertCompanyExists(companyId: string): Promise<void> {
    const company = await this.prisma.company.findFirst({
      where: { deletedAt: null, id: companyId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!company) throw new NotFoundException("The company was not found.");
  }

  private async removeOldLogo(companyId: string, storageKey: string): Promise<void> {
    try {
      await this.storage.remove(validateCompanyLogoOwnership(companyId, storageKey));
    } catch {
      this.logger.warn("Failed to delete a superseded company logo object.");
    }
  }
}
