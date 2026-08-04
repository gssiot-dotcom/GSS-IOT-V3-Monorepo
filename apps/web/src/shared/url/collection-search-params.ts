import type { CollectionPageSize } from "@gss-iot/contracts";
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function useCollectionSearchParams(defaultPageSize: CollectionPageSize = 50) {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = searchParams.get("pageSize") === "100" ? 100 : defaultPageSize;
  const search = searchParams.get("search") ?? "";

  const update = useCallback(
    (values: Record<string, number | string | null | undefined>, replace = false) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(values).forEach(([key, value]) => {
            if (value === undefined || value === null || value === "") next.delete(key);
            else next.set(key, String(value));
          });
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  return {
    page,
    pageSize: pageSize as CollectionPageSize,
    search,
    searchParams,
    setPage: (next: number) => update({ page: Math.max(1, next) }),
    setPageSize: (next: CollectionPageSize) => update({ page: 1, pageSize: next }),
    setSearch: (next: string) => update({ page: 1, search: next }),
    update,
  };
}
