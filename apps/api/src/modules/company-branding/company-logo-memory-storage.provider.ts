import type { CompanyLogoStorageProvider, StoredCompanyLogo } from "./company-logo-storage.types";

export class MemoryCompanyLogoStorageProvider implements CompanyLogoStorageProvider {
  readonly name = "memory";
  private readonly objects = new Map<string, StoredCompanyLogo>();

  async put(storageKey: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(storageKey, { body: Buffer.from(body), contentType });
  }

  async get(storageKey: string): Promise<StoredCompanyLogo | undefined> {
    const object = this.objects.get(storageKey);
    return object ? { body: Buffer.from(object.body), contentType: object.contentType } : undefined;
  }

  async remove(storageKey: string): Promise<void> {
    this.objects.delete(storageKey);
  }
}
