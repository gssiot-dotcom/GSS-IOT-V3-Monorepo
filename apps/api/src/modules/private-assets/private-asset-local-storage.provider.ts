import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import type {
  PrivateAssetStorageProvider,
  StoredPrivateAsset,
} from "./private-asset-storage.types";
import { PrivateAssetStorageError } from "./private-asset-storage.types";

interface LocalStorageMetadata {
  contentType: string;
}

export class LocalPrivateAssetStorageProvider implements PrivateAssetStorageProvider {
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
        { encoding: "utf8", flag: "wx" },
      );
      await rename(temporaryTarget, target);
      await rename(temporaryMetadata, metadata);
    } catch {
      await Promise.allSettled([
        rm(temporaryTarget, { force: true }),
        rm(temporaryMetadata, { force: true }),
      ]);
      throw new PrivateAssetStorageError();
    }
  }

  async get(storageKey: string): Promise<StoredPrivateAsset | undefined> {
    const target = this.pathFor(storageKey);
    try {
      const [body, metadataText] = await Promise.all([
        readFile(target),
        readFile(`${target}.meta.json`, "utf8"),
      ]);
      const metadata = JSON.parse(metadataText) as Partial<LocalStorageMetadata>;
      if (!metadata.contentType) throw new PrivateAssetStorageError();
      return { body, contentType: metadata.contentType };
    } catch (error) {
      if (isNotFound(error)) return undefined;
      if (error instanceof PrivateAssetStorageError) throw error;
      throw new PrivateAssetStorageError();
    }
  }

  async remove(storageKey: string): Promise<void> {
    const target = this.pathFor(storageKey);
    try {
      await Promise.all([rm(target, { force: true }), rm(`${target}.meta.json`, { force: true })]);
    } catch {
      throw new PrivateAssetStorageError();
    }
  }

  private pathFor(storageKey: string): string {
    const target = resolve(join(this.root, storageKey));
    const outsideRoot = relative(this.root, target);
    if (isAbsolute(outsideRoot) || outsideRoot.startsWith(`..${sep}`) || outsideRoot === "..") {
      throw new PrivateAssetStorageError();
    }
    return target;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
