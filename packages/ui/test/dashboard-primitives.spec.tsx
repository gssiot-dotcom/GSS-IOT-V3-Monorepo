import { describe, expect, it, vi } from "vitest";

import {
  CompactActionMenu,
  ConfirmActionModal,
  ContextSectionLayout,
  DataTable,
  EntityCard,
  EntityCardGrid,
  EntityActionMenu,
  EntityPrimaryCell,
  EntityStatusBadge,
  FormSection,
  isInteractiveTarget,
  PageContainer,
  DashboardKpiCard,
  DashboardSection,
  PageHeader,
  ModalFormFooter,
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
    const tableChildren = Array.isArray(table.props.children)
      ? table.props.children
      : [table.props.children];
    const scrollContainer = tableChildren.find(Boolean);
    expect(scrollContainer.props.children.props["aria-label"]).toBe("Gateway inventory");
  });

  it("treats the dots SVG and menu descendants as row actions for pointer and keyboard guards", () => {
    const button = document.createElement("button");
    const dotsSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dotsSvg.append(dot);
    button.append(dotsSvg);

    const menuItem = document.createElement("div");
    menuItem.setAttribute("role", "menuitem");
    const menuIcon = document.createElementNS("http://www.w3.org/2000/svg", "path");
    menuItem.append(menuIcon);

    expect(isInteractiveTarget(dot)).toBe(true);
    expect(isInteractiveTarget(menuIcon)).toBe(true);
    expect(isInteractiveTarget(button, button)).toBe(false);
    expect(isInteractiveTarget(document.createElement("span"))).toBe(false);
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

  it("exposes the Wave 1 action and confirmation contract", () => {
    const primary = EntityPrimaryCell({
      identifier: "GSS-001",
      onClick: vi.fn(),
      title: "Acme Safety",
    });
    const status = EntityStatusBadge({ label: "Active", status: "active" });
    const menu = EntityActionMenu({
      ariaLabel: "Company actions",
      items: [
        { key: "open", label: "Open", onClick: vi.fn() },
        { destructive: true, key: "deactivate", label: "Deactivate", onClick: vi.fn() },
      ],
    });
    const footer = ModalFormFooter({
      cancelLabel: "Cancel",
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
      submitLabel: "Save",
    });
    const confirmation = ConfirmActionModal({
      cancelLabel: "Cancel",
      confirmLabel: "Deactivate",
      description: "Reversible",
      entityName: "Acme Safety",
      onClose: vi.fn(),
      onConfirm: vi.fn(),
      opened: true,
      title: "Confirm deactivation",
    });

    expect(primary.props.className).toBe("gss-entity-primary-button");
    expect(status.props.status).toBe("active");
    expect(menu.props["aria-label"]).toBe("Company actions");
    expect(footer.props.className).toBe("gss-modal-form-footer");
    expect(confirmation.props.opened).toBe(true);
  });
});
