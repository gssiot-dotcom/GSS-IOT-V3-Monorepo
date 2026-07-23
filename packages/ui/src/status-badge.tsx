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
  | "active"
  | "acknowledged"
  | "assigned"
  | "available"
  | "cancelled"
  | "caution"
  | "completed"
  | "connecting"
  | "danger"
  | "expired"
  | "failed"
  | "inactive"
  | "maintenance"
  | "offline"
  | "online"
  | "open"
  | "pending"
  | "processing"
  | "read"
  | "reconnecting"
  | "retired"
  | "safe"
  | "sent"
  | "skipped"
  | "resolved"
  | "stale"
  | "unassigned"
  | "unconfigured"
  | "unread"
  | "warning";

const statusConfig: Record<GssStatus, { color: string; icon: typeof IconCircleCheck }> = {
  active: { color: "gss", icon: IconCircleCheck },
  acknowledged: { color: "blue", icon: IconCircleCheckFilled },
  assigned: { color: "gss", icon: IconCircleCheck },
  available: { color: "blue", icon: IconCircleCheck },
  cancelled: { color: "gray", icon: IconPlugConnectedX },
  caution: { color: "green", icon: IconShieldCheck },
  completed: { color: "green", icon: IconCircleCheck },
  connecting: { color: "yellow", icon: IconClock },
  danger: { color: "red", icon: IconAlertTriangle },
  expired: { color: "orange", icon: IconClock },
  failed: { color: "red", icon: IconAlertTriangle },
  inactive: { color: "gray", icon: IconPlugConnectedX },
  maintenance: { color: "orange", icon: IconClock },
  offline: { color: "gray", icon: IconPlugConnectedX },
  online: { color: "green", icon: IconCircleCheck },
  open: { color: "red", icon: IconAlertTriangle },
  pending: { color: "yellow", icon: IconClock },
  processing: { color: "yellow", icon: IconClock },
  read: { color: "gray", icon: IconCircleCheck },
  reconnecting: { color: "orange", icon: IconClock },
  retired: { color: "gray", icon: IconPlugConnectedX },
  safe: { color: "gss", icon: IconCircleCheck },
  sent: { color: "blue", icon: IconClock },
  skipped: { color: "gray", icon: IconPlugConnectedX },
  resolved: { color: "green", icon: IconCircleCheckFilled },
  stale: { color: "orange", icon: IconClock },
  unassigned: { color: "gray", icon: IconQuestionMark },
  unconfigured: { color: "gray", icon: IconQuestionMark },
  unread: { color: "blue", icon: IconExclamationCircle },
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
