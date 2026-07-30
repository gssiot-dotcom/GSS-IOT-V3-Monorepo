import { describe, expect, it, vi } from "vitest";

import { ArchiveReconciliationService } from "../src/modules/archive/archive-reconciliation.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { PrivateAssetStorageService } from "../src/modules/private-assets/private-asset-storage.service";
import type { ReportStorageService } from "../src/modules/reports/report-storage.service";

describe("ArchiveReconciliationService", () => {
  it("reports deterministic provenance, orphan and storage discrepancies without keys", async () => {
    const rawCounts = [1, 2, 0, 0, 0, 0, 0, 0];
    const prisma = {
      $queryRaw: vi.fn().mockImplementation(async () => [{ count: rawCounts.shift() ?? 0 }]),
      buildingPlanImage: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "image-1", storageKey: "building-images/c/b/plan/a.png" }]),
      },
      company: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "company-1", logoKey: "company-logos/c/a.png" }]),
      },
      nodeGatewayAssignment: { count: vi.fn().mockResolvedValue(4) },
      reportExport: {
        findMany: vi.fn().mockResolvedValue([{ id: "export-1", storageKey: "reports/a.csv" }]),
      },
    } as unknown as PrismaService;
    const privateStorage = {
      get: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("provider down")),
    } as unknown as PrivateAssetStorageService;
    const reportStorage = {
      get: vi.fn().mockResolvedValue({ body: Buffer.from("ok") }),
    } as unknown as ReportStorageService;

    const result = await new ArchiveReconciliationService(
      prisma,
      privateStorage,
      reportStorage,
    ).report();

    expect(result.provenance).toEqual({
      ambiguousLegacyAssignments: 4,
      gatewayMismatches: 2,
      missingSourceCommands: 1,
    });
    expect(result.storage.companyLogos).toMatchObject({ missing: 1, failures: 0 });
    expect(result.storage.buildingImages).toMatchObject({ missing: 0, failures: 1 });
    expect(result.storage.reportExports).toMatchObject({ missing: 0, failures: 0 });
    expect(result).not.toHaveProperty("storageKey");
    expect(JSON.stringify(result)).not.toContain("reports/a.csv");
    expect(result.unexpectedCount).toBe(4);
  });
});
