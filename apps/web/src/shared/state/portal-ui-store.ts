import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type PortalMonitoringView = "CARD" | "TABLE";

interface PortalUiState {
  adminMonitoringView: PortalMonitoringView;
  companyMonitoringView: PortalMonitoringView;
  setAdminMonitoringView: (view: PortalMonitoringView) => void;
  setCompanyMonitoringView: (view: PortalMonitoringView) => void;
}

const STORE_KEY = "gss.portal-ui.v1";
const LEGACY_ADMIN_KEY = "gss.monitoring.admin.view";
const LEGACY_COMPANY_KEY = "gss.monitoring.view";

function monitoringView(value: string | null): PortalMonitoringView | undefined {
  return value === "CARD" || value === "TABLE" ? value : undefined;
}

function portalUiStorage(): StateStorage {
  return {
    getItem: (name) => {
      const current = window.localStorage.getItem(name);
      if (current) return current;
      const adminMonitoringView = monitoringView(window.localStorage.getItem(LEGACY_ADMIN_KEY));
      const companyMonitoringView = monitoringView(window.localStorage.getItem(LEGACY_COMPANY_KEY));
      if (!adminMonitoringView && !companyMonitoringView) return null;
      return JSON.stringify({
        state: {
          adminMonitoringView: adminMonitoringView ?? "TABLE",
          companyMonitoringView: companyMonitoringView ?? "TABLE",
        },
        version: 0,
      });
    },
    removeItem: (name) => window.localStorage.removeItem(name),
    setItem: (name, value) => {
      window.localStorage.setItem(name, value);
      // Legacy values are removed only after the versioned store write succeeds.
      window.localStorage.removeItem(LEGACY_ADMIN_KEY);
      window.localStorage.removeItem(LEGACY_COMPANY_KEY);
    },
  };
}

export const usePortalUiStore = create<PortalUiState>()(
  persist(
    (set) => ({
      adminMonitoringView: "TABLE",
      companyMonitoringView: "TABLE",
      setAdminMonitoringView: (adminMonitoringView) => set({ adminMonitoringView }),
      setCompanyMonitoringView: (companyMonitoringView) => set({ companyMonitoringView }),
    }),
    {
      migrate: (persisted) =>
        persisted as Pick<PortalUiState, "adminMonitoringView" | "companyMonitoringView">,
      name: STORE_KEY,
      partialize: ({ adminMonitoringView, companyMonitoringView }) => ({
        adminMonitoringView,
        companyMonitoringView,
      }),
      storage: createJSONStorage(portalUiStorage),
      version: 1,
    },
  ),
);
