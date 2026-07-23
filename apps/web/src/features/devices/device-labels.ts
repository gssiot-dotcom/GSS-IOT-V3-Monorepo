import type { DeviceLifecycleStatus, GatewayCommandStatus, GatewayType } from "@gss-iot/contracts";
import { StatusBadge, type GssStatus } from "@gss-iot/ui";
import type { ReactNode } from "react";

import { t } from "../../app/i18n";

export function deviceStatusLabel(status: DeviceLifecycleStatus): string {
  if (status === "ACTIVE") return t("devices.statusActive");
  if (status === "INACTIVE") return t("devices.statusInactive");
  return t("devices.statusRetired");
}

export function gatewayTypeLabel(type: GatewayType): string {
  if (type === "NODES_GATEWAY") return t("devices.typeNodesGateway");
  return t("devices.typeSecurityOfficeGateway");
}

export function deviceLifecycleStatus(status: DeviceLifecycleStatus): GssStatus {
  if (status === "ACTIVE") return "active";
  if (status === "INACTIVE") return "inactive";
  return "retired";
}

export function deviceLifecycleBadge(status: DeviceLifecycleStatus): ReactNode {
  return StatusBadge({ label: deviceStatusLabel(status), status: deviceLifecycleStatus(status) });
}

export function deviceConnectivityBadge(lastSeenAt: string | null): ReactNode {
  return StatusBadge({
    label: lastSeenAt ? t("status.online") : t("status.offline"),
    status: lastSeenAt ? "online" : "offline",
  });
}

export function formatDeviceDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : t("common.notAvailable");
}

export function gatewayCommandStatusBadge(status: GatewayCommandStatus): ReactNode {
  const statusMap: Record<GatewayCommandStatus, GssStatus> = {
    ACKNOWLEDGED: "acknowledged",
    CANCELLED: "cancelled",
    EXPIRED: "cancelled",
    FAILED: "failed",
    PENDING: "pending",
    SENT: "sent",
  };
  const labelMap: Record<GatewayCommandStatus, string> = {
    ACKNOWLEDGED: t("status.acknowledged"),
    CANCELLED: t("status.cancelled"),
    EXPIRED: t("status.expired"),
    FAILED: t("status.failed"),
    PENDING: t("status.pending"),
    SENT: t("status.sent"),
  };
  return StatusBadge({ label: labelMap[status], status: statusMap[status] });
}
