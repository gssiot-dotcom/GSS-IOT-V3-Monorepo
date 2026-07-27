export interface StoredCompanyLogo {
  body: Buffer;
  contentType: string;
}

export interface CompanyLogoStorageProvider {
  readonly name: string;
  put(storageKey: string, body: Buffer, contentType: string): Promise<void>;
  get(storageKey: string): Promise<StoredCompanyLogo | undefined>;
  remove(storageKey: string): Promise<void>;
}

export class CompanyLogoStorageError extends Error {
  constructor(message = "Company logo storage operation failed.") {
    super(message);
    this.name = "CompanyLogoStorageError";
  }
}
