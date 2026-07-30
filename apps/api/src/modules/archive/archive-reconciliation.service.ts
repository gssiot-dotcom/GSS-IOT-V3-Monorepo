import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { PrivateAssetStorageService } from "../private-assets/private-asset-storage.service";
import { ReportStorageService } from "../reports/report-storage.service";

const STORAGE_SCAN_LIMIT = 1_000;

type CountRow = { count: bigint | number };

@Injectable()
export class ArchiveReconciliationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PrivateAssetStorageService) private readonly privateStorage: PrivateAssetStorageService,
    @Inject(ReportStorageService) private readonly reportStorage: ReportStorageService,
  ) {}

  async report() {
    const [
      missingSourceCommands,
      gatewayMismatches,
      ambiguousLegacyAssignments,
      missingAssignmentNodes,
      missingAssignmentGateways,
      missingCommandGateways,
      missingAuditCompanies,
      missingAuditAreas,
      missingAuditBuildings,
      logos,
      images,
      exports,
    ] = await Promise.all([
      this.count(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "NodeGatewayAssignment" a
        LEFT JOIN "GatewayCommand" c ON c.id = a."sourceCommandId"
        WHERE a."sourceCommandId" IS NOT NULL AND c.id IS NULL
      `),
      this.count(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "NodeGatewayAssignment" a
        JOIN "GatewayCommand" c ON c.id = a."sourceCommandId"
        WHERE c."gatewayId" <> a."gatewayId"
      `),
      this.prisma.nodeGatewayAssignment.count({ where: { sourceCommandId: null } }),
      this.count(Prisma.sql`
        SELECT COUNT(*)::bigint AS count FROM "NodeGatewayAssignment" a
        LEFT JOIN "Node" n ON n.id = a."nodeId" WHERE n.id IS NULL
      `),
      this.count(Prisma.sql`
        SELECT COUNT(*)::bigint AS count FROM "NodeGatewayAssignment" a
        LEFT JOIN "Gateway" g ON g.id = a."gatewayId" WHERE g.id IS NULL
      `),
      this.count(Prisma.sql`
        SELECT COUNT(*)::bigint AS count FROM "GatewayCommand" c
        LEFT JOIN "Gateway" g ON g.id = c."gatewayId" WHERE g.id IS NULL
      `),
      this.count(Prisma.sql`
        SELECT COUNT(*)::bigint AS count FROM "AuditLog" l
        LEFT JOIN "Company" c ON c.id = l."companyId"
        WHERE l."companyId" IS NOT NULL AND c.id IS NULL
      `),
      this.count(Prisma.sql`
        SELECT COUNT(*)::bigint AS count FROM "AuditLog" l
        LEFT JOIN "ConstructionArea" a ON a.id = l."areaId"
        WHERE l."areaId" IS NOT NULL AND a.id IS NULL
      `),
      this.count(Prisma.sql`
        SELECT COUNT(*)::bigint AS count FROM "AuditLog" l
        LEFT JOIN "ConstructionBuilding" b ON b.id = l."buildingId"
        WHERE l."buildingId" IS NOT NULL AND b.id IS NULL
      `),
      this.prisma.company.findMany({
        select: { id: true, logoKey: true },
        take: STORAGE_SCAN_LIMIT + 1,
        where: { logoKey: { not: null } },
      }),
      this.prisma.buildingPlanImage.findMany({
        select: { id: true, storageKey: true },
        take: STORAGE_SCAN_LIMIT + 1,
      }),
      this.prisma.reportExport.findMany({
        select: { id: true, storageKey: true },
        take: STORAGE_SCAN_LIMIT + 1,
        where: { storageDeletedAt: null },
      }),
    ]);

    const [logoStorage, imageStorage, reportStorage] = await Promise.all([
      this.scanStorage(logos, (row) => this.privateStorage.get(row.logoKey!)),
      this.scanStorage(images, (row) => this.privateStorage.get(row.storageKey)),
      this.scanStorage(exports, (row) => this.reportStorage.get(row.storageKey)),
    ]);
    const orphanForeignKeys = {
      auditAreas: missingAuditAreas,
      auditBuildings: missingAuditBuildings,
      auditCompanies: missingAuditCompanies,
      commandGateways: missingCommandGateways,
      assignmentGateways: missingAssignmentGateways,
      assignmentNodes: missingAssignmentNodes,
    };
    const unexpectedCount =
      missingSourceCommands +
      gatewayMismatches +
      Object.values(orphanForeignKeys).reduce((sum, count) => sum + count, 0) +
      logoStorage.missing +
      imageStorage.missing +
      reportStorage.missing;

    return {
      generatedAt: new Date().toISOString(),
      provenance: {
        ambiguousLegacyAssignments,
        gatewayMismatches,
        missingSourceCommands,
      },
      orphanForeignKeys,
      storage: {
        buildingImages: imageStorage,
        companyLogos: logoStorage,
        reportExports: reportStorage,
      },
      unexpectedCount,
    };
  }

  private async count(query: Prisma.Sql): Promise<number> {
    const [row] = await this.prisma.$queryRaw<CountRow[]>(query);
    return Number(row?.count ?? 0);
  }

  private async scanStorage<T extends { id: string }>(
    records: T[],
    get: (record: T) => Promise<unknown>,
  ): Promise<{ checked: number; failures: number; missing: number; truncated: boolean }> {
    const truncated = records.length > STORAGE_SCAN_LIMIT;
    let failures = 0;
    let missing = 0;
    for (const record of records.slice(0, STORAGE_SCAN_LIMIT)) {
      try {
        if (!(await get(record))) missing += 1;
      } catch {
        failures += 1;
      }
    }
    return { checked: Math.min(records.length, STORAGE_SCAN_LIMIT), failures, missing, truncated };
  }
}
