import type {
  PrivateAssetStorageProvider,
  StoredPrivateAsset,
} from "./private-asset-storage.types";

export class MemoryPrivateAssetStorageProvider implements PrivateAssetStorageProvider {
  readonly name = "memory";
  private readonly objects = new Map<string, StoredPrivateAsset>();

  async put(storageKey: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(storageKey, { body: Buffer.from(body), contentType });
  }

  async get(storageKey: string): Promise<StoredPrivateAsset | undefined> {
    const object = this.objects.get(storageKey);
    return object ? { body: Buffer.from(object.body), contentType: object.contentType } : undefined;
  }

  async remove(storageKey: string): Promise<void> {
    this.objects.delete(storageKey);
  }
}
