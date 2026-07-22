import { Center, Group, Stack } from "@mantine/core";

type LedPosition = "center" | "up" | "down" | "left" | "right" | "none";

export function TShapeStatusIndicator({
  activePosition,
  color,
  label,
}: {
  activePosition: LedPosition;
  color: string;
  label: string;
}) {
  const led = (position: LedPosition, size = 11) => (
    <Center
      aria-hidden="true"
      bg={activePosition === position ? color : "gray.2"}
      h={size}
      style={{
        border:
          activePosition === position
            ? `2px solid ${color}`
            : "1px solid var(--mantine-color-gray-4)",
        borderRadius: "50%",
        boxShadow: activePosition === position ? `0 0 12px ${color}` : "none",
      }}
      w={size}
    />
  );

  return (
    <Stack align="center" aria-label={label} gap={4} role="img">
      {led("up")}
      <Group gap={6}>
        {led("left")}
        {led("center", 14)}
        {led("right")}
      </Group>
      {led("down")}
    </Stack>
  );
}

export type { LedPosition };
