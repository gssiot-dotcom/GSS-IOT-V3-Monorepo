import { Paper } from "@mantine/core";
import { Portal } from "@mantine/core";
import type { ReactNode } from "react";

export interface ChartTooltipState {
  content: ReactNode;
  x: number;
  y: number;
}

export function ChartTooltip({ id, state }: { id: string; state?: ChartTooltipState }) {
  if (!state) return null;

  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const left = Math.min(Math.max(state.x, 136), Math.max(136, viewportWidth - 136));
  const placeBelow = state.y < 150;

  return (
    <Portal>
      <Paper
        aria-live="polite"
        id={id}
        p="sm"
        role="tooltip"
        shadow="lg"
        style={{
          left,
          maxWidth: 260,
          pointerEvents: "none",
          position: "fixed",
          top: placeBelow ? state.y + 14 : state.y - 14,
          transform: placeBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)",
          width: "max-content",
          zIndex: 10000,
        }}
        withBorder
      >
        {state.content}
      </Paper>
    </Portal>
  );
}

export function chartTooltipPosition(target: SVGElement) {
  const bounds = target.getBoundingClientRect();
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  };
}
