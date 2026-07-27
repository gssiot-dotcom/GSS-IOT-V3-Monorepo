import { Tabs } from "@mantine/core";
import type { ReactNode } from "react";

export interface WorkspaceTabItem {
  label: ReactNode;
  value: string;
  disabled?: boolean;
}

export function WorkspaceTabs({
  ariaLabel,
  items,
  onChange,
  value,
}: {
  ariaLabel: string;
  items: WorkspaceTabItem[];
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Tabs
      className="gss-workspace-tabs"
      keepMounted={false}
      onChange={(nextValue) => nextValue && onChange(nextValue)}
      value={value}
    >
      <Tabs.List aria-label={ariaLabel} className="gss-workspace-tabs-list">
        {items.map((item) => (
          <Tabs.Tab disabled={item.disabled} key={item.value} value={item.value}>
            {item.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
