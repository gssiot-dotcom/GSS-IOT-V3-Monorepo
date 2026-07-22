import { Injectable } from "@nestjs/common";

import { loadApiEnv } from "@gss-iot/config";

import { LocalReportStorageProvider } from "./report-local-storage.provider";
import { MemoryReportStorageProvider } from "./report-memory-storage.provider";
import { S3ReportStorageProvider } from "./report-s3-storage.provider";
import type { ReportStorageProvider, StoredReportObject } from "./report-storage.types";
import { ReportStorageError } from "./report-storage.types";

export type { ReportStorageProvider, StoredReportObject } from "./report-storage.types";
export { ReportStorageError } from "./report-storage.types";

/**
 * Provider-neutral report storage boundary. API responses expose neither provider URLs nor keys.
 */
@Injectable()
export class ReportStorageService {
  private readonly provider: ReportStorageProvider;

  constructor() {
    const env = loadApiEnv();
    this.provider = createProvider(env);
  }

  get providerName(): string {
    return this.provider.name;
  }

  put(storageKey: string, body: Buffer, contentType: string): Promise<void> {
    return this.provider.put(validateStorageKey(storageKey), body, contentType);
  }

  get(storageKey: string): Promise<StoredReportObject | undefined> {
    return this.provider.get(validateStorageKey(storageKey));
  }

  remove(storageKey: string): Promise<void> {
    return this.provider.remove(validateStorageKey(storageKey));
  }
}

function createProvider(env: ReturnType<typeof loadApiEnv>): ReportStorageProvider {
  switch (env.REPORT_STORAGE_PROVIDER) {
    case "memory":
      return new MemoryReportStorageProvider();
    case "local":
      return new LocalReportStorageProvider(env.REPORT_LOCAL_STORAGE_DIR);
    case "s3":
      return new S3ReportStorageProvider(env);
    default:
      throw new ReportStorageError();
  }
}

export function validateStorageKey(storageKey: string): string {
  if (
    !storageKey ||
    storageKey.includes("\\") ||
    storageKey.includes("\0") ||
    storageKey.startsWith("/") ||
    storageKey.includes("..") ||
    !/^reports\/[A-Za-z0-9._/-]+$/.test(storageKey)
  ) {
    throw new ReportStorageError();
  }
  return storageKey;
}
