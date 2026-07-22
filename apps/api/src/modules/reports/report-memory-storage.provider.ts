import type { ReportStorageProvider, StoredReportObject } from "./report-storage.types";

export class MemoryReportStorageProvider implements ReportStorageProvider {
  readonly name = "memory";
  private readonly objects = new Map<string, StoredReportObject>();

  async put(storageKey: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(storageKey, { body: Buffer.from(body), contentType });
  }

  async get(storageKey: string): Promise<StoredReportObject | undefined> {
    const object = this.objects.get(storageKey);
    return object ? { body: Buffer.from(object.body), contentType: object.contentType } : undefined;
  }

  async remove(storageKey: string): Promise<void> {
    this.objects.delete(storageKey);
  }
}
