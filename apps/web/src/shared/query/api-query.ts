import type { AuthSession } from "@gss-iot/contracts";
import {
  queryOptions,
  useMutation,
  useQuery,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiRequest } from "../api/api-client";

export const REFERENCE_STALE_TIME = 5 * 60_000;

export function apiQueryOptions<T>(
  session: AuthSession,
  queryKey: QueryKey,
  path: string,
  options: Omit<UseQueryOptions<T, Error, T, QueryKey>, "queryFn" | "queryKey"> = {},
) {
  return queryOptions({
    ...options,
    queryFn: ({ signal }) => apiRequest<T>(session, path, { signal }),
    queryKey,
  });
}

export function useApiQuery<T>(
  session: AuthSession | undefined,
  queryKey: QueryKey,
  path: string,
  options: Omit<UseQueryOptions<T, Error, T, QueryKey>, "queryFn" | "queryKey"> = {},
) {
  return useQuery({
    ...options,
    enabled: Boolean(session) && (options.enabled ?? true),
    queryFn: ({ signal }) => apiRequest<T>(session as AuthSession, path, { signal }),
    queryKey,
  });
}

export interface ApiMutationVariables {
  options?: RequestInit;
  path: string;
}

export function useApiMutation<
  TData = unknown,
  TVariables extends ApiMutationVariables = ApiMutationVariables,
>(
  session: AuthSession | undefined,
  options: Omit<UseMutationOptions<TData, Error, TVariables>, "mutationFn"> = {},
) {
  return useMutation({
    ...options,
    mutationFn: ({ options: requestOptions, path }) =>
      apiRequest<TData>(session as AuthSession, path, requestOptions),
  });
}
