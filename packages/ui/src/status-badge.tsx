import { Badge } from "@mantine/core";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconExclamationCircle,
  IconClock,
  IconCircleCheckFilled,
  IconQuestionMark,
  IconPlugConnectedX,
  IconShieldCheck,
} from "@tabler/icons-react";

export type GssStatus =
  | "acknowledged"
  | "caution"
  | "danger"
  | "failed"
  | "offline"
  | "online"
  | "pending"
  | "safe"
  | "stale"
  | "unconfigured"
  | "warning";

const statusConfig: Record<GssStatus, { color: string; icon: typeof IconCircleCheck }> = {
  acknowledged: { color: "blue", icon: IconCircleCheckFilled },
  caution: { color: "green", icon: IconShieldCheck },
  danger: { color: "red", icon: IconAlertTriangle },
  failed: { color: "red", icon: IconAlertTriangle },
  offline: { color: "gray", icon: IconPlugConnectedX },
  online: { color: "green", icon: IconCircleCheck },
  pending: { color: "yellow", icon: IconClock },
  safe: { color: "gss", icon: IconCircleCheck },
  stale: { color: "orange", icon: IconClock },
  unconfigured: { color: "gray", icon: IconQuestionMark },
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
