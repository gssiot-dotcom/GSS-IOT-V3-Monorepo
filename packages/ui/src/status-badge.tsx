import { Badge } from "@mantine/core";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconExclamationCircle,
  IconPlugConnectedX,
  IconShieldCheck,
} from "@tabler/icons-react";

export type GssStatus = "caution" | "danger" | "offline" | "safe" | "warning";

const statusConfig: Record<GssStatus, { color: string; icon: typeof IconCircleCheck }> = {
  caution: { color: "green", icon: IconShieldCheck },
  danger: { color: "red", icon: IconAlertTriangle },
  offline: { color: "gray", icon: IconPlugConnectedX },
  safe: { color: "gss", icon: IconCircleCheck },
  warning: { color: "yellow", icon: IconExclamationCircle },
};

export function StatusBadge({ label, status }: { label: string; status: GssStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge color={config.color} leftSection={<Icon size={12} />} variant="light">
      {label}
    </Badge>
  );
}
