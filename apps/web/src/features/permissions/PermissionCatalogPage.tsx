import type { AuthContext, CompanyPermissionRecord } from "@gss-iot/contracts";
import {
  DataTable,
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

import { t, tf } from "../../app/i18n";
import { ApiError, apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";

type CatalogContext = Extract<AuthContext, "gss-admin" | "company-user">;

export function PermissionCatalogPage({ context }: { context: CatalogContext }) {
  const { session } = useAuth();
  const [permissions, setPermissions] = useState<CompanyPermissionRecord[]>();
  const [errorStatus, setErrorStatus] = useState<number>();
  const [search, setSearch] = useState("");
  const endpoint = context === "gss-admin" ? "/admin/permissions" : "/company/permissions";

  const load = useCallback(() => {
    if (!session) return;
    setErrorStatus(undefined);
    setPermissions(undefined);
    void apiRequest<CompanyPermissionRecord[]>(session, endpoint)
      .then(setPermissions)
      .catch((error: unknown) => setErrorStatus(error instanceof ApiError ? error.status : 500));
  }, [endpoint, session]);

  useEffect(() => load(), [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!permissions || !query) return permissions ?? [];
    return permissions.filter((permission) =>
      [permission.key, permission.module, permission.description ?? ""].some((value) =>
        value.toLocaleLowerCase().includes(query),
      ),
    );
  }, [permissions, search]);

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
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder={t("permissions.searchPlaceholder")}
            value={search}
            w={{ base: "100%", sm: 420 }}
          />
          <Text c="dimmed" size="sm">
            {tf("permissions.resultCount", { count: filtered.length })}
          </Text>
        </Group>
      </Paper>

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
                        {permission.scopeType ?? t("common.notAvailable")}
                      </Badge>
                    </Group>
                    <Text c="dimmed" size="sm">
                      {permission.description ?? t("permissions.noDescription")}
                    </Text>
                    <SimpleGrid cols={2} spacing="xs">
                      <PermissionMeta label={t("permissions.module")} value={permission.module} />
                      <PermissionMeta label={t("permissions.action")} value={permission.action} />
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
                  render: (permission) => permission.description ?? t("permissions.noDescription"),
                  width: "40%",
                },
                {
                  key: "module",
                  label: t("permissions.module"),
                  render: (permission) => permission.module,
                },
                {
                  align: "right",
                  key: "scope",
                  label: t("permissions.scope"),
                  render: (permission) => (
                    <Badge color="gray" style={{ flexShrink: 0 }} variant="light">
                      {permission.scopeType ?? t("common.notAvailable")}
                    </Badge>
                  ),
                  width: 104,
                },
                {
                  align: "right",
                  key: "action",
                  label: t("permissions.action"),
                  render: (permission) => permission.action,
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
