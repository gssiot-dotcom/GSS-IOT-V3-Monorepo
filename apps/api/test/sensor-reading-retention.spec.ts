import { describe, expect, it, vi } from "vitest";

import { SensorReadingRetentionService } from "../src/modules/monitoring/sensor-reading-retention.service";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("SensorReadingRetentionService", () => {
  it("counts only old readings with no trigger or mutable counter references", async () => {
    const count = vi.fn().mockResolvedValue(4);
    const prisma = { sensorReading: { count } } as unknown as PrismaService;
    const service = new SensorReadingRetentionService(prisma);

    await expect(service.dryRunCount({ companyId: "company-1" })).resolves.toBe(4);
    const where = count.mock.calls[0]?.[0]?.where;
    expect(where.AND[0]).toEqual({ companyId: "company-1" });
    expect(where.AND[1].receivedAt.lt).toBeInstanceOf(Date);
    expect(where.AND[2]).toEqual({
      firstCounterStates: { none: {} },
      firstPolicyTriggers: { none: {} },
      lastCounterStates: { none: {} },
      lastPolicyTriggers: { none: {} },
      triggerReadings: { none: {} },
    });
  });
});
