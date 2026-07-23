import { describe, expect, it, vi } from "vitest";

import {
  CompactActionMenu,
  ContextSectionLayout,
  DataTable,
  EntityCard,
  EntityCardGrid,
  FormSection,
  PageContainer,
  DashboardKpiCard,
  DashboardSection,
  PageHeader,
  RealtimeStatusBadge,
  ResponsiveContentGrid,
  SectionHeader,
} from "../src";

describe("dashboard primitives", () => {
  it("keeps KPI and section primitives data-driven", () => {
    const kpi = DashboardKpiCard({ label: "Gateways", value: 12, hint: "3 offline" });
    const section = DashboardSection({ children: "content", title: "Overview" });
    const header = SectionHeader({ action: "action", subtitle: "Scope", title: "Overview" });

    expect(kpi.props.h).toBe("100%");
    expect(section.props.children).toHaveLength(2);
    expect(header.props.children).toHaveLength(2);
  });

  it("provides accessible action, responsive-grid and realtime foundations", () => {
    const menu = CompactActionMenu({
      ariaLabel: "Gateway actions",
      items: [{ key: "view", label: "View", onClick: vi.fn() }],
    });
    const grid = ResponsiveContentGrid({ children: "content" });
    const badge = RealtimeStatusBadge({ label: "Connected", status: "connected" });

    expect(menu.props["aria-label"]).toBe("Gateway actions");
    expect(grid.props.cols).toEqual({ base: 1, lg: 4, sm: 2 });
    expect(badge.props.children).toBe("Connected");
  });

  it("keeps shared page headers and tables responsive and nameable", () => {
    const header = PageHeader({ action: "action", subtitle: "Scope", title: "Overview" });
    const table = DataTable({
      ariaLabel: "Gateway inventory",
      caption: "Current gateway inventory",
      columns: [
        { key: "name", label: "Name", render: (row: { id: string; name: string }) => row.name },
      ],
      rows: [{ id: "gateway-1", name: "Gateway 1" }],
    });

    expect(header.props.wrap).toBe("wrap");
    expect(table.props.children.props["aria-label"]).toBe("Gateway inventory");
  });

  it("exposes reusable redesign primitives without owning domain behavior", () => {
    const card = EntityCard({ description: "North site", title: "Company A" });
    const grid = EntityCardGrid({ children: card });
    const page = PageContainer({ children: "content" });
    const layout = ContextSectionLayout({ children: "content", navigation: "navigation" });
    const section = FormSection({ children: "fields", title: "Identity" });

    expect(card.props.className).toBe("gss-entity-card");
    expect(grid.props.cols).toEqual({ base: 1, lg: 3, xs: 2 });
    expect(page.props.className).toBe("gss-page-container");
    expect(layout.props.children).toHaveLength(2);
    expect(section.props.className).toBe("gss-form-section");
  });
});
