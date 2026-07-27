import { Injectable } from "@nestjs/common";

import { loadApiEnv } from "@gss-iot/config";

import { LocalPrivateAssetStorageProvider } from "./private-asset-local-storage.provider";
import { MemoryPrivateAssetStorageProvider } from "./private-asset-memory-storage.provider";
import { S3PrivateAssetStorageProvider } from "./private-asset-s3-storage.provider";
import type {
  PrivateAssetStorageProvider,
  StoredPrivateAsset,
} from "./private-asset-storage.types";
import { PrivateAssetStorageError } from "./private-asset-storage.types";

@Injectable()
export class PrivateAssetStorageService {
  private readonly provider: PrivateAssetStorageProvider;

  constructor() {
    const env = loadApiEnv();
    this.provider = createProvider(env);
  }

  get providerName(): string {
    return this.provider.name;
  }

  put(storageKey: string, body: Buffer, contentType: string): Promise<void> {
    return this.provider.put(validatePrivateAssetStorageKey(storageKey), body, contentType);
  }

  get(storageKey: string): Promise<StoredPrivateAsset | undefined> {
    return this.provider.get(validatePrivateAssetStorageKey(storageKey));
  }

  remove(storageKey: string): Promise<void> {
    return this.provider.remove(validatePrivateAssetStorageKey(storageKey));
  }
}

function createProvider(env: ReturnType<typeof loadApiEnv>): PrivateAssetStorageProvider {
  switch (env.ASSET_STORAGE_PROVIDER) {
    case "memory":
      return new MemoryPrivateAssetStorageProvider();
    case "local":
      return new LocalPrivateAssetStorageProvider(env.ASSET_LOCAL_STORAGE_DIR);
    case "s3":
      return new S3PrivateAssetStorageProvider(env);
    default:
      throw new PrivateAssetStorageError();
  }
}

export function validatePrivateAssetStorageKey(storageKey: string): string {
  const companyLogo = /^company-logos\/[A-Za-z0-9_-]+\/[0-9a-f-]+\.(png|jpg|webp)$/;
  const buildingImage =
    /^building-images\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/(plan|real)\/[0-9a-f-]+\.(png|jpg|webp)$/;
  if (
    !storageKey ||
    storageKey.includes("\\") ||
    storageKey.includes("\0") ||
    storageKey.startsWith("/") ||
    storageKey.includes("..") ||
    (!companyLogo.test(storageKey) && !buildingImage.test(storageKey))
  ) {
    throw new PrivateAssetStorageError();
  }
  return storageKey;
}

export type {
  PrivateAssetStorageProvider,
  StoredPrivateAsset,
} from "./private-asset-storage.types";
export { PrivateAssetStorageError } from "./private-asset-storage.types";
