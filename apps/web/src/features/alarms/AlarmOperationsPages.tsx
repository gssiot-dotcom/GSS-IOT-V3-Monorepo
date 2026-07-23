import type {
  AlarmChannel,
  AlarmEventRecord,
  AlarmNotificationRecord,
  AlarmPolicyRecord,
  AlarmRuleRecord,
  AlarmSeverity,
  BuildingRecord,
  CompanyPositionRecord,
  CompanyUserRecord,
  NodeTypeRecord,
} from "@gss-iot/contracts";
import {
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
} from "@gss-iot/ui";
import {
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { IconBellCheck, IconCheck, IconEye, IconPlus } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { t, tf } from "../../app/i18n";
import { ApiError, apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { Can } from "../../shared/rbac/Can";
import { hasPermission } from "../../shared/rbac/has-permission";

type BasePath = "/admin" | "/company";

interface ListResponse<T> {
  items: T[];
}

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

  const load = useCallback(async () => {
    if (!session) return;
    setError(false);
    try {
      const response = await apiRequest<ListResponse<AlarmEventRecord>>(
        session,
        endpoint(basePath, "/alarms"),
      );
      setAlarms(response.items);
    } catch {
      setError(true);
    }
  }, [basePath, session]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!alarms) return <LoadingState title={t("common.loading")} />;
  if (error)
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;

  return (
    <Stack gap="lg">
      <PageHeader title={t("alarms.title")} subtitle={t("alarms.subtitle")} />
      {alarms.length ? (
        <DataTable
          rows={alarms}
          columns={[
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
                  ]}
                />
              ),
            },
          ]}
        />
      ) : (
        <EmptyState description={t("alarms.empty")} title={t("common.emptyTitle")} />
      )}
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
      <Tabs defaultValue="triggers">
        <Tabs.List>
          <Tabs.Tab value="triggers">{t("alarms.triggers")}</Tabs.Tab>
          <Tabs.Tab value="notifications">{t("app.notifications")}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel pt="md" value="triggers">
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
        </Tabs.Panel>
        <Tabs.Panel pt="md" value="notifications">
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
        </Tabs.Panel>
      </Tabs>
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
  const [ruleDraft, setRuleDraft] = useState(createEmptyRuleDraft);
  const [policyDraft, setPolicyDraft] = useState(createEmptyPolicyDraft);
  const [ruleNameError, setRuleNameError] = useState<string | null>(null);
  const [ruleFormError, setRuleFormError] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setError(false);
    try {
      const [loadedRules, loadedOptions] = await Promise.all([
        apiRequest<ListResponse<AlarmRuleRecord>>(session, endpoint(basePath, "/alarm-rules")),
        apiRequest<RuleOptions>(session, endpoint(basePath, "/alarm-rules/options")),
      ]);
      setRules(loadedRules.items);
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
  }, [basePath, session]);

  useEffect(() => {
    void load();
  }, [load]);

  const building = options?.buildings.find((item) => item.id === policyDraft.buildingId);
  const targetPositions =
    options?.positions.filter((item) => item.companyId === building?.companyId) ?? [];
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

  const createPolicy = async () => {
    if (!session || !policyRule) return;
    await apiRequest(session, endpoint(basePath, `/alarm-rules/${policyRule.id}/policies`), {
      body: JSON.stringify({
        channel: policyDraft.channel,
        countIntervalSeconds: policyDraft.countIntervalSeconds,
        positionId: policyDraft.targetType === "POSITION" ? policyDraft.positionId : undefined,
        requiredOccurrenceCount: policyDraft.requiredOccurrenceCount,
        specificUserId:
          policyDraft.targetType === "SPECIFIC_USER" ? policyDraft.specificUserId : undefined,
        targetType: policyDraft.targetType,
      }),
      method: "POST",
    });
    setPolicyRule(null);
    setPolicyDraft(createEmptyPolicyDraft());
    await load();
  };

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
              key: "actions",
              label: t("organizations.actions"),
              render: (row) => (
                <Can permission="alarm-rules.manage">
                  <EntityActionMenu
                    ariaLabel={`${t("common.moreActions")}: ${row.name ?? row.id}`}
                    items={[
                      {
                        icon: <IconPlus size={16} />,
                        key: "add-policy",
                        label: t("alarms.addPolicy"),
                        onClick: () => {
                          setPolicyDraft({
                            ...createEmptyPolicyDraft(),
                            buildingId: row.buildingId,
                          });
                          setPolicyRule(row);
                        },
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
      <Modal opened={opened} onClose={closeCreateRule} title={t("alarms.createRule")}>
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
          setPolicyDraft(createEmptyPolicyDraft());
        }}
        title={t("alarms.addPolicy")}
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
          <StickyFormActions>
            <Button variant="default" onClick={() => setPolicyRule(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void createPolicy()}>{t("organizations.save")}</Button>
          </StickyFormActions>
        </Stack>
      </Modal>
    </Stack>
  );
}

function NotificationsPage({ basePath }: { basePath: BasePath }) {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<AlarmNotificationRecord[]>();
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setError(false);
    try {
      const [items, count] = await Promise.all([
        apiRequest<ListResponse<AlarmNotificationRecord>>(
          session,
          endpoint(basePath, "/notifications"),
        ),
        apiRequest<{ unreadCount: number }>(
          session,
          endpoint(basePath, "/notifications/unread-count"),
        ),
      ]);
      setNotifications(items.items);
      setUnreadCount(count.unreadCount);
    } catch {
      setError(true);
    }
  }, [basePath, session]);

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
      {notifications.length ? (
        <DataTable
          rows={notifications}
          columns={[
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
                  ]}
                />
              ),
            },
          ]}
        />
      ) : (
        <EmptyState description={t("alarms.emptyNotifications")} title={t("common.emptyTitle")} />
      )}
    </Stack>
  );
}
