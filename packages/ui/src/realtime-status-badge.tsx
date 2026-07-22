import { Badge, type MantineColor } from "@mantine/core";
import { IconPlugConnected, IconPlugOff, IconRefresh, IconWifi } from "@tabler/icons-react";
import type { ReactNode } from "react";

export type RealtimeConnectionState =
  "connected" | "connecting" | "idle" | "offline" | "reconnecting";

export interface RealtimeStatusBadgeProps {
  status: RealtimeConnectionState;
  label: string;
}

const statusConfig: Record<RealtimeConnectionState, { color: MantineColor; icon: ReactNode }> = {
  connected: { color: "gss", icon: <IconWifi size={14} /> },
  connecting: { color: "yellow", icon: <IconRefresh size={14} /> },
  idle: { color: "gray", icon: <IconPlugConnected size={14} /> },
  offline: { color: "gray", icon: <IconPlugOff size={14} /> },
  reconnecting: { color: "yellow", icon: <IconRefresh size={14} /> },
};

export function RealtimeStatusBadge({ label, status }: RealtimeStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge color={config.color} leftSection={config.icon} variant="light">
      {label}
    </Badge>
  );
}
