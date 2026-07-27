export interface StoredPrivateAsset {
  body: Buffer;
  contentType: string;
}

export interface PrivateAssetStorageProvider {
  readonly name: string;
  put(storageKey: string, body: Buffer, contentType: string): Promise<void>;
  get(storageKey: string): Promise<StoredPrivateAsset | undefined>;
  remove(storageKey: string): Promise<void>;
}

export class PrivateAssetStorageError extends Error {
  constructor(message = "Private asset storage operation failed.") {
    super(message);
    this.name = "PrivateAssetStorageError";
  }
}
