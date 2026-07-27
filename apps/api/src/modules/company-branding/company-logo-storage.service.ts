import { Injectable } from "@nestjs/common";

import { loadApiEnv } from "@gss-iot/config";

import { LocalCompanyLogoStorageProvider } from "./company-logo-local-storage.provider";
import { MemoryCompanyLogoStorageProvider } from "./company-logo-memory-storage.provider";
import { S3CompanyLogoStorageProvider } from "./company-logo-s3-storage.provider";
import type { CompanyLogoStorageProvider, StoredCompanyLogo } from "./company-logo-storage.types";
import { CompanyLogoStorageError } from "./company-logo-storage.types";

export type { CompanyLogoStorageProvider, StoredCompanyLogo } from "./company-logo-storage.types";
export { CompanyLogoStorageError } from "./company-logo-storage.types";

@Injectable()
export class CompanyLogoStorageService {
  private readonly provider: CompanyLogoStorageProvider;

  constructor() {
    const env = loadApiEnv();
    this.provider = createProvider(env);
  }

  get providerName(): string {
    return this.provider.name;
  }

  put(storageKey: string, body: Buffer, contentType: string): Promise<void> {
    return this.provider.put(validateCompanyLogoStorageKey(storageKey), body, contentType);
  }

  get(storageKey: string): Promise<StoredCompanyLogo | undefined> {
    return this.provider.get(validateCompanyLogoStorageKey(storageKey));
  }

  remove(storageKey: string): Promise<void> {
    return this.provider.remove(validateCompanyLogoStorageKey(storageKey));
  }
}

function createProvider(env: ReturnType<typeof loadApiEnv>): CompanyLogoStorageProvider {
  switch (env.ASSET_STORAGE_PROVIDER) {
    case "memory":
      return new MemoryCompanyLogoStorageProvider();
    case "local":
      return new LocalCompanyLogoStorageProvider(env.ASSET_LOCAL_STORAGE_DIR);
    case "s3":
      return new S3CompanyLogoStorageProvider(env);
    default:
      throw new CompanyLogoStorageError();
  }
}

export function validateCompanyLogoStorageKey(storageKey: string): string {
  if (
    !storageKey ||
    storageKey.includes("\\") ||
    storageKey.includes("\0") ||
    storageKey.startsWith("/") ||
    storageKey.includes("..") ||
    !/^company-logos\/[A-Za-z0-9_-]+\/[0-9a-f-]+\.(png|jpg|webp)$/.test(storageKey)
  ) {
    throw new CompanyLogoStorageError();
  }
  return storageKey;
}

export function validateCompanyLogoOwnership(companyId: string, storageKey: string): string {
  const validKey = validateCompanyLogoStorageKey(storageKey);
  if (!validKey.startsWith(`company-logos/${companyId}/`)) {
    throw new CompanyLogoStorageError();
  }
  return validKey;
}
