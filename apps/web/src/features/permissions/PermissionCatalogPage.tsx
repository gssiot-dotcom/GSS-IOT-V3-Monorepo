import type {
  AuthContext,
  CollectionPageSize,
  CompanyPermissionRecord,
  PaginatedResponse,
} from "@gss-iot/contracts";
import {
  DataTable,
  CollectionPagination,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  PageHeader,
  SessionExpiredState,
} from "@gss-iot/ui";
import { Badge, Box, Group, Paper, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { IconKey, IconSearch } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { hasTranslationKey, t, tf } from "../../app/i18n";
import { ApiError, apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";

type CatalogContext = Extract<AuthContext, "gss-admin" | "company-user">;

function permissionPart(prefix: "action" | "module" | "scope", value: string | null | undefined) {
  if (!value) return t("common.notAvailable");
  const key = `permissions.${prefix}.${value}`;
  return hasTranslationKey(key) ? t(key) : value;
}

function permissionDescription(permission: CompanyPermissionRecord) {
  return tf("permissions.descriptionTemplate", {
    action: permissionPart("action", permission.action),
    module: permissionPart("module", permission.module),
    scope: permissionPart("scope", permission.scopeType),
  });
}

export function PermissionCatalogPage({ context }: { context: CatalogContext }) {
  const { session } = useAuth();
  const [permissions, setPermissions] = useState<CompanyPermissionRecord[]>();
  const [errorStatus, setErrorStatus] = useState<number>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<CollectionPageSize>(50);
  const [total, setTotal] = useState(0);
  const endpoint = context === "gss-admin" ? "/admin/permissions" : "/company/permissions";

  const load = useCallback(() => {
    if (!session) return;
    setErrorStatus(undefined);
    setPermissions(undefined);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.trim()) params.set("search", search.trim());
    void apiRequest<PaginatedResponse<CompanyPermissionRecord>>(
      session,
      `${endpoint}?${params.toString()}`,
    )
      .then((response) => {
        setPermissions(response.items);
        setTotal(response.total);
      })
      .catch((error: unknown) => setErrorStatus(error instanceof ApiError ? error.status : 500));
  }, [endpoint, page, pageSize, search, session]);

  useEffect(() => load(), [load]);

  const filtered = useMemo(() => permissions ?? [], [permissions]);

  if (errorStatus === 401) {
    return (
      <SessionExpiredState description={t("auth.inactive")} title={t("common.sessionExpired")} />
    );
  }
  if (errorStatus === 403) {
    return (
      <ForbiddenState description={t("common.pageUnavailable")} title={t("common.forbidden")} />
    );
  }
  if (errorStatus) {
    return (
      <ErrorState
        description={t("common.errorDescription")}
        onRetry={load}
        retryLabel={t("common.retry")}
        title={t("permissions.loadError")}
      />
    );
  }
  if (!permissions) return <LoadingState title={t("common.loading")} />;

  const title =
    context === "gss-admin" ? t("permissions.adminTitle") : t("permissions.companyTitle");
  const subtitle =
    context === "gss-admin" ? t("permissions.adminSubtitle") : t("permissions.companySubtitle");

  return (
    <Stack gap="lg">
      <PageHeader subtitle={subtitle} title={title} />
      <Paper p="md" shadow="sm" withBorder>
        <Group align="end" justify="space-between" wrap="wrap">
          <TextInput
            aria-label={t("permissions.searchLabel")}
            leftSection={<IconSearch aria-hidden="true" size={16} />}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setPage(1);
            }}
            placeholder={t("permissions.searchPlaceholder")}
            value={search}
            w={{ base: "100%", sm: 420 }}
          />
          <Text c="dimmed" size="sm">
            {tf("permissions.resultCount", { count: total })}
          </Text>
        </Group>
      </Paper>
      <CollectionPagination
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(Number(value) as CollectionPageSize);
          setPage(1);
        }}
        page={page}
        pageSize={pageSize}
        pageSizeLabel={t("table.pageSize")}
        rangeLabel={tf("table.range", {
          from: total === 0 ? 0 : (page - 1) * pageSize + 1,
          to: Math.min(page * pageSize, total),
          total,
        })}
        totalPages={Math.max(1, Math.ceil(total / pageSize))}
      />

      {!permissions.length ? (
        <EmptyState
          description={t("permissions.emptyDescription")}
          title={t("permissions.emptyTitle")}
        />
      ) : !filtered.length ? (
        <EmptyState
          description={t("permissions.searchEmptyDescription")}
          title={t("permissions.searchEmptyTitle")}
        />
      ) : (
        <>
          <Box hiddenFrom="sm">
            <Stack gap="sm">
              {filtered.map((permission) => (
                <Paper key={permission.id} p="md" shadow="xs" withBorder>
                  <Stack gap="sm">
                    <Group align="flex-start" justify="space-between" wrap="nowrap">
                      <Group align="flex-start" gap="xs" wrap="nowrap">
                        <IconKey aria-hidden="true" color="var(--gss-accent)" size={18} />
                        <Text ff="monospace" fw={700} style={{ overflowWrap: "anywhere" }}>
                          {permission.key}
                        </Text>
                      </Group>
                      <Badge color="gray" style={{ flexShrink: 0 }} variant="light">
                        {permissionPart("scope", permission.scopeType)}
                      </Badge>
                    </Group>
                    <Text c="dimmed" size="sm">
                      {permissionDescription(permission)}
                    </Text>
                    <SimpleGrid cols={2} spacing="xs">
                      <PermissionMeta
                        label={t("permissions.module")}
                        value={permissionPart("module", permission.module)}
                      />
                      <PermissionMeta
                        label={t("permissions.action")}
                        value={permissionPart("action", permission.action)}
                      />
                    </SimpleGrid>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
          <Box visibleFrom="sm">
            <DataTable
              ariaLabel={t("permissions.tableLabel")}
              columns={[
                {
                  key: "key",
                  label: t("permissions.key"),
                  render: (permission) => (
                    <Text ff="monospace" fw={650} size="sm">
                      {permission.key}
                    </Text>
                  ),
                  width: "25%",
                },
                {
                  key: "description",
                  label: t("permissions.description"),
                  render: permissionDescription,
                  width: "40%",
                },
                {
                  key: "module",
                  label: t("permissions.module"),
                  render: (permission) => permissionPart("module", permission.module),
                },
                {
                  align: "right",
                  key: "scope",
                  label: t("permissions.scope"),
                  render: (permission) => (
                    <Badge color="gray" style={{ flexShrink: 0 }} variant="light">
                      {permissionPart("scope", permission.scopeType)}
                    </Badge>
                  ),
                  width: 104,
                },
                {
                  align: "right",
                  key: "action",
                  label: t("permissions.action"),
                  render: (permission) => permissionPart("action", permission.action),
                },
              ]}
              density="compact"
              rows={filtered}
            />
          </Box>
        </>
      )}
    </Stack>
  );
}

function PermissionMeta({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text fw={600} size="sm">
        {value}
      </Text>
    </Stack>
  );
}
