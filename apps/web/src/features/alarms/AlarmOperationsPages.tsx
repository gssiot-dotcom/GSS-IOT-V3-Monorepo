import type {
  AlarmChannel,
  AlarmEventRecord,
  AlarmNotificationRecord,
  AlarmPolicyRecord,
  AlarmRuleRecord,
  AlarmSeverity,
  CollectionPageSize,
  BuildingRecord,
  CompanyPositionRecord,
  CompanyUserRecord,
  NodeTypeRecord,
  PaginatedResponse,
} from "@gss-iot/contracts";
import {
  CollectionPagination,
  ConfirmActionModal,
  DataTable,
  EntityActionMenu,
  EmptyState,
  ErrorState,
  FormFieldGrid,
  FormSection,
  FormWorkspace,
  LoadingState,
  PageHeader,
  StatusBadge,
  StickyFormActions,
  WorkspaceTabs,
} from "@gss-iot/ui";
import {
  Button,
  Checkbox,
  Divider,
  Drawer,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconBellCheck,
  IconCheck,
  IconEdit,
  IconEye,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { t, tf } from "../../app/i18n";
import { ApiError, apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { Can } from "../../shared/rbac/Can";
import { hasPermission } from "../../shared/rbac/has-permission";

type BasePath = "/admin" | "/company";

type ListResponse<T> = PaginatedResponse<T>;

interface RuleOptions {
  buildings: Array<BuildingRecord & { company?: { name: string } }>;
  nodeTypes: NodeTypeRecord[];
  positions: CompanyPositionRecord[];
  users: CompanyUserRecord[];
}

interface ProviderStatus {
  providers: Array<{ channel: AlarmChannel; configured: boolean; providerKey: string }>;
}

const severityOptions: AlarmSeverity[] = ["CAUTION", "WARNING", "DANGER"];
const channelOptions: AlarmChannel[] = ["IN_APP", "SMS", "TELEGRAM", "EMAIL", "WEB_PUSH"];
const alarmRuleNameMaxLength = 120;

interface RuleDraft {
  buildingId: string;
  name: string;
  nodeTypeId: string;
  severity: AlarmSeverity;
}

interface PolicyDraft {
  buildingId: string;
  channel: AlarmChannel;
  countIntervalSeconds: number;
  positionId: string;
  requiredOccurrenceCount: number;
  specificUserId: string;
  targetType: "POSITION" | "SPECIFIC_USER";
}

function createEmptyRuleDraft(): RuleDraft {
  return {
    buildingId: "",
    name: "",
    nodeTypeId: "",
    severity: "DANGER",
  };
}

function createEmptyPolicyDraft(): PolicyDraft {
  return {
    buildingId: "",
    channel: "IN_APP",
    countIntervalSeconds: 0,
    positionId: "",
    requiredOccurrenceCount: 1,
    specificUserId: "",
    targetType: "POSITION",
  };
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "-";
}

function semanticStatus(status: string) {
  const normalized = status.toLowerCase();
  const supported = new Set([
    "acknowledged",
    "active",
    "available",
    "cancelled",
    "caution",
    "completed",
    "connecting",
    "danger",
    "expired",
    "failed",
    "inactive",
    "maintenance",
    "offline",
    "online",
    "open",
    "pending",
    "processing",
    "read",
    "reconnecting",
    "resolved",
    "retired",
    "safe",
    "sent",
    "skipped",
    "stale",
    "unassigned",
    "unconfigured",
    "unread",
    "warning",
  ]);
  return (supported.has(normalized) ? normalized : "inactive") as Parameters<
    typeof StatusBadge
  >[0]["status"];
}

function StatusValue({ value }: { value: string }) {
  return (
    <StatusBadge
      label={t(`status.${value.toLowerCase()}` as never)}
      status={semanticStatus(value)}
    />
  );
}

function PolicyFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Paper p="md" radius="md" withBorder>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text component="div" fw={650} mt={4} size="sm">
        {value}
      </Text>
    </Paper>
  );
}

function endpoint(basePath: BasePath, path: string) {
  return `${basePath}${path}`;
}

export function AdminAlarmsPage() {
  return <AlarmsPage basePath="/admin" />;
}

export function CompanyAlarmsPage() {
  return <AlarmsPage basePath="/company" />;
}

export function AdminAlarmDetailPage() {
  return <AlarmDetailPage basePath="/admin" />;
}

export function CompanyAlarmDetailPage() {
  return <AlarmDetailPage basePath="/company" />;
}

export function AdminAlarmRulesPage() {
  return <AlarmRulesPage basePath="/admin" />;
}

export function CompanyAlarmRulesPage() {
  return <AlarmRulesPage basePath="/company" />;
}

export function AdminNotificationsPage() {
  return <NotificationsPage basePath="/admin" />;
}

export function CompanyNotificationsPage() {
  return <NotificationsPage basePath="/company" />;
}

function AlarmsPage({ basePath }: { basePath: BasePath }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [alarms, setAlarms] = useState<AlarmEventRecord[]>();
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<CollectionPageSize>(50);
  const [total, setTotal] = useState(0);
  const [archiveTarget, setArchiveTarget] = useState<AlarmEventRecord | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkArchiveIds, setBulkArchiveIds] = useState<string[]>([]);
  const [mutationError, setMutationError] = useState<string>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    setError(false);
    try {
      const response = await apiRequest<ListResponse<AlarmEventRecord>>(
        session,
        endpoint(basePath, `/alarms?page=${page}&pageSize=${pageSize}`),
      );
      setAlarms(response.items);
      setTotal(response.total);
      setSelectedIds((current) =>
        current.filter((id) =>
          response.items.some((item) => item.id === id && item.status === "RESOLVED"),
        ),
      );
    } catch {
      setError(true);
    }
  }, [basePath, page, pageSize, session]);

  const archive = async () => {
    if (!session || !archiveTarget || archiving) return;
    setMutationError(undefined);
    setArchiving(true);
    try {
      await apiRequest(session, endpoint(basePath, `/alarms/${archiveTarget.id}`), {
        method: "DELETE",
      });
      setArchiveTarget(null);
      await load();
    } catch (error) {
      setMutationError(error instanceof ApiError ? error.message : t("common.errorDescription"));
    } finally {
      setArchiving(false);
    }
  };

  const bulkArchive = async () => {
    if (!session || !bulkArchiveIds.length || archiving) return;
    setMutationError(undefined);
    setArchiving(true);
    try {
      await apiRequest(session, endpoint(basePath, "/alarms/bulk-archive"), {
        body: JSON.stringify({ ids: [...bulkArchiveIds] }),
        method: "POST",
      });
      setBulkArchiveOpen(false);
      setBulkArchiveIds([]);
      setSelectedIds([]);
      await load();
    } catch (error) {
      setMutationError(error instanceof ApiError ? error.message : t("common.errorDescription"));
    } finally {
      setArchiving(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  if (!alarms) return <LoadingState title={t("common.loading")} />;
  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  const selectableIds = alarms.filter((alarm) => alarm.status === "RESOLVED").map(({ id }) => id);
  const allSelectableSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));
  const canArchive = hasPermission(session, "alarms.manage");

  return (
    <Stack gap="lg">
      <PageHeader title={t("alarms.title")} subtitle={t("alarms.subtitle")} />
      {mutationError ? (
        <Text c="red" role="alert" size="sm">
          {mutationError}
        </Text>
      ) : null}
      {alarms.length ? (
        <Stack gap="sm">
          <CollectionPagination
            actions={
              canArchive ? (
                <Group gap="xs">
                  <Button
                    disabled={!selectableIds.length}
                    onClick={() => setSelectedIds(allSelectableSelected ? [] : [...selectableIds])}
                    size="xs"
                    variant="default"
                  >
                    {t(allSelectableSelected ? "common.clearSelection" : "common.selectAll")}
                  </Button>
                  <Button
                    color="red"
                    disabled={!selectedIds.length}
                    leftSection={<IconTrash size={14} />}
                    onClick={() => {
                      setBulkArchiveIds([...selectedIds]);
                      setBulkArchiveOpen(true);
                    }}
                    size="xs"
                    variant="light"
                  >
                    {tf("common.deleteSelected", { count: selectedIds.length })}
                  </Button>
                </Group>
              ) : undefined
            }
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
          <DataTable
            rows={alarms}
            columns={[
              ...(canArchive
                ? [
                    {
                      key: "select",
                      label: t("common.select"),
                      render: (row: AlarmEventRecord) => (
                        <Checkbox
                          aria-label={`${t("common.select")}: ${row.node?.number ?? row.nodeId}`}
                          checked={selectedIds.includes(row.id)}
                          disabled={row.status !== "RESOLVED"}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            setSelectedIds((current) =>
                              checked
                                ? [...new Set([...current, row.id])]
                                : current.filter((id) => id !== row.id),
                            );
                          }}
                          title={
                            row.status === "RESOLVED" ? undefined : t("alarms.deleteResolvedOnly")
                          }
                        />
                      ),
                      width: 72,
                    },
                  ]
                : []),
              {
                key: "building",
                label: t("organizations.building"),
                render: (row) => row.building?.title ?? row.buildingId,
              },
              {
                key: "node",
                label: t("devices.node"),
                render: (row) => row.node?.number ?? row.nodeId,
              },
              {
                key: "severity",
                label: t("alarms.severity"),
                render: (row) => <StatusValue value={row.severity} />,
              },
              {
                key: "status",
                label: t("gatewayCommands.status"),
                render: (row) => <StatusValue value={row.status} />,
              },
              {
                key: "opened",
                label: t("alarms.openedAt"),
                render: (row) => formatDate(row.openedAt),
              },
              {
                key: "actions",
                label: t("organizations.actions"),
                render: (row) => (
                  <EntityActionMenu
                    ariaLabel={`${t("common.moreActions")}: ${row.node?.number ?? row.nodeId}`}
                    items={[
                      {
                        icon: <IconEye size={16} />,
                        key: "open",
                        label: t("organizations.open"),
                        onClick: () => navigate(`${basePath}/alarms/${row.id}`),
                      },
                      ...(hasPermission(session, "alarms.manage")
                        ? [
                            {
                              color: "red" as const,
                              destructive: true,
                              disabled: row.status !== "RESOLVED",
                              disabledReason:
                                row.status === "RESOLVED"
                                  ? undefined
                                  : t("alarms.deleteResolvedOnly"),
                              icon: <IconTrash size={16} />,
                              key: "delete",
                              label: t("organizations.delete"),
                              onClick: () => setArchiveTarget(row),
                            },
                          ]
                        : []),
                    ]}
                  />
                ),
              },
            ]}
          />
        </Stack>
      ) : (
        <EmptyState description={t("alarms.empty")} title={t("common.emptyTitle")} />
      )}
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("organizations.delete")}
        description={t("alarms.confirmArchiveImpact")}
        entityName={archiveTarget?.node?.number ?? archiveTarget?.nodeId ?? ""}
        loading={archiving}
        onClose={() => {
          if (!archiving) setArchiveTarget(null);
        }}
        onConfirm={() => void archive()}
        opened={Boolean(archiveTarget)}
        title={t("alarms.confirmArchiveTitle")}
      />
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={tf("common.deleteSelected", { count: bulkArchiveIds.length })}
        description={t("alarms.confirmBulkArchiveImpact")}
        entityName={tf("alarms.selectedAlarmCount", { count: bulkArchiveIds.length })}
        loading={archiving}
        onClose={() => {
          if (!archiving) {
            setBulkArchiveOpen(false);
            setBulkArchiveIds([]);
          }
        }}
        onConfirm={() => void bulkArchive()}
        opened={bulkArchiveOpen}
        title={t("alarms.confirmBulkArchiveTitle")}
      />
    </Stack>
  );
}

function AlarmDetailPage({ basePath }: { basePath: BasePath }) {
  const { alarmId } = useParams();
  const { session } = useAuth();
  const [alarm, setAlarm] = useState<
    AlarmEventRecord & {
      notifications?: AlarmNotificationRecord[];
      policyTriggers?: Array<{
        countIntervalSeconds?: number;
        id: string;
        policy?: AlarmPolicyRecord;
        triggerOccurrenceCount?: number;
        triggeredAt?: string;
      }>;
    }
  >();
  const [error, setError] = useState(false);
  const [mutation, setMutation] = useState<"acknowledge" | "resolve" | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"notifications" | "triggers">("triggers");

  const load = useCallback(async () => {
    if (!session || !alarmId) return;
    setError(false);
    try {
      setAlarm(await apiRequest(session, endpoint(basePath, `/alarms/${alarmId}`)));
    } catch {
      setError(true);
    }
  }, [alarmId, basePath, session]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = async (action: "acknowledge" | "resolve") => {
    if (!session || !alarmId || mutation) return;
    setMutation(action);
    setMutationError(null);
    try {
      const updated = await apiRequest<AlarmEventRecord>(
        session,
        endpoint(basePath, `/alarms/${alarmId}/${action}`),
        {
          body: JSON.stringify({ note: "" }),
          method: "PATCH",
        },
      );
      setAlarm((current) => ({ ...current, ...updated }));
    } catch (caught) {
      const backendMessage =
        caught instanceof ApiError && caught.status >= 400 && caught.status < 500
          ? caught.message
          : "";
      if (action === "resolve") {
        setMutationError(
          backendMessage && !backendMessage.startsWith("API request failed with status")
            ? tf("alarms.resolveFailed", { message: backendMessage })
            : t("alarms.resolveFailedFallback"),
        );
      } else {
        setMutationError(
          backendMessage && !backendMessage.startsWith("API request failed with status")
            ? tf("alarms.actionFailed", { message: backendMessage })
            : t("alarms.actionFailedFallback"),
        );
      }
    } finally {
      setMutation(null);
    }
  };

  if (!alarm) return <LoadingState title={t("common.loading")} />;
  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  return (
    <Stack gap="lg">
      <PageHeader title={t("alarms.detailTitle")} subtitle={alarm.building?.title ?? ""} />
      <Group>
        <StatusValue value={alarm.severity} />
        <StatusValue value={alarm.status} />
        <Text size="sm">{alarm.node?.number}</Text>
        <Text size="sm">{formatDate(alarm.openedAt)}</Text>
      </Group>
      <Group>
        <Can permission="alarms.acknowledge">
          <Button
            disabled={alarm.status !== "OPEN" || Boolean(mutation)}
            loading={mutation === "acknowledge"}
            leftSection={<IconBellCheck size={16} />}
            onClick={() => void mutate("acknowledge")}
            variant="light"
          >
            {t("alarms.acknowledge")}
          </Button>
        </Can>
        <Can permission="alarms.resolve">
          <Button
            disabled={alarm.status === "RESOLVED" || Boolean(mutation)}
            loading={mutation === "resolve"}
            leftSection={<IconCheck size={16} />}
            onClick={() => void mutate("resolve")}
            variant="light"
          >
            {t("alarms.resolve")}
          </Button>
        </Can>
      </Group>
      {mutationError ? (
        <Text c="red" role="alert" size="sm">
          {mutationError}
        </Text>
      ) : null}
      <WorkspaceTabs
        ariaLabel={t("alarms.detailTitle")}
        items={[
          { label: t("alarms.triggers"), value: "triggers" },
          { label: t("app.notifications"), value: "notifications" },
        ]}
        onChange={(value) => setDetailTab(value as "notifications" | "triggers")}
        value={detailTab}
      />
      {detailTab === "triggers" ? (
        <DataTable
          rows={alarm.policyTriggers ?? []}
          columns={[
            {
              key: "channel",
              label: t("alarms.channel"),
              render: (row) => row.policy?.channel ?? "-",
            },
            {
              key: "count",
              label: t("alarms.occurrences"),
              render: (row) => String(row.triggerOccurrenceCount ?? "-"),
            },
          ]}
        />
      ) : (
        <DataTable
          rows={alarm.notifications ?? []}
          columns={[
            { key: "title", label: t("alarms.notification"), render: (row) => row.title },
            {
              key: "status",
              label: t("gatewayCommands.status"),
              render: (row) => <StatusValue value={row.status} />,
            },
            { key: "channel", label: t("alarms.channel"), render: (row) => row.channel },
            {
              key: "attempts",
              label: t("gatewayCommands.attempts"),
              render: (row) => `${row.attemptCount}/${row.maxAttempts}`,
            },
          ]}
        />
      )}
    </Stack>
  );
}

function AlarmRulesPage({ basePath }: { basePath: BasePath }) {
  const { session } = useAuth();
  const [rules, setRules] = useState<AlarmRuleRecord[]>();
  const [options, setOptions] = useState<RuleOptions>();
  const [providers, setProviders] = useState<ProviderStatus>();
  const [opened, setOpened] = useState(false);
  const [policyRule, setPolicyRule] = useState<AlarmRuleRecord | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<AlarmPolicyRecord | null>(null);
  const [viewingPolicy, setViewingPolicy] = useState<
    (AlarmPolicyRecord & { rule: AlarmRuleRecord; ruleName: string }) | null
  >(null);
  const [ruleDraft, setRuleDraft] = useState(createEmptyRuleDraft);
  const [policyDraft, setPolicyDraft] = useState(createEmptyPolicyDraft);
  const [policyFormError, setPolicyFormError] = useState<string | null>(null);
  const [policySaving, setPolicySaving] = useState(false);
  const [ruleNameError, setRuleNameError] = useState<string | null>(null);
  const [ruleFormError, setRuleFormError] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<CollectionPageSize>(50);
  const [total, setTotal] = useState(0);
  const [lifecycleTarget, setLifecycleTarget] = useState<{
    action: "ARCHIVE" | "STATUS";
    id: string;
    isActive: boolean;
    kind: "policy" | "rule";
    name: string;
  } | null>(null);
  const [mutating, setMutating] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setError(false);
    try {
      const [loadedRules, loadedOptions] = await Promise.all([
        apiRequest<ListResponse<AlarmRuleRecord>>(
          session,
          endpoint(basePath, `/alarm-rules?page=${page}&pageSize=${pageSize}`),
        ),
        apiRequest<RuleOptions>(session, endpoint(basePath, "/alarm-rules/options")),
      ]);
      setRules(loadedRules.items);
      setTotal(loadedRules.total);
      setOptions(loadedOptions);
      if (hasPermission(session, "notifications.manage")) {
        setProviders(
          await apiRequest<ProviderStatus>(
            session,
            endpoint(basePath, "/notifications/providers/status"),
          ),
        );
      }
    } catch {
      setError(true);
    }
  }, [basePath, page, pageSize, session]);

  useEffect(() => {
    void load();
  }, [load]);

  const building = options?.buildings.find((item) => item.id === policyDraft.buildingId);
  const targetPositions =
    options?.positions.filter((item) => item.companyId === building?.companyId && item.isActive) ??
    [];
  const targetUsers = options?.users.filter((item) => item.companyId === building?.companyId) ?? [];
  const providerText = useMemo(
    () =>
      providers?.providers
        .map(
          (provider) =>
            `${provider.channel}: ${provider.configured ? "configured" : "unconfigured"}`,
        )
        .join(" / ") ?? t("alarms.inAppOnly"),
    [providers],
  );

  const openCreateRule = () => {
    setRuleDraft(createEmptyRuleDraft());
    setRuleNameError(null);
    setRuleFormError(null);
    setOpened(true);
  };

  const closeCreateRule = () => {
    setOpened(false);
    setRuleDraft(createEmptyRuleDraft());
    setRuleNameError(null);
    setRuleFormError(null);
  };

  const createRule = async () => {
    if (!session) return;
    const name = ruleDraft.name.trim();
    setRuleNameError(null);
    setRuleFormError(null);
    if (!name) {
      setRuleNameError(t("alarms.nameRequired"));
      return;
    }
    if (name.length > alarmRuleNameMaxLength) {
      setRuleNameError(t("alarms.nameTooLong"));
      return;
    }
    try {
      await apiRequest(session, endpoint(basePath, "/alarm-rules"), {
        body: JSON.stringify({
          buildingId: ruleDraft.buildingId,
          name,
          nodeTypeId: ruleDraft.nodeTypeId,
          severity: ruleDraft.severity,
        }),
        method: "POST",
      });
      closeCreateRule();
      await load();
    } catch {
      setRuleFormError(t("alarms.ruleSaveFailed"));
    }
  };

  const savePolicy = async () => {
    if (!session || !policyRule || policySaving) return;
    setPolicySaving(true);
    setPolicyFormError(null);
    try {
      const path = editingPolicy
        ? `/alarm-policies/${editingPolicy.id}`
        : `/alarm-rules/${policyRule.id}/policies`;
      await apiRequest(session, endpoint(basePath, path), {
        body: JSON.stringify({
          channel: policyDraft.channel,
          countIntervalSeconds: policyDraft.countIntervalSeconds,
          positionId: policyDraft.targetType === "POSITION" ? policyDraft.positionId : undefined,
          requiredOccurrenceCount: policyDraft.requiredOccurrenceCount,
          specificUserId:
            policyDraft.targetType === "SPECIFIC_USER" ? policyDraft.specificUserId : undefined,
          targetType: policyDraft.targetType,
        }),
        method: editingPolicy ? "PATCH" : "POST",
      });
      setPolicyRule(null);
      setEditingPolicy(null);
      setPolicyDraft(createEmptyPolicyDraft());
      await load();
    } catch (error) {
      setPolicyFormError(error instanceof ApiError ? error.message : t("common.errorDescription"));
    } finally {
      setPolicySaving(false);
    }
  };

  const mutateLifecycle = async () => {
    if (!session || !lifecycleTarget || mutating) return;
    setMutating(true);
    try {
      const resource = lifecycleTarget.kind === "rule" ? "alarm-rules" : "alarm-policies";
      const path = endpoint(
        basePath,
        `/${resource}/${lifecycleTarget.id}${
          lifecycleTarget.action === "ARCHIVE" ? "" : "/status"
        }`,
      );
      await apiRequest(
        session,
        path,
        lifecycleTarget.action === "ARCHIVE"
          ? { method: "DELETE" }
          : { body: JSON.stringify({ isActive: !lifecycleTarget.isActive }), method: "PATCH" },
      );
      setViewingPolicy(null);
      setLifecycleTarget(null);
      await load();
    } finally {
      setMutating(false);
    }
  };

  const policies = (rules ?? []).flatMap((rule) =>
    (rule.recipientPolicies ?? []).map((policy) => ({
      ...policy,
      rule,
      ruleName: rule.name ?? rule.id,
    })),
  );
  const viewingTarget = viewingPolicy
    ? viewingPolicy.targetType === "POSITION"
      ? (options?.positions.find((item) => item.id === viewingPolicy.positionId)?.name ??
        viewingPolicy.positionId)
      : (options?.users.find((item) => item.id === viewingPolicy.specificUserId)?.name ??
        viewingPolicy.specificUserId)
    : null;

  if (!rules || !options) return <LoadingState title={t("common.loading")} />;
  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  return (
    <Stack gap="lg">
      <PageHeader
        title={t("alarms.rulesTitle")}
        subtitle={providerText}
        action={
          <Can permission="alarm-rules.manage">
            <Button leftSection={<IconPlus size={16} />} onClick={openCreateRule}>
              {t("alarms.createRule")}
            </Button>
          </Can>
        }
      />
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
      {rules.length ? (
        <DataTable
          rows={rules}
          columns={[
            {
              key: "name",
              label: t("organizations.name"),
              render: (row) => row.name ?? "-",
            },
            {
              key: "building",
              label: t("organizations.building"),
              render: (row) => row.building?.title ?? row.buildingId,
            },
            {
              key: "nodeType",
              label: t("devices.nodeType"),
              render: (row) => row.nodeType?.displayName ?? row.nodeTypeId,
            },
            {
              key: "severity",
              label: t("alarms.severity"),
              render: (row) => <StatusValue value={row.severity} />,
            },
            {
              key: "policies",
              label: t("alarms.policies"),
              render: (row) => String(row.recipientPolicies?.length ?? 0),
            },
            {
              key: "status",
              label: t("organizations.status"),
              render: (row) => <StatusValue value={row.isActive ? "ACTIVE" : "INACTIVE"} />,
            },
            {
              key: "actions",
              label: t("organizations.actions"),
              render: (row) => (
                <Can permission="alarm-rules.manage">
                  <EntityActionMenu
                    ariaLabel={`${t("common.moreActions")}: ${row.name ?? row.id}`}
                    items={[
                      ...(row.isActive
                        ? [
                            {
                              icon: <IconPlus size={16} />,
                              key: "add-policy",
                              label: t("alarms.addPolicy"),
                              onClick: () => {
                                setEditingPolicy(null);
                                setPolicyFormError(null);
                                setPolicyDraft({
                                  ...createEmptyPolicyDraft(),
                                  buildingId: row.buildingId,
                                });
                                setPolicyRule(row);
                              },
                            },
                          ]
                        : []),
                      {
                        icon: row.isActive ? (
                          <IconPlayerPause size={16} />
                        ) : (
                          <IconPlayerPlay size={16} />
                        ),
                        key: "status",
                        label: t(
                          row.isActive ? "organizations.deactivate" : "organizations.activate",
                        ),
                        onClick: () =>
                          setLifecycleTarget({
                            action: "STATUS",
                            id: row.id,
                            isActive: row.isActive,
                            kind: "rule",
                            name: row.name ?? row.id,
                          }),
                      },
                      {
                        color: "red",
                        destructive: true,
                        icon: <IconTrash size={16} />,
                        key: "archive",
                        label: t("organizations.delete"),
                        onClick: () =>
                          setLifecycleTarget({
                            action: "ARCHIVE",
                            id: row.id,
                            isActive: row.isActive,
                            kind: "rule",
                            name: row.name ?? row.id,
                          }),
                      },
                    ]}
                  />
                </Can>
              ),
            },
          ]}
        />
      ) : (
        <EmptyState description={t("alarms.emptyRules")} title={t("common.emptyTitle")} />
      )}
      {policies.length ? (
        <Stack gap="sm">
          <Text fw={650}>{t("alarms.policies")}</Text>
          <DataTable
            isRowSelected={(row) => viewingPolicy?.id === row.id}
            onRowClick={setViewingPolicy}
            rowAriaLabel={(row) => `${t("organizations.open")}: ${row.ruleName}`}
            rows={policies}
            columns={[
              { key: "rule", label: t("alarms.rulesTitle"), render: (row) => row.ruleName },
              {
                key: "target",
                label: t("alarms.recipientTarget"),
                render: (row) =>
                  row.targetType === "POSITION"
                    ? (options.positions.find((item) => item.id === row.positionId)?.name ??
                      row.positionId)
                    : (options.users.find((item) => item.id === row.specificUserId)?.name ??
                      row.specificUserId),
              },
              {
                key: "building",
                label: t("organizations.building"),
                render: (row) => row.rule.building?.title ?? row.rule.buildingId,
              },
              {
                key: "severity",
                label: t("alarms.severity"),
                render: (row) => <StatusValue value={row.rule.severity} />,
              },
              {
                key: "occurrences",
                label: t("alarms.requiredOccurrences"),
                render: (row) => String(row.requiredOccurrenceCount),
              },
              {
                key: "interval",
                label: t("alarms.countInterval"),
                render: (row) => tf("alarms.secondsValue", { count: row.countIntervalSeconds }),
              },
              { key: "channel", label: t("alarms.channel"), render: (row) => row.channel },
              {
                key: "status",
                label: t("organizations.status"),
                align: "left",
                render: (row) => <StatusValue value={row.isActive ? "ACTIVE" : "INACTIVE"} />,
              },
            ]}
          />
        </Stack>
      ) : null}
      <Drawer
        opened={Boolean(viewingPolicy)}
        onClose={() => setViewingPolicy(null)}
        position="right"
        size="min(100%, 520px)"
        title={t("alarms.policyDetails")}
      >
        {viewingPolicy ? (
          <Stack gap="lg">
            <Stack gap={4}>
              <Text fw={700} size="lg">
                {viewingPolicy.ruleName}
              </Text>
              <Text c="dimmed" size="sm">
                {viewingPolicy.rule.building?.company?.name
                  ? `${viewingPolicy.rule.building.company.name} / `
                  : ""}
                {viewingPolicy.rule.building?.area?.name
                  ? `${viewingPolicy.rule.building.area.name} / `
                  : ""}
                {viewingPolicy.rule.building?.title ?? viewingPolicy.rule.buildingId}
              </Text>
            </Stack>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <PolicyFact label={t("alarms.recipientTarget")} value={viewingTarget ?? "-"} />
              <PolicyFact
                label={t("alarms.severity")}
                value={<StatusValue value={viewingPolicy.rule.severity} />}
              />
              <PolicyFact
                label={t("devices.nodeType")}
                value={viewingPolicy.rule.nodeType?.displayName ?? viewingPolicy.rule.nodeTypeId}
              />
              <PolicyFact label={t("alarms.channel")} value={viewingPolicy.channel} />
              <PolicyFact
                label={t("alarms.requiredOccurrences")}
                value={viewingPolicy.requiredOccurrenceCount}
              />
              <PolicyFact
                label={t("alarms.countInterval")}
                value={tf("alarms.secondsValue", { count: viewingPolicy.countIntervalSeconds })}
              />
              <PolicyFact
                label={t("organizations.status")}
                value={<StatusValue value={viewingPolicy.isActive ? "ACTIVE" : "INACTIVE"} />}
              />
              <PolicyFact
                label={t("alarms.policyHistory")}
                value={tf("alarms.policyHistoryCounts", {
                  counters: viewingPolicy.history?.counters ?? 0,
                  notifications: viewingPolicy.history?.notifications ?? 0,
                  triggers: viewingPolicy.history?.triggers ?? 0,
                })}
              />
            </SimpleGrid>
            <Divider />
            <Can permission="alarm-rules.manage">
              <Group justify="space-between" wrap="wrap">
                <Group>
                  <Button
                    leftSection={<IconEdit size={16} />}
                    onClick={() => {
                      setPolicyRule(viewingPolicy.rule);
                      setEditingPolicy(viewingPolicy);
                      setPolicyDraft({
                        buildingId: viewingPolicy.rule.buildingId,
                        channel: viewingPolicy.channel,
                        countIntervalSeconds: viewingPolicy.countIntervalSeconds,
                        positionId: viewingPolicy.positionId ?? "",
                        requiredOccurrenceCount: viewingPolicy.requiredOccurrenceCount,
                        specificUserId: viewingPolicy.specificUserId ?? "",
                        targetType: viewingPolicy.targetType,
                      });
                      setViewingPolicy(null);
                    }}
                    variant="default"
                  >
                    {t("organizations.edit")}
                  </Button>
                  <Button
                    leftSection={
                      viewingPolicy.isActive ? (
                        <IconPlayerPause size={16} />
                      ) : (
                        <IconPlayerPlay size={16} />
                      )
                    }
                    onClick={() =>
                      setLifecycleTarget({
                        action: "STATUS",
                        id: viewingPolicy.id,
                        isActive: viewingPolicy.isActive,
                        kind: "policy",
                        name: `${viewingPolicy.ruleName} / ${viewingPolicy.channel}`,
                      })
                    }
                    variant="light"
                  >
                    {t(
                      viewingPolicy.isActive
                        ? "organizations.deactivate"
                        : "organizations.activate",
                    )}
                  </Button>
                </Group>
                <Button
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() =>
                    setLifecycleTarget({
                      action: "ARCHIVE",
                      id: viewingPolicy.id,
                      isActive: viewingPolicy.isActive,
                      kind: "policy",
                      name: `${viewingPolicy.ruleName} / ${viewingPolicy.channel}`,
                    })
                  }
                  variant="light"
                >
                  {t("organizations.delete")}
                </Button>
              </Group>
            </Can>
          </Stack>
        ) : null}
      </Drawer>
      <Modal opened={opened} onClose={closeCreateRule} size="lg" title={t("alarms.createRule")}>
        <FormWorkspace>
          <FormSection title={t("alarms.rulesTitle")}>
            <FormFieldGrid>
              <Select
                allowDeselect={false}
                data={options.buildings.map((item) => ({
                  label: item.company?.name ? `${item.company.name} / ${item.title}` : item.title,
                  value: item.id,
                }))}
                label={t("organizations.building")}
                onChange={(value) =>
                  setRuleDraft((current) => ({ ...current, buildingId: value ?? "" }))
                }
                value={ruleDraft.buildingId}
              />
              <Select
                allowDeselect={false}
                data={options.nodeTypes.map((item) => ({
                  label: item.displayName,
                  value: item.id,
                }))}
                label={t("devices.nodeType")}
                onChange={(value) =>
                  setRuleDraft((current) => ({ ...current, nodeTypeId: value ?? "" }))
                }
                value={ruleDraft.nodeTypeId}
              />
              <Select
                allowDeselect={false}
                data={severityOptions.map((item) => ({ label: item, value: item }))}
                label={t("alarms.severity")}
                onChange={(value) =>
                  setRuleDraft((current) => ({
                    ...current,
                    severity: (value ?? current.severity) as AlarmSeverity,
                  }))
                }
                value={ruleDraft.severity}
              />
              <TextInput
                error={ruleNameError}
                label={t("organizations.name")}
                maxLength={alarmRuleNameMaxLength}
                onChange={(event) => {
                  const name = event.currentTarget.value;
                  setRuleDraft((current) => ({ ...current, name }));
                  setRuleNameError(null);
                  setRuleFormError(null);
                }}
                value={ruleDraft.name}
              />
            </FormFieldGrid>
          </FormSection>
          {ruleFormError ? (
            <Text c="red" size="sm">
              {ruleFormError}
            </Text>
          ) : null}
          <StickyFormActions>
            <Button
              disabled={!ruleDraft.buildingId || !ruleDraft.nodeTypeId}
              onClick={() => void createRule()}
            >
              {t("organizations.save")}
            </Button>
          </StickyFormActions>
        </FormWorkspace>
      </Modal>
      <Modal
        opened={Boolean(policyRule)}
        onClose={() => {
          setPolicyRule(null);
          setEditingPolicy(null);
          setPolicyFormError(null);
          setPolicyDraft(createEmptyPolicyDraft());
        }}
        title={t(editingPolicy ? "alarms.editPolicy" : "alarms.addPolicy")}
      >
        <Stack>
          <Select
            allowDeselect={false}
            data={[
              { label: t("management.position"), value: "POSITION" },
              { label: t("alarms.specificUser"), value: "SPECIFIC_USER" },
            ]}
            label={t("alarms.recipientTarget")}
            onChange={(value) =>
              setPolicyDraft((current) => ({
                ...current,
                targetType: value === "SPECIFIC_USER" ? "SPECIFIC_USER" : "POSITION",
              }))
            }
            value={policyDraft.targetType}
          />
          {policyDraft.targetType === "POSITION" ? (
            <Select
              data={targetPositions.map((item) => ({ label: item.name, value: item.id }))}
              label={t("management.position")}
              onChange={(value) =>
                setPolicyDraft((current) => ({ ...current, positionId: value ?? "" }))
              }
              value={policyDraft.positionId}
            />
          ) : (
            <Select
              data={targetUsers.map((item) => ({ label: item.name, value: item.id }))}
              label={t("alarms.specificUser")}
              onChange={(value) =>
                setPolicyDraft((current) => ({ ...current, specificUserId: value ?? "" }))
              }
              value={policyDraft.specificUserId}
            />
          )}
          <Select
            allowDeselect={false}
            data={channelOptions.map((item) => ({ label: item, value: item }))}
            label={t("alarms.channel")}
            onChange={(value) =>
              setPolicyDraft((current) => ({ ...current, channel: value as AlarmChannel }))
            }
            value={policyDraft.channel}
          />
          <NumberInput
            label={t("alarms.requiredOccurrences")}
            min={1}
            onChange={(value) =>
              setPolicyDraft((current) => ({
                ...current,
                requiredOccurrenceCount: Number(value) || 1,
              }))
            }
            value={policyDraft.requiredOccurrenceCount}
          />
          <NumberInput
            label={t("alarms.countInterval")}
            min={0}
            onChange={(value) =>
              setPolicyDraft((current) => ({
                ...current,
                countIntervalSeconds: Number(value) || 0,
              }))
            }
            value={policyDraft.countIntervalSeconds}
          />
          {policyFormError ? (
            <Text c="red" size="sm">
              {policyFormError}
            </Text>
          ) : null}
          <StickyFormActions>
            <Button
              variant="default"
              onClick={() => {
                setPolicyRule(null);
                setEditingPolicy(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              disabled={
                policyDraft.targetType === "POSITION"
                  ? !policyDraft.positionId
                  : !policyDraft.specificUserId
              }
              loading={policySaving}
              onClick={() => void savePolicy()}
            >
              {t("organizations.save")}
            </Button>
          </StickyFormActions>
        </Stack>
      </Modal>
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t(
          lifecycleTarget?.action === "ARCHIVE"
            ? "organizations.delete"
            : lifecycleTarget?.isActive
              ? "organizations.deactivate"
              : "organizations.activate",
        )}
        description={t(
          lifecycleTarget?.action === "ARCHIVE"
            ? lifecycleTarget.kind === "rule"
              ? "alarms.confirmRuleArchiveImpact"
              : "alarms.confirmPolicyArchiveImpact"
            : lifecycleTarget?.isActive
              ? "organizations.confirmDeactivateImpact"
              : "organizations.confirmActivateImpact",
        )}
        entityName={lifecycleTarget?.name ?? ""}
        loading={mutating}
        onClose={() => {
          if (!mutating) setLifecycleTarget(null);
        }}
        onConfirm={() => void mutateLifecycle()}
        opened={Boolean(lifecycleTarget)}
        title={t(
          lifecycleTarget?.action === "ARCHIVE"
            ? "alarms.confirmConfigurationArchiveTitle"
            : lifecycleTarget?.isActive
              ? "organizations.confirmDeactivateTitle"
              : "organizations.confirmActivateTitle",
        )}
      />
    </Stack>
  );
}

function NotificationsPage({ basePath }: { basePath: BasePath }) {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<AlarmNotificationRecord[]>();
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<CollectionPageSize>(50);
  const [total, setTotal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<AlarmNotificationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    setError(false);
    try {
      const [items, count] = await Promise.all([
        apiRequest<ListResponse<AlarmNotificationRecord>>(
          session,
          endpoint(basePath, `/notifications?page=${page}&pageSize=${pageSize}`),
        ),
        apiRequest<{ unreadCount: number }>(
          session,
          endpoint(basePath, "/notifications/unread-count"),
        ),
      ]);
      setNotifications(items.items);
      setTotal(items.total);
      setUnreadCount(count.unreadCount);
      setSelectedIds((current) =>
        current.filter((id) => items.items.some((item) => item.id === id)),
      );
    } catch {
      setError(true);
    }
  }, [basePath, page, pageSize, session]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id: string) => {
    if (!session) return;
    await apiRequest(session, endpoint(basePath, `/notifications/${id}/read`), { method: "PATCH" });
    await load();
  };

  const markAll = async () => {
    if (!session) return;
    await apiRequest(session, endpoint(basePath, "/notifications/read-all"), { method: "PATCH" });
    await load();
  };

  const archiveNotification = async () => {
    if (!session || !deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await apiRequest(session, endpoint(basePath, `/notifications/${deleteTarget.id}`), {
        method: "DELETE",
      });
      setDeleteTarget(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  const bulkArchiveNotifications = async () => {
    if (!session || !selectedIds.length || deleting) return;
    setDeleting(true);
    try {
      await apiRequest(session, endpoint(basePath, "/notifications/bulk-archive"), {
        body: JSON.stringify({ ids: selectedIds }),
        method: "POST",
      });
      setBulkDeleteOpen(false);
      setSelectedIds([]);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  if (!notifications) return <LoadingState title={t("common.loading")} />;
  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  return (
    <Stack gap="lg">
      <PageHeader
        title={t("app.notifications")}
        subtitle={`${unreadCount} ${t("alarms.unread")}`}
        action={
          <Button
            leftSection={<IconCheck size={16} />}
            onClick={() => void markAll()}
            variant="light"
          >
            {t("alarms.markAllRead")}
          </Button>
        }
      />
      <CollectionPagination
        actions={
          notifications.length ? (
            <Group gap="xs">
              <Button
                onClick={() =>
                  setSelectedIds(
                    selectedIds.length === notifications.length
                      ? []
                      : notifications.map(({ id }) => id),
                  )
                }
                size="xs"
                variant="default"
              >
                {t(
                  selectedIds.length === notifications.length
                    ? "common.clearSelection"
                    : "common.selectAll",
                )}
              </Button>
              <Button
                color="red"
                disabled={!selectedIds.length}
                leftSection={<IconTrash size={14} />}
                onClick={() => setBulkDeleteOpen(true)}
                size="xs"
                variant="light"
              >
                {tf("common.deleteSelected", { count: selectedIds.length })}
              </Button>
            </Group>
          ) : undefined
        }
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
      {notifications.length ? (
        <DataTable
          rows={notifications}
          columns={[
            {
              key: "select",
              label: t("common.select"),
              render: (row) => (
                <Checkbox
                  aria-label={`${t("common.select")}: ${row.title}`}
                  checked={selectedIds.includes(row.id)}
                  onChange={(event) =>
                    setSelectedIds((current) =>
                      event.currentTarget.checked
                        ? [...new Set([...current, row.id])]
                        : current.filter((id) => id !== row.id),
                    )
                  }
                />
              ),
              width: 72,
            },
            { key: "title", label: t("alarms.notification"), render: (row) => row.title },
            { key: "body", label: t("alarms.message"), render: (row) => row.body },
            {
              key: "status",
              label: t("gatewayCommands.status"),
              render: (row) => <StatusValue value={row.status} />,
            },
            {
              key: "created",
              label: t("gatewayCommands.createdAt"),
              render: (row) => formatDate(row.createdAt),
            },
            {
              key: "actions",
              label: t("organizations.actions"),
              render: (row) => (
                <EntityActionMenu
                  ariaLabel={`${t("common.moreActions")}: ${row.title}`}
                  items={[
                    {
                      disabled: Boolean(row.readAt),
                      icon: <IconCheck size={16} />,
                      key: "read",
                      label: t("alarms.markRead"),
                      onClick: () => void markRead(row.id),
                    },
                    {
                      color: "red",
                      destructive: true,
                      icon: <IconTrash size={16} />,
                      key: "delete",
                      label: t("organizations.delete"),
                      onClick: () => setDeleteTarget(row),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      ) : (
        <EmptyState description={t("alarms.emptyNotifications")} title={t("common.emptyTitle")} />
      )}
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("organizations.delete")}
        description={t("alarms.confirmNotificationArchiveImpact")}
        entityName={deleteTarget?.title ?? ""}
        loading={deleting}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void archiveNotification()}
        opened={Boolean(deleteTarget)}
        title={t("alarms.confirmNotificationArchiveTitle")}
      />
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={tf("common.deleteSelected", { count: selectedIds.length })}
        description={t("alarms.confirmBulkNotificationArchiveImpact")}
        entityName={tf("alarms.selectedNotificationCount", { count: selectedIds.length })}
        loading={deleting}
        onClose={() => {
          if (!deleting) setBulkDeleteOpen(false);
        }}
        onConfirm={() => void bulkArchiveNotifications()}
        opened={bulkDeleteOpen}
        title={t("alarms.confirmBulkNotificationArchiveTitle")}
      />
    </Stack>
  );
}
