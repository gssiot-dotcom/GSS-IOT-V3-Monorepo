import { Box, Group, Text } from "@mantine/core";
import { IconActivity } from "@tabler/icons-react";

export interface GssPlatformBrandProps {
  compact?: boolean;
  label: string;
}

export function GssPlatformBrand({ compact = false, label }: GssPlatformBrandProps) {
  return (
    <Group aria-label={label} gap="sm" wrap="nowrap">
      <Box
        aria-hidden="true"
        style={{
          alignItems: "center",
          background:
            "linear-gradient(135deg, var(--mantine-color-gssCyan-5), var(--mantine-color-gss-6))",
          borderRadius: "var(--mantine-radius-md)",
          boxShadow: "0 6px 18px color-mix(in srgb, var(--mantine-color-gss-6) 28%, transparent)",
          color: "white",
          display: "flex",
          flex: "0 0 auto",
          height: 34,
          justifyContent: "center",
          width: 34,
        }}
      >
        <IconActivity size={21} stroke={2.25} />
      </Box>
      {!compact ? (
        <Text fw={800} size="sm" style={{ letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
          {label}
        </Text>
      ) : null}
    </Group>
  );
}
