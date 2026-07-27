import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useAuthenticatedLogo, type LogoLoadStatus } from "./use-authenticated-logo";

interface CompanyBrandingValue {
  logoUrl?: string;
  refreshLogo: () => Promise<void>;
  status: LogoLoadStatus;
}

const CompanyBrandingContext = createContext<CompanyBrandingValue | undefined>(undefined);

export function CompanyBrandingProvider({ children }: { children: ReactNode }) {
  const branding = useAuthenticatedLogo("/company/branding/logo");
  const value = useMemo(() => branding, [branding.logoUrl, branding.refreshLogo, branding.status]);
  return (
    <CompanyBrandingContext.Provider value={value}>{children}</CompanyBrandingContext.Provider>
  );
}

export function useCompanyBranding(): CompanyBrandingValue {
  const value = useContext(CompanyBrandingContext);
  if (!value) throw new Error("useCompanyBranding must be used within CompanyBrandingProvider.");
  return value;
}
