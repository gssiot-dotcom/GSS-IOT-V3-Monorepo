import type { AuthSession } from "@gss-iot/contracts";

import { readWebEnv } from "../../app/env";
import { getActiveLocale, hasTranslationKey, intlLocaleByLocale, t } from "../../app/i18n";
import { ensureCsrfToken, refreshSession } from "../auth/auth-api";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly technicalMessage?: string,
  ) {
    super(message);
  }
}

interface ErrorPayload {
  code?: unknown;
  message?: unknown;
}

async function readErrorPayload(response: Response): Promise<ErrorPayload> {
  try {
    return (await response.json()) as ErrorPayload;
  } catch {
    return {};
  }
}

function technicalMessage(payload: ErrorPayload): string | undefined {
  if (Array.isArray(payload.message)) {
    const messages = payload.message.filter((item): item is string => typeof item === "string");
    if (messages.length) return messages.join(" ");
  }
  return typeof payload.message === "string" && payload.message.trim()
    ? payload.message
    : undefined;
}

function statusErrorKey(status: number) {
  if (status === 401) return "apiError.authenticationRequired" as const;
  if (status === 403) return "apiError.permissionDenied" as const;
  if (status === 404) return "apiError.notFound" as const;
  if (status === 409) return "apiError.conflict" as const;
  if (status === 400 || status === 422) return "apiError.validation" as const;
  return "apiError.generic" as const;
}

async function createApiError(response: Response): Promise<ApiError> {
  const payload = await readErrorPayload(response);
  const code = typeof payload.code === "string" ? payload.code : undefined;
  const codeKey = code ? `apiError.${code}` : undefined;
  const message =
    codeKey && hasTranslationKey(codeKey) ? t(codeKey) : t(statusErrorKey(response.status));
  return new ApiError(message, response.status, code, technicalMessage(payload));
}

function localeHeaders(): Record<string, string> {
  return { "accept-language": intlLocaleByLocale[getActiveLocale()] };
}

async function authenticatedFetch(
  path: string,
  options: RequestInit = {},
  retryAfterRefresh = true,
): Promise<Response> {
  const method = options.method?.toUpperCase() ?? "GET";
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(method);
  const response = await fetch(`${readWebEnv().apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(unsafe ? { "x-csrf-token": await ensureCsrfToken() } : {}),
      ...localeHeaders(),
      ...options.headers,
    },
  });
  if (response.status === 401 && retryAfterRefresh) {
    await refreshSession();
    return authenticatedFetch(path, options, false);
  }
  return response;
}

export async function apiRequest<T>(
  _session: AuthSession,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await authenticatedFetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw await createApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiMultipartRequest<T>(
  _session: AuthSession,
  path: string,
  body: FormData,
  method: "POST" | "PUT" = "PUT",
): Promise<T> {
  const response = await authenticatedFetch(path, {
    body,
    method,
  });

  if (!response.ok) throw await createApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function apiBlob(
  _session: AuthSession,
  path: string,
  options: Pick<RequestInit, "cache"> = {},
): Promise<Blob> {
  const response = await authenticatedFetch(path, {
    ...options,
  });
  if (!response.ok) throw await createApiError(response);
  return response.blob();
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

export async function apiDownload(_session: AuthSession, path: string): Promise<ApiDownload> {
  const response = await authenticatedFetch(path);

  if (!response.ok) {
    throw await createApiError(response);
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
    fileName:
      fileNameFromContentDisposition(response.headers.get("content-disposition")) ??
      "report-export",
  };
}
