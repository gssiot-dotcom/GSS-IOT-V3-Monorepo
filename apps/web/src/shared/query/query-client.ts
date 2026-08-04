import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "../api/api-client";

export const DEFAULT_STALE_TIME = 30_000;
export const DEFAULT_GC_TIME = 10 * 60_000;

export function shouldRetryQuery(failureCount: number, error: Error): boolean {
  if (failureCount >= 2) return false;
  if (!(error instanceof ApiError)) return failureCount < 1;
  if ([400, 401, 403, 404, 409, 422].includes(error.status)) return false;
  return error.status >= 500 && failureCount < 2;
}

export function createQueryClient({ test = false }: { test?: boolean } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        gcTime: test ? 0 : DEFAULT_GC_TIME,
        refetchOnReconnect: true,
        // Stale queries reconcile on focus; fresh data remains untouched for 30 seconds.
        refetchOnWindowFocus: true,
        retry: test ? false : shouldRetryQuery,
        staleTime: DEFAULT_STALE_TIME,
      },
    },
  });
}

export const queryClient = createQueryClient();
