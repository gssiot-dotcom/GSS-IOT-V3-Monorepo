import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

import type { ReportStorageProvider, StoredReportObject } from "./report-storage.types";
import { ReportStorageError } from "./report-storage.types";

interface LocalStorageMetadata {
  contentType: string;
}

export class LocalReportStorageProvider implements ReportStorageProvider {
  readonly name = "local";
  private readonly root: string;

  constructor(rootDirectory: string) {
    this.root = resolve(rootDirectory);
  }

  async put(storageKey: string, body: Buffer, contentType: string): Promise<void> {
    const target = this.pathFor(storageKey);
    const metadata = `${target}.meta.json`;
    await mkdir(dirname(target), { recursive: true });
    const temporaryTarget = `${target}.${randomUUID()}.tmp`;
    const temporaryMetadata = `${metadata}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryTarget, body, { flag: "wx" });
      await writeFile(
        temporaryMetadata,
        JSON.stringify({ contentType } satisfies LocalStorageMetadata),
        {
          encoding: "utf8",
          flag: "wx",
        },
      );
      await rename(temporaryTarget, target);
      await rename(temporaryMetadata, metadata);
    } catch {
      await Promise.allSettled([
        rm(temporaryTarget, { force: true }),
        rm(temporaryMetadata, { force: true }),
      ]);
      throw new ReportStorageError();
    }
  }

  async get(storageKey: string): Promise<StoredReportObject | undefined> {
    const target = this.pathFor(storageKey);
    const metadata = `${target}.meta.json`;
    try {
      const [body, metadataText] = await Promise.all([
        readFile(target),
        readFile(metadata, "utf8"),
      ]);
      const parsed = JSON.parse(metadataText) as Partial<LocalStorageMetadata>;
      if (!parsed.contentType) throw new ReportStorageError();
      return { body, contentType: parsed.contentType };
    } catch (error) {
      if (isNotFound(error)) return undefined;
      if (error instanceof ReportStorageError) throw error;
      throw new ReportStorageError();
    }
  }

  async remove(storageKey: string): Promise<void> {
    const target = this.pathFor(storageKey);
    await Promise.all([rm(target, { force: true }), rm(`${target}.meta.json`, { force: true })]);
  }

  private pathFor(storageKey: string): string {
    const target = resolve(join(this.root, storageKey));
    const outsideRoot = relative(this.root, target);
    if (isAbsolute(outsideRoot) || outsideRoot.startsWith(`..${sep}`) || outsideRoot === "..") {
      throw new ReportStorageError();
    }
    return target;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
