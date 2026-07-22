export interface StoredReportObject {
  body: Buffer;
  contentType: string;
}

export interface ReportStorageProvider {
  readonly name: string;
  put(storageKey: string, body: Buffer, contentType: string): Promise<void>;
  get(storageKey: string): Promise<StoredReportObject | undefined>;
  remove(storageKey: string): Promise<void>;
}

export class ReportStorageError extends Error {
  constructor(message = "Report storage operation failed.") {
    super(message);
    this.name = "ReportStorageError";
  }
}
