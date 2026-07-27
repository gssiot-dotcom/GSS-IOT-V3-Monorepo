import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ApiEnv } from "@gss-iot/config";
import { BadRequestException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validateCompanyLogoFile } from "../src/modules/company-branding/company-logo-file";
import { LocalCompanyLogoStorageProvider } from "../src/modules/company-branding/company-logo-local-storage.provider";
import { MemoryCompanyLogoStorageProvider } from "../src/modules/company-branding/company-logo-memory-storage.provider";
import { S3CompanyLogoStorageProvider } from "../src/modules/company-branding/company-logo-s3-storage.provider";
import {
  CompanyLogoStorageError,
  validateCompanyLogoOwnership,
  validateCompanyLogoStorageKey,
} from "../src/modules/company-branding/company-logo-storage.service";

const storageKey = "company-logos/company-1/00000000-0000-4000-8000-000000000001.png";
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe("company logo storage and validation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("writes, reads and idempotently deletes local and memory objects", async () => {
    const root = await mkdtemp(join(tmpdir(), "gss-company-logo-"));
    try {
      for (const provider of [
        new LocalCompanyLogoStorageProvider(root),
        new MemoryCompanyLogoStorageProvider(),
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

  it("rejects traversal, foreign-company keys, SVG and malformed content", () => {
    expect(() => validateCompanyLogoStorageKey("company-logos/company-1/../secret.png")).toThrow(
      CompanyLogoStorageError,
    );
    expect(() => validateCompanyLogoOwnership("company-2", storageKey)).toThrow(
      CompanyLogoStorageError,
    );
    expect(() =>
      validateCompanyLogoFile({
        buffer: Buffer.from("<svg></svg>"),
        mimetype: "image/svg+xml",
        originalname: "logo.svg",
        size: 11,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateCompanyLogoFile({
        buffer: Buffer.alloc(0),
        mimetype: "image/png",
        originalname: "empty.png",
        size: 0,
      }),
    ).toThrow(BadRequestException);
  });

  it("detects supported content from magic bytes rather than the declared MIME type", () => {
    expect(
      validateCompanyLogoFile({
        buffer: png,
        mimetype: "text/plain",
        originalname: "mislabelled.txt",
        size: png.length,
      }),
    ).toMatchObject({ contentType: "image/png", extension: "png" });
  });

  it("uses private signed S3-compatible requests", async () => {
    const requests: Request[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(new Request(input, init));
        return new Response(png, { headers: { "content-type": "image/png" }, status: 200 });
      }),
    );
    const provider = new S3CompanyLogoStorageProvider({
      ASSET_S3_ACCESS_KEY_ID: "access-key",
      ASSET_S3_BUCKET: "asset-bucket",
      ASSET_S3_ENDPOINT: "http://localhost:9000",
      ASSET_S3_REGION: "ap-northeast-2",
      ASSET_S3_SECRET_ACCESS_KEY: "secret-key",
    } as unknown as ApiEnv);

    await provider.put(storageKey, png, "image/png");
    await expect(provider.get(storageKey)).resolves.toMatchObject({ contentType: "image/png" });
    expect(requests[0]?.url).toContain("/asset-bucket/company-logos/company-1/");
    expect(requests[0]?.headers.get("authorization")).toContain("Credential=access-key/");
  });
});
