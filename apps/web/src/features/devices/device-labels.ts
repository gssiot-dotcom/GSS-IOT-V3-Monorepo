import type { DeviceLifecycleStatus, GatewayType } from "@gss-iot/contracts";

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
