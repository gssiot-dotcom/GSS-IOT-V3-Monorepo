import { Injectable } from "@nestjs/common";

import { Inject } from "@nestjs/common";

import { PrivateAssetStorageService } from "../private-assets/private-asset-storage.service";
import type { StoredPrivateAsset } from "../private-assets/private-asset-storage.service";
import { CompanyLogoStorageError } from "./company-logo-storage.types";

export type { CompanyLogoStorageProvider, StoredCompanyLogo } from "./company-logo-storage.types";
export { CompanyLogoStorageError } from "./company-logo-storage.types";

@Injectable()
export class CompanyLogoStorageService {
  constructor(
    @Inject(PrivateAssetStorageService) private readonly storage: PrivateAssetStorageService,
  ) {}

  get providerName(): string {
    return this.storage.providerName;
  }

  put(storageKey: string, body: Buffer, contentType: string): Promise<void> {
    return this.storage.put(validateCompanyLogoStorageKey(storageKey), body, contentType);
  }

  get(storageKey: string): Promise<StoredPrivateAsset | undefined> {
    return this.storage.get(validateCompanyLogoStorageKey(storageKey));
  }

  remove(storageKey: string): Promise<void> {
    return this.storage.remove(validateCompanyLogoStorageKey(storageKey));
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
