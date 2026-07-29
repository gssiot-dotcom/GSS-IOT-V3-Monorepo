import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ApiEnv } from "@gss-iot/config";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { AuditActorType, BuildingImageDeletionState, BuildingImageKind } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BUILDING_IMAGE_MAX_BYTES,
  validateBuildingImageFile,
} from "../src/modules/organizations/building-image-file";
import { BuildingImagesService } from "../src/modules/organizations/building-images.service";
import { LocalPrivateAssetStorageProvider } from "../src/modules/private-assets/private-asset-local-storage.provider";
import { MemoryPrivateAssetStorageProvider } from "../src/modules/private-assets/private-asset-memory-storage.provider";
import { S3PrivateAssetStorageProvider } from "../src/modules/private-assets/private-asset-s3-storage.provider";
import {
  PrivateAssetStorageError,
  validatePrivateAssetStorageKey,
} from "../src/modules/private-assets/private-asset-storage.service";
import type { PrivateAssetStorageService } from "../src/modules/private-assets/private-asset-storage.service";
import type { AuditLogService } from "../src/modules/audit-logs/audit-log.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const storageKey =
  "building-images/company-1/building-1/plan/00000000-0000-4000-8000-000000000001.png";
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe("private building-image storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("writes, reads and idempotently deletes local and memory objects", async () => {
    const root = await mkdtemp(join(tmpdir(), "gss-building-image-"));
    try {
      for (const provider of [
        new LocalPrivateAssetStorageProvider(root),
        new MemoryPrivateAssetStorageProvider(),
      ]) {
        await provider.put(storageKey, png, "image/png");
        await expect(provider.get(storageKey)).resolves.toEqual({
          body: png,
          contentType: "image/png",
        });
        await provider.remove(storageKey);
        await provider.remove(storageKey);
        await expect(provider.get(storageKey)).resolves.toBeUndefined();
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("requires matching MIME, extension and magic bytes and enforces 8 MiB", () => {
    expect(
      validateBuildingImageFile({
        buffer: png,
        mimetype: "image/png",
        originalname: "plan.png",
        size: png.length,
      }),
    ).toMatchObject({ contentType: "image/png", extension: "png" });
    for (const file of [
      { buffer: png, mimetype: "image/jpeg", originalname: "plan.jpg", size: png.length },
      {
        buffer: Buffer.from("<svg></svg>"),
        mimetype: "image/svg+xml",
        originalname: "plan.svg",
        size: 11,
      },
      {
        buffer: Buffer.alloc(BUILDING_IMAGE_MAX_BYTES + 1),
        mimetype: "image/png",
        originalname: "large.png",
        size: BUILDING_IMAGE_MAX_BYTES + 1,
      },
    ]) {
      expect(() => validateBuildingImageFile(file)).toThrow(BadRequestException);
    }
    expect(() => validatePrivateAssetStorageKey("building-images/a/b/plan/../secret.png")).toThrow(
      PrivateAssetStorageError,
    );
  });

  it("signs private S3 operations and surfaces deletion failures for retry", async () => {
    const requests: Request[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init));
      if (init?.method === "DELETE") return new Response(null, { status: 503 });
      return new Response(png, { headers: { "content-type": "image/png" }, status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new S3PrivateAssetStorageProvider({
      ASSET_S3_ACCESS_KEY_ID: "access-key",
      ASSET_S3_BUCKET: "asset-bucket",
      ASSET_S3_ENDPOINT: "http://localhost:9000",
      ASSET_S3_REGION: "ap-northeast-2",
      ASSET_S3_SECRET_ACCESS_KEY: "secret-key",
    } as unknown as ApiEnv);

    await provider.put(storageKey, png, "image/png");
    await expect(provider.remove(storageKey)).rejects.toBeInstanceOf(PrivateAssetStorageError);
    expect(requests.map((item) => item.method)).toEqual(["PUT", "DELETE"]);
    expect(requests[0]?.headers.get("authorization")).toContain("Credential=access-key/");
  });

  it("keeps failed deletions durable and completes them idempotently on retry", async () => {
    let state: BuildingImageDeletionState = BuildingImageDeletionState.ACTIVE;
    let deleted = false;
    let attempts = 0;
    const image = {
      building: { areaId: "area-1", companyId: "company-1", id: "building-1", title: "Tower" },
      buildingId: "building-1",
      byteSize: png.length,
      contentType: "image/png",
      createdAt: new Date("2026-07-27T00:00:00.000Z"),
      deletionAttemptCount: 0,
      deletionRequestedAt: null,
      deletionRequestedById: null,
      deletionRequestedByType: null,
      height: null,
      id: "image-1",
      kind: BuildingImageKind.PLAN,
      orderIndex: 0,
      storageKey,
      width: null,
    };
    const transactionClient = {
      auditLog: { create: vi.fn(async () => undefined) },
      buildingPlanImage: {
        deleteMany: vi.fn(async () => {
          if (deleted) return { count: 0 };
          deleted = true;
          return { count: 1 };
        }),
        update: vi.fn(async () => {
          state = BuildingImageDeletionState.DELETE_FAILED;
          attempts += 1;
          return { ...image, deletionState: state };
        }),
        updateMany: vi.fn(async () => {
          state = BuildingImageDeletionState.PENDING_DELETE;
          return { count: 1 };
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (work: (tx: typeof transactionClient) => Promise<unknown>) =>
        work(transactionClient),
      ),
      buildingPlanImage: {
        findMany: vi.fn(async () => (deleted ? [] : [{ id: image.id }])),
        findUnique: vi.fn(async () =>
          deleted
            ? null
            : {
                ...image,
                deletionAttemptCount: attempts,
                deletionRequestedAt: new Date(),
                deletionRequestedById: "admin-1",
                deletionRequestedByType: AuditActorType.GSS_ADMIN,
                deletionState: state,
              },
        ),
      },
    };
    const storage = {
      remove: vi
        .fn<PrivateAssetStorageService["remove"]>()
        .mockRejectedValueOnce(new PrivateAssetStorageError())
        .mockResolvedValue(undefined),
    };
    const auditLog = { record: vi.fn(async () => undefined) };
    const service = new BuildingImagesService(
      prisma as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
      storage as unknown as PrivateAssetStorageService,
    );
    const actor = {
      context: "gss-admin" as const,
      sub: "admin-1",
      tokenVersion: 0,
    };

    await expect(service.requestDelete(actor, image.id)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(state).toBe(BuildingImageDeletionState.DELETE_FAILED);
    expect(attempts).toBe(1);
    await expect(service.retryPendingDeletions()).resolves.toBe(1);
    await expect(service.requestDelete(actor, image.id)).resolves.toBeUndefined();
    expect(storage.remove).toHaveBeenCalledTimes(2);
    expect(transactionClient.auditLog.create).toHaveBeenCalledTimes(2);
  });
});
