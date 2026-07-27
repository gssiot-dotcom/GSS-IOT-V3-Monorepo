import { createHash, createHmac } from "node:crypto";

import type { ApiEnv } from "@gss-iot/config";

import type {
  PrivateAssetStorageProvider,
  StoredPrivateAsset,
} from "./private-asset-storage.types";
import { PrivateAssetStorageError } from "./private-asset-storage.types";

export class S3PrivateAssetStorageProvider implements PrivateAssetStorageProvider {
  readonly name = "s3";
  private readonly endpoint: URL;

  constructor(private readonly env: ApiEnv) {
    this.endpoint = new URL(
      env.ASSET_S3_ENDPOINT ?? `https://s3.${env.ASSET_S3_REGION}.amazonaws.com`,
    );
  }

  async put(storageKey: string, body: Buffer, contentType: string): Promise<void> {
    await this.request("PUT", storageKey, body, contentType);
  }

  async get(storageKey: string): Promise<StoredPrivateAsset | undefined> {
    const response = await this.request("GET", storageKey);
    if (!response) return undefined;
    return {
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
    };
  }

  async remove(storageKey: string): Promise<void> {
    await this.request("DELETE", storageKey);
  }

  private async request(
    method: "DELETE" | "GET" | "PUT",
    storageKey: string,
    body?: Buffer,
    contentType?: string,
  ): Promise<Response | undefined> {
    const url = this.objectUrl(storageKey);
    const payload = body ?? Buffer.alloc(0);
    const payloadHash = sha256(payload);
    const amzDate = formatAmzDate(new Date());
    const dateStamp = amzDate.slice(0, 8);
    const headers = new Headers({
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    });
    if (contentType) headers.set("content-type", contentType);
    headers.set(
      "authorization",
      signRequest(this.env, method, url, headers, payloadHash, dateStamp),
    );

    try {
      const response = await fetch(url, {
        body: method === "PUT" ? Uint8Array.from(payload) : undefined,
        headers,
        method,
      });
      if (response.ok) return response;
      if ((method === "GET" || method === "DELETE") && response.status === 404) return undefined;
      throw new PrivateAssetStorageError();
    } catch (error) {
      if (error instanceof PrivateAssetStorageError) throw error;
      throw new PrivateAssetStorageError();
    }
  }

  private objectUrl(storageKey: string): URL {
    const url = new URL(this.endpoint);
    const prefix = url.pathname.replace(/\/$/, "");
    const encodedKey = storageKey.split("/").map(encodeURIComponent).join("/");
    const forcePathStyle =
      this.env.ASSET_S3_FORCE_PATH_STYLE ?? Boolean(this.env.ASSET_S3_ENDPOINT);
    if (forcePathStyle) {
      url.pathname = `${prefix}/${encodeURIComponent(this.env.ASSET_S3_BUCKET!)}/${encodedKey}`;
    } else {
      url.hostname = `${this.env.ASSET_S3_BUCKET!}.${url.hostname}`;
      url.pathname = `${prefix}/${encodedKey}`;
    }
    return url;
  }
}

function signRequest(
  env: ApiEnv,
  method: string,
  url: URL,
  headers: Headers,
  payloadHash: string,
  dateStamp: string,
): string {
  const signedHeaderNames = [...headers.keys()].map((header) => header.toLowerCase()).sort();
  const canonicalHeaders = signedHeaderNames
    .map((header) => `${header}:${headers.get(header)!.trim()}\n`)
    .join("");
  const canonicalRequest = [
    method,
    url.pathname,
    url.search.slice(1),
    canonicalHeaders,
    signedHeaderNames.join(";"),
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${env.ASSET_S3_REGION}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    headers.get("x-amz-date"),
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const signingKey = hmac(
    hmac(
      hmac(hmac(`AWS4${env.ASSET_S3_SECRET_ACCESS_KEY!}`, dateStamp), env.ASSET_S3_REGION!),
      "s3",
    ),
    "aws4_request",
  );
  const signature = hmac(signingKey, stringToSign).toString("hex");
  return `AWS4-HMAC-SHA256 Credential=${env.ASSET_S3_ACCESS_KEY_ID!}/${credentialScope}, SignedHeaders=${signedHeaderNames.join(";")}, Signature=${signature}`;
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function formatAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}
