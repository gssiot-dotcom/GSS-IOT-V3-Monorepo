import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ApiEnv } from "@gss-iot/config";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalReportStorageProvider } from "../src/modules/reports/report-local-storage.provider";
import { MemoryReportStorageProvider } from "../src/modules/reports/report-memory-storage.provider";
import { S3ReportStorageProvider } from "../src/modules/reports/report-s3-storage.provider";
import {
  ReportStorageError,
  validateStorageKey,
} from "../src/modules/reports/report-storage.service";

const storageKey = "reports/00000000-0000-4000-8000-000000000001.csv";

describe("report storage providers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("writes, reads and deletes local objects", async () => {
    const root = await mkdtemp(join(tmpdir(), "gss-report-storage-"));
    try {
      const provider = new LocalReportStorageProvider(root);
      await provider.put(storageKey, Buffer.from("private"), "text/csv");
      await expect(provider.get(storageKey)).resolves.toEqual({
        body: Buffer.from("private"),
        contentType: "text/csv",
      });
      await provider.remove(storageKey);
      await expect(provider.get(storageKey)).resolves.toBeUndefined();
      await expect(provider.remove(storageKey)).resolves.toBeUndefined();
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("keeps memory storage isolated and key validation opaque", async () => {
    const provider = new MemoryReportStorageProvider();
    await provider.put(storageKey, Buffer.from("private"), "text/csv");
    const object = await provider.get(storageKey);
    expect(object?.body.toString()).toBe("private");
    expect(() => validateStorageKey("reports/../secret.csv")).toThrow(ReportStorageError);
    expect(() => validateStorageKey("https://public.example/report.csv")).toThrow(
      ReportStorageError,
    );
    await provider.remove(storageKey);
    await expect(provider.get(storageKey)).resolves.toBeUndefined();
  });

  it("uses private S3-compatible requests without exposing a public URL", async () => {
    const requests: Request[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(new Request(input, init));
        return new Response(Buffer.from("private"), {
          headers: { "content-type": "text/csv" },
          status: 200,
        });
      }),
    );
    const env = {
      REPORT_S3_ACCESS_KEY_ID: "access-key",
      REPORT_S3_BUCKET: "report-bucket",
      REPORT_S3_ENDPOINT: "http://localhost:9000",
      REPORT_S3_REGION: "ap-northeast-2",
      REPORT_S3_SECRET_ACCESS_KEY: "secret-key",
    } as unknown as ApiEnv;
    const provider = new S3ReportStorageProvider(env);

    await provider.put(storageKey, Buffer.from("private"), "text/csv");
    const object = await provider.get(storageKey);
    expect(object?.body.toString()).toBe("private");
    const firstRequest = requests.at(0)!;
    expect(firstRequest.url).toContain("http://localhost:9000/report-bucket/reports/");
    expect(firstRequest.url).not.toContain("public");
    expect(firstRequest.headers.get("authorization")).toContain("Credential=access-key/");
    expect(firstRequest.headers.get("x-amz-content-sha256")).toHaveLength(64);
  });
});
