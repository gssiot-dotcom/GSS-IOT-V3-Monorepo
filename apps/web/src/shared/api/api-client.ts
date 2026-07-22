import type { AuthSession } from "@gss-iot/contracts";

import { readWebEnv } from "../../app/env";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown };
    if (Array.isArray(payload.message)) {
      const messages = payload.message.filter((item): item is string => typeof item === "string");
      if (messages.length) return messages.join(" ");
    }
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  } catch {
    // Some error responses have no JSON body; use the stable status fallback below.
  }

  return `API request failed with status ${response.status}.`;
}

export async function apiRequest<T>(
  session: AuthSession,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${readWebEnv().apiBaseUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      "content-type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function fileNameFromContentDisposition(value: string | null): string | undefined {
  if (!value) return undefined;
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.replace(/^"|"$/g, ""));
    } catch {
      return undefined;
    }
  }
  return value.match(/filename="?([^";]+)"?/i)?.[1];
}

export interface ApiDownload {
  blob: Blob;
  contentType: string;
  fileName: string;
}

export async function apiDownload(session: AuthSession, path: string): Promise<ApiDownload> {
  const response = await fetch(`${readWebEnv().apiBaseUrl}${path}`, {
    headers: { authorization: `Bearer ${session.accessToken}` },
  });

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
    fileName:
      fileNameFromContentDisposition(response.headers.get("content-disposition")) ??
      "report-export",
  };
}
